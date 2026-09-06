import express from 'express';
import prisma from '../prisma.js';
import { verifyToken, requireRole, requireOwnerOfGym } from '../middleware/auth.js';

const router = express.Router();

// GET /api/gyms - Discovery listing with optional query filters
router.get('/', async (req, res) => {
  const { search, city, facility, minPrice, maxPrice, rating, isApproved } = req.query;

  // Build prisma query options
  let where = {};

  // Standard users only see approved gyms
  if (isApproved === 'false' && req.headers['authorization']) {
    // If request contains authorization, check if it's admin asking for pending listings
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      const JWT_SECRET = process.env.JWT_SECRET || 'fithub-super-secret-key-12345';
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role === 'ADMIN') {
        where.isApproved = false;
      } else {
        where.isApproved = true;
      }
    } catch (e) {
      where.isApproved = true;
    }
  } else {
    where.isApproved = true;
  }

  if (city) {
    where.city = { contains: city, lte: undefined }; // Case insensitive is tricky in SQLite, contains is default case-insensitive in SQLite
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
      { address: { contains: search } }
    ];
  }

  if (minPrice || maxPrice) {
    where.plans = {
      some: {
        price: {
          ...(minPrice && { gte: parseFloat(minPrice) }),
          ...(maxPrice && { lte: parseFloat(maxPrice) }),
        }
      }
    };
  }

  try {
    let gyms = await prisma.gym.findMany({
      where,
      orderBy: [
        { isFeatured: 'desc' },
        { priorityOrder: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        owner: {
          select: { id: true, name: true, email: true, phone: true, avatar: true, lastLoginAt: true }
        },
        facilities: {
          include: {
            facility: true
          }
        },
        plans: true,
        reviews: true,
        photos: true,
      }
    });

    // Attach trial calculation info to each gym
    const processedGyms = gyms.map(gym => {
      const startDate = new Date(gym.trialStartDate || gym.createdAt);
      const trialDaysTotal = (gym.trialMonths || 3) * 30;
      const diffTime = Date.now() - startDate.getTime();
      const daysPassed = Math.floor(diffTime / (1000 * 3600 * 24));
      const remainingTrialDays = Math.max(0, trialDaysTotal - daysPassed);
      const isTrialExpired = remainingTrialDays <= 0 && !gym.isSubscriptionPaid;

      return {
        ...gym,
        trialMonths: gym.trialMonths || 3,
        remainingTrialDays,
        isTrialExpired,
        trialStatus: gym.isSubscriptionPaid ? 'SUBSCRIBED' : isTrialExpired ? 'EXPIRED' : 'TRIAL_ACTIVE'
      };
    });

    let filteredGyms = processedGyms;

    // Client-side facility filter
    if (facility) {
      filteredGyms = filteredGyms.filter(gym => 
        gym.facilities.some(gf => gf.facility.name.toLowerCase() === facility.toString().toLowerCase())
      );
    }

    // Client-side rating filter
    if (rating) {
      const minRating = parseFloat(rating);
      filteredGyms = filteredGyms.filter(gym => {
        if (gym.reviews.length === 0) return false;
        const avg = gym.reviews.reduce((acc, r) => acc + r.rating, 0) / gym.reviews.length;
        return avg >= minRating;
      });
    }

    // Ensure priority & featured ordering is preserved after filters
    filteredGyms.sort((a, b) => {
      if (a.isFeatured !== b.isFeatured) return b.isFeatured ? 1 : -1;
      if (a.priorityOrder !== b.priorityOrder) return (b.priorityOrder || 0) - (a.priorityOrder || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return res.json(filteredGyms);
  } catch (error) {
    console.error('Fetch gyms error:', error);
    return res.status(500).json({ error: 'Failed to search gyms.' });
  }
});

// GET /api/gyms/admin/pending - Get pending approvals (Admin only)
router.get('/admin/pending', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const gyms = await prisma.gym.findMany({
      where: { isApproved: false },
      include: {
        owner: {
          select: { name: true, email: true }
        }
      }
    });
    return res.json(gyms);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch pending gyms.' });
  }
});

// GET /api/gyms/:id - Detailed profile view
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const gym = await prisma.gym.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        facilities: {
          include: {
            facility: true
          }
        },
        plans: true,
        photos: true,
        updates: {
          orderBy: { createdAt: 'desc' }
        },
        reviews: {
          include: {
            customer: {
              select: { id: true, name: true, avatar: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!gym) {
      return res.status(404).json({ error: 'Gym profile not found.' });
    }

    return res.json(gym);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch gym details.' });
  }
});

// POST /api/gyms - Create Gym Profile (Gym Owner only)
router.post('/', verifyToken, requireRole(['GYM_OWNER']), async (req, res) => {
  const { name, description, address, city, latitude, longitude, contactNumber, email, logo, coverImage, openingHours, freeTrialDays } = req.body;

  if (!name || !description || !address || !city || !contactNumber || !email) {
    return res.status(400).json({ error: 'Missing required gym details.' });
  }

  try {
    const existingGym = await prisma.gym.findUnique({
      where: { ownerId: req.user.id }
    });

    if (existingGym) {
      return res.status(400).json({ error: 'Each Gym Owner can only list one gym profile.' });
    }

    const newGym = await prisma.gym.create({
      data: {
        ownerId: req.user.id,
        name,
        description,
        address,
        city,
        latitude: parseFloat(latitude) || 26.9124,
        longitude: parseFloat(longitude) || 75.7873,
        contactNumber,
        email,
        logo: logo || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=300',
        coverImage: coverImage || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200',
        openingHours: openingHours || '06:00 AM - 10:00 PM',
        trialMonths: freeTrialDays !== undefined ? Math.max(1, parseInt(freeTrialDays)) : 3,
        isApproved: true, // Direct approval on registration as requested
      }
    });

    return res.status(201).json(newGym);
  } catch (error) {
    console.error('Create gym error:', error);
    return res.status(500).json({ error: 'Failed to create gym profile.' });
  }
});

// PUT /api/gyms/:id - Update profile
router.put('/:id', verifyToken, requireOwnerOfGym, async (req, res) => {
  const { id } = req.params;
  const { name, description, address, city, latitude, longitude, contactNumber, email, logo, coverImage, openingHours, freeTrialDays } = req.body;

  try {
    const updatedGym = await prisma.gym.update({
      where: { id },
      data: {
        name,
        description,
        address,
        city,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        contactNumber,
        email,
        logo,
        coverImage,
        openingHours,
        trialMonths: freeTrialDays !== undefined ? Math.max(1, parseInt(freeTrialDays)) : undefined
      }
    });

    return res.json(updatedGym);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update gym profile.' });
  }
});

// POST /api/gyms/:id/approve - Approve gym (Admin only)
router.put('/:id/approve', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  try {
    const gym = await prisma.gym.update({
      where: { id },
      data: { isApproved: true }
    });

    // Notify the gym owner
    await prisma.notification.create({
      data: {
        userId: gym.ownerId,
        title: 'Gym Profile Approved!',
        message: `Your gym listing "${gym.name}" has been approved by the admin and is now public.`
      }
    });

    return res.json({ message: 'Gym listing approved successfully.', gym });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to approve gym.' });
  }
});

// POST /api/gyms/:id/reject - Suspend/Reject gym (Admin only)
router.put('/:id/reject', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  try {
    const gym = await prisma.gym.update({
      where: { id },
      data: { isApproved: false }
    });

    // Notify the owner
    await prisma.notification.create({
      data: {
        userId: gym.ownerId,
        title: 'Gym Listing Suspended',
        message: `Your gym listing "${gym.name}" has been deactivated or rejected by the admin. Contact support.`
      }
    });

    return res.json({ message: 'Gym listing deactivated successfully.', gym });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to deactivate gym.' });
  }
});

// DELETE /api/gyms/admin/:id - Completely delete fake or violating gym (Admin only)
router.delete('/admin/:id', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.gym.delete({ where: { id } });
    return res.json({ message: 'Gym listing deleted successfully.' });
  } catch (error) {
    console.error('Delete gym error:', error);
    return res.status(500).json({ error: 'Failed to delete gym listing.' });
  }
});

// POST /api/gyms/:id/facilities - Edit Facilities (Many-to-Many updates)
router.post('/:id/facilities', verifyToken, requireOwnerOfGym, async (req, res) => {
  const { id } = req.params;
  const { facilityIds } = req.body; // Array of facility IDs

  if (!Array.isArray(facilityIds)) {
    return res.status(400).json({ error: 'facilityIds must be an array.' });
  }

  try {
    // Clear old associations
    await prisma.gymFacility.deleteMany({
      where: { gymId: id }
    });

    // Batch create new associations
    const associations = facilityIds.map(fid => ({
      gymId: id,
      facilityId: fid
    }));

    await prisma.gymFacility.createMany({
      data: associations
    });

    return res.json({ message: 'Facilities updated successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update facilities.' });
  }
});

// POST /api/gyms/:id/plans - Add membership plan
router.post('/:id/plans', verifyToken, requireOwnerOfGym, async (req, res) => {
  const { id } = req.params;
  const { name, price, durationDays, description, features } = req.body;

  if (!name || !price || !durationDays) {
    return res.status(400).json({ error: 'Plan name, price, and duration are required.' });
  }

  try {
    const newPlan = await prisma.membershipPlan.create({
      data: {
        gymId: id,
        name,
        price: parseFloat(price),
        durationDays: parseInt(durationDays),
        description: description || '',
        features: features || '',
      }
    });

    return res.status(201).json(newPlan);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create membership plan.' });
  }
});

// DELETE /api/plans/:planId - Delete membership plan
router.delete('/plans/:planId', verifyToken, async (req, res) => {
  const { planId } = req.params;

  try {
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: planId },
      include: { gym: true }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found.' });
    }

    // Verify owner
    if (plan.gym.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await prisma.membershipPlan.delete({
      where: { id: planId }
    });

    return res.json({ message: 'Plan deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete plan.' });
  }
});

// POST /api/gyms/:id/updates - Publish a gym news update
router.post('/:id/updates', verifyToken, requireOwnerOfGym, async (req, res) => {
  const { id } = req.params;
  const { title, description, imageUrl } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required for gym updates.' });
  }

  try {
    const update = await prisma.gymUpdate.create({
      data: {
        gymId: id,
        title,
        description,
        imageUrl,
      }
    });

    // Proactively notify all subscribed members of this gym
    const subscriptions = await prisma.subscription.findMany({
      where: { gymId: id, status: 'ACTIVE' },
      select: { customerId: true }
    });

    const notifications = subscriptions.map(sub => ({
      userId: sub.customerId,
      title: `Update from your gym!`,
      message: `Your gym posted: "${title}". Check the details page.`
    }));

    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications
      });
    }

    return res.status(201).json(update);
  } catch (error) {
    console.error('Gym update error:', error);
    return res.status(500).json({ error: 'Failed to publish gym update.' });
  }
});

// GET /api/facilities - Helper endpoint to get all possible facilities
router.get('/facilities/all', async (req, res) => {
  try {
    const facilities = await prisma.facility.findMany();
    return res.json(facilities);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch facilities.' });
  }
});

// ADMIN API: PUT /api/gyms/admin/:id/trial - Update gym platform trial months or subscription status
router.put('/admin/:id/trial', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { trialMonths, isSubscriptionPaid } = req.body;

  try {
    const updated = await prisma.gym.update({
      where: { id },
      data: {
        ...(trialMonths !== undefined && { trialMonths: Number(trialMonths) }),
        ...(isSubscriptionPaid !== undefined && { isSubscriptionPaid: Boolean(isSubscriptionPaid) })
      }
    });

    return res.json({ message: 'Gym platform trial settings updated.', gym: updated });
  } catch (error) {
    console.error('Update gym trial error:', error);
    return res.status(500).json({ error: 'Failed to update gym trial settings.' });
  }
});

// GYM OWNER API: PUT /api/gyms/:id/payout - Update bank details, UPI ID, and payment QR code
router.put('/:id/payout', verifyToken, requireRole(['GYM_OWNER']), requireOwnerOfGym, async (req, res) => {
  const { id } = req.params;
  const { upiId, bankAccountNumber, bankIfsc, bankAccountName, bankName, paymentQrCode } = req.body;

  try {
    const updated = await prisma.gym.update({
      where: { id },
      data: {
        upiId: upiId || null,
        bankAccountNumber: bankAccountNumber || null,
        bankIfsc: bankIfsc || null,
        bankAccountName: bankAccountName || null,
        bankName: bankName || null,
        paymentQrCode: paymentQrCode || null,
      }
    });

    return res.json({ message: 'Payout and payment collection details saved successfully.', gym: updated });
  } catch (error) {
    console.error('Update payout error:', error);
    return res.status(500).json({ error: 'Failed to update payout details.' });
  }
});

// ADMIN API: PUT /api/gyms/admin/:id/priority - Update gym rank priority, featured & promoted badges
router.put('/admin/:id/priority', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { priorityOrder, isFeatured, isPromoted } = req.body;

  try {
    const updated = await prisma.gym.update({
      where: { id },
      data: {
        ...(priorityOrder !== undefined && { priorityOrder: Number(priorityOrder) }),
        ...(isFeatured !== undefined && { isFeatured: Boolean(isFeatured) }),
        ...(isPromoted !== undefined && { isPromoted: Boolean(isPromoted) })
      }
    });

    return res.json({ message: 'Gym priority and advertisement settings updated.', gym: updated });
  } catch (error) {
    console.error('Update gym priority error:', error);
    return res.status(500).json({ error: 'Failed to update gym priority settings.' });
  }
});

export default router;
