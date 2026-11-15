import express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';
import { getJwtSecret } from '../middleware/auth.js';
import {
  handleChatMessage,
  generateDietPlan,
  checkRateLimit
} from '../services/geminiService.js';

const router = express.Router();

// Middleware: Optional Authentication (Extracts user if valid Bearer token provided, but doesn't block guests)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
  } catch (err) {
    req.user = null; // Expired or invalid token still allowed as guest
  }
  next();
};

// Middleware: Strict Authentication
const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

// POST /api/ai/chat - Intelligent Assistant Conversation
router.post('/chat', optionalAuth, async (req, res) => {
  const clientIdentifier = req.user?.id || req.ip || 'anonymous';
  
  if (!checkRateLimit(clientIdentifier)) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment before sending another message.',
      reply: 'You are sending messages too quickly! Please wait a few seconds and try again.'
    });
  }

  const { message, history } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    const response = await handleChatMessage({
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      user: req.user
    });

    return res.json(response);
  } catch (error) {
    console.error('[AI Chat Route Error]:', error);
    return res.status(500).json({
      error: 'Failed to process chat message.',
      reply: "I experienced a temporary hitch processing that request. Please try again or click 'Contact Support' if you need immediate assistance."
    });
  }
});

// POST /api/ai/diet-plan - Generate Personalized Diet Plan
router.post('/diet-plan', optionalAuth, async (req, res) => {
  const clientIdentifier = req.user?.id || req.ip || 'anonymous';
  
  if (!checkRateLimit(clientIdentifier)) {
    return res.status(429).json({
      error: 'Too many diet generation requests. Please wait a moment.'
    });
  }

  const {
    age,
    height,
    weight,
    fitnessGoal,
    dietaryPreference,
    allergies,
    activityLevel,
    mealsPerDay,
    foodPreferences,
    budget,
    cuisine,
    context
  } = req.body;

  if (!fitnessGoal || !dietaryPreference) {
    return res.status(400).json({ error: 'Fitness goal and dietary preference are required.' });
  }

  try {
    const plan = await generateDietPlan({
      age: Number(age) || 25,
      height: Number(height) || 172,
      weight: Number(weight) || 68,
      fitnessGoal,
      dietaryPreference,
      allergies: allergies || 'None',
      activityLevel: activityLevel || 'Moderately active',
      mealsPerDay: Number(mealsPerDay) || 4,
      foodPreferences: foodPreferences || '',
      budget: budget || 'Moderate',
      cuisine: cuisine || 'North Indian',
      context: context || ''
    });

    return res.json({ success: true, plan });
  } catch (error) {
    console.error('[AI Diet Plan Route Error]:', error);
    return res.status(500).json({ error: 'Failed to generate diet plan.' });
  }
});

// POST /api/ai/diet-plan/save - Save generated plan for authenticated user
router.post('/diet-plan/save', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { title, fitnessGoal, dietaryPref, caloriesApprox, proteinApprox, planData } = req.body;

  if (!planData || !title) {
    return res.status(400).json({ error: 'Plan data and title are required.' });
  }

  try {
    const saved = await prisma.dietPlan.create({
      data: {
        userId,
        title,
        fitnessGoal: fitnessGoal || 'General Fitness',
        dietaryPref: dietaryPref || 'Vegetarian',
        caloriesApprox: caloriesApprox ? Number(caloriesApprox) : null,
        proteinApprox: proteinApprox ? Number(proteinApprox) : null,
        planData
      }
    });

    return res.status(201).json({ success: true, savedPlan: saved });
  } catch (error) {
    console.error('[Save Diet Plan Error]:', error);
    return res.status(500).json({ error: 'Failed to save diet plan.' });
  }
});

// GET /api/ai/diet-plan/saved - Fetch saved plans for authenticated user
router.get('/diet-plan/saved', requireAuth, async (req, res) => {
  const userId = req.user.id;

  try {
    const plans = await prisma.dietPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ success: true, count: plans.length, plans });
  } catch (error) {
    console.error('[Fetch Saved Diet Plans Error]:', error);
    return res.status(500).json({ error: 'Failed to fetch saved diet plans.' });
  }
});

// DELETE /api/ai/diet-plan/:id - Delete a saved plan
router.delete('/diet-plan/:id', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const existing = await prisma.dietPlan.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Saved diet plan not found.' });
    }

    await prisma.dietPlan.delete({ where: { id } });
    return res.json({ success: true, message: 'Diet plan removed.' });
  } catch (error) {
    console.error('[Delete Diet Plan Error]:', error);
    return res.status(500).json({ error: 'Failed to delete diet plan.' });
  }
});

// POST /api/ai/diet-plan/replace-meal - Replace a specific meal item
router.post('/diet-plan/replace-meal', optionalAuth, async (req, res) => {
  const { mealName, currentFood, dietaryPreference = 'Vegetarian' } = req.body;

  const isVeg = dietaryPreference.toLowerCase().includes('veg') && !dietaryPreference.toLowerCase().includes('non');
  
  const alternatives = isVeg ? [
    { food: 'Paneer Stuffed Moong Dal Chilla with Mint Chutney', portion: '2 chillas (100g paneer)', calories: 380, protein: 22 },
    { food: 'Greek Yogurt Bowl with Chia Seeds, Walnuts & Banana', portion: '200g yogurt + 25g nuts', calories: 340, protein: 20 },
    { food: 'Soya Chunks Bhurji with 2 Multigrain Phulkas', portion: '50g soya chunks + 2 rotis', calories: 410, protein: 28 },
    { food: 'Quinoa & Mixed Sprouts Salad with Lemon Olive Dressing', portion: '1 large bowl (250g)', calories: 320, protein: 16 }
  ] : [
    { food: 'Scrambled Egg Whites (4) with Multigrain Toast & Avocado', portion: '4 whites + 2 toasts', calories: 350, protein: 24 },
    { food: 'Grilled Lemon Herb Chicken with Steamed Broccoli', portion: '150g chicken breast', calories: 360, protein: 36 },
    { food: 'Tuna Salad with Bell Peppers & Boiled Sweet Corn', portion: '1 medium can + greens', calories: 310, protein: 30 }
  ];

  const randomAlt = alternatives[Math.floor(Math.random() * alternatives.length)];
  return res.json({
    success: true,
    mealName: mealName || 'Replaced Meal',
    replacedFood: currentFood,
    replacement: randomAlt
  });
});

export default router;
