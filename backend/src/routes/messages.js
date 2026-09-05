import express from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/messages/conversations - List conversations for user
router.get('/conversations', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // Fetch all messages involving the user
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      include: {
        sender: {
          select: { id: true, name: true, avatar: true, role: true }
        },
        receiver: {
          select: { id: true, name: true, avatar: true, role: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group messages by the other user ID to construct unique conversations
    const conversationsMap = {};
    messages.forEach(msg => {
      const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
      
      conversationsMap[otherUser.id] = {
        otherUser,
        lastMessage: msg.content,
        lastMessageAt: msg.createdAt,
        unreadCount: (msg.receiverId === userId && !msg.isRead) ? 1 : 0
      };
    });

    // Count unreads correctly (not just overriding with last message read status)
    for (const otherId in conversationsMap) {
      const count = await prisma.message.count({
        where: {
          senderId: otherId,
          receiverId: userId,
          isRead: false
        }
      });
      conversationsMap[otherId].unreadCount = count;
    }

    return res.json(Object.values(conversationsMap).sort((a,b) => b.lastMessageAt - a.lastMessageAt));
  } catch (error) {
    console.error('Fetch conversations error:', error);
    return res.status(500).json({ error: 'Failed to fetch conversations.' });
  }
});

// GET /api/messages/history/:otherUserId - Get chat history with a user
router.get('/history/:otherUserId', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { otherUserId } = req.params;

  try {
    // Mark messages from this user as read
    await prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: userId,
        isRead: false
      },
      data: { isRead: true }
    });

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    return res.json(messages);
  } catch (error) {
    console.error('Fetch message history error:', error);
    return res.status(500).json({ error: 'Failed to fetch chat logs.' });
  }
});

// POST /api/messages - Send message (Fallback REST endpoint)
router.post('/', verifyToken, async (req, res) => {
  const senderId = req.user.id;
  const { receiverId, content, imageUrl } = req.body;

  if (!receiverId || (!content && !imageUrl)) {
    return res.status(400).json({ error: 'Receiver ID and content/imageUrl are required.' });
  }

  try {
    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        content: content || '',
        imageUrl: imageUrl || null,
        isRead: false
      }
    });

    return res.status(201).json(message);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to send message.' });
  }
});

// GET /api/messages/escalations - Fetch 2-day unreplied gym owner messages escalated to Admin & Support Employees
router.get('/escalations', verifyToken, async (req, res) => {
  try {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Find messages sent to GYM_OWNERs by CUSTOMERs older than 48 hours
    const unrepliedCustomerMessages = await prisma.message.findMany({
      where: {
        createdAt: { lte: twoDaysAgo },
        receiver: { role: 'GYM_OWNER' },
        sender: { role: 'CUSTOMER' }
      },
      include: {
        sender: { select: { id: true, name: true, email: true, avatar: true } },
        receiver: { select: { id: true, name: true, email: true, gym: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filter to only those where the GYM_OWNER hasn't replied yet
    const escalatedList = [];
    for (const msg of unrepliedCustomerMessages) {
      const ownerReplyCount = await prisma.message.count({
        where: {
          senderId: msg.receiverId,
          receiverId: msg.senderId,
          createdAt: { gte: msg.createdAt }
        }
      });

      if (ownerReplyCount === 0) {
        escalatedList.push(msg);
      }
    }

    return res.json(escalatedList);
  } catch (error) {
    console.error('Fetch escalations error:', error);
    return res.status(500).json({ error: 'Failed to fetch escalated support tickets.' });
  }
});

// GET /api/messages/notifications - Fetch user notifications
router.get('/notifications', verifyToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });

    // Unread count
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false }
    });

    return res.json({ notifications, unreadCount });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// PUT /api/messages/notifications/read - Mark notifications as read
router.put('/notifications/read', verifyToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    });
    return res.json({ message: 'Notifications marked as read.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to mark notifications.' });
  }
});

export default router;
