import { GoogleGenAI } from '@google/genai';
import prisma from '../prisma.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Initialize SDK client if key is configured
let genAI = null;
if (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== '') {
  try {
    genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY.trim() });
  } catch (err) {
    console.warn('[GeminiService] Failed to initialize GoogleGenAI client:', err.message);
  }
}

// In-memory rate limiting map: ipOrUser -> timestamp[]
const rateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

export const checkRateLimit = (identifier) => {
  const now = Date.now();
  const timestamps = rateLimits.get(identifier) || [];
  const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  validTimestamps.push(now);
  rateLimits.set(identifier, validTimestamps);
  return true;
};

// Periodic cleanup of stale rate limits
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimits.entries()) {
    const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      rateLimits.delete(key);
    } else {
      rateLimits.set(key, valid);
    }
  }
}, 5 * 60 * 1000).unref();

// GymConnect Tool Definitions for Gemini Function Calling
export const gymConnectToolDeclarations = [
  {
    name: 'searchGyms',
    description: 'Search for verified gyms by city, name keyword, or amenities.',
    parameters: {
      type: 'OBJECT',
      properties: {
        city: { type: 'STRING', description: 'City name (e.g., Jaipur, Delhi)' },
        query: { type: 'STRING', description: 'Gym name or keyword search' }
      }
    }
  },
  {
    name: 'getGymDetails',
    description: 'Get in-depth details of a specific gym, including contact info, address, operating hours, and membership plans.',
    parameters: {
      type: 'OBJECT',
      properties: {
        gymId: { type: 'STRING', description: 'Unique Gym ID' },
        gymName: { type: 'STRING', description: 'Exact or partial gym name' }
      }
    }
  },
  {
    name: 'searchProducts',
    description: 'Search the GymConnect fitness store for equipment, apparel, or workout supplements.',
    parameters: {
      type: 'OBJECT',
      properties: {
        category: { type: 'STRING', description: 'Category: SUPPLEMENTS, EQUIPMENT, APPAREL, or ACCESSORIES' },
        query: { type: 'STRING', description: 'Product search term (e.g., Whey Protein, Dumbbells)' }
      }
    }
  },
  {
    name: 'getOrderStatus',
    description: 'Look up real-time status of orders placed by the current logged-in customer.',
    parameters: {
      type: 'OBJECT',
      properties: {
        orderId: { type: 'STRING', description: 'Specific Order ID (optional)' }
      }
    }
  },
  {
    name: 'createSupportTicket',
    description: 'Lodge a formal customer support complaint or refund request for the logged-in customer.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Short summary of the issue or complaint' },
        description: { type: 'STRING', description: 'Detailed problem description and steps attempted' }
      },
      required: ['title', 'description']
    }
  },
  {
    name: 'getSupportTicketStatus',
    description: 'Check status of customer support complaint tickets for the logged-in user.',
    parameters: {
      type: 'OBJECT',
      properties: {
        ticketId: { type: 'STRING', description: 'Complaint Ticket ID (optional)' }
      }
    }
  }
];

// Tool Execution Implementation accessing real database
export const executeTool = async (name, args, user) => {
  try {
    switch (name) {
      case 'searchGyms': {
        const where = { isApproved: true };
        if (args.city) {
          where.city = { contains: args.city, mode: 'insensitive' };
        }
        if (args.query) {
          where.name = { contains: args.query, mode: 'insensitive' };
        }
        const gyms = await prisma.gym.findMany({
          where,
          take: 5,
          select: {
            id: true,
            name: true,
            city: true,
            address: true,
            openingHours: true,
            contactNumber: true,
            plans: { select: { id: true, name: true, price: true, durationDays: true } }
          }
        });
        return { count: gyms.length, gyms };
      }

      case 'getGymDetails': {
        const where = {};
        if (args.gymId) where.id = args.gymId;
        else if (args.gymName) where.name = { contains: args.gymName, mode: 'insensitive' };
        else return { error: 'Please specify gymId or gymName.' };

        const gym = await prisma.gym.findFirst({
          where,
          include: {
            plans: true,
            facilities: { include: { facility: true } }
          }
        });
        if (!gym) return { found: false, message: 'Gym not found.' };
        return {
          found: true,
          id: gym.id,
          name: gym.name,
          city: gym.city,
          address: gym.address,
          openingHours: gym.openingHours,
          contactNumber: gym.contactNumber,
          plans: gym.plans.map(p => ({ id: p.id, name: p.name, price: p.price, durationDays: p.durationDays })),
          facilities: gym.facilities.map(f => f.facility.name)
        };
      }

      case 'searchProducts': {
        const where = { stock: { gt: 0 } };
        if (args.category) where.category = args.category.toUpperCase();
        if (args.query) where.name = { contains: args.query, mode: 'insensitive' };

        const products = await prisma.product.findMany({
          where,
          take: 6,
          select: {
            id: true,
            name: true,
            category: true,
            price: true,
            stock: true,
            discount: true,
            description: true
          }
        });
        return { count: products.length, products };
      }

      case 'getOrderStatus': {
        if (!user || !user.id) {
          return { error: 'Authentication required. Please sign in to view your orders.' };
        }
        const where = { customerId: user.id };
        if (args.orderId) where.id = args.orderId;

        const orders = await prisma.order.findMany({
          where,
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: { product: { select: { name: true } } }
            }
          }
        });
        return { count: orders.length, orders };
      }

      case 'createSupportTicket': {
        if (!user || !user.id) {
          return { error: 'Please sign in to lodge a formal support ticket, or provide your email address.' };
        }
        const complaint = await prisma.complaint.create({
          data: {
            customerId: user.id,
            title: args.title || 'Customer Support Request',
            description: args.description || 'Customer raised an issue via AI Assistant.',
            status: 'PENDING'
          }
        });
        return {
          success: true,
          ticketId: complaint.id,
          title: complaint.title,
          status: complaint.status,
          message: `Support Ticket #${complaint.id.substring(0, 8)} has been created successfully. Our support desk will review it promptly.`
        };
      }

      case 'getSupportTicketStatus': {
        if (!user || !user.id) {
          return { error: 'Please sign in to check your support ticket status.' };
        }
        const where = { customerId: user.id };
        if (args.ticketId) where.id = args.ticketId;

        const tickets = await prisma.complaint.findMany({
          where,
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            updatedAt: true
          }
        });
        return { count: tickets.length, tickets };
      }

      default:
        return { error: `Tool ${name} is not supported.` };
    }
  } catch (err) {
    console.error(`[Tool Execution Error] ${name}:`, err.message);
    return { error: `Failed to execute ${name}: ${err.message}` };
  }
};

// System Prompt for GymConnect AI Assistant
export const SYSTEM_INSTRUCTION = `
You are the GymConnect AI Assistant, an intelligent, empathetic, and professional customer support, fitness, and diet planning assistant for the GymConnect fitness platform (located at https://gym-connect-six.vercel.app).

Your core mission is to assist GymConnect customers, gym owners, and fitness enthusiasts with:
1. Account & Authentication:
   - Registration: Click 'Sign In' at top right -> Switch to 'Create Account' tab -> Fill Name, Email, Phone, Password -> Select Role ('Customer' or 'Gym Owner').
   - Login: Click 'Sign In' -> Enter registered Email/Phone & Password -> Sign In.
   - Password Recovery: Click 'Forgot Password?' on login modal -> Enter registered email -> Brevo sends a secure single-use password reset link.
   - Troubleshooting: Check credentials, verify caps lock, check email spam folder for reset link.
2. Gym Discovery & Facilities:
   - Find Gyms: Navigate to '/gyms' (Find Gyms in Navbar).
   - Use city search, name filter, or click 'Near Me' to detect geolocation coordinates.
   - Filter by facilities: Cardio, Free Weights, CrossFit, Sauna, Steam Bath, Personal Training.
   - View detailed profile, photos, operating hours, and transparent membership plan prices.
   - Chat with gym owners via the 'Chat with Gym' button.
3. Membership Plans:
   - Transparent tiers: Monthly, Quarterly, Annual passes with free guest pass/trial days where offered.
   - Instant booking with UPI / Bank transfer direct payment to gym owner.
4. Fitness Store & Orders:
   - Browse workout gear, fitness equipment, and health supplements at '/store'.
   - Add to cart, adjust quantities, enter delivery shipping address and contact number on '/cart'.
   - Track active order status (Pending, Confirmed, Packed, Shipped, Delivered).
5. Customer Support & Problem Solving:
   - Always attempt to understand and solve the problem step-by-step first.
   - If an issue cannot be resolved or requires staff action, offer to create a formal Support Ticket (using 'createSupportTicket' tool).
   - Once a ticket is created, display the real Ticket ID.
6. Fitness & Nutrition Guidance:
   - Provide beginner workout routines, exercise technique tips, warm-up/cool-down, and muscle group advice.
   - When generating diet plans, emphasize balanced macronutrients, hydration, healthy Indian and global food staples (Roti, Dal, Paneer, Curd, Oats, Eggs, Chicken, Rice).
   - NEVER provide medical diagnosis, prescription, or promise extreme weight-loss. Advise consulting healthcare professionals for pregnancy, medical conditions, or minors.

Tone & Style:
- Friendly, warm, helpful, structured, and concise.
- Use numbered steps for instructions.
- Support English, Hindi, and Hinglish naturally.
- Only talk about GymConnect, fitness, health, nutrition, and customer support. If asked about totally unrelated topics (e.g. politics, coding puzzles), politely reply:
  "I'm your GymConnect AI Assistant. I specialize in GymConnect services, gym discovery, memberships, fitness store orders, workout guidance, and nutrition planning. How can I assist you with your fitness journey today?"
`;

// Smart Fallback Engine: Answers questions intelligently even when GEMINI_API_KEY is not configured
export const solveWithKnowledgeBase = async (message, user) => {
  const q = (message || '').toLowerCase().trim();

  // 1. Login & Registration
  if (q.includes('how to log in') || q.includes('how do i log in') || q.includes('login') || q.includes('sign in') || q.includes('log in')) {
    return {
      reply: `To log in to your GymConnect account:

1. **Open GymConnect**: Navigate to the [GymConnect website](https://gym-connect-six.vercel.app).
2. **Click Sign In**: Click the **Sign In** button located in the top navigation bar.
3. **Select Your Role**: Choose whether you are logging in as a **Customer**, **Gym Owner**, **Employee**, or **Admin**.
4. **Enter Credentials**: Provide your registered **Email Address** (or phone number) and **Password**.
5. **Click Sign In**: Press the **Sign In** button to access your personalized dashboard!

💡 *Forgot your password?* Click the **"Forgot Password?"** link on the login modal to receive a secure password reset link via email.`,
      quickActions: ['Forgot Password Help', 'How to Register', 'Find a Gym']
    };
  }

  if (q.includes('register') || q.includes('sign up') || q.includes('create account') || q.includes('join')) {
    return {
      reply: `Creating a GymConnect account is quick and free! Here is how:

1. Click **Sign In** at the top right of the navigation bar.
2. Select the **"Create Account"** tab at the top of the modal.
3. Fill in your details:
   - **Full Name**
   - **Email Address**
   - **Contact Phone**
   - **Secure Password** (minimum 6 characters)
4. Choose your account type:
   - **Customer**: For searching gyms, purchasing passes, and shopping fitness gear.
   - **Gym Owner**: For listing your club, managing facilities, and selling packages.
5. Click **Create Account** to complete registration!`,
      quickActions: ['Log In Now', 'Find Gyms', 'Membership Help']
    };
  }

  // 2. Forgot Password / Reset Password
  if (q.includes('forgot password') || q.includes('reset password') || q.includes('change password')) {
    return {
      reply: `Here is how to reset your GymConnect password:

1. Click **Sign In** in the top navigation bar.
2. Click the **"Forgot password?"** link beneath the password field.
3. Enter your **registered email address** in the recovery prompt.
4. Click **"Send Reset Link"**.
5. Check your email inbox (and spam/junk folder) for a message from GymConnect Support with your single-use reset link.
6. Click the link to set your new secure password!

If you still don't receive the email, let me know and I can help create a priority support ticket for you.`,
      quickActions: ['Create Support Ticket', 'Try Login Again']
    };
  }

  // 3. Gym Discovery & Locations
  if (q.includes('find gym') || q.includes('nearby') || q.includes('near me') || q.includes('search gym') || q.includes('gyms in') || q.includes('jaipur')) {
    let gyms = [];
    try {
      const cityMatch = q.match(/in ([a-zA-Z]+)/);
      const city = cityMatch ? cityMatch[1] : '';
      const toolRes = await executeTool('searchGyms', { city });
      gyms = toolRes.gyms || [];
    } catch (e) {}

    let reply = `Here is how to discover gyms on GymConnect:

1. Click **[Find Gyms](https://gym-connect-six.vercel.app/gyms)** in the top navigation.
2. **Near Me Search**: Click the **"Near Me"** button to allow browser geolocation and view fitness centers closest to your coordinates.
3. **Filter by City**: Choose your city (e.g., Jaipur, Delhi) from the dropdown.
4. **Amenity Filters**: Filter by specific facilities such as *Cardio*, *Free Weights*, *CrossFit*, *Sauna*, *Steam Bath*, or *Personal Training*.
5. **Interactive Map**: Switch between list and map views to see exact club locations!`;

    if (gyms.length > 0) {
      reply += `\n\n**Featured Verified Clubs Available Right Now:**\n` + 
        gyms.slice(0, 3).map(g => `• **${g.name}** (${g.city}) - ${g.address} | Hours: ${g.openingHours}`).join('\n');
    }

    return {
      reply,
      quickActions: ['View Gyms Directory', 'Membership Plans', 'Create Diet Plan']
    };
  }

  // 4. Products, Store & Cart
  if (q.includes('product') || q.includes('store') || q.includes('cart') || q.includes('buy') || q.includes('supplement') || q.includes('equipment')) {
    let products = [];
    try {
      const toolRes = await executeTool('searchProducts', {});
      products = toolRes.products || [];
    } catch (e) {}

    let reply = `Welcome to the GymConnect Fitness Store! Here is how to shop:

1. Visit **[Fitness Store](https://gym-connect-six.vercel.app/store)**.
2. Browse by categories: **Supplements**, **Equipment**, **Apparel**, and **Accessories**.
3. Click **"Add to Cart"** on any item in stock.
4. Open your **Cart** at the top right to adjust quantities.
5. Provide your shipping address and contact number to confirm checkout!`;

    if (products.length > 0) {
      reply += `\n\n**Popular Products Currently in Stock:**\n` +
        products.slice(0, 3).map(p => `• **${p.name}** - ₹${p.price} (${p.category})`).join('\n');
    }

    return {
      reply,
      quickActions: ['Browse Store', 'My Orders', 'Contact Support']
    };
  }

  // 5. Orders & Tracking
  if (q.includes('order') || q.includes('track') || q.includes('delivery') || q.includes('shipping')) {
    if (user && user.id) {
      try {
        const orderRes = await executeTool('getOrderStatus', {}, user);
        if (orderRes.orders && orderRes.orders.length > 0) {
          const latest = orderRes.orders[0];
          return {
            reply: `Here is your most recent order on GymConnect:

📦 **Order #${latest.id.substring(0, 8)}**
- **Status:** **${latest.status}**
- **Total Amount:** ₹${latest.totalPrice.toFixed(2)}
- **Delivery Address:** ${latest.address}
- **Items:** ${latest.items.map(i => `${i.product.name} (Qty: ${i.quantity})`).join(', ')}

To view full details, visit your **Customer Dashboard**!`,
            quickActions: ['View Dashboard', 'Contact Support']
          };
        }
      } catch (e) {}
    }

    return {
      reply: `To track your GymConnect retail orders:

1. Sign in to your **Customer Account**.
2. Navigate to your **Customer Dashboard** via the profile menu at top right.
3. Review your **"My Store Orders"** section to inspect real-time order status (*Pending*, *Confirmed*, *Packed*, *Shipped*, or *Delivered*).

If you have an order question or delay, let me know your Order ID and I will check it for you!`,
      quickActions: ['Sign In to View Orders', 'Report an Order Issue']
    };
  }

  // 6. Support Ticket & Complaints
  if (q.includes('ticket') || q.includes('complaint') || q.includes('refund') || q.includes('problem') || q.includes('issue') || q.includes('support')) {
    if (user && user.id) {
      try {
        const ticketRes = await executeTool('getSupportTicketStatus', {}, user);
        if (ticketRes.tickets && ticketRes.tickets.length > 0) {
          const latest = ticketRes.tickets[0];
          return {
            reply: `You have an active support ticket:

🎫 **Ticket #${latest.id.substring(0, 8)}**
- **Title:** "${latest.title}"
- **Status:** **${latest.status}**
- **Logged On:** ${new Date(latest.createdAt).toLocaleDateString()}

Our administrative staff reviews all tickets promptly. If an owner does not respond within 48 hours, tickets are automatically escalated for intervention!

Need to report a new problem? Just describe it to me and I will log a fresh ticket for you.`,
            quickActions: ['Create New Ticket', 'Live Support Chat']
          };
        }
      } catch (e) {}
    }

    return {
      reply: `I can help you report an issue or lodge a formal support ticket!

**How GymConnect Support Works:**
1. Tell me what issue you are experiencing (e.g. refund, billing, gym hygiene, login error).
2. I will provide immediate troubleshooting steps.
3. If the problem continues, I will lodge a formal **Support Ticket** with our Help Desk.
4. You receive a unique **Ticket ID** to track resolution.
5. If gym management does not reply within 48 hours, our platform administrators automatically escalate the case!

Would you like me to register a support ticket for you right now?`,
      quickActions: ['Create Support Ticket', 'Live Support Chat', 'Troubleshoot Login']
    };
  }

  // 7. General Fallback
  return {
    reply: `I'm here to assist you with GymConnect!

Here is what I can help you with right now:
• **Gym Discovery**: Search local fitness centers, check amenities, and explore locations on the map.
• **Memberships**: Learn about monthly/annual passes, pricing, and guest trial passes.
• **Diet Planner**: Generate custom daily & weekly meal plans tailored to your fitness goals.
• **Fitness Guidance**: Workout routines, warm-ups, cool-downs, and exercise tips.
• **Store & Orders**: Find gym equipment, supplements, and track your cart or orders.
• **Support**: Troubleshoot website issues or create formal support tickets.

What would you like to explore today?`,
    quickActions: ['Find a Gym', 'Create Diet Plan', 'Fitness Guidance', 'Contact Support']
  };
};

// Main Chat Orchestration Function
export const handleChatMessage = async ({ message, history = [], user = null }) => {
  if (!message || typeof message !== 'string') {
    throw new Error('Message is required.');
  }

  const trimmed = message.trim();

  // If Gemini SDK is available and key is present, attempt Gemini call with tool orchestration
  if (genAI && GEMINI_API_KEY) {
    try {
      // Build conversation contents
      const contents = [];
      
      // Inject previous history (last 10 turns max for context without window exhaustion)
      const recentHistory = history.slice(-10);
      for (const turn of recentHistory) {
        if (turn.sender === 'user' || turn.role === 'user') {
          contents.push({ role: 'user', parts: [{ text: turn.text || turn.content || '' }] });
        } else if (turn.sender === 'bot' || turn.role === 'model') {
          contents.push({ role: 'model', parts: [{ text: turn.text || turn.content || '' }] });
        }
      }

      // Add current user prompt
      const userPrompt = user 
        ? `[Authenticated User: ${user.name} (Role: ${user.role}, ID: ${user.id})]\n${trimmed}`
        : `[Guest User]\n${trimmed}`;

      contents.push({ role: 'user', parts: [{ text: userPrompt }] });

      // Call Gemini 2.0 / 1.5 Flash
      const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: gymConnectToolDeclarations }],
          temperature: 0.7
        }
      });

      // Check for tool calls / function calling
      const candidate = response?.candidates?.[0];
      const functionCalls = candidate?.content?.parts?.filter(p => p.functionCall);

      if (functionCalls && functionCalls.length > 0) {
        // Execute tool calls
        const toolResponses = [];
        let createdTicket = null;

        for (const fc of functionCalls) {
          const call = fc.functionCall;
          const result = await executeTool(call.name, call.args || {}, user);
          
          if (call.name === 'createSupportTicket' && result.success) {
            createdTicket = result;
          }

          toolResponses.push({
            functionResponse: {
              name: call.name,
              response: result
            }
          });
        }

        // Send tool results back to Gemini for synthesized natural language response
        const secondTurnContents = [
          ...contents,
          candidate.content,
          { role: 'user', parts: toolResponses }
        ];

        const secondResponse = await genAI.models.generateContent({
          model: GEMINI_MODEL,
          contents: secondTurnContents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.7
          }
        });

        const finalReply = secondResponse?.text || secondResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
        return {
          reply: finalReply || 'I processed your request using GymConnect data.',
          quickActions: ['Find a Gym', 'Membership Plans', 'Create Diet Plan'],
          ticket: createdTicket
        };
      }

      // Standard text response without tool call
      const replyText = response?.text || candidate?.content?.parts?.[0]?.text;
      if (replyText) {
        return {
          reply: replyText,
          quickActions: ['Find a Gym', 'Create Diet Plan', 'Membership Help']
        };
      }
    } catch (geminiError) {
      console.warn('[GeminiService API Error, falling back to Knowledge Base]:', geminiError.message);
    }
  }

  // Graceful Fallback Engine
  return await solveWithKnowledgeBase(trimmed, user);
};

// Personalized Diet Plan Generation
export const generateDietPlan = async (params) => {
  const {
    age = 25,
    height = 175, // cm
    weight = 70,  // kg
    fitnessGoal = 'Muscle building',
    dietaryPreference = 'Vegetarian',
    allergies = 'None',
    activityLevel = 'Moderately active',
    mealsPerDay = 4,
    foodPreferences = '',
    budget = 'Moderate',
    cuisine = 'North Indian',
    context = ''
  } = params;

  // Calculate approximate Basal Metabolic Rate (BMR) using Mifflin-St Jeor equation
  const bmr = 10 * weight + 6.25 * height - 5 * age + 5; // default male/neutral baseline
  const activityMultipliers = {
    'Sedentary': 1.2,
    'Lightly active': 1.375,
    'Moderately active': 1.55,
    'Very active': 1.725
  };
  const multiplier = activityMultipliers[activityLevel] || 1.45;
  let targetCalories = Math.round(bmr * multiplier);

  // Adjust for goal
  if (fitnessGoal.toLowerCase().includes('muscle') || fitnessGoal.toLowerCase().includes('gain')) {
    targetCalories += 300;
  } else if (fitnessGoal.toLowerCase().includes('weight loss') || fitnessGoal.toLowerCase().includes('fat loss') || fitnessGoal.toLowerCase().includes('management')) {
    targetCalories = Math.max(1500, targetCalories - 400); // Safe minimum
  }

  const targetProteinGrams = Math.round(weight * 1.8); // 1.8g per kg bodyweight
  const targetFatGrams = Math.round((targetCalories * 0.25) / 9);
  const targetCarbGrams = Math.round((targetCalories - (targetProteinGrams * 4 + targetFatGrams * 9)) / 4);

  // Attempt Gemini generation for rich, personalized, creative plan
  if (genAI && GEMINI_API_KEY) {
    try {
      const prompt = `
Generate a comprehensive, scientifically grounded, culturally authentic personalized 7-day diet plan in valid JSON format.

User Profile:
- Age: ${age} years
- Height: ${height} cm
- Weight: ${weight} kg
- Fitness Goal: ${fitnessGoal}
- Dietary Preference: ${dietaryPreference} (Include appropriate staples: Roti, Rice, Dal, Paneer, Curd, Milk, Oats, Fruits, Vegetables, Eggs, Chicken where appropriate)
- Food Allergies / Intolerances: ${allergies}
- Daily Activity Level: ${activityLevel}
- Number of Meals: ${mealsPerDay}
- Budget: ${budget}
- Preferred Cuisine: ${cuisine}
- Special Notes / Preferences: ${foodPreferences} ${context}

Calculated Target Estimates:
- Daily Calories: ~${targetCalories} kcal
- Daily Protein: ~${targetProteinGrams} g
- Daily Carbs: ~${targetCarbGrams} g
- Daily Fats: ~${targetFatGrams} g

JSON Response Requirements:
Return a single JSON object with the exact structure below:
{
  "title": "String (e.g. Personalized 7-Day High-Protein Vegetarian Meal Plan)",
  "overview": {
    "fitnessGoal": "${fitnessGoal}",
    "dietaryPreference": "${dietaryPreference}",
    "caloriesApprox": ${targetCalories},
    "proteinApprox": ${targetProteinGrams},
    "carbsApprox": ${targetCarbGrams},
    "fatApprox": ${targetFatGrams},
    "summary": "String explaining the nutrition strategy"
  },
  "dailyPlan": [
    {
      "mealTime": "08:00 AM",
      "mealName": "Breakfast",
      "foodItems": ["Item 1 with portion", "Item 2 with portion"],
      "portionGuidance": "Detailed portion guide",
      "calories": 450,
      "protein": 22,
      "healthyAlternative": "Quick swap alternative"
    }
  ],
  "weeklySchedule": [
    {
      "day": "Monday",
      "breakfast": "Meal description",
      "lunch": "Meal description",
      "snack": "Meal description",
      "dinner": "Meal description"
    }
  ],
  "hydration": {
    "dailyLiters": "3.0 - 3.5 Liters",
    "reminders": [
      "Drink 500ml water upon waking",
      "Drink 500ml 30 minutes before workouts",
      "Keep a water bottle near your desk"
    ]
  },
  "groceryList": {
    "Grains & Cereals": ["Oats", "Whole Wheat Atta", "Brown Basmati Rice"],
    "Proteins & Dairy": ["Paneer", "Low-fat Curd", "Greek Yogurt", "Eggs/Lentils"],
    "Fruits & Vegetables": ["Spinach", "Bananas", "Apples", "Bell Peppers"],
    "Healthy Fats & Seeds": ["Almonds", "Chia Seeds", "Extra Virgin Olive Oil"]
  },
  "safetyDisclaimer": "General fitness and wellness guidance only. Not medical advice. For pregnancy, chronic illnesses, or minors, consult a registered dietitian or doctor."
}
`;

      const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.4
        }
      });

      const jsonText = response?.text;
      if (jsonText) {
        const parsed = JSON.parse(jsonText);
        return parsed;
      }
    } catch (geminiError) {
      console.warn('[Gemini Diet Plan Generation Error, using fallback engine]:', geminiError.message);
    }
  }

  // Robust Parametric Fallback Diet Plan Engine
  const isVeg = dietaryPreference.toLowerCase().includes('veg') && !dietaryPreference.toLowerCase().includes('non');
  const isVegan = dietaryPreference.toLowerCase().includes('vegan');
  const isEgg = dietaryPreference.toLowerCase().includes('egg');

  const proteinSource = isVegan
    ? 'Tofu, Soy Chunks, Lentils & Sprouts'
    : isVeg
    ? 'Low-fat Paneer, Curd & Yellow Dal'
    : isEgg
    ? 'Egg Whites, Whole Eggs & Greek Yogurt'
    : 'Grilled Chicken Breast, Eggs & Fish';

  return {
    title: `Personalized ${dietaryPreference} ${fitnessGoal} Plan`,
    overview: {
      fitnessGoal,
      dietaryPreference,
      caloriesApprox: targetCalories,
      proteinApprox: targetProteinGrams,
      carbsApprox: targetCarbGrams,
      fatApprox: targetFatGrams,
      summary: `Tailored ${mealsPerDay}-meal daily nutritional blueprint designed for ${fitnessGoal.toLowerCase()} with balanced macro partitioning and wholesome staples.`
    },
    dailyPlan: [
      {
        mealTime: '08:00 AM',
        mealName: 'Energizing Breakfast',
        foodItems: isVeg || isVegan 
          ? ['Masala Rolled Oats (60g) cooked with milk/almond milk', 'Handful of raw almonds & walnuts (25g)', '1 medium banana or apple']
          : ['3 boiled eggs (2 whites + 1 whole)', '2 slices whole grain toast with peanut butter', '1 cup green tea'],
        portionGuidance: '1 medium bowl oats, 1 whole fruit, palm-sized nuts portion.',
        calories: Math.round(targetCalories * 0.25),
        protein: Math.round(targetProteinGrams * 0.25),
        healthyAlternative: 'Moong Dal Chilla with mint chutney or Vegetable Poha with roasted peanuts.'
      },
      {
        mealTime: '01:00 PM',
        mealName: 'Nutrient-Dense Lunch',
        foodItems: isVeg 
          ? ['2 Phulkas (multigrain rotis) with light ghee', '1 cup Tadka Dal (Arhar or Moong)', '100g fresh paneer bhurji or sautéed tofu', '1 bowl fresh cucumber & tomato salad']
          : ['150g grilled chicken breast or fish curry', '1 cup steamed brown basmati rice', '1 cup mixed green salad with lemon', '1 cup vegetable dal'],
        portionGuidance: '2 medium rotis, fist-sized portion of protein (100-150g), deep bowl of salad.',
        calories: Math.round(targetCalories * 0.35),
        protein: Math.round(targetProteinGrams * 0.35),
        healthyAlternative: 'Quinoa Khichdi with curd or Rajma Rice with steamed greens.'
      },
      {
        mealTime: '05:00 PM',
        mealName: 'Evening Pre-Workout Fuel',
        foodItems: isVegan
          ? ['Roasted Makhana (Lotus Seeds) - 30g', '1 cup warm black coffee or green tea', '1 apple']
          : ['1 cup Greek yogurt or low-fat curd with chia seeds', 'Handful of roasted chana (30g)', '1 fresh seasonal fruit'],
        portionGuidance: '1 small bowl roasted snack, 1 cup dairy/plant yogurt.',
        calories: Math.round(targetCalories * 0.15),
        protein: Math.round(targetProteinGrams * 0.15),
        healthyAlternative: 'Sprouts chaat with lemon & pomegranate or 1 scoop protein shake.'
      },
      {
        mealTime: '08:30 PM',
        mealName: 'Light Recovery Dinner',
        foodItems: isVeg
          ? ['1 large bowl mixed vegetable & soybean stir-fry', '1 cup Palak Paneer or Dal Palak', '1 small multigrain roti or 1/2 cup brown rice']
          : ['120g grilled chicken / steamed fish fillet', '1 large bowl vegetable stir-fry with olive oil', '1 small roti or sweet potato mash'],
        portionGuidance: 'Plate half-filled with sautéed vegetables, quarter protein, quarter complex carbs.',
        calories: Math.round(targetCalories * 0.25),
        protein: Math.round(targetProteinGrams * 0.25),
        healthyAlternative: 'Warm vegetable soup with paneer cubes or scrambled egg whites with sautéed mushrooms.'
      }
    ],
    weeklySchedule: [
      { day: 'Monday', breakfast: 'Rolled Oats Porridge & Fruit', lunch: 'Rotis, Paneer Bhurji & Dal', snack: 'Roasted Makhana & Green Tea', dinner: 'Sautéed Vegetables with Tofu/Paneer' },
      { day: 'Tuesday', breakfast: 'Vegetable Moong Dal Chilla', lunch: 'Brown Rice, Rajma & Cucumber Salad', snack: 'Greek Yogurt with Berries', dinner: 'Palak Paneer with 1 Multigrain Roti' },
      { day: 'Wednesday', breakfast: 'Multigrain Toast & Eggs / Peanut Butter', lunch: 'Rotis, Chana Masala & Curd', snack: 'Roasted Chana & Fruit', dinner: 'Stir-fried Veggies with Grilled Chicken / Tofu' },
      { day: 'Thursday', breakfast: 'Poha with Peanuts & Boiled Sprouts', lunch: 'Brown Rice, Dal Makhani (light) & Salad', snack: 'Handful Almonds & Black Coffee', dinner: 'Mixed Vegetable Soup with Paneer' },
      { day: 'Friday', breakfast: 'Oatmeal with Chia Seeds & Banana', lunch: '2 Rotis, Paneer Curry & Dal', snack: 'Sprouts Chaat with Lime', dinner: 'Grilled Protein with Steamed Broccoli' },
      { day: 'Saturday', breakfast: 'Besan Chilla with Mint Chutney', lunch: 'Vegetable Biryani with Cucumber Raita', snack: 'Fresh Coconut Water & Nuts', dinner: 'Light Khichdi with Curd & Papd' },
      { day: 'Sunday', breakfast: 'Healthy Pancake with Honey & Fruit', lunch: 'Special Sunday Thali (Controlled Portions)', snack: 'Mixed Fruit Salad with Seeds', dinner: 'Clear Vegetable Broth & Grilled Paneer' }
    ],
    hydration: {
      dailyLiters: '3.0 - 3.5 Liters',
      reminders: [
        'Drink 500ml room temperature water right after waking up.',
        'Drink 300-500ml water 30 minutes before your workout.',
        'Sip water throughout the day; avoid chugging large quantities during meals.'
      ]
    },
    groceryList: {
      'Grains & Cereals': ['Whole Wheat Atta', 'Rolled Oats', 'Brown Basmati Rice', 'Roasted Chana'],
      'Proteins & Dairy': [proteinSource, 'Low-fat Curd / Greek Yogurt', 'Skimmed Milk'],
      'Produce': ['Spinach', 'Cucumbers', 'Tomatoes', 'Broccoli', 'Bananas', 'Apples', 'Lemons'],
      'Healthy Fats': ['Almonds', 'Walnuts', 'Chia Seeds', 'Ghee / Cold-pressed Mustard Oil']
    },
    safetyDisclaimer: 'This meal plan is for general fitness and nutritional guidance only. It does not replace clinical advice. Individuals with allergies, chronic metabolic conditions, pregnancy, or minors should consult a certified dietitian or physician.'
  };
};
