import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { sendOtpEmail, sendWelcomeEmail, sendLoginNotificationEmail } from '../utils/mailer.js';
import { sendPasswordResetEmail, checkBrevoConfiguration } from '../utils/brevoMailer.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fithub-super-secret-key-12345';
const getAdminPassword = () => process.env.ADMIN_PASSWORD || '9450558546028';

// Simple in-memory rate limiters for security
const resetRequestStore = new Map(); // key -> timestamps[]
const resetAttemptStore = new Map(); // key -> timestamps[]

function checkRateLimit(store, key, maxRequests = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const timestamps = store.get(key) || [];
  const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
  
  if (validTimestamps.length >= maxRequests) {
    store.set(key, validTimestamps);
    return false; // Rate limit exceeded
  }
  
  validTimestamps.push(now);
  store.set(key, validTimestamps);
  return true; // Allowed
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, name, role, phone } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address (e.g. user@example.com).' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const cleanPhone = phone && phone.trim() ? phone.trim().replace(/[\s\-\(\)]/g, '') : null;

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
    const existingEmail = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        email: cleanEmail,
        password: hashedPassword,
        name: name.trim(),
        phone: cleanPhone,
        role: normalizedRole,
        isApproved,
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name.trim())}`,
      },
    });

    // Create an empty cart if customer
    if (normalizedRole === 'CUSTOMER') {
      await prisma.cart.create({
        data: { userId: newUser.id }
      });
    }

    // Send Welcome Email asynchronously
    if (cleanEmail.includes('@')) {
      sendWelcomeEmail(cleanEmail, newUser.name, newUser.role).catch(err => {
        console.error('Failed to send welcome email:', err.message);
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
  const { email, phone, loginInput, password, role } = req.body;
  const rawInput = (loginInput || email || phone || '').trim();

  if (!rawInput || !password) {
    return res.status(400).json({ error: 'Email/Phone and password are required.' });
  }

  const cleanEmail = rawInput.toLowerCase();
  const digitsOnlyPhone = rawInput.replace(/[\s\-\(\)\+]/g, '');

  try {
    // Find candidate users by Email OR Phone Number
    const searchConditions = [
      { email: cleanEmail },
      { phone: rawInput }
    ];

    if (digitsOnlyPhone && digitsOnlyPhone !== rawInput) {
      searchConditions.push({ phone: digitsOnlyPhone });
    }

    const candidates = await prisma.user.findMany({
      where: {
        OR: searchConditions
      }
    });

    if (!candidates || candidates.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    // Prioritize candidates matching the requested role tab if provided
    let sortedCandidates = candidates;
    if (role) {
      const targetRole = role.toUpperCase();
      sortedCandidates = [
        ...candidates.filter(c => c.role === targetRole),
        ...candidates.filter(c => c.role !== targetRole)
      ];
    }

    // Match candidate password securely
    let user = null;
    for (const candidate of sortedCandidates) {
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

    // Send Login Notification Email asynchronously
    if (user.email && user.email.includes('@')) {
      sendLoginNotificationEmail(user.email, user.name, user.role).catch(err => {
        console.error('Failed to send login email notification:', err.message);
      });
    }

    // JWT payload contains user's actual database role (server-side RBAC)
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

// POST /api/auth/forgot-password - Request Password Reset Link (Brevo Integration)
router.post('/forgot-password', async (req, res) => {
  const { email, emailOrPhone } = req.body;
  const input = (email || emailOrPhone || '').trim();

  if (!input) {
    return res.status(400).json({ error: 'Registered email address is required.' });
  }

  // Rate limiting per IP and per Email
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  if (!checkRateLimit(resetRequestStore, `ip:${clientIp}`, 5, 15 * 60 * 1000) ||
      !checkRateLimit(resetRequestStore, `email:${input.toLowerCase()}`, 5, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many password reset requests. Please wait 15 minutes before trying again.' });
  }

  const cleanEmail = input.toLowerCase();
  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  // Account enumeration protection: Return identical generic message whether account exists or not
  const genericSuccessMessage = 'If an account is associated with that email address, a password reset link has been sent. Please check your inbox and spam folder.';

  try {
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (!user) {
      // Account does not exist - return generic success response
      return res.json({ message: genericSuccessMessage });
    }

    // Generate cryptographically secure random token (single-use)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store only token hash and expiry in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: tokenHash,
        resetTokenExpiry: expiry
      }
    });

    // Send transactional email via Brevo
    try {
      await sendPasswordResetEmail(user.email, rawToken, user.name);
    } catch (emailError) {
      console.error('[AuthService ERROR] Failed to send Brevo reset email:', emailError.message);
      // Keep going to return generic response to avoid enumeration and expose provider errors to end-user
    }

    return res.json({ message: genericSuccessMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

// GET /api/auth/verify-reset-token - Check if a reset token is valid before rendering form
router.get('/verify-reset-token', async (req, res) => {
  const token = req.query.token;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ valid: false, error: 'Reset token is required.' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const user = await prisma.user.findFirst({
      where: { resetTokenHash: tokenHash }
    });

    if (!user) {
      return res.status(400).json({ valid: false, error: 'Invalid or previously used password reset link.' });
    }

    if (user.resetTokenExpiry && new Date() > new Date(user.resetTokenExpiry)) {
      return res.status(400).json({ valid: false, error: 'This password reset link has expired. Please request a new link.' });
    }

    return res.json({ valid: true, email: user.email });
  } catch (error) {
    console.error('Verify token error:', error);
    return res.status(500).json({ valid: false, error: 'Failed to verify reset token.' });
  }
});

// POST /api/auth/reset-password - Reset password using secure token (or legacy OTP)
router.post('/reset-password', async (req, res) => {
  const { token, newPassword, confirmPassword, emailOrPhone, otp } = req.body;

  // Rate limiting attempts
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  if (!checkRateLimit(resetAttemptStore, `attempt:${clientIp}`, 10, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many password reset attempts. Please wait 15 minutes before trying again.' });
  }

  // Token-based password reset (Primary secure workflow)
  if (token) {
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    try {
      const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

      const user = await prisma.user.findFirst({
        where: { resetTokenHash: tokenHash }
      });

      if (!user) {
        return res.status(400).json({ error: 'Invalid or previously used password reset token. Please request a new link.' });
      }

      if (user.resetTokenExpiry && new Date() > new Date(user.resetTokenExpiry)) {
        return res.status(400).json({ error: 'Password reset link has expired. Please request a new link.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Invalidate token immediately and update password atomically
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetTokenHash: null,
          resetTokenExpiry: null,
          resetOtp: null,
          resetOtpExpiry: null
        }
      });

      return res.json({ message: 'Password has been reset successfully! You can now log in with your new password.' });
    } catch (error) {
      console.error('Token reset password error:', error);
      return res.status(500).json({ error: 'Failed to reset password.' });
    }
  }

  // Backward-compatible OTP-based password reset
  if (emailOrPhone && otp) {
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
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

      if (!user || !user.resetOtp || user.resetOtp !== otp.trim()) {
        return res.status(400).json({ error: 'Invalid reset request or OTP mismatch.' });
      }

      if (user.resetOtpExpiry && new Date() > new Date(user.resetOtpExpiry)) {
        return res.status(400).json({ error: 'OTP code has expired. Please request a new code.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetOtp: null,
          resetOtpExpiry: null,
          resetTokenHash: null,
          resetTokenExpiry: null
        }
      });

      return res.json({ message: 'Password reset successfully! You can now log in with your new password.' });
    } catch (error) {
      console.error('OTP reset password error:', error);
      return res.status(500).json({ error: 'Failed to reset password.' });
    }
  }

  return res.status(400).json({ error: 'A valid reset token and new password are required.' });
});

// POST /api/auth/resend-otp - Backward compatibility
router.post('/resend-otp', async (req, res) => {
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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetOtp: otp,
        resetOtpExpiry: expiry
      }
    });

    try {
      await sendOtpEmail(user.email, otp, user.name);
    } catch (emailError) {
      console.error('Failed to resend OTP email:', emailError.message);
    }

    return res.json({
      message: `A new verification code has been dispatched.`,
      email: user.email
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({ error: 'Failed to resend OTP.' });
  }
});

// POST /api/auth/verify-otp - Backward compatibility
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

// ADMIN API: DELETE /api/auth/admin/users/:id - Remove customer or user account
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
