import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Route imports
import authRoutes from './routes/auth.js';
import gymRoutes from './routes/gyms.js';
import reviewRoutes from './routes/reviews.js';
import subscriptionRoutes from './routes/subscriptions.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import messageRoutes from './routes/messages.js';
import complaintRoutes from './routes/complaints.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for local development/testing
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  }
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/gyms', gymRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/complaints', complaintRoutes);

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

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log('User connected to socket:', socket.id);

  // User registers their room based on userId
  socket.on('register', (userId) => {
    socket.join(userId);
    console.log(`Socket ${socket.id} joined room for User: ${userId}`);
  });

  // Client sends a message
  socket.on('send_message', async ({ senderId, receiverId, content, imageUrl }) => {
    if (!senderId || !receiverId || (!content && !imageUrl)) return;

    try {
      // Save message to database
      const msg = await prisma.message.create({
        data: {
          senderId,
          receiverId,
          content: content || '',
          imageUrl: imageUrl || null
        }
      });

      // Broadcast message to receiver's room and sender's room
      io.to(receiverId).emit('receive_message', msg);
      io.to(senderId).emit('receive_message', msg);

      // Create notification for receiver if not already in conversation
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { name: true }
      });

      await prisma.notification.create({
        data: {
          userId: receiverId,
          title: `New Message from ${sender.name}`,
          message: content.length > 50 ? `${content.substring(0, 50)}...` : content
        }
      });

      // Send live notification update
      io.to(receiverId).emit('new_notification', {
        title: `New Message from ${sender.name}`,
        message: content.length > 50 ? `${content.substring(0, 50)}...` : content
      });

    } catch (err) {
      console.error('Socket message save error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected from socket:', socket.id);
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
