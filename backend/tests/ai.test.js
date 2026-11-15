import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../src/server.js';
import prisma from '../src/prisma.js';
import { getJwtSecret } from '../src/middleware/auth.js';

describe('GymConnect Gemini AI Assistant & Diet Planner Suite', { timeout: 45000 }, () => {
  let server;
  let baseUrl;
  let authToken;

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

    // Create or find a test customer for authenticated AI endpoints
    const testEmail = 'test.ai.customer@gymconnect.test';
    let user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: testEmail,
          password: 'Password123!',
          name: 'AI Test User',
          role: 'CUSTOMER'
        }
      });
    }

    authToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      getJwtSecret(),
      { expiresIn: '1h' }
    );
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await prisma.$disconnect().catch(() => {});
  });

  it('Case 1: AI Chat explains the actual login process step-by-step when asked how to log in', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'How do I log in to GymConnect?' })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.reply, 'Should return a reply string');
    const lowerReply = data.reply.toLowerCase();

    // Must explain login steps, NOT a generic support ticket!
    assert.ok(lowerReply.includes('sign in') || lowerReply.includes('log in'), 'Should mention Sign In / Log in');
    assert.ok(lowerReply.includes('email') || lowerReply.includes('password'), 'Should explain entering email and password');
    assert.ok(lowerReply.includes('1.') || lowerReply.includes('step'), 'Should be structured step-by-step');
    assert.ok(!lowerReply.includes('we have logged this with our customer support team'), 'Should not be the old generic hardcoded ticket message');
  });

  it('Case 2: AI Chat answers gym discovery and city queries', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'How can I find gyms in Jaipur near me?' })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.reply);
    const reply = data.reply.toLowerCase();
    assert.ok(reply.includes('find gyms') || reply.includes('near me') || reply.includes('jaipur'));
  });

  it('Case 3: AI Chat answers product store and cart troubleshooting questions', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'My product is not getting added to cart. How do I buy supplements?' })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.reply);
    const reply = data.reply.toLowerCase();
    assert.ok(reply.includes('store') || reply.includes('cart') || reply.includes('supplement'));
  });

  it('Case 4: Rejects empty or invalid chat messages with 400', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '   ' })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  it('Case 5: Generates a complete structured vegetarian personalized diet plan', async () => {
    const res = await fetch(`${baseUrl}/api/ai/diet-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        age: 26,
        height: 175,
        weight: 72,
        fitnessGoal: 'Muscle building',
        dietaryPreference: 'Vegetarian',
        allergies: 'None',
        activityLevel: 'Moderately active',
        mealsPerDay: 4,
        budget: 'Moderate',
        cuisine: 'North Indian'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.plan, 'Should return plan object');
    const plan = data.plan;

    // Validate structured diet plan properties
    assert.ok(plan.title);
    assert.ok(plan.overview);
    assert.ok(typeof plan.overview.caloriesApprox === 'number' && plan.overview.caloriesApprox > 1500);
    assert.ok(typeof plan.overview.proteinApprox === 'number' && plan.overview.proteinApprox > 50);

    // Validate daily plan meals
    assert.ok(Array.isArray(plan.dailyPlan) && plan.dailyPlan.length >= 3);
    const firstMeal = plan.dailyPlan[0];
    assert.ok(firstMeal.mealTime);
    assert.ok(firstMeal.mealName);
    assert.ok(Array.isArray(firstMeal.foodItems) && firstMeal.foodItems.length > 0);
    assert.ok(firstMeal.portionGuidance);
    assert.ok(firstMeal.calories > 0);

    // Validate 7-day weekly schedule
    assert.ok(Array.isArray(plan.weeklySchedule) && plan.weeklySchedule.length === 7);
    assert.strictEqual(plan.weeklySchedule[0].day, 'Monday');

    // Validate hydration and grocery list
    assert.ok(plan.hydration && plan.hydration.dailyLiters);
    assert.ok(plan.groceryList && Object.keys(plan.groceryList).length > 0);
    assert.ok(plan.safetyDisclaimer, 'Must include wellness safety disclaimer');
  });

  it('Case 6: Replaces a meal with appropriate alternatives', async () => {
    const res = await fetch(`${baseUrl}/api/ai/diet-plan/replace-meal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mealName: 'Lunch',
        currentFood: 'Paneer Bhurji with Roti',
        dietaryPreference: 'Vegetarian'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.replacement);
    assert.ok(data.replacement.food);
    assert.ok(data.replacement.protein > 0);
  });

  it('Case 7: Unauthenticated user cannot save diet plan', async () => {
    const res = await fetch(`${baseUrl}/api/ai/diet-plan/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'My Custom Plan',
        planData: { test: true }
      })
    });

    assert.strictEqual(res.status, 401);
  });

  it('Case 8: Authenticated user can save, retrieve, and delete personalized diet plans', async () => {
    // 1. Save plan
    const saveRes = await fetch(`${baseUrl}/api/ai/diet-plan/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        title: 'Automated Test Muscle Plan',
        fitnessGoal: 'Muscle building',
        dietaryPref: 'Vegetarian',
        caloriesApprox: 2400,
        proteinApprox: 130,
        planData: {
          title: 'Automated Test Muscle Plan',
          sample: true
        }
      })
    });

    assert.strictEqual(saveRes.status, 201);
    const saveBody = await saveRes.json();
    const savedId = saveBody.savedPlan.id;
    assert.ok(savedId);

    // 2. Fetch saved plans
    const getRes = await fetch(`${baseUrl}/api/ai/diet-plan/saved`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    assert.strictEqual(getRes.status, 200);
    const getBody = await getRes.json();
    assert.ok(getBody.plans.some(p => p.id === savedId));

    // 3. Clean up created test plan
    const delRes = await fetch(`${baseUrl}/api/ai/diet-plan/${savedId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    assert.strictEqual(delRes.status, 200);
  });
});
