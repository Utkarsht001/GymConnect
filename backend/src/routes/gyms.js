import express from 'express';
import prisma from '../prisma.js';
import jwt from 'jsonwebtoken';
import { verifyToken, requireRole, requireOwnerOfGym, getJwtSecret } from '../middleware/auth.js';

const router = express.Router();

// High-performance in-memory cache
const gymsCache = {
  discovery: null,
  discoveryExpiresAt: 0,
  facilities: null,
  facilitiesExpiresAt: 0,
  gymDetails: new Map(), // gymId -> { data, expiresAt }
};

export function invalidateGymsCache(gymId = null) {
  gymsCache.discovery = null;
  gymsCache.discoveryExpiresAt = 0;
  gymsCache.facilities = null;
  gymsCache.facilitiesExpiresAt = 0;
  if (gymId) {
    gymsCache.gymDetails.delete(gymId);
  } else {
    gymsCache.gymDetails.clear();
  }
}

// GET /api/gyms - Discovery listing with optional query filters
router.get('/', async (req, res) => {
  const { search, city, facility, minPrice, maxPrice, rating, isApproved, status } = req.query;

  // Check cache for public default discovery queries (sub-5ms response)
  const isPublicDefault = !search && !city && !facility && !minPrice && !maxPrice && !rating && !isApproved && !status && !req.headers['authorization'];
  if (isPublicDefault && gymsCache.discovery && Date.now() < gymsCache.discoveryExpiresAt) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(gymsCache.discovery);
  }

  // Build prisma query options
  let where = {};

  // Standard users and public visitors only see approved gyms
  if ((isApproved === 'false' || status === 'PENDING' || status === 'REJECTED' || status === 'ALL') && req.headers['authorization']) {
    // If request contains authorization, check if it's admin asking for non-approved listings
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      const decoded = jwt.verify(token, getJwtSecret());
      if (decoded.role === 'ADMIN') {
        if (status === 'PENDING') {
          where.approvalStatus = 'PENDING';
        } else if (status === 'REJECTED') {
          where.approvalStatus = 'REJECTED';
        } else if (isApproved === 'false') {
          where.isApproved = false;
        }
        // If status === 'ALL', no approval filter applied
      } else {
        where.isApproved = true;
        where.approvalStatus = 'APPROVED';
      }
    } catch (e) {
      where.isApproved = true;
      where.approvalStatus = 'APPROVED';
    }
  } else {
    where.isApproved = true;
    where.approvalStatus = 'APPROVED';
  }

  if (city) {
    where.city = { contains: city, mode: 'insensitive' };
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } }
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
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        contactNumber: true,
        email: true,
        logo: true,
        coverImage: true,
        openingHours: true,
        trialStartDate: true,
        trialMonths: true,
        isSubscriptionPaid: true,
        isApproved: true,
        approvalStatus: true,
        rejectionReason: true,
        isFeatured: true,
        isPromoted: true,
        priorityOrder: true,
        createdAt: true,
        owner: {
          select: { id: true, name: true, email: true, phone: true, avatar: true, lastLoginAt: true }
        },
        facilities: {
          select: {
            facility: {
              select: { id: true, name: true, icon: true }
            }
          }
        },
        plans: {
          select: { id: true, name: true, price: true, durationDays: true }
        },
        reviews: {
          select: { rating: true }
        }
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
        gym.facilities.some(gf => gf.facility?.name?.toLowerCase() === facility.toString().toLowerCase())
      );
    }

    // Client-side rating filter
    if (rating) {
      const minRating = parseFloat(rating);
      filteredGyms = filteredGyms.filter(gym => {
        if (!gym.reviews || gym.reviews.length === 0) return false;
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

    // Cache default public discovery results for 60 seconds
    if (isPublicDefault) {
      gymsCache.discovery = filteredGyms;
      gymsCache.discoveryExpiresAt = Date.now() + 60000;
      res.setHeader('X-Cache', 'MISS');
    }

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
      where: {
        OR: [
          { approvalStatus: 'PENDING' },
          { isApproved: false }
        ]
      },
      orderBy: { createdAt: 'desc' },
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
        photos: true
      }
    });
    return res.json(gyms);
  } catch (error) {
    console.error('Fetch pending gyms error:', error);
    return res.status(500).json({ error: 'Failed to fetch pending gyms.' });
  }
});

// GET /api/gyms/:id - Detailed profile view
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  // Check cache for approved gyms if unauthenticated public visitor
  const cached = gymsCache.gymDetails.get(id);
  if (cached && Date.now() < cached.expiresAt && !req.headers['authorization']) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached.data);
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, phone: true, avatar: true }
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

    // Protection: If gym is not approved, only the gym's owner or an ADMIN may view it
    if (!gym.isApproved || gym.approvalStatus !== 'APPROVED') {
      let authorized = false;
      if (req.headers['authorization']) {
        try {
          const authHeader = req.headers['authorization'];
          const token = authHeader && authHeader.split(' ')[1];
          const decoded = jwt.verify(token, getJwtSecret());
          if (decoded.role === 'ADMIN' || decoded.id === gym.ownerId) {
            authorized = true;
          }
        } catch (e) {
          authorized = false;
        }
      }
      if (!authorized) {
        return res.status(403).json({
          error: 'This gym listing is currently under administrative verification and is not publicly accessible.',
          approvalStatus: gym.approvalStatus || 'PENDING'
        });
      }
    }

    // Cache approved profile for 60 seconds
    if (gym.isApproved && gym.approvalStatus === 'APPROVED') {
      gymsCache.gymDetails.set(id, { data: gym, expiresAt: Date.now() + 60000 });
    }

    return res.json(gym);
  } catch (error) {
    console.error('Fetch gym details error:', error);
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
        name: name.trim(),
        description: description.trim(),
        address: address.trim(),
        city: city.trim(),
        latitude: parseFloat(latitude) || 26.9124,
        longitude: parseFloat(longitude) || 75.7873,
        contactNumber: contactNumber.trim(),
        email: email.trim(),
        logo: logo || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=300',
        coverImage: coverImage || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200',
        openingHours: openingHours || '06:00 AM - 10:00 PM',
        trialMonths: freeTrialDays !== undefined ? Math.max(1, parseInt(freeTrialDays)) : 3,
        isApproved: false, // CRITICAL: NEVER auto-approve new gyms
        approvalStatus: 'PENDING',
        rejectionReason: null,
        reviewedAt: null,
      }
    });

    // Notify gym owner that application has been submitted for review
    await prisma.notification.create({
      data: {
        userId: req.user.id,
        title: 'Gym Registration Submitted',
        message: `Your gym listing "${newGym.name}" has been submitted and is currently under administrative review.`
      }
    });

    console.log(`[GYM CREATION] Gym "${newGym.name}" registered by Owner ${req.user.id} - Status: PENDING`);
    invalidateGymsCache();
    return res.status(201).json(newGym);
  } catch (error) {
    console.error('Create gym error:', error);
    return res.status(500).json({ error: 'Failed to create gym profile.' });
  }
});

// PUT /api/gyms/:id - Update profile
router.put('/:id', verifyToken, requireOwnerOfGym, async (req, res) => {
  const { id } = req.params;
  const { name, description, address, city, latitude, longitude, contactNumber, email, logo, coverImage, openingHours, freeTrialDays, resubmitForApproval } = req.body;

  try {
    const existing = await prisma.gym.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Gym profile not found.' });
    }

    // If gym was rejected and owner updates it or explicitly requests re-submission, set to PENDING
    let nextStatus = existing.approvalStatus;
    let nextIsApproved = existing.isApproved;
    if (existing.approvalStatus === 'REJECTED' || resubmitForApproval) {
      nextStatus = 'PENDING';
      nextIsApproved = false;
    }

    const updatedGym = await prisma.gym.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description.trim() : undefined,
        address: address !== undefined ? address.trim() : undefined,
        city: city !== undefined ? city.trim() : undefined,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        contactNumber: contactNumber !== undefined ? contactNumber.trim() : undefined,
        email: email !== undefined ? email.trim() : undefined,
        logo,
        coverImage,
        openingHours,
        trialMonths: freeTrialDays !== undefined ? Math.max(1, parseInt(freeTrialDays)) : undefined,
        approvalStatus: nextStatus,
        isApproved: nextIsApproved,
        ...(nextStatus === 'PENDING' && existing.approvalStatus === 'REJECTED' ? { rejectionReason: null, reviewedAt: null } : {})
      }
    });

    if (nextStatus === 'PENDING' && existing.approvalStatus === 'REJECTED') {
      await prisma.notification.create({
        data: {
          userId: existing.ownerId,
          title: 'Gym Re-submitted for Review',
          message: `Your updated profile for "${updatedGym.name}" has been resubmitted for admin approval.`
        }
      });
    }

    return res.json(updatedGym);
  } catch (error) {
    console.error('Update gym error:', error);
    return res.status(500).json({ error: 'Failed to update gym profile.' });
  }
});

// PUT /api/gyms/:id/approve - Approve gym (Admin only)
router.put('/:id/approve', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.gym.findUnique({
      where: { id },
      include: { owner: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Gym not found.' });
    }

    const gym = await prisma.gym.update({
      where: { id },
      data: { 
        isApproved: true,
        approvalStatus: 'APPROVED',
        rejectionReason: null,
        reviewedAt: new Date()
      }
    });

    // Notify the gym owner
    await prisma.notification.create({
      data: {
        userId: gym.ownerId,
        title: 'Gym Profile Approved! 🎉',
        message: `Your gym listing "${gym.name}" has been approved by the admin and is now publicly live on GymConnect.`
      }
    });

    console.log(`[ADMIN APPROVAL] Admin ${req.user.email} APPROVED gym: "${gym.name}" (${gym.id})`);
    invalidateGymsCache(id);
    return res.json({ message: 'Gym listing approved successfully.', gym });
  } catch (error) {
    console.error('Approve gym error:', error);
    return res.status(500).json({ error: 'Failed to approve gym.' });
  }
});

// PUT /api/gyms/:id/reject - Reject gym with reason (Admin only)
router.put('/:id/reject', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  if (!rejectionReason || typeof rejectionReason !== 'string' || rejectionReason.trim().length < 10) {
    return res.status(400).json({ 
      error: 'A detailed rejection reason is mandatory (minimum 10 characters) explaining what needs improvement.' 
    });
  }

  try {
    const existing = await prisma.gym.findUnique({
      where: { id },
      include: { owner: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Gym not found.' });
    }

    const gym = await prisma.gym.update({
      where: { id },
      data: { 
        isApproved: false,
        approvalStatus: 'REJECTED',
        rejectionReason: rejectionReason.trim(),
        reviewedAt: new Date()
      }
    });

    // Notify the owner with reason
    await prisma.notification.create({
      data: {
        userId: gym.ownerId,
        title: 'Gym Listing Needs Revision',
        message: `Your gym listing "${gym.name}" was not approved. Reason: ${rejectionReason.trim()}. You can update your listing details on your dashboard and re-submit for review.`
      }
    });

    console.log(`[ADMIN REJECTION] Admin ${req.user.email} REJECTED gym: "${gym.name}" (${gym.id}). Reason: ${rejectionReason.trim()}`);
    invalidateGymsCache(id);
    return res.json({ message: 'Gym listing rejected with reason recorded.', gym });
  } catch (error) {
    console.error('Reject gym error:', error);
    return res.status(500).json({ error: 'Failed to reject gym.' });
  }
});

// DELETE /api/gyms/admin/:id - Completely delete fake or violating gym (Admin only)
router.delete('/admin/:id', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.gym.delete({ where: { id } });
    invalidateGymsCache(id);
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
  if (gymsCache.facilities && Date.now() < gymsCache.facilitiesExpiresAt) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(gymsCache.facilities);
  }
  try {
    const facilities = await prisma.facility.findMany();
    gymsCache.facilities = facilities;
    gymsCache.facilitiesExpiresAt = Date.now() + 300000; // 5 min cache
    res.setHeader('X-Cache', 'MISS');
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
