import express from 'express';
import prisma from '../prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// POST /api/reviews - Add a review (Customers only)
router.post('/', verifyToken, requireRole(['CUSTOMER']), async (req, res) => {
  const { gymId, rating, comment } = req.body;

  if (!gymId || !rating || !comment) {
    return res.status(400).json({ error: 'Gym ID, rating (1-5), and comment text are required.' });
  }

  const score = parseInt(rating);
  if (score < 1 || score > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
  }

  try {
    // Check if customer is subscribed to this gym (business logic)
    const activeSub = await prisma.subscription.findFirst({
      where: {
        customerId: req.user.id,
        gymId,
        status: 'ACTIVE'
      }
    });

    if (!activeSub) {
      return res.status(403).json({ error: 'Review access denied. You must hold an active membership at this gym to write reviews.' });
    }

    // Check if already reviewed
    const existingReview = await prisma.review.findFirst({
      where: {
        customerId: req.user.id,
        gymId
      }
    });

    if (existingReview) {
      return res.status(400).json({ error: 'You have already submitted a review for this gym.' });
    }

    const review = await prisma.review.create({
      data: {
        customerId: req.user.id,
        gymId,
        rating: score,
        comment,
      },
      include: {
        customer: {
          select: { name: true, avatar: true }
        }
      }
    });

    // Notify the gym owner
    const gym = await prisma.gym.findUnique({ where: { id: gymId } });
    if (gym) {
      await prisma.notification.create({
        data: {
          userId: gym.ownerId,
          title: 'New Review Recieved!',
          message: `${req.user.name} rated your gym ${score}/5 stars: "${comment.substring(0, 30)}..."`
        }
      });
    }

    return res.status(201).json(review);
  } catch (error) {
    console.error('Create review error:', error);
    return res.status(500).json({ error: 'Failed to write review.' });
  }
});

// PUT /api/reviews/:id/reply - Reply to a review (Gym Owner only)
router.put('/:id/reply', verifyToken, requireRole(['GYM_OWNER']), async (req, res) => {
  const { id } = req.params;
  const { reply } = req.body;

  if (!reply) {
    return res.status(400).json({ error: 'Reply text cannot be empty.' });
  }

  try {
    const review = await prisma.review.findUnique({
      where: { id },
      include: { gym: true }
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    // Make sure owner owns the gym
    if (review.gym.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this gym.' });
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: { ownerReply: reply },
      include: {
        customer: {
          select: { name: true, avatar: true }
        }
      }
    });

    // Notify the customer
    await prisma.notification.create({
      data: {
        userId: review.customerId,
        title: 'Gym Owner Replied to Your Review',
        message: `The owner of "${review.gym.name}" responded to your feedback.`
      }
    });

    return res.json(updatedReview);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to reply to review.' });
  }
});

// DELETE /api/reviews/:id - Admin or user can delete review
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    if (review.customerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await prisma.review.delete({ where: { id } });
    return res.json({ message: 'Review deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete review.' });
  }
});

export default router;
