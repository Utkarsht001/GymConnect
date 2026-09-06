import express from 'express';
import prisma from '../prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// POST /api/subscriptions - Subscribe to a membership plan (Customers only)
router.post('/', verifyToken, requireRole(['CUSTOMER']), async (req, res) => {
  const { planId } = req.body;

  if (!planId) {
    return res.status(400).json({ error: 'Membership planId is required.' });
  }

  try {
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: planId },
      include: { gym: true }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Membership plan not found.' });
    }

    if (!plan.gym.isApproved) {
      return res.status(403).json({ error: 'Cannot purchase memberships for unapproved gyms.' });
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + plan.durationDays);

    // Deactivate previous active subscriptions for this same gym if any
    await prisma.subscription.updateMany({
      where: {
        customerId: req.user.id,
        gymId: plan.gymId,
        status: 'ACTIVE'
      },
      data: { status: 'EXPIRED' }
    });

    // Create new subscription
    const subscription = await prisma.subscription.create({
      data: {
        customerId: req.user.id,
        gymId: plan.gymId,
        planId: plan.id,
        startDate,
        endDate,
        pricePaid: plan.price,
        status: 'ACTIVE',
      },
      include: {
        plan: true,
        gym: true,
      }
    });

    // Notify Gym Owner
    await prisma.notification.create({
      data: {
        userId: plan.gym.ownerId,
        title: 'New Member Subscription!',
        message: `${req.user.name} subscribed to your plan: "${plan.name}" (Paid: ₹${plan.price})`
      }
    });

    // Notify Customer
    await prisma.notification.create({
      data: {
        userId: req.user.id,
        title: 'Membership Activated!',
        message: `Successfully joined "${plan.gym.name}" on the "${plan.name}" plan. Valid until ${endDate.toLocaleDateString()}.`
      }
    });

    return res.status(201).json(subscription);
  } catch (error) {
    console.error('Subscription purchase error:', error);
    return res.status(500).json({ error: 'Purchase transaction failed.' });
  }
});

// GET /api/subscriptions/my - Fetch subscriptions history
router.get('/my', verifyToken, async (req, res) => {
  try {
    if (req.user.role === 'CUSTOMER') {
      const subs = await prisma.subscription.findMany({
        where: { customerId: req.user.id },
        include: {
          plan: true,
          gym: {
            select: { id: true, name: true, logo: true, address: true, city: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(subs);
    } else if (req.user.role === 'GYM_OWNER') {
      // Gym owners get subscriptions for their gym
      const gym = await prisma.gym.findUnique({
        where: { ownerId: req.user.id }
      });

      if (!gym) {
        return res.json([]);
      }

      const subs = await prisma.subscription.findMany({
        where: { gymId: gym.id },
        include: {
          plan: true,
          customer: {
            select: { id: true, name: true, email: true, avatar: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(subs);
    } else if (req.user.role === 'ADMIN') {
      // Admin gets all platform subscriptions
      const subs = await prisma.subscription.findMany({
        include: {
          plan: true,
          gym: true,
          customer: true
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(subs);
    }

    return res.status(400).json({ error: 'Invalid user role.' });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    return res.status(500).json({ error: 'Failed to fetch subscription records.' });
  }
});

// PUT /api/subscriptions/:id/cancel - Cancel active subscription
router.put('/:id/cancel', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: { gym: true }
    });

    if (!sub) {
      return res.status(404).json({ error: 'Subscription not found.' });
    }

    // Only customer or admin can cancel
    if (sub.customerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const updatedSub = await prisma.subscription.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    // Notify Gym Owner
    await prisma.notification.create({
      data: {
        userId: sub.gym.ownerId,
        title: 'Membership Cancelled',
        message: `A customer cancelled their active subscription to plan ID ${sub.planId}.`
      }
    });

    return res.json({ message: 'Membership cancelled successfully.', subscription: updatedSub });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to cancel subscription.' });
  }
});

// GET /api/subscriptions/platform-payment - Get platform admin payment config
router.get('/platform-payment', async (req, res) => {
  try {
    let settings = await prisma.platformSetting.findUnique({
      where: { id: 'default' }
    });

    if (!settings) {
      settings = await prisma.platformSetting.create({
        data: { id: 'default', listingFeeRupees: 999 }
      });
    }

    return res.json(settings);
  } catch (error) {
    console.error('Fetch platform settings error:', error);
    return res.status(500).json({ error: 'Failed to fetch platform payment settings.' });
  }
});

// ADMIN API: PUT /api/subscriptions/admin/platform-payment - Admin update platform payout config
router.put('/admin/platform-payment', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  const { adminUpiId, adminBankName, adminBankAccountNumber, adminBankIfsc, adminBankAccountName, adminQrCode, listingFeeRupees } = req.body;

  try {
    const settings = await prisma.platformSetting.upsert({
      where: { id: 'default' },
      update: {
        adminUpiId,
        adminBankName,
        adminBankAccountNumber,
        adminBankIfsc,
        adminBankAccountName,
        adminQrCode,
        ...(listingFeeRupees !== undefined && { listingFeeRupees: parseFloat(listingFeeRupees) })
      },
      create: {
        id: 'default',
        adminUpiId,
        adminBankName,
        adminBankAccountNumber,
        adminBankIfsc,
        adminBankAccountName,
        adminQrCode,
        listingFeeRupees: listingFeeRupees ? parseFloat(listingFeeRupees) : 999
      }
    });

    return res.json({ message: 'Platform admin payment settings updated successfully.', settings });
  } catch (error) {
    console.error('Update platform settings error:', error);
    return res.status(500).json({ error: 'Failed to update platform payment settings.' });
  }
});

// GYM OWNER API: POST /api/subscriptions/pay-platform - Submit platform subscription payment proof
router.post('/pay-platform', verifyToken, requireRole(['GYM_OWNER']), async (req, res) => {
  const { amount, paymentMethod, transactionId, proofUrl } = req.body;

  try {
    const gym = await prisma.gym.findUnique({
      where: { ownerId: req.user.id }
    });

    if (!gym) {
      return res.status(400).json({ error: 'Gym profile not found for current user.' });
    }

    const subPayment = await prisma.subscriptionPayment.create({
      data: {
        gymId: gym.id,
        amount: parseFloat(amount) || 999,
        paymentMethod: paymentMethod || 'UPI',
        transactionId: transactionId || null,
        proofUrl: proofUrl || null,
        status: 'PENDING'
      }
    });

    return res.status(201).json({ message: 'Platform subscription payment submitted. Awaiting Admin verification.', payment: subPayment });
  } catch (error) {
    console.error('Pay platform subscription error:', error);
    return res.status(500).json({ error: 'Failed to submit platform subscription payment.' });
  }
});

// ADMIN API: GET /api/subscriptions/admin/payments - List platform subscription payments
router.get('/admin/payments', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const payments = await prisma.subscriptionPayment.findMany({
      include: {
        gym: {
          include: {
            owner: { select: { name: true, email: true, phone: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(payments);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch platform subscription payments.' });
  }
});

// ADMIN API: PUT /api/subscriptions/admin/payments/:id/verify - Verify or Reject platform subscription payment
router.put('/admin/payments/:id/verify', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // "VERIFIED" or "REJECTED"

  if (!['VERIFIED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Status must be VERIFIED or REJECTED.' });
  }

  try {
    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id },
      include: { gym: true }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment request not found.' });
    }

    const updatedPayment = await prisma.subscriptionPayment.update({
      where: { id },
      data: { status }
    });

    if (status === 'VERIFIED') {
      // Mark gym subscription as paid & extend trial months if needed
      await prisma.gym.update({
        where: { id: payment.gymId },
        data: { isSubscriptionPaid: true }
      });

      // Notify Gym Owner
      await prisma.notification.create({
        data: {
          userId: payment.gym.ownerId,
          title: 'Platform Subscription Verified! 🎉',
          message: `Your platform subscription payment of ₹${payment.amount} has been verified by Admin. Your gym listing is fully active!`
        }
      });
    } else if (status === 'REJECTED') {
      // Notify Gym Owner
      await prisma.notification.create({
        data: {
          userId: payment.gym.ownerId,
          title: 'Platform Payment Rejected',
          message: `Your platform subscription payment submission of ₹${payment.amount} was rejected by Admin. Please check your transaction details.`
        }
      });
    }

    return res.json({ message: `Payment ${status.toLowerCase()} successfully.`, payment: updatedPayment });
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({ error: 'Failed to verify subscription payment.' });
  }
});

export default router;
