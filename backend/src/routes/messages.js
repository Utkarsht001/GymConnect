import express from 'express';
import prisma from '../prisma.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/messages/conversations - List conversations for user
router.get('/conversations', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // Fetch all messages involving the user ordered by createdAt asc
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
            gym: { select: { id: true, name: true, logo: true } }
          }
        },
        receiver: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
            gym: { select: { id: true, name: true, logo: true } }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group messages by the other user ID to construct unique conversations in a single pass (O(1) in-memory)
    const conversationsMap = {};
    messages.forEach(msg => {
      const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
      if (!otherUser) return;
      
      if (!conversationsMap[otherUser.id]) {
        conversationsMap[otherUser.id] = {
          otherUser: {
            id: otherUser.id,
            name: otherUser.name,
            avatar: otherUser.avatar,
            role: otherUser.role,
            gymName: otherUser.gym?.name || null,
            gymId: otherUser.gym?.id || null,
          },
          lastMessage: msg.content || (msg.imageUrl ? '📷 [Image attachment]' : ''),
          lastMessageAt: msg.createdAt,
          lastMessageSenderId: msg.senderId,
          unreadCount: 0
        };
      } else {
        conversationsMap[otherUser.id].lastMessage = msg.content || (msg.imageUrl ? '📷 [Image attachment]' : '');
        conversationsMap[otherUser.id].lastMessageAt = msg.createdAt;
        conversationsMap[otherUser.id].lastMessageSenderId = msg.senderId;
      }

      // Compute unread count directly in memory without N+1 database queries
      if (msg.receiverId === userId && !msg.isRead) {
        conversationsMap[otherUser.id].unreadCount += 1;
      }
    });

    const conversations = Object.values(conversationsMap).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    return res.json(conversations);
  } catch (error) {
    console.error('Fetch conversations error:', error);
    return res.status(500).json({ error: 'Failed to fetch conversations.' });
  }
});

// GET /api/messages/user-info/:otherUserId - Get user details for starting a new chat
router.get('/user-info/:otherUserId', verifyToken, async (req, res) => {
  const { otherUserId } = req.params;

  try {
    const userRecord = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: {
        id: true,
        name: true,
        avatar: true,
        role: true,
        gym: { select: { id: true, name: true, logo: true } }
      }
    });

    if (!userRecord) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({
      id: userRecord.id,
      name: userRecord.name,
      avatar: userRecord.avatar,
      role: userRecord.role,
      gymName: userRecord.gym?.name || null,
      gymId: userRecord.gym?.id || null
    });
  } catch (error) {
    console.error('Fetch user-info error:', error);
    return res.status(500).json({ error: 'Failed to fetch participant info.' });
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

    // Notify other user via Socket.IO that messages were read
    const io = req.app.get('io');
    if (io) {
      io.to(otherUserId).emit('messages_read', {
        readBy: userId,
        conversationWith: otherUserId
      });
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId }
        ]
      },
      include: {
        sender: {
          select: { id: true, name: true, avatar: true, role: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return res.json(messages);
  } catch (error) {
    console.error('Fetch message history error:', error);
    return res.status(500).json({ error: 'Failed to fetch chat logs.' });
  }
});

// PUT /api/messages/read/:otherUserId - Mark conversation messages as read
router.put('/read/:otherUserId', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { otherUserId } = req.params;

  try {
    await prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: userId,
        isRead: false
      },
      data: { isRead: true }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(otherUserId).emit('messages_read', {
        readBy: userId,
        conversationWith: otherUserId
      });
    }

    return res.json({ message: 'Messages marked as read.' });
  } catch (error) {
    console.error('Mark read error:', error);
    return res.status(500).json({ error: 'Failed to mark messages as read.' });
  }
});

// POST /api/messages - Send message (REST endpoint with DB save + Socket broadcast)
router.post('/', verifyToken, async (req, res) => {
  const senderId = req.user.id;
  const { receiverId, content, imageUrl } = req.body;

  if (!receiverId) {
    return res.status(400).json({ error: 'Receiver ID is required.' });
  }

  const trimmedContent = typeof content === 'string' ? content.trim() : '';

  if (!trimmedContent && !imageUrl) {
    return res.status(400).json({ error: 'Message content or image attachment is required.' });
  }

  if (trimmedContent.length > 5000) {
    return res.status(400).json({ error: 'Message content exceeds maximum length of 5000 characters.' });
  }

  try {
    // Verify receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true, name: true, email: true }
    });

    if (!receiver) {
      return res.status(404).json({ error: 'Recipient user does not exist.' });
    }

    // Rate limiting: max 15 messages in the last 10 seconds per user
    const recentCount = await prisma.message.count({
      where: {
        senderId,
        createdAt: { gte: new Date(Date.now() - 10000) }
      }
    });

    if (recentCount >= 15) {
      return res.status(429).json({ error: 'You are sending messages too quickly. Please pause for a few seconds.' });
    }

    // Save message permanently in database
    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        content: trimmedContent,
        imageUrl: imageUrl || null,
        isRead: false
      },
      include: {
        sender: {
          select: { id: true, name: true, avatar: true, role: true }
        }
      }
    });

    // Real-time broadcast via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      const conversationRoom = `conv_${[senderId, receiverId].sort().join('_')}`;
      io.to(receiverId).emit('receive_message', message);
      io.to(senderId).emit('receive_message', message);
      io.to(conversationRoom).emit('receive_message', message);
    }

    // Create in-app notification for receiver
    const senderName = message.sender?.name || 'A user';
    const preview = trimmedContent 
      ? (trimmedContent.length > 50 ? `${trimmedContent.substring(0, 50)}...` : trimmedContent)
      : 'sent an image attachment';

    await prisma.notification.create({
      data: {
        userId: receiverId,
        title: `New Message from ${senderName}`,
        message: preview
      }
    });

    if (io) {
      io.to(receiverId).emit('new_notification', {
        title: `New Message from ${senderName}`,
        message: preview,
        senderId
      });
    }

    return res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
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
