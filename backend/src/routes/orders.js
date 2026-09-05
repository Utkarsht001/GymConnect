import express from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/orders - Checkout cart and create order (Customers only)
router.post('/', verifyToken, requireRole(['CUSTOMER']), async (req, res) => {
  const { address, phone } = req.body;

  if (!address || !phone) {
    return res.status(400).json({ error: 'Delivery address and contact phone number are required.' });
  }

  try {
    // 1. Fetch user's cart
    const cart = await prisma.cart.findUnique({
      where: { userId: req.user.id },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Your shopping cart is empty.' });
    }

    // 2. Validate stock and calculate total price
    let totalPrice = 0;
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for product: "${item.product.name}". Available stock is ${item.product.stock}.` 
        });
      }
      const itemPrice = item.product.price * (1 - item.product.discount / 100);
      totalPrice += itemPrice * item.quantity;
    }

    // 3. Create the Order in a transaction-like sequence
    const order = await prisma.order.create({
      data: {
        customerId: req.user.id,
        address,
        phone,
        totalPrice,
        status: 'PENDING',
        items: {
          create: cart.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            pricePaid: item.product.price * (1 - item.product.discount / 100)
          }))
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // 4. Update product stocks
    for (const item of cart.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity
          }
        }
      });
    }

    // 5. Clear cart items
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id }
    });

    // 6. Notify gym owners involved in the order
    // Find unique gyms involved in this order
    const gymIds = [...new Set(cart.items.map(item => item.product.gymId))];
    for (const gid of gymIds) {
      const gym = await prisma.gym.findUnique({ where: { id: gid } });
      if (gym) {
        await prisma.notification.create({
          data: {
            userId: gym.ownerId,
            title: 'New Product Order Recieved!',
            message: `Order #${order.id.substring(0, 8)} contains accessories from your store.`
          }
        });
      }
    }

    // Notify customer
    await prisma.notification.create({
      data: {
        userId: req.user.id,
        title: 'Order Placed Successfully!',
        message: `Your order for ₹${totalPrice.toFixed(2)} has been submitted. Status: PENDING.`
      }
    });

    return res.status(201).json(order);
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: 'Order processing checkout failed.' });
  }
});

// GET /api/orders/my - View orders history
router.get('/my', verifyToken, async (req, res) => {
  try {
    if (req.user.role === 'CUSTOMER') {
      const orders = await prisma.order.findMany({
        where: { customerId: req.user.id },
        include: {
          items: {
            include: {
              product: {
                select: { name: true, image: true, gym: { select: { name: true } } }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(orders);
    } else if (req.user.role === 'GYM_OWNER') {
      // Gym owners see orders containing their products
      const gym = await prisma.gym.findUnique({
        where: { ownerId: req.user.id }
      });

      if (!gym) {
        return res.json([]);
      }

      // Fetch all order items belonging to this gym
      const orderItems = await prisma.orderItem.findMany({
        where: {
          product: { gymId: gym.id }
        },
        include: {
          product: true,
          order: {
            include: {
              customer: {
                select: { name: true, email: true }
              }
            }
          }
        },
        orderBy: { order: { createdAt: 'desc' } }
      });

      // Group by order
      const ordersMap = {};
      orderItems.forEach(item => {
        const o = item.order;
        if (!ordersMap[o.id]) {
          ordersMap[o.id] = {
            id: o.id,
            createdAt: o.createdAt,
            status: o.status,
            address: o.address,
            phone: o.phone,
            customerName: o.customer.name,
            customerEmail: o.customer.email,
            items: [],
            totalPrice: 0
          };
        }
        ordersMap[o.id].items.push({
          productName: item.product.name,
          quantity: item.quantity,
          pricePaid: item.pricePaid,
          image: item.product.image
        });
        ordersMap[o.id].totalPrice += item.pricePaid * item.quantity;
      });

      return res.json(Object.values(ordersMap));
    } else if (req.user.role === 'ADMIN') {
      const orders = await prisma.order.findMany({
        include: {
          customer: {
            select: { name: true, email: true }
          },
          items: {
            include: {
              product: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(orders);
    }

    return res.status(400).json({ error: 'Invalid user role.' });
  } catch (error) {
    console.error('Fetch orders error:', error);
    return res.status(500).json({ error: 'Failed to retrieve order history.' });
  }
});

// PUT /api/orders/:id/status - Update fulfillment state (Owners/Admin only)
router.put('/:id/status', verifyToken, requireRole(['GYM_OWNER', 'ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // PENDING, CONFIRMED, PACKED, SHIPPED, DELIVERED, CANCELLED

  const validStatuses = ['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid order status value.' });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } } }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Verify owner check: gym owner can only modify status if order contains their gym products
    if (req.user.role === 'GYM_OWNER') {
      const gym = await prisma.gym.findUnique({ where: { ownerId: req.user.id } });
      const containsGymProduct = order.items.some(item => item.product.gymId === gym.id);
      if (!containsGymProduct) {
        return res.status(403).json({ error: 'Access denied. Order does not contain your gym products.' });
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status }
    });

    // Notify customer
    await prisma.notification.create({
      data: {
        userId: order.customerId,
        title: `Order Status Updated: ${status}`,
        message: `Your order #${order.id.substring(0, 8)} status is now ${status}.`
      }
    });

    return res.json(updatedOrder);
  } catch (error) {
    console.error('Update order error:', error);
    return res.status(500).json({ error: 'Failed to update order status.' });
  }
});

// Cart helper endpoints for frontend synchronization
// GET /api/orders/cart - View cart
router.get('/cart', verifyToken, requireRole(['CUSTOMER']), async (req, res) => {
  try {
    const cart = await prisma.cart.findUnique({
      where: { userId: req.user.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                gym: { select: { name: true } }
              }
            }
          }
        }
      }
    });
    return res.json(cart);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch cart.' });
  }
});

// POST /api/orders/cart/add - Add to cart
router.post('/cart/add', verifyToken, requireRole(['CUSTOMER']), async (req, res) => {
  const { productId, quantity } = req.body;
  const qty = parseInt(quantity) || 1;

  try {
    const cart = await prisma.cart.findUnique({
      where: { userId: req.user.id }
    });

    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (product.stock < qty) {
      return res.status(400).json({ error: 'Not enough stock available.' });
    }

    // Check if item already in cart
    const existingItem = await prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId }
    });

    if (existingItem) {
      const newQty = existingItem.quantity + qty;
      if (product.stock < newQty) {
        return res.status(400).json({ error: 'Cannot add more. Not enough stock.' });
      }
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty }
      });
    } else {
      await prisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity: qty }
      });
    }

    return res.json({ message: 'Product added to cart successfully.' });
  } catch (error) {
    console.error('Cart add error:', error);
    return res.status(500).json({ error: 'Failed to add item to cart.' });
  }
});

// DELETE /api/orders/cart/item/:itemId - Delete cart item
router.delete('/cart/item/:itemId', verifyToken, requireRole(['CUSTOMER']), async (req, res) => {
  const { itemId } = req.params;
  try {
    const cart = await prisma.cart.findUnique({
      where: { userId: req.user.id }
    });

    const item = await prisma.cartItem.findUnique({
      where: { id: itemId }
    });

    if (!item || item.cartId !== cart.id) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }

    await prisma.cartItem.delete({
      where: { id: itemId }
    });

    return res.json({ message: 'Cart item removed.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to remove cart item.' });
  }
});

export default router;
