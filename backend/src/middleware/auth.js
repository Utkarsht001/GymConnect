import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fithub-super-secret-key-12345';

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expect Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient privileges.' });
    }
    next();
  };
};

export const requireOwnerOfGym = async (req, res, next) => {
  try {
    if (req.user.role === 'ADMIN') {
      return next(); // Admins bypass ownership checks
    }

    if (req.user.role !== 'GYM_OWNER') {
      return res.status(403).json({ error: 'Access denied. Must be a Gym Owner.' });
    }

    const { id } = req.params; // Gym ID
    const gym = await prisma.gym.findUnique({
      where: { id },
    });

    if (!gym) {
      return res.status(404).json({ error: 'Gym profile not found.' });
    }

    if (gym.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this gym listing.' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Internal server check failed.' });
  }
};
