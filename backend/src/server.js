import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import prisma from './prisma.js';
import { getJwtSecret } from './middleware/auth.js';

// Route imports
import authRoutes from './routes/auth.js';
import gymRoutes from './routes/gyms.js';
import reviewRoutes from './routes/reviews.js';
import subscriptionRoutes from './routes/subscriptions.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import messageRoutes from './routes/messages.js';
import complaintRoutes from './routes/complaints.js';
import aiRoutes from './routes/ai.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for development and production
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Provide io instance to Express routes
app.set('io', io);

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/gyms', gymRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/ai', aiRoutes);

// Health check & Root API status endpoints
app.get('/', (req, res) => {
  res.json({
    status: 'ONLINE',
    message: 'GYMGO Backend REST API & WebSocket Server',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      gyms: '/api/gyms',
      products: '/api/products',
      subscriptions: '/api/subscriptions',
      auth: '/api/auth'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'GYMGO API is running smoothly.' });
});

// Socket.IO Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret());
      socket.user = decoded;
    } catch (e) {
      console.warn('Socket token verification warning:', e.message);
    }
  }
  next();
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  const authenticatedUserId = socket.user?.id;
  if (authenticatedUserId) {
    socket.join(authenticatedUserId);
    console.log(`Socket ${socket.id} authenticated and joined room: ${authenticatedUserId}`);
  } else {
    console.log('User connected to socket (unauthenticated):', socket.id);
  }

  // User registers their room based on userId (or confirms presence)
  socket.on('register', (userId) => {
    if (!userId) return;
    // If authenticated, ensure user can only register their own room
    if (socket.user && socket.user.id !== userId) {
      console.warn(`Socket ${socket.id} attempted to register unauthorized user room ${userId}`);
      return;
    }
    socket.join(userId);
    socket.userId = userId;
    console.log(`Socket ${socket.id} joined room for User: ${userId}`);
  });

  // Join a dedicated conversation room between two users
  socket.on('join_conversation', ({ otherUserId }) => {
    const currentUserId = socket.user?.id || socket.userId;
    if (currentUserId && otherUserId) {
      const conversationRoom = `conv_${[currentUserId, otherUserId].sort().join('_')}`;
      socket.join(conversationRoom);
      console.log(`Socket ${socket.id} joined conversation room: ${conversationRoom}`);
    }
  });

  // Client sends a message
  socket.on('send_message', async ({ senderId, receiverId, content, imageUrl }) => {
    const effectiveSenderId = socket.user?.id || senderId;
    if (!effectiveSenderId || !receiverId || (!content && !imageUrl)) {
      socket.emit('message_error', { error: 'Sender ID, receiver ID, and content or image are required.' });
      return;
    }

    try {
      // 1. Permanently save message to database first
      const msg = await prisma.message.create({
        data: {
          senderId: effectiveSenderId,
          receiverId,
          content: content ? content.trim() : '',
          imageUrl: imageUrl || null,
          isRead: false
        },
        include: {
          sender: {
            select: { id: true, name: true, avatar: true, role: true }
          }
        }
      });

      // 2. Broadcast message to receiver's room, sender's room, and conversation room
      const conversationRoom = `conv_${[effectiveSenderId, receiverId].sort().join('_')}`;
      io.to(receiverId).emit('receive_message', msg);
      io.to(effectiveSenderId).emit('receive_message', msg);
      io.to(conversationRoom).emit('receive_message', msg);

      // 3. Create persistent notification for receiver
      const senderName = msg.sender?.name || 'A user';
      const previewText = msg.content 
        ? (msg.content.length > 50 ? `${msg.content.substring(0, 50)}...` : msg.content) 
        : 'sent an image attachment';

      await prisma.notification.create({
        data: {
          userId: receiverId,
          title: `New Message from ${senderName}`,
          message: previewText
        }
      });

      // 4. Send live notification update to receiver
      io.to(receiverId).emit('new_notification', {
        title: `New Message from ${senderName}`,
        message: previewText,
        senderId: effectiveSenderId
      });

    } catch (err) {
      console.error('Socket message save error:', err);
      socket.emit('message_error', { error: 'Failed to deliver message. Please retry.' });
    }
  });

  // Mark messages from a conversation as read in real-time
  socket.on('mark_read', async ({ otherUserId }) => {
    const currentUserId = socket.user?.id || socket.userId;
    if (!currentUserId || !otherUserId) return;

    try {
      await prisma.message.updateMany({
        where: {
          senderId: otherUserId,
          receiverId: currentUserId,
          isRead: false
        },
        data: { isRead: true }
      });

      // Notify the sender that their messages were read
      io.to(otherUserId).emit('messages_read', {
        readBy: currentUserId,
        conversationWith: otherUserId
      });
    } catch (err) {
      console.error('Socket mark_read error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected from socket:', socket.id);
  });
});

// Start Server
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test' && !process.argv[1]?.includes('.test.js')) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (http://localhost:${PORT})`);
  });
}

export default app;

