import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fithub-super-secret-key-12345';
const getAdminPassword = () => process.env.ADMIN_PASSWORD || '9450558546028';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, name, role, phone } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required.' });
  }

  const requestedRole = role ? role.toUpperCase() : 'CUSTOMER';
  const normalizedRole = ['CUSTOMER', 'GYM_OWNER', 'ADMIN', 'EMPLOYEE'].includes(requestedRole) 
    ? requestedRole 
    : 'CUSTOMER';

  // Admin password enforcement
  if (normalizedRole === 'ADMIN' && password !== getAdminPassword()) {
    return res.status(400).json({ error: 'Invalid admin authorization password.' });
  }

  // Employees require Admin approval
  const isApproved = normalizedRole === 'EMPLOYEE' ? false : true;

  try {
    const existingEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name,
        phone: phone && phone.trim() ? phone.trim() : null,
        role: normalizedRole,
        isApproved,
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
      },
    });

    // Create an empty cart if customer
    if (normalizedRole === 'CUSTOMER') {
      await prisma.cart.create({
        data: { userId: newUser.id }
      });
    }

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        phone: newUser.phone,
        role: newUser.role,
        isApproved: newUser.isApproved,
        avatar: newUser.avatar,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/login - Supports Email OR Phone Number (allows shared phone numbers)
router.post('/login', async (req, res) => {
  const { email, phone, loginInput, password } = req.body;
  const input = (loginInput || email || phone || '').trim();

  if (!input || !password) {
    return res.status(400).json({ error: 'Email/Phone and password are required.' });
  }

  try {
    // Find candidate users by Email OR Phone Number
    const candidates = await prisma.user.findMany({
      where: {
        OR: [
          { email: input.toLowerCase() },
          { phone: input }
        ]
      }
    });

    if (!candidates || candidates.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    // Match candidate password
    let user = null;
    for (const candidate of candidates) {
      if (candidate.role === 'ADMIN') {
        const isCorrectAdminPassword = (password === getAdminPassword()) || await bcrypt.compare(password, candidate.password);
        if (isCorrectAdminPassword) {
          user = candidate;
          break;
        }
      } else {
        const isMatch = await bcrypt.compare(password, candidate.password);
        if (isMatch) {
          user = candidate;
          break;
        }
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid password or credentials.' });
    }

    // Check Employee approval status
    if (user.role === 'EMPLOYEE' && user.isApproved === false) {
      return res.status(403).json({ error: 'Your employee account is pending Admin approval.' });
    }

    // Update lastLoginAt timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        salary: user.salary,
        role: user.role,
        isApproved: user.isApproved,
        avatar: user.avatar,
        lastLoginAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/forgot-password - Request 6-digit OTP
router.post('/forgot-password', async (req, res) => {
  const { emailOrPhone } = req.body;
  if (!emailOrPhone) {
    return res.status(400).json({ error: 'Registered Email or Phone number is required.' });
  }

  const input = emailOrPhone.trim();

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.toLowerCase() },
          { phone: input }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'No account registered with this email or phone number.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // Valid 15 mins

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetOtp: otp,
        resetOtpExpiry: expiry
      }
    });

    return res.json({
      message: `OTP sent successfully to registered account (${user.email}).`,
      otp, // Demo response for testing
      email: user.email,
      phone: user.phone
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Failed to request OTP.' });
  }
});

// POST /api/auth/verify-otp - Verify OTP code
router.post('/verify-otp', async (req, res) => {
  const { emailOrPhone, otp } = req.body;
  if (!emailOrPhone || !otp) {
    return res.status(400).json({ error: 'Email/Phone and OTP code are required.' });
  }

  const input = emailOrPhone.trim();

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.toLowerCase() },
          { phone: input }
        ]
      }
    });

    if (!user || !user.resetOtp) {
      return res.status(400).json({ error: 'No password reset requested for this account.' });
    }

    if (user.resetOtp !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid OTP code entered.' });
    }

    if (user.resetOtpExpiry && new Date() > new Date(user.resetOtpExpiry)) {
      return res.status(400).json({ error: 'OTP code has expired. Please request a new code.' });
    }

    return res.json({ message: 'OTP verified successfully.', verified: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to verify OTP.' });
  }
});

// POST /api/auth/reset-password - Reset password with verified OTP
router.post('/reset-password', async (req, res) => {
  const { emailOrPhone, otp, newPassword } = req.body;
  if (!emailOrPhone || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email/Phone, OTP, and new password are required.' });
  }

  const input = emailOrPhone.trim();

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.toLowerCase() },
          { phone: input }
        ]
      }
    });

    if (!user || user.resetOtp !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid reset request or OTP mismatch.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetOtp: null,
        resetOtpExpiry: null
      }
    });

    return res.json({ message: 'Password reset successfully! You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        salary: true,
        role: true,
        isApproved: true,
        avatar: true,
        createdAt: true,
        gym: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json(user);
  } catch (error) {
    console.error('Me route error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ADMIN API: GET /api/auth/admin/users - Fetch all users for moderation
router.get('/admin/users', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        salary: true,
        role: true,
        isApproved: true,
        lastLoginAt: true,
        createdAt: true,
        avatar: true,
        gym: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch users list.' });
  }
});

// ADMIN API: PUT /api/auth/admin/users/:id/approve - Approve employee/user
router.put('/admin/users/:id/approve', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await prisma.user.update({
      where: { id },
      data: { isApproved: true }
    });
    return res.json({ message: 'User approved successfully.', user: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to approve user.' });
  }
});

// ADMIN API: PUT /api/auth/admin/employees/:id/salary - Update Employee monthly salary (Admin only)
router.put('/admin/employees/:id/salary', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { salary } = req.body;

  if (salary === undefined || isNaN(Number(salary)) || Number(salary) < 0) {
    return res.status(400).json({ error: 'Valid salary amount in rupees is required.' });
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: { salary: Number(salary) }
    });
    return res.json({ message: 'Employee salary updated successfully.', user: updated });
  } catch (error) {
    console.error('Update salary error:', error);
    return res.status(500).json({ error: 'Failed to update employee salary.' });
  }
});

// ADMIN API: DELETE /api/auth/admin/users/:id - Remove fake customer or fake user account
router.delete('/admin/users/:id', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({ where: { id } });
    return res.json({ message: 'User account removed successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: 'Failed to remove user account.' });
  }
});

// Settings state
let platformListingFeeInRupees = 499;

// ADMIN API: GET /api/auth/admin/settings - Fetch admin settings
router.get('/admin/settings', verifyToken, async (req, res) => {
  return res.json({ listingFeeRupees: platformListingFeeInRupees });
});

// ADMIN API: POST /api/auth/admin/settings - Update admin settings
router.post('/admin/settings', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  const { listingFeeRupees } = req.body;
  if (typeof listingFeeRupees === 'number' && listingFeeRupees >= 0) {
    platformListingFeeInRupees = listingFeeRupees;
  }
  return res.json({ message: 'Settings updated successfully.', listingFeeRupees: platformListingFeeInRupees });
});

export default router;
