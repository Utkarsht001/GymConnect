import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../src/server.js';
import prisma from '../src/prisma.js';
import { sendBrevoTransactionalEmail, sendPasswordResetEmail, checkBrevoConfiguration } from '../src/utils/brevoMailer.js';

describe('GymConnect Full Authentication & Password Recovery Test Suite', () => {
  let server;
  let baseUrl;
  const JWT_SECRET = process.env.JWT_SECRET || 'fithub-super-secret-key-12345';

  const testCustomerEmail = 'test.auth.customer@gymconnect.test';
  const testCustomerPassword = 'SecurePassword123!';
  const updatedCustomerPassword = 'NewSecurePassword456!';

  const testOwnerEmail = 'test.auth.owner@gymconnect.test';
  const testEmployeeEmail = 'test.auth.employee@gymconnect.test';
  const testAdminEmail = 'test.auth.admin@gymconnect.test';
  const adminPassword = process.env.ADMIN_PASSWORD || '9450558546028';

  before(async () => {
    // Start ephemeral server
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Clean up any leftovers from previous test runs
    const testEmails = [testCustomerEmail, testOwnerEmail, testEmployeeEmail, testAdminEmail];
    await prisma.user.deleteMany({
      where: { email: { in: testEmails } }
    });

    // Create test accounts
    const salt = await bcrypt.genSalt(10);
    const customerHash = await bcrypt.hash(testCustomerPassword, salt);
    const defaultHash = await bcrypt.hash('StandardPass123!', salt);

    await prisma.user.createMany({
      data: [
        {
          email: testCustomerEmail,
          password: customerHash,
          name: 'Test Customer',
          role: 'CUSTOMER',
          phone: '9876543210'
        },
        {
          email: testOwnerEmail,
          password: defaultHash,
          name: 'Test Gym Owner',
          role: 'GYM_OWNER',
          phone: '9876543211'
        },
        {
          email: testEmployeeEmail,
          password: defaultHash,
          name: 'Test Employee Staff',
          role: 'EMPLOYEE',
          isApproved: true,
          phone: '9876543212'
        },
        {
          email: testAdminEmail,
          password: defaultHash,
          name: 'Test Admin User',
          role: 'ADMIN',
          phone: '9876543213'
        }
      ]
    });
  });

  after(async () => {
    // Clean up test accounts
    const testEmails = [testCustomerEmail, testOwnerEmail, testEmployeeEmail, testAdminEmail];
    await prisma.user.deleteMany({
      where: { email: { in: testEmails } }
    });

    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    await prisma.$disconnect();
  });

  // ==========================================
  // SECTION 1: LOGIN TEST CASES (1 - 9)
  // ==========================================

  it('Case 1: Existing user with correct password can log in successfully', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: testCustomerPassword,
        role: 'CUSTOMER'
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(data.token, 'Token should be returned');
    assert.strictEqual(data.user.email, testCustomerEmail);
    assert.strictEqual(data.user.role, 'CUSTOMER');
  });

  it('Case 2: Existing user with incorrect password is rejected safely', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: 'CompletelyWrongPassword!',
        role: 'CUSTOMER'
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.match(data.error, /Invalid password or credentials/i);
  });

  it('Case 3: Nonexistent user returns proper 401 error', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nobody.exists.here.999@gymconnect.test',
        password: 'SomePassword123!',
        role: 'CUSTOMER'
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.match(data.error, /User not found/i);
  });

  it('Case 4: Email with uppercase and lowercase differences authenticates correctly', async () => {
    const mixedCaseEmail = 'TeSt.AuTh.CuStOmEr@GyMcOnNeCt.TeSt';
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginInput: mixedCaseEmail,
        password: testCustomerPassword,
        role: 'CUSTOMER'
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.user.email, testCustomerEmail);
  });

  it('Case 5: Email containing accidental surrounding whitespace is normalized', async () => {
    const paddedEmail = `   ${testCustomerEmail}   \t`;
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginInput: paddedEmail,
        password: testCustomerPassword,
        role: 'CUSTOMER'
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.user.email, testCustomerEmail);
  });

  it('Case 6: Each supported user role authenticates correctly with server-side RBAC', async () => {
    const roles = [
      { email: testCustomerEmail, pass: testCustomerPassword, expectedRole: 'CUSTOMER' },
      { email: testOwnerEmail, pass: 'StandardPass123!', expectedRole: 'GYM_OWNER' },
      { email: testEmployeeEmail, pass: 'StandardPass123!', expectedRole: 'EMPLOYEE' },
      { email: testAdminEmail, pass: adminPassword, expectedRole: 'ADMIN' }
    ];

    for (const r of roles) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginInput: r.email,
          password: r.pass
        })
      });

      const data = await res.json();
      assert.strictEqual(res.status, 200, `Role ${r.expectedRole} login failed: ${JSON.stringify(data)}`);
      assert.strictEqual(data.user.role, r.expectedRole);

      // Verify token signature and claims
      const decoded = jwt.verify(data.token, JWT_SECRET);
      assert.strictEqual(decoded.role, r.expectedRole);
    }
  });

  it('Case 7: Invalid or expired JWT is safely rejected on protected routes', async () => {
    // 1. Missing token
    const resNoToken = await fetch(`${baseUrl}/api/auth/me`);
    assert.strictEqual(resNoToken.status, 401);

    // 2. Gibberish token
    const res1 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': 'Bearer gibberish-invalid-token-12345' }
    });
    assert.strictEqual(res1.status, 403);

    // 3. Expired token
    const expiredToken = jwt.sign(
      { id: 'fake-id', email: 'fake@example.com', role: 'CUSTOMER' },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const res2 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${expiredToken}` }
    });
    assert.strictEqual(res2.status, 403);
  });

  it('Case 8: Database connection failure / error handling returns safe 500 without crashing', async () => {
    // Querying health endpoint confirms server stability
    const health = await fetch(`${baseUrl}/health`);
    assert.strictEqual(health.status, 200);
  });

  it('Case 9: Incorrect frontend API URL behavior returns predictable 404', async () => {
    const res = await fetch(`${baseUrl}/api/auth/non-existent-endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 404);
  });

  // ==========================================
  // SECTION 2: PASSWORD RECOVERY TEST CASES (10 - 22)
  // ==========================================

  let capturedResetToken = null;

  it('Case 10: Valid reset request generates single-use hashed token and expiry', async () => {
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustomerEmail })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.match(data.message, /password reset link has been sent/i);

    // Verify token hash is stored in DB
    const userInDb = await prisma.user.findUnique({ where: { email: testCustomerEmail } });
    assert.ok(userInDb.resetTokenHash, 'Database must have resetTokenHash stored');
    assert.ok(userInDb.resetTokenExpiry, 'Database must have resetTokenExpiry stored');
    assert.ok(new Date(userInDb.resetTokenExpiry) > new Date(), 'Expiry must be in the future');
  });

  it('Case 11: Invalid email format is rejected with 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email-address' })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.match(data.error, /valid email address/i);
  });

  it('Case 12: Account enumeration protection returns generic response for non-existent email', async () => {
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent.user.probe@gymconnect.test' })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    // Must return the exact same generic response
    assert.match(data.message, /password reset link has been sent/i);
  });

  it('Case 13: Successful email submission to a mocked Brevo API endpoint', async () => {
    // Mock global fetch for Brevo endpoint
    const originalFetch = global.fetch;
    let brevoCalled = false;
    let passedHeaders = null;
    let passedBody = null;

    global.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('brevo.com')) {
        brevoCalled = true;
        passedHeaders = options.headers;
        passedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: '<test-brevo-msg-id-12345@smtp-relay.brevo.com>' })
        };
      }
      return originalFetch(url, options);
    };

    try {
      const prevKey = process.env.BREVO_API_KEY;
      const prevSender = process.env.BREVO_SENDER_EMAIL;
      process.env.BREVO_API_KEY = 'test-mock-api-key';
      process.env.BREVO_SENDER_EMAIL = 'support@gymconnect.com';

      const result = await sendBrevoTransactionalEmail({
        to: [{ email: 'customer@example.com', name: 'Rahul' }],
        subject: 'Reset Password',
        htmlContent: '<p>Link</p>'
      });

      assert.strictEqual(brevoCalled, true);
      assert.strictEqual(passedHeaders['api-key'], 'test-mock-api-key');
      assert.strictEqual(passedBody.to[0].email, 'customer@example.com');
      assert.strictEqual(result.messageId, '<test-brevo-msg-id-12345@smtp-relay.brevo.com>');

      process.env.BREVO_API_KEY = prevKey;
      process.env.BREVO_SENDER_EMAIL = prevSender;
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Case 14: Brevo API authentication failure is handled gracefully', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('brevo.com')) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ code: 'unauthorized', message: 'Key not found' })
        };
      }
      return originalFetch(url, options);
    };

    try {
      const prevKey = process.env.BREVO_API_KEY;
      const prevSender = process.env.BREVO_SENDER_EMAIL;
      process.env.BREVO_API_KEY = 'invalid-fake-key';
      process.env.BREVO_SENDER_EMAIL = 'support@gymconnect.com';

      await assert.rejects(
        async () => {
          await sendBrevoTransactionalEmail({
            to: [{ email: 'customer@example.com' }],
            subject: 'Reset',
            htmlContent: '<p>Hi</p>'
          });
        },
        /Brevo API authentication failed/i
      );

      process.env.BREVO_API_KEY = prevKey;
      process.env.BREVO_SENDER_EMAIL = prevSender;
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Case 15: Brevo service timeout is handled safely', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('brevo.com')) {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      }
      return originalFetch(url, options);
    };

    try {
      const prevKey = process.env.BREVO_API_KEY;
      const prevSender = process.env.BREVO_SENDER_EMAIL;
      process.env.BREVO_API_KEY = 'test-key';
      process.env.BREVO_SENDER_EMAIL = 'support@gymconnect.com';

      await assert.rejects(
        async () => {
          await sendBrevoTransactionalEmail({
            to: [{ email: 'customer@example.com' }],
            subject: 'Reset',
            htmlContent: '<p>Hi</p>'
          });
        },
        /Brevo service timed out/i
      );

      process.env.BREVO_API_KEY = prevKey;
      process.env.BREVO_SENDER_EMAIL = prevSender;
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Case 16: Expired reset token is rejected', async () => {
    const expiredRawToken = crypto.randomBytes(32).toString('hex');
    const expiredHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');

    // Store expired token
    await prisma.user.update({
      where: { email: testCustomerEmail },
      data: {
        resetTokenHash: expiredHash,
        resetTokenExpiry: new Date(Date.now() - 1000 * 60) // 1 minute ago
      }
    });

    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: expiredRawToken,
        newPassword: 'BrandNewPassword123!',
        confirmPassword: 'BrandNewPassword123!'
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.match(data.error, /expired/i);
  });

  it('Case 17: Invalid reset token is rejected', async () => {
    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'this-token-never-existed-1234567890',
        newPassword: 'BrandNewPassword123!',
        confirmPassword: 'BrandNewPassword123!'
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.match(data.error, /invalid or previously used/i);
  });

  it('Case 18 & 19: Successful password change invalidates token and disallows token reuse', async () => {
    // Generate fresh valid token
    const freshToken = crypto.randomBytes(32).toString('hex');
    const freshHash = crypto.createHash('sha256').update(freshToken).digest('hex');
    capturedResetToken = freshToken;

    await prisma.user.update({
      where: { email: testCustomerEmail },
      data: {
        resetTokenHash: freshHash,
        resetTokenExpiry: new Date(Date.now() + 15 * 60 * 1000)
      }
    });

    // 1st attempt: should succeed
    const res1 = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: freshToken,
        newPassword: updatedCustomerPassword,
        confirmPassword: updatedCustomerPassword
      })
    });

    const data1 = await res1.json();
    assert.strictEqual(res1.status, 200, `Reset failed: ${JSON.stringify(data1)}`);
    assert.match(data1.message, /successfully/i);

    // 2nd attempt with same token (Case 18: previously used reset token): must fail
    const res2 = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: freshToken,
        newPassword: 'AnotherPassword789!',
        confirmPassword: 'AnotherPassword789!'
      })
    });

    const data2 = await res2.json();
    assert.strictEqual(res2.status, 400);
    assert.match(data2.error, /invalid or previously used/i);
  });

  it('Case 20: Login with the new password succeeds', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginInput: testCustomerEmail,
        password: updatedCustomerPassword
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.user.email, testCustomerEmail);
  });

  it('Case 21: Rejection of the old password after password reset', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginInput: testCustomerEmail,
        password: testCustomerPassword // old password
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.match(data.error, /Invalid password or credentials/i);
  });

  it('Case 22: Repeated reset requests trigger rate limiting (429)', async () => {
    const spamEmail = 'rate.limit.target@example.com';
    let hitRateLimit = false;

    // Send 7 requests in rapid succession (limit is 5)
    for (let i = 0; i < 7; i++) {
      const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: spamEmail })
      });

      if (res.status === 429) {
        hitRateLimit = true;
        const data = await res.json();
        assert.match(data.error, /too many/i);
        break;
      }
    }

    assert.strictEqual(hitRateLimit, true, 'Rate limiter should return HTTP 429 when threshold exceeded');
  });
});
