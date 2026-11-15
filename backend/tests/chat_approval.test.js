import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../src/server.js';
import prisma from '../src/prisma.js';
import { getJwtSecret } from '../src/middleware/auth.js';

describe('GymConnect Live Chat & Admin Gym Approval Suite', { timeout: 45000 }, () => {
  let server;
  let baseUrl;
  let adminToken;
  let ownerToken;
  let customerToken;
  let testAdminUser;
  let testOwnerUser;
  let testCustomerUser;
  let testGym;

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

    const jwtSecret = getJwtSecret();

    // 1. Setup Test Admin
    const adminEmail = `test.admin.${Date.now()}@gymconnect.test`;
    testAdminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password: 'Password123!',
        name: 'Super Admin Tester',
        role: 'ADMIN',
        isApproved: true
      }
    });
    adminToken = jwt.sign(
      { id: testAdminUser.id, email: testAdminUser.email, role: 'ADMIN', name: testAdminUser.name },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // 2. Setup Test Gym Owner
    const ownerEmail = `test.owner.${Date.now()}@gymconnect.test`;
    testOwnerUser = await prisma.user.create({
      data: {
        email: ownerEmail,
        password: 'Password123!',
        name: 'Gym Owner Tester',
        role: 'GYM_OWNER',
        isApproved: true
      }
    });
    ownerToken = jwt.sign(
      { id: testOwnerUser.id, email: testOwnerUser.email, role: 'GYM_OWNER', name: testOwnerUser.name },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // 3. Setup Test Customer
    const customerEmail = `test.customer.${Date.now()}@gymconnect.test`;
    testCustomerUser = await prisma.user.create({
      data: {
        email: customerEmail,
        password: 'Password123!',
        name: 'Fitness Member Tester',
        role: 'CUSTOMER',
        isApproved: true
      }
    });
    customerToken = jwt.sign(
      { id: testCustomerUser.id, email: testCustomerUser.email, role: 'CUSTOMER', name: testCustomerUser.name },
      jwtSecret,
      { expiresIn: '1h' }
    );
  });

  after(async () => {
    try {
      if (testGym?.id) {
        await prisma.message.deleteMany({
          where: {
            OR: [
              { senderId: testCustomerUser?.id },
              { receiverId: testCustomerUser?.id },
              { senderId: testOwnerUser?.id },
              { receiverId: testOwnerUser?.id }
            ]
          }
        });
        await prisma.gym.deleteMany({ where: { id: testGym.id } });
      }
      if (testAdminUser?.id) await prisma.user.delete({ where: { id: testAdminUser.id } }).catch(() => {});
      if (testOwnerUser?.id) await prisma.user.delete({ where: { id: testOwnerUser.id } }).catch(() => {});
      if (testCustomerUser?.id) await prisma.user.delete({ where: { id: testCustomerUser.id } }).catch(() => {});
    } catch (e) {
      // Ignore cleanup errors
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await prisma.$disconnect().catch(() => {});
  });

  // ==========================================
  // SECTION 1: ADMIN GYM APPROVAL WORKFLOW
  // ==========================================

  it('1. Newly created gym must NEVER be auto-approved (Default: PENDING, isApproved: false)', async () => {
    const gymPayload = {
      name: `Test Arena ${Date.now()}`,
      description: 'High performance training center with modern equipment',
      address: '100 Fitness Boulevard',
      city: 'Jaipur',
      contactNumber: '+919876543210',
      email: testOwnerUser.email,
      latitude: 26.9124,
      longitude: 75.7873
    };

    const res = await fetch(`${baseUrl}/api/gyms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify(gymPayload)
    });

    assert.strictEqual(res.status, 201, 'Should create gym profile');
    testGym = await res.json();

    assert.strictEqual(testGym.isApproved, false, 'Gym must NOT be approved on creation');
    assert.strictEqual(testGym.approvalStatus, 'PENDING', 'Default status must be PENDING');
    assert.strictEqual(testGym.rejectionReason, null, 'Rejection reason must be null');
  });

  it('2. Pending gym must NOT appear in public discovery/search listing', async () => {
    const res = await fetch(`${baseUrl}/api/gyms?search=${encodeURIComponent(testGym.name)}`);
    assert.strictEqual(res.status, 200);
    const list = await res.json();

    const found = list.find((g) => g.id === testGym.id);
    assert.strictEqual(found, undefined, 'Pending gym must be hidden from public search');
  });

  it('3. Public unauthenticated visitor cannot access pending gym details directly', async () => {
    const res = await fetch(`${baseUrl}/api/gyms/${testGym.id}`);
    assert.strictEqual(res.status, 403, 'Should block public access to unapproved gym');
  });

  it('4. Non-admin users cannot approve or reject gyms (Strict RBAC)', async () => {
    const resApprove = await fetch(`${baseUrl}/api/gyms/${testGym.id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.strictEqual(resApprove.status, 403, 'Customer cannot approve gym');

    const resReject = await fetch(`${baseUrl}/api/gyms/${testGym.id}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({ rejectionReason: 'Valid reason here' })
    });
    assert.strictEqual(resReject.status, 403, 'Owner cannot reject gym');
  });

  it('5. Admin rejection fails if rejection reason is missing or shorter than 10 characters', async () => {
    const resNoReason = await fetch(`${baseUrl}/api/gyms/${testGym.id}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ rejectionReason: '' })
    });
    assert.strictEqual(resNoReason.status, 400, 'Rejection reason is mandatory');

    const resShortReason = await fetch(`${baseUrl}/api/gyms/${testGym.id}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ rejectionReason: 'Too short' })
    });
    assert.strictEqual(resShortReason.status, 400, 'Rejection reason must be >= 10 chars');
  });

  it('6. Admin can reject gym with valid reason and record feedback', async () => {
    const reasonText = 'Equipment photos missing certified safety standards certificate.';
    const res = await fetch(`${baseUrl}/api/gyms/${testGym.id}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ rejectionReason: reasonText })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.gym.approvalStatus, 'REJECTED');
    assert.strictEqual(data.gym.isApproved, false);
    assert.strictEqual(data.gym.rejectionReason, reasonText);
  });

  it('7. Admin can approve gym, making it live and visible in public search', async () => {
    const res = await fetch(`${baseUrl}/api/gyms/${testGym.id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.gym.approvalStatus, 'APPROVED');
    assert.strictEqual(data.gym.isApproved, true);
    assert.strictEqual(data.gym.rejectionReason, null);

    // Verify it now appears in public search
    const publicRes = await fetch(`${baseUrl}/api/gyms?search=${encodeURIComponent(testGym.name)}`);
    assert.strictEqual(publicRes.status, 200);
    const list = await publicRes.json();
    const found = list.find((g) => g.id === testGym.id);
    assert.ok(found, 'Approved gym must now be visible in public search');
  });

  // ==========================================
  // SECTION 2: LIVE CHAT & MESSAGING SYSTEM
  // ==========================================

  it('8. Customer can start conversation and send message to Gym Owner via REST', async () => {
    const messageContent = 'Hello! What are your peak morning hours for weight training?';
    const res = await fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        receiverId: testOwnerUser.id,
        content: messageContent
      })
    });

    assert.strictEqual(res.status, 201, 'Should create and persist message in database');
    const msg = await res.json();
    assert.strictEqual(msg.senderId, testCustomerUser.id);
    assert.strictEqual(msg.receiverId, testOwnerUser.id);
    assert.strictEqual(msg.content, messageContent);
    assert.strictEqual(msg.isRead, false);
  });

  it('9. Gym Owner receives message in conversation history and it marks incoming as read', async () => {
    const res = await fetch(`${baseUrl}/api/messages/history/${testCustomerUser.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });

    assert.strictEqual(res.status, 200);
    const history = await res.json();
    assert.ok(Array.isArray(history), 'History should be an array');
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].senderId, testCustomerUser.id);
    assert.strictEqual(history[0].receiverId, testOwnerUser.id);
    assert.strictEqual(history[0].isRead, true, 'Opening history marks messages as read');
  });

  it('10. Gym Owner can reply to Customer, maintaining two-way thread', async () => {
    const replyContent = 'Hi! Our peak hours are 7am - 9am. Early mornings 6am - 7am are nice and quiet!';
    const res = await fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        receiverId: testCustomerUser.id,
        content: replyContent
      })
    });

    assert.strictEqual(res.status, 201);
    const reply = await res.json();
    assert.strictEqual(reply.senderId, testOwnerUser.id);
    assert.strictEqual(reply.receiverId, testCustomerUser.id);

    // Verify chronological ordering in thread
    const threadRes = await fetch(`${baseUrl}/api/messages/history/${testOwnerUser.id}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const thread = await threadRes.json();
    assert.strictEqual(thread.length, 2, 'Should have both customer message and owner reply');
    assert.strictEqual(thread[0].senderId, testCustomerUser.id);
    assert.strictEqual(thread[1].senderId, testOwnerUser.id);
  });

  it('11. Unique conversation summaries appear correctly in GET /api/messages/conversations', async () => {
    const res = await fetch(`${baseUrl}/api/messages/conversations`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    assert.strictEqual(res.status, 200);
    const convs = await res.json();
    assert.ok(Array.isArray(convs));
    assert.strictEqual(convs.length, 1);
    assert.strictEqual(convs[0].otherUser.id, testOwnerUser.id);
    assert.ok(convs[0].lastMessage.includes('peak hours'));
  });
});
