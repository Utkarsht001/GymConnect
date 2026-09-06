import express from 'express';
import prisma from '../prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// POST /api/complaints - Lodge a customer complaint
router.post('/', verifyToken, async (req, res) => {
  const customerId = req.user.id;
  const { gymId, title, description } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Complaint title and description are required.' });
  }

  try {
    const complaint = await prisma.complaint.create({
      data: {
        customerId,
        gymId: gymId || null,
        title,
        description,
        status: 'PENDING'
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        gym: { select: { id: true, name: true, city: true } }
      }
    });

    // Create notification for admin & support employees
    await prisma.notification.create({
      data: {
        userId: customerId,
        title: 'Complaint Registered',
        message: `Your complaint "${title}" has been registered. Our support team will review it.`
      }
    });

    return res.status(201).json(complaint);
  } catch (error) {
    console.error('Create complaint error:', error);
    return res.status(500).json({ error: 'Failed to lodge complaint.' });
  }
});

// GET /api/complaints - Fetch complaints list
router.get('/', verifyToken, async (req, res) => {
  const { role, id: userId } = req.user;

  try {
    let where = {};
    if (role === 'CUSTOMER') {
      where.customerId = userId;
    }

    const complaints = await prisma.complaint.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true, avatar: true } },
        gym: { select: { id: true, name: true, city: true, ownerId: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(complaints);
  } catch (error) {
    console.error('Fetch complaints error:', error);
    return res.status(500).json({ error: 'Failed to fetch complaints.' });
  }
});

// PUT /api/complaints/:id/status - Update complaint status (Admin/Employee only)
router.put('/:id/status', verifyToken, requireRole(['ADMIN', 'EMPLOYEE']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['PENDING', 'RESOLVED', 'ACTION_TAKEN'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  try {
    const updated = await prisma.complaint.update({
      where: { id },
      data: { status },
      include: {
        customer: true,
        gym: true
      }
    });

    // Notify customer
    await prisma.notification.create({
      data: {
        userId: updated.customerId,
        title: 'Complaint Status Updated',
        message: `Your complaint "${updated.title}" status is now: ${status}`
      }
    });

    return res.json(updated);
  } catch (error) {
    console.error('Update complaint error:', error);
    return res.status(500).json({ error: 'Failed to update complaint status.' });
  }
});

export default router;
