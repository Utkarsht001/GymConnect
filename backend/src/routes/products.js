import express from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/products - List store products
router.get('/', async (req, res) => {
  const { search, category, gymId } = req.query;

  let where = {};

  if (gymId) {
    where.gymId = gymId;
  }

  if (category) {
    where.category = category;
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } }
    ];
  }

  try {
    const products = await prisma.product.findMany({
      where,
      include: {
        gym: {
          select: {
            id: true,
            name: true,
            city: true,
            upiId: true,
            bankAccountNumber: true,
            bankIfsc: true,
            bankAccountName: true,
            bankName: true,
            paymentQrCode: true
          }
        }
      },
      orderBy: [
        { isPromoted: 'desc' },
        { isFeatured: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return res.json(products);
  } catch (error) {
    console.error('Fetch products error:', error);
    return res.status(500).json({ error: 'Failed to search products.' });
  }
});

// GET /api/products/:id - Product detail
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        gym: true
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    return res.json(product);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch product details.' });
  }
});

// POST /api/products - Create product (Gym Owners only)
router.post('/', verifyToken, requireRole(['GYM_OWNER']), async (req, res) => {
  const { name, description, price, discount, stock, image, category } = req.body;

  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Product name, price, and category are required.' });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { ownerId: req.user.id }
    });

    if (!gym) {
      return res.status(400).json({ error: 'You must create a gym profile before listing products.' });
    }

    const product = await prisma.product.create({
      data: {
        gymId: gym.id,
        name,
        description: description || '',
        price: parseFloat(price),
        discount: parseFloat(discount) || 0,
        stock: parseInt(stock) || 0,
        image: image || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400',
        category,
      }
    });

    return res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({ error: 'Failed to create product listing.' });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', verifyToken, requireRole(['GYM_OWNER']), async (req, res) => {
  const { id } = req.params;
  const { name, description, price, discount, stock, image, category } = req.body;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { gym: true }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Verify owner
    if (product.gym.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied. You do not own this product.' });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price: price ? parseFloat(price) : undefined,
        discount: discount ? parseFloat(discount) : undefined,
        stock: stock ? parseInt(stock) : undefined,
        image,
        category
      }
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update product.' });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', verifyToken, requireRole(['GYM_OWNER', 'ADMIN']), async (req, res) => {
  const { id } = req.params;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { gym: true }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Verify owner
    if (product.gym.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await prisma.product.delete({ where: { id } });
    return res.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete product.' });
  }
});

// ADMIN API: PUT /api/products/admin/:id/promote - Admin toggle product featured/promoted status
router.put('/admin/:id/promote', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { isPromoted, isFeatured } = req.body;

  try {
    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(isPromoted !== undefined && { isPromoted: Boolean(isPromoted) }),
        ...(isFeatured !== undefined && { isFeatured: Boolean(isFeatured) })
      }
    });

    return res.json({ message: 'Product promotion status updated.', product: updated });
  } catch (error) {
    console.error('Update product promote error:', error);
    return res.status(500).json({ error: 'Failed to update product promotion status.' });
  }
});

export default router;
