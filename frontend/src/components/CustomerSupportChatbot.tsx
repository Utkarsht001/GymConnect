import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Bot,
  X,
  Send,
  Sparkles,
  Utensils,
  Dumbbell,
  Bookmark,
  RotateCcw,
  Copy,
  Check,
  Printer,
  Droplets,
  Maximize2,
  Minimize2,
  AlertCircle,
  ChevronRight,
  Trash2,
  Loader2
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  quickActions?: string[];
  ticket?: {
    ticketId: string;
    title: string;
    status: string;
    message: string;
  } | null;
  timestamp: string;
}

interface MealItem {
  mealTime: string;
  mealName: string;
  foodItems: string[];
  portionGuidance: string;
  calories: number;
  protein: number;
  healthyAlternative: string;
}

interface DietPlanData {
  title: string;
  overview: {
    fitnessGoal: string;
    dietaryPreference: string;
    caloriesApprox: number;
    proteinApprox: number;
    carbsApprox: number;
    fatApprox: number;
    summary: string;
  };
  dailyPlan: MealItem[];
  weeklySchedule: Array<{
    day: string;
    breakfast: string;
    lunch: string;
    snack: string;
    dinner: string;
  }>;
  hydration: {
    dailyLiters: string;
    reminders: string[];
  };
  groceryList: Record<string, string[]>;
  safetyDisclaimer: string;
}

interface SavedDietRecord {
  id: string;
  title: string;
  fitnessGoal: string;
  dietaryPref: string;
  caloriesApprox?: number;
  proteinApprox?: number;
  planData: DietPlanData;
  createdAt: string;
}

export const CustomerSupportChatbot: React.FC = () => {
  const { user, apiFetch } = useAuth();

  // Widget States
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'diet' | 'saved_diets' | 'fitness'>('chat');

  // Chat States
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const initialWelcomeMessage: ChatMessage = {
    id: 'welcome-1',
    sender: 'bot',
    text: "Hi! I'm your GymConnect AI Assistant. I can help you discover gyms, understand memberships, solve website problems, explore fitness products, and create personalized diet plans. How can I help you today?",
    quickActions: [
      'Find a Gym',
      'Membership Help',
      'Product & Order Help',
      'Create Diet Plan',
      'Fitness Guidance',
      'Contact Support'
    ],
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('gymconnect_ai_chat');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [initialWelcomeMessage];
  });

  // Save conversation memory to session
  useEffect(() => {
    try {
      sessionStorage.setItem('gymconnect_ai_chat', JSON.stringify(messages));
    } catch (e) {}
  }, [messages]);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat' && isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, activeTab, isOpen]);

  // Diet Planner Form States
  const [age, setAge] = useState<number>(25);
  const [height, setHeight] = useState<number>(172);
  const [weight, setWeight] = useState<number>(68);
  const [fitnessGoal, setFitnessGoal] = useState<string>('Muscle building');
  const [dietaryPreference, setDietaryPreference] = useState<string>('Vegetarian');
  const [allergies, setAllergies] = useState<string>('None');
  const [activityLevel, setActivityLevel] = useState<string>('Moderately active');
  const [mealsPerDay, setMealsPerDay] = useState<number>(4);
  const [budget, setBudget] = useState<string>('Moderate');
  const [cuisine, setCuisine] = useState<string>('North Indian');
  const [foodPreferences, setFoodPreferences] = useState<string>('');
  
  const [currentPlan, setCurrentPlan] = useState<DietPlanData | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [savedPlans, setSavedPlans] = useState<SavedDietRecord[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [replacingMealIndex, setReplacingMealIndex] = useState<number | null>(null);

  // Fetch saved plans on tab open
  useEffect(() => {
    if (activeTab === 'saved_diets') {
      fetchSavedPlans();
    }
  }, [activeTab, user]);

  const fetchSavedPlans = async () => {
    setLoadingSaved(true);
    let remotePlans: SavedDietRecord[] = [];
    if (user) {
      try {
        const res = await apiFetch('/api/ai/diet-plan/saved');
        if (res.success && Array.isArray(res.plans)) {
          remotePlans = res.plans;
        }
      } catch (err) {
        console.warn('Failed to fetch remote diet plans, checking local storage');
      }
    }

    try {
      const local = localStorage.getItem('gymconnect_saved_diet_plans');
      const localPlans: SavedDietRecord[] = local ? JSON.parse(local) : [];
      // Merge unique
      const all = [...remotePlans];
      for (const lp of localPlans) {
        if (!all.some(p => p.id === lp.id)) {
          all.push(lp);
        }
      }
      setSavedPlans(all);
    } catch (e) {
      setSavedPlans(remotePlans);
    }
    setLoadingSaved(false);
  };

  // Chat message submission
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isTyping) return;

    setInputText('');
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const historyPayload = messages.slice(-8).map(m => ({
        sender: m.sender,
        text: m.text
      }));

      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: query,
          history: historyPayload
        })
      });

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: res.reply || "I've checked GymConnect. How else can I assist you with your fitness journey?",
        quickActions: res.quickActions || ['Find a Gym', 'Create Diet Plan', 'Contact Support'],
        ticket: res.ticket || null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        sender: 'bot',
        text: "I experienced a temporary hitch connecting to our AI server. Let me help you directly: You can discover gyms on our [Find Gyms](/gyms) page, view fitness gear in the [Store](/store), or click below to lodge a direct support ticket.",
        quickActions: ['How to Log In', 'Find a Gym', 'Create Support Ticket'],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // Quick Action Handler
  const handleQuickAction = (action: string) => {
    if (action === 'Create Diet Plan') {
      setActiveTab('diet');
      return;
    }
    if (action === 'Fitness Guidance') {
      setActiveTab('fitness');
      return;
    }
    if (action === 'Find a Gym') {
      handleSendMessage('How can I find gyms near me in Jaipur or my city?');
      return;
    }
    if (action === 'Membership Help') {
      handleSendMessage('How do GymConnect membership packages and trial passes work?');
      return;
    }
    if (action === 'Product & Order Help') {
      handleSendMessage('How do I browse products, add to cart, and track orders?');
      return;
    }
    if (action === 'Contact Support') {
      handleSendMessage('I need to file a formal customer support ticket for assistance.');
      return;
    }

    handleSendMessage(action);
  };

  // Generate Personalized Diet Plan
  const handleGenerateDietPlan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setGeneratingPlan(true);
    setSaveSuccessMsg('');

    try {
      const res = await apiFetch('/api/ai/diet-plan', {
        method: 'POST',
        body: JSON.stringify({
          age,
          height,
          weight,
          fitnessGoal,
          dietaryPreference,
          allergies,
          activityLevel,
          mealsPerDay,
          budget,
          cuisine,
          foodPreferences
        })
      });

      if (res.success && res.plan) {
        setCurrentPlan(res.plan);
      }
    } catch (err) {
      console.error('Diet plan generation failed:', err);
      alert('Could not generate meal plan. Please check your network and try again.');
    } finally {
      setGeneratingPlan(false);
    }
  };

  // Save Plan
  const handleSaveDietPlan = async () => {
    if (!currentPlan) return;
    setSavingPlan(true);
    setSaveSuccessMsg('');

    const newRecord: SavedDietRecord = {
      id: `local-plan-${Date.now()}`,
      title: currentPlan.title,
      fitnessGoal: currentPlan.overview.fitnessGoal,
      dietaryPref: currentPlan.overview.dietaryPreference,
      caloriesApprox: currentPlan.overview.caloriesApprox,
      proteinApprox: currentPlan.overview.proteinApprox,
      planData: currentPlan,
      createdAt: new Date().toISOString()
    };

    // Save to DB if authenticated
    if (user) {
      try {
        const res = await apiFetch('/api/ai/diet-plan/save', {
          method: 'POST',
          body: JSON.stringify({
            title: currentPlan.title,
            fitnessGoal: currentPlan.overview.fitnessGoal,
            dietaryPref: currentPlan.overview.dietaryPreference,
            caloriesApprox: currentPlan.overview.caloriesApprox,
            proteinApprox: currentPlan.overview.proteinApprox,
            planData: currentPlan
          })
        });
        if (res.success && res.savedPlan) {
          newRecord.id = res.savedPlan.id;
        }
      } catch (e) {
        console.warn('Could not save to database, persisting locally.');
      }
    }

    // Always persist in localStorage
    try {
      const local = localStorage.getItem('gymconnect_saved_diet_plans');
      const list: SavedDietRecord[] = local ? JSON.parse(local) : [];
      list.unshift(newRecord);
      localStorage.setItem('gymconnect_saved_diet_plans', JSON.stringify(list));
    } catch (e) {}

    setSavedPlans(prev => [newRecord, ...prev]);
    setSavingPlan(false);
    setSaveSuccessMsg('✓ Plan saved successfully to your profile!');
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // Replace a specific meal in current plan
  const handleReplaceMeal = async (idx: number, mealName: string, currentFood: string) => {
    setReplacingMealIndex(idx);
    try {
      const res = await apiFetch('/api/ai/diet-plan/replace-meal', {
        method: 'POST',
        body: JSON.stringify({
          mealName,
          currentFood,
          dietaryPreference
        })
      });

      if (res.success && res.replacement && currentPlan) {
        const updatedMeals = [...currentPlan.dailyPlan];
        updatedMeals[idx] = {
          ...updatedMeals[idx],
          foodItems: [res.replacement.food],
          portionGuidance: res.replacement.portion,
          calories: res.replacement.calories,
          protein: res.replacement.protein,
          healthyAlternative: `Previously: ${currentFood}`
        };
        setCurrentPlan({
          ...currentPlan,
          dailyPlan: updatedMeals
        });
      }
    } catch (e) {
      console.error('Failed to replace meal:', e);
    } finally {
      setReplacingMealIndex(null);
    }
  };

  // Delete saved plan
  const handleDeleteSavedPlan = async (id: string) => {
    if (!confirm('Are you sure you want to remove this saved diet plan?')) return;
    if (user && !id.startsWith('local-')) {
      try {
        await apiFetch(`/api/ai/diet-plan/${id}`, { method: 'DELETE' });
      } catch (e) {}
    }

    try {
      const local = localStorage.getItem('gymconnect_saved_diet_plans');
      if (local) {
        const list: SavedDietRecord[] = JSON.parse(local).filter((p: SavedDietRecord) => p.id !== id);
        localStorage.setItem('gymconnect_saved_diet_plans', JSON.stringify(list));
      }
    } catch (e) {}

    setSavedPlans(prev => prev.filter(p => p.id !== id));
  };

  // Print or export meal plan
  const handlePrintPlan = () => {
    if (!currentPlan) return;
    window.print();
  };

  // Copy text to clipboard
  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Clear chat memory
  const handleClearChat = () => {
    if (confirm('Clear conversation memory?')) {
      sessionStorage.removeItem('gymconnect_ai_chat');
      setMessages([initialWelcomeMessage]);
    }
  };

  // Simple rich text formatting parser (safe, fast, zero extra dependencies)
  const renderFormattedText = (rawText: string) => {
    const lines = rawText.split('\n');
    return lines.map((line, lIdx) => {
      if (!line.trim()) {
        return <div key={lIdx} style={{ height: '0.4rem' }} />;
      }

      // Check for bullet lines
      const isBullet = line.trim().startsWith('•') || line.trim().startsWith('- ') || line.trim().startsWith('* ');
      const cleanLine = isBullet ? line.trim().replace(/^[•\-\*]\s*/, '') : line;

      // Parse bold **text**
      const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
      const renderedParts = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} style={{ color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      if (isBullet) {
        return (
          <div key={lIdx} style={{ display: 'flex', gap: '0.4rem', margin: '0.2rem 0', paddingLeft: '0.25rem' }}>
            <span style={{ color: 'var(--primary-color)' }}>•</span>
            <span>{renderedParts}</span>
          </div>
        );
      }

      return <p key={lIdx} style={{ margin: '0.2rem 0', lineHeight: '1.45' }}>{renderedParts}</p>;
    });
  };

  return (
    <div className={`chatbot-widget-container ${isExpanded ? 'expanded-mode' : ''}`}>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="chatbot-trigger-btn glow-btn flex-center animate-pulse"
          title="Open GymConnect AI Assistant"
          aria-label="Open GymConnect AI Assistant for 24/7 Support, Gym Discovery & Personalized Diet Planning"
        >
          <div className="trigger-icon-wrap">
            <Bot size={22} aria-hidden="true" />
            <span className="online-beacon" aria-hidden="true"></span>
          </div>
          <span className="trigger-label">AI Assistant</span>
          <span className="badge-ai-chip">Gemini</span>
        </button>
      )}

      {/* Main Chatbot Window */}
      {isOpen && (
        <section
          className="chatbot-window-panel glass-panel"
          role="dialog"
          aria-label="GymConnect AI Assistant"
        >
          {/* Header */}
          <header className="chatbot-header">
            <div className="header-left">
              <div className="avatar-orb flex-center">
                <Bot size={20} className="text-primary" aria-hidden="true" />
                <span className="online-dot" title="AI Model Online"></span>
              </div>
              <div className="header-titles">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <h3 className="title-text">GymConnect AI</h3>
                  <span className="gemini-pill">Gemini AI</span>
                </div>
                <small className="subtitle-text">Support • Gym Discovery • Diet Planner</small>
              </div>
            </div>

            <div className="header-actions">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="header-icon-btn"
                title={isExpanded ? 'Minimize Window' : 'Expand Window'}
                aria-label={isExpanded ? 'Minimize Window' : 'Expand Window'}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="header-icon-btn close-btn"
                title="Close AI Assistant"
                aria-label="Close GymConnect AI Assistant"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </header>

          {/* Navigation Tabs */}
          <nav className="chatbot-nav-tabs" role="tablist" aria-label="AI Assistant Sections">
            <button
              role="tab"
              aria-selected={activeTab === 'chat'}
              className={`nav-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <Bot size={14} /> AI Chat
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'diet'}
              className={`nav-tab-btn ${activeTab === 'diet' ? 'active' : ''}`}
              onClick={() => setActiveTab('diet')}
            >
              <Utensils size={14} /> Diet Planner
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'saved_diets'}
              className={`nav-tab-btn ${activeTab === 'saved_diets' ? 'active' : ''}`}
              onClick={() => setActiveTab('saved_diets')}
            >
              <Bookmark size={14} /> Saved Plans {savedPlans.length > 0 && `(${savedPlans.length})`}
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'fitness'}
              className={`nav-tab-btn ${activeTab === 'fitness' ? 'active' : ''}`}
              onClick={() => setActiveTab('fitness')}
            >
              <Dumbbell size={14} /> Fitness Hub
            </button>
          </nav>

          {/* TAB 1: AI CHAT ASSISTANT */}
          {activeTab === 'chat' && (
            <div className="tab-body-wrapper chat-layout">
              {/* Messages feed */}
              <div className="chatbot-feed-area" role="log" aria-live="polite">
                {messages.map((msg) => (
                  <div key={msg.id} className={`chatbot-msg-row ${msg.sender === 'user' ? 'user-row' : 'bot-row'}`}>
                    <div className="chatbot-msg-bubble">
                      <div className="msg-content">{renderFormattedText(msg.text)}</div>

                      {/* Ticket Badge if created */}
                      {msg.ticket && (
                        <div className="created-ticket-badge glass-card">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '1.1rem' }}>🎫</span>
                            <div>
                              <b style={{ color: 'var(--primary-color)' }}>Support Ticket Registered</b>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>ID: #{msg.ticket.ticketId.substring(0, 8)} | Status: {msg.ticket.status}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="msg-meta-bar">
                        <span className="msg-time">{msg.timestamp}</span>
                        {msg.sender === 'bot' && (
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.text)}
                            className="msg-copy-btn"
                            title="Copy reply text"
                            aria-label="Copy reply text"
                          >
                            {copiedId === msg.id ? <Check size={12} color="#00ffcc" /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quick action suggestion buttons */}
                    {msg.quickActions && msg.quickActions.length > 0 && (
                      <div className="chatbot-options-grid">
                        {msg.quickActions.map((opt, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleQuickAction(opt)}
                            className="chatbot-option-btn"
                            aria-label={`Ask AI: ${opt}`}
                          >
                            <span>{opt}</span>
                            <ChevronRight size={12} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="chatbot-msg-row bot-row">
                    <div className="chatbot-msg-bubble typing-bubble">
                      <div className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <small style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Gemini AI is thinking...</small>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat action footer controls */}
              <div className="chat-controls-bar">
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="chat-action-btn"
                  title="Clear conversation history"
                  aria-label="Clear conversation history"
                >
                  <RotateCcw size={12} /> Clear Chat
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('diet')}
                  className="chat-action-btn highlight"
                  aria-label="Switch to Diet Planner"
                >
                  <Utensils size={12} /> Open Diet Planner
                </button>
              </div>

              {/* Text Input Form */}
              <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="chatbot-input-bar">
                <label htmlFor="chatbot-text-input" className="sr-only">Ask a question or request fitness help</label>
                <input
                  id="chatbot-text-input"
                  name="supportMessage"
                  type="text"
                  placeholder="Ask about gyms, memberships, store orders, or diet..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="form-control"
                  aria-label="Ask about gyms, memberships, store orders, or diet"
                  autoComplete="off"
                  disabled={isTyping}
                />
                <button
                  type="submit"
                  className="glow-btn send-btn flex-center"
                  aria-label="Send message to AI assistant"
                  disabled={isTyping || !inputText.trim()}
                >
                  {isTyping ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} aria-hidden="true" />}
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: AI-POWERED PERSONALIZED DIET PLANNER */}
          {activeTab === 'diet' && (
            <div className="tab-body-wrapper scrollable-tab-body">
              {!currentPlan ? (
                <div className="diet-form-panel">
                  <div className="diet-header-banner">
                    <Sparkles size={24} className="text-primary" />
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary-color)' }}>Personalized Diet &amp; Nutrition Planner</h4>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Powered by Gemini AI. Tailored to your fitness goals, cultural foods, and allergies.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleGenerateDietPlan} className="diet-planner-form">
                    {/* Metrics Row */}
                    <div className="form-grid-3">
                      <div className="form-group-item">
                        <label>Age (years)</label>
                        <input
                          type="number"
                          min={14}
                          max={90}
                          value={age}
                          onChange={(e) => setAge(Number(e.target.value))}
                          className="form-input"
                          required
                        />
                      </div>
                      <div className="form-group-item">
                        <label>Height (cm)</label>
                        <input
                          type="number"
                          min={120}
                          max={230}
                          value={height}
                          onChange={(e) => setHeight(Number(e.target.value))}
                          className="form-input"
                          required
                        />
                      </div>
                      <div className="form-group-item">
                        <label>Weight (kg)</label>
                        <input
                          type="number"
                          min={35}
                          max={220}
                          value={weight}
                          onChange={(e) => setWeight(Number(e.target.value))}
                          className="form-input"
                          required
                        />
                      </div>
                    </div>

                    {/* Goal & Preference Row */}
                    <div className="form-grid-2">
                      <div className="form-group-item">
                        <label>Primary Fitness Goal</label>
                        <select
                          value={fitnessGoal}
                          onChange={(e) => setFitnessGoal(e.target.value)}
                          className="form-input"
                        >
                          <option value="Muscle building">Muscle Building &amp; Hypertrophy</option>
                          <option value="Weight loss & Fat burn">Weight Loss / Fat Loss</option>
                          <option value="General fitness">General Fitness &amp; Stamina</option>
                          <option value="Healthy eating">Healthy Eating &amp; Clean Diet</option>
                          <option value="Maintaining current weight">Maintaining Current Weight</option>
                        </select>
                      </div>

                      <div className="form-group-item">
                        <label>Dietary Preference</label>
                        <select
                          value={dietaryPreference}
                          onChange={(e) => setDietaryPreference(e.target.value)}
                          className="form-input"
                        >
                          <option value="Vegetarian">Vegetarian (Paneer, Dal, Curd, Milk)</option>
                          <option value="Non-vegetarian">Non-Vegetarian (Chicken, Fish, Eggs)</option>
                          <option value="Eggetarian">Eggetarian (Eggs + Vegetarian)</option>
                          <option value="Vegan">Vegan (Plant-based, Tofu, Legumes)</option>
                        </select>
                      </div>
                    </div>

                    {/* Activity & Meals Row */}
                    <div className="form-grid-2">
                      <div className="form-group-item">
                        <label>Daily Activity Level</label>
                        <select
                          value={activityLevel}
                          onChange={(e) => setActivityLevel(e.target.value)}
                          className="form-input"
                        >
                          <option value="Sedentary">Sedentary (Desk job, minimal exercise)</option>
                          <option value="Lightly active">Lightly Active (1-3 days gym/week)</option>
                          <option value="Moderately active">Moderately Active (3-5 days gym/week)</option>
                          <option value="Very active">Very Active (6-7 days heavy training)</option>
                        </select>
                      </div>

                      <div className="form-group-item">
                        <label>Meals Per Day</label>
                        <select
                          value={mealsPerDay}
                          onChange={(e) => setMealsPerDay(Number(e.target.value))}
                          className="form-input"
                        >
                          <option value={3}>3 Meals (Breakfast, Lunch, Dinner)</option>
                          <option value={4}>4 Meals (Breakfast, Lunch, Snack, Dinner)</option>
                          <option value={5}>5 Meals (Frequent small portions)</option>
                        </select>
                      </div>
                    </div>

                    {/* Cuisine & Budget */}
                    <div className="form-grid-2">
                      <div className="form-group-item">
                        <label>Preferred Cuisine</label>
                        <select
                          value={cuisine}
                          onChange={(e) => setCuisine(e.target.value)}
                          className="form-input"
                        >
                          <option value="North Indian">North Indian (Roti, Dal, Paneer)</option>
                          <option value="South Indian">South Indian (Idli, Dosa, Sambhar)</option>
                          <option value="Pan-Indian">Pan-Indian Blend</option>
                          <option value="Continental / Global">Continental / Global</option>
                        </select>
                      </div>

                      <div className="form-group-item">
                        <label>Budget Tier</label>
                        <select
                          value={budget}
                          onChange={(e) => setBudget(e.target.value)}
                          className="form-input"
                        >
                          <option value="Budget-friendly">Budget-friendly (Home staples)</option>
                          <option value="Moderate">Moderate (Standard fitness food)</option>
                          <option value="Premium">Premium (Imported nuts, whey, salmon)</option>
                        </select>
                      </div>
                    </div>

                    {/* Allergies & Preferences */}
                    <div className="form-group-item">
                      <label>Food Allergies / Intolerances</label>
                      <input
                        type="text"
                        placeholder="e.g. Peanut allergy, Lactose intolerance, or None"
                        value={allergies}
                        onChange={(e) => setAllergies(e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group-item">
                      <label>Special Food Preferences / Dislikes</label>
                      <input
                        type="text"
                        placeholder="e.g. Love black coffee, prefer oats for breakfast, no soy"
                        value={foodPreferences}
                        onChange={(e) => setFoodPreferences(e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={generatingPlan}
                      className="glow-btn generate-plan-btn flex-center"
                    >
                      {generatingPlan ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Generating Personalized Plan...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} /> Generate Personalized Diet Plan
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="diet-results-panel">
                  {/* Results Top Bar */}
                  <div className="results-actions-header">
                    <button
                      onClick={() => setCurrentPlan(null)}
                      className="btn-secondary small-btn"
                    >
                      ← Change Preferences
                    </button>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        onClick={handleSaveDietPlan}
                        disabled={savingPlan}
                        className="glow-btn small-btn flex-center"
                      >
                        {savingPlan ? <Loader2 size={12} className="animate-spin" /> : <Bookmark size={12} />}
                        Save Plan
                      </button>
                      <button
                        onClick={handlePrintPlan}
                        className="btn-secondary small-btn flex-center"
                        title="Print or export plan"
                      >
                        <Printer size={12} /> Print
                      </button>
                    </div>
                  </div>

                  {saveSuccessMsg && (
                    <div className="save-toast-banner">{saveSuccessMsg}</div>
                  )}

                  {/* Plan Overview Card */}
                  <div className="plan-summary-card glass-card">
                    <h3 className="plan-heading glow-text">{currentPlan.title}</h3>
                    <p className="plan-summary-text">{currentPlan.overview.summary}</p>

                    <div className="macros-stat-grid">
                      <div className="macro-stat-box">
                        <span className="macro-num">{currentPlan.overview.caloriesApprox}</span>
                        <span className="macro-lbl">Daily Calories</span>
                      </div>
                      <div className="macro-stat-box highlight-protein">
                        <span className="macro-num">{currentPlan.overview.proteinApprox}g</span>
                        <span className="macro-lbl">Protein Target</span>
                      </div>
                      <div className="macro-stat-box">
                        <span className="macro-num">{currentPlan.overview.carbsApprox}g</span>
                        <span className="macro-lbl">Complex Carbs</span>
                      </div>
                      <div className="macro-stat-box">
                        <span className="macro-num">{currentPlan.overview.fatApprox}g</span>
                        <span className="macro-lbl">Healthy Fats</span>
                      </div>
                    </div>
                  </div>

                  {/* Daily Meal Breakdown */}
                  <h4 className="section-divider-title">Daily Meal Schedule</h4>
                  <div className="daily-meals-list">
                    {currentPlan.dailyPlan.map((meal, idx) => (
                      <div key={idx} className="meal-card glass-panel">
                        <div className="meal-card-top">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="meal-clock-badge">{meal.mealTime}</span>
                            <h5 className="meal-title">{meal.mealName}</h5>
                          </div>
                          <span className="meal-cal-pill">{meal.calories} kcal • {meal.protein}g protein</span>
                        </div>

                        <ul className="meal-food-items">
                          {meal.foodItems.map((item, fIdx) => (
                            <li key={fIdx}>{item}</li>
                          ))}
                        </ul>

                        <div className="meal-portion-box">
                          <b>Portion Guidance:</b> {meal.portionGuidance}
                        </div>

                        {meal.healthyAlternative && (
                          <div className="meal-swap-box">
                            <span style={{ color: '#ffb703' }}>💡 Swap:</span> {meal.healthyAlternative}
                          </div>
                        )}

                        <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                          <button
                            onClick={() => handleReplaceMeal(idx, meal.mealName, meal.foodItems[0])}
                            disabled={replacingMealIndex === idx}
                            className="replace-meal-btn"
                          >
                            {replacingMealIndex === idx ? (
                              <>
                                <Loader2 size={10} className="animate-spin" /> Swapping...
                              </>
                            ) : (
                              '🔄 Replace This Meal'
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Hydration Reminders */}
                  <div className="hydration-card glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Droplets size={20} style={{ color: '#00ffcc' }} />
                      <h4 style={{ margin: 0, color: '#00ffcc' }}>Hydration Target: {currentPlan.hydration.dailyLiters}</h4>
                    </div>
                    <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.2rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {currentPlan.hydration.reminders.map((r, rIdx) => (
                        <li key={rIdx}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 7-Day Weekly Schedule */}
                  <h4 className="section-divider-title" style={{ marginTop: '1.25rem' }}>7-Day Weekly Variety</h4>
                  <div className="weekly-schedule-table-wrap">
                    <table className="weekly-table">
                      <thead>
                        <tr>
                          <th>Day</th>
                          <th>Breakfast</th>
                          <th>Lunch</th>
                          <th>Snack</th>
                          <th>Dinner</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentPlan.weeklySchedule.map((dayItem, dIdx) => (
                          <tr key={dIdx}>
                            <td><b>{dayItem.day}</b></td>
                            <td>{dayItem.breakfast}</td>
                            <td>{dayItem.lunch}</td>
                            <td>{dayItem.snack}</td>
                            <td>{dayItem.dinner}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Grocery List */}
                  <h4 className="section-divider-title" style={{ marginTop: '1.25rem' }}>Weekly Grocery Checklist</h4>
                  <div className="grocery-grid">
                    {Object.entries(currentPlan.groceryList).map(([category, items], gIdx) => (
                      <div key={gIdx} className="grocery-box glass-card">
                        <h6>{category}</h6>
                        <ul>
                          {items.map((item, iIdx) => (
                            <li key={iIdx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {/* Medical Disclaimer Banner */}
                  <div className="disclaimer-banner">
                    <AlertCircle size={16} className="text-muted" />
                    <small>{currentPlan.safetyDisclaimer}</small>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SAVED DIET PLANS */}
          {activeTab === 'saved_diets' && (
            <div className="tab-body-wrapper scrollable-tab-body">
              <div className="saved-plans-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Your Saved Meal Plans</h4>
                  <button
                    onClick={() => setActiveTab('diet')}
                    className="glow-btn small-btn"
                  >
                    + Create New Plan
                  </button>
                </div>

                {loadingSaved ? (
                  <div className="text-center" style={{ padding: '2rem' }}>
                    <Loader2 size={24} className="animate-spin text-primary" style={{ margin: '0 auto' }} />
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Loading saved plans...</p>
                  </div>
                ) : savedPlans.length === 0 ? (
                  <div className="empty-state-box text-center glass-card">
                    <Bookmark size={36} className="text-muted" style={{ margin: '0 auto 0.5rem auto' }} />
                    <h5>No Saved Plans Yet</h5>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Generate a personalized meal plan in the Diet Planner and click "Save Plan" to view it here anytime!
                    </p>
                    <button onClick={() => setActiveTab('diet')} className="glow-btn small-btn" style={{ marginTop: '0.5rem' }}>
                      Open Diet Planner
                    </button>
                  </div>
                ) : (
                  <div className="saved-plans-list">
                    {savedPlans.map((rec) => (
                      <div key={rec.id} className="saved-plan-card glass-panel">
                        <div className="saved-card-header">
                          <div>
                            <h5 className="saved-plan-title">{rec.title}</h5>
                            <span className="saved-plan-date">Created: {new Date(rec.createdAt).toLocaleDateString()}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteSavedPlan(rec.id)}
                            className="delete-plan-icon-btn"
                            title="Delete this saved plan"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="saved-plan-badges">
                          <span className="pill-badge">{rec.fitnessGoal}</span>
                          <span className="pill-badge">{rec.dietaryPref}</span>
                          {rec.caloriesApprox && <span className="pill-badge">{rec.caloriesApprox} kcal/day</span>}
                          {rec.proteinApprox && <span className="pill-badge highlight">{rec.proteinApprox}g protein</span>}
                        </div>

                        <button
                          onClick={() => {
                            setCurrentPlan(rec.planData);
                            setActiveTab('diet');
                          }}
                          className="view-plan-btn"
                        >
                          View Full Meal Schedule &amp; Grocery List →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: FITNESS HUB */}
          {activeTab === 'fitness' && (
            <div className="tab-body-wrapper scrollable-tab-body">
              <div className="fitness-hub-panel">
                <div className="diet-header-banner">
                  <Dumbbell size={24} className="text-primary" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary-color)' }}>GymConnect Fitness Assistant</h4>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Workout splits, exercise guidance, warm-up routines, and recovery strategies.
                    </p>
                  </div>
                </div>

                <div className="fitness-cards-grid">
                  <div className="fitness-topic-card glass-card">
                    <h5>🔥 5-Minute Dynamic Warm-Up</h5>
                    <p>Protect joints and elevate core temperature before lifting heavy weights:</p>
                    <ul>
                      <li><b>Jumping Jacks</b> - 60 seconds</li>
                      <li><b>Arm Circles &amp; Band Pull-Aparts</b> - 20 reps</li>
                      <li><b>Bodyweight Squats</b> - 15 reps</li>
                      <li><b>World's Greatest Stretch</b> - 5 per side</li>
                    </ul>
                  </div>

                  <div className="fitness-topic-card glass-card">
                    <h5>🏋️ Push / Pull / Legs (PPL) Split</h5>
                    <p>The gold standard 3-6 day progressive overload workout structure:</p>
                    <ul>
                      <li><b>Push</b>: Chest (Bench Press), Shoulders (Overhead Press), Triceps</li>
                      <li><b>Pull</b>: Back (Lat Pulldowns, Rows), Rear Delts, Biceps</li>
                      <li><b>Legs</b>: Quads (Squats), Hamstrings (Romanian Deadlifts), Calves</li>
                    </ul>
                  </div>

                  <div className="fitness-topic-card glass-card">
                    <h5>⚡ Beginner Full-Body Routine</h5>
                    <p>Ideal for newcomers training 3 non-consecutive days per week:</p>
                    <ul>
                      <li><b>Goblet Squats</b> - 3 sets × 10 reps</li>
                      <li><b>Dumbbell Chest Press</b> - 3 sets × 10 reps</li>
                      <li><b>Seated Cable Rows</b> - 3 sets × 12 reps</li>
                      <li><b>Dumbbell Shoulder Press</b> - 3 sets × 10 reps</li>
                      <li><b>Plank Hold</b> - 3 sets × 45 seconds</li>
                    </ul>
                  </div>

                  <div className="fitness-topic-card glass-card">
                    <h5>💤 Muscle Recovery &amp; Sleep</h5>
                    <p>Muscles grow during recovery, not during the workout itself:</p>
                    <ul>
                      <li>Aim for <b>7 to 8.5 hours</b> of continuous sleep.</li>
                      <li>Consume <b>1.6 to 2.2g of protein</b> per kilogram of body weight.</li>
                      <li>Take at least 1-2 dedicated active recovery days weekly.</li>
                    </ul>
                  </div>
                </div>

                <div className="fitness-ask-box glass-panel text-center">
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Have a specific question about an exercise, form, or muscle group?
                  </p>
                  <button
                    onClick={() => {
                      setActiveTab('chat');
                      handleSendMessage('Can you explain proper form and technique for the barbell deadlift?');
                    }}
                    className="glow-btn small-btn"
                  >
                    Ask AI: "Explain Barbell Deadlift Form"
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Embedded High-Performance Styles */}
      <style>{`
        .chatbot-widget-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 10000;
        }

        .chatbot-trigger-btn {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.75rem 1.25rem;
          border-radius: 30px;
          box-shadow: 0 8px 30px rgba(0, 255, 204, 0.35);
          cursor: pointer;
          background: linear-gradient(135deg, #00ffcc 0%, #00b4d8 100%);
          color: #0b0d10;
          font-weight: 700;
          border: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .chatbot-trigger-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 35px rgba(0, 255, 204, 0.5);
        }

        .trigger-icon-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .online-beacon {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          background: #10b981;
          border: 2px solid #0b0d10;
          border-radius: 50%;
        }

        .badge-ai-chip {
          background: rgba(11, 13, 16, 0.3);
          color: #0b0d10;
          padding: 0.15rem 0.45rem;
          border-radius: 10px;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        /* Window Panel */
        .chatbot-window-panel {
          width: 380px;
          height: 540px;
          display: flex;
          flex-direction: column;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(0,0,0,0.75);
          border: 1px solid rgba(0, 255, 204, 0.25);
          background: #0f172a;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .expanded-mode .chatbot-window-panel {
          width: 540px;
          height: 720px;
          max-width: 95vw;
          max-height: 90vh;
        }

        /* Header */
        .chatbot-header {
          padding: 0.85rem 1rem;
          background: #0b0d10;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }

        .avatar-orb {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: rgba(0, 255, 204, 0.1);
          border: 1px solid rgba(0, 255, 204, 0.3);
          position: relative;
        }

        .online-dot {
          position: absolute;
          bottom: 1px;
          right: 1px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #00ffcc;
          box-shadow: 0 0 6px #00ffcc;
        }

        .title-text {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 700;
          color: #fff;
        }

        .gemini-pill {
          background: linear-gradient(90deg, #00ffcc 0%, #38bdf8 100%);
          color: #0b0d10;
          font-size: 0.6rem;
          font-weight: 800;
          padding: 0.1rem 0.4rem;
          border-radius: 6px;
          text-transform: uppercase;
        }

        .subtitle-text {
          font-size: 0.68rem;
          color: #94a3b8;
          display: block;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .header-icon-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 0.3rem;
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: var(--transition-fast);
        }

        .header-icon-btn:hover {
          color: #fff;
          background: rgba(255,255,255,0.08);
        }

        .header-icon-btn.close-btn:hover {
          color: #ef4444;
        }

        /* Navigation Tabs */
        .chatbot-nav-tabs {
          display: flex;
          background: #0b0d10;
          border-bottom: 1px solid var(--border-color);
          padding: 0.25rem 0.5rem;
          gap: 0.25rem;
          overflow-x: auto;
        }

        .nav-tab-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          padding: 0.45rem 0.4rem;
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 0.72rem;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
        }

        .nav-tab-btn:hover {
          color: #fff;
          background: rgba(255,255,255,0.04);
        }

        .nav-tab-btn.active {
          color: #00ffcc;
          background: rgba(0, 255, 204, 0.1);
        }

        /* Tab Body Wrappers */
        .tab-body-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          position: relative;
        }

        .scrollable-tab-body {
          overflow-y: auto;
          padding: 1rem;
        }

        /* Chat Feed */
        .chat-layout {
          height: 100%;
        }

        .chatbot-feed-area {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .chatbot-msg-row {
          display: flex;
          flex-direction: column;
          width: 100%;
        }

        .chatbot-msg-row.user-row {
          align-items: flex-end;
        }

        .chatbot-msg-row.bot-row {
          align-items: flex-start;
        }

        .chatbot-msg-bubble {
          max-width: 88%;
          padding: 0.7rem 0.9rem;
          border-radius: 12px;
          font-size: 0.8rem;
          line-height: 1.45;
          position: relative;
          word-break: break-word;
        }

        .user-row .chatbot-msg-bubble {
          background: linear-gradient(135deg, #00ffcc 0%, #00b4d8 100%);
          color: #0b0d10;
          font-weight: 500;
          border-bottom-right-radius: 2px;
        }

        .bot-row .chatbot-msg-bubble {
          background: #1e293b;
          color: var(--text-primary);
          border: 1px solid rgba(255,255,255,0.08);
          border-bottom-left-radius: 2px;
        }

        .msg-meta-bar {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 0.4rem;
          margin-top: 0.35rem;
        }

        .msg-time {
          font-size: 0.65rem;
          opacity: 0.65;
        }

        .msg-copy-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 0.1rem;
          display: flex;
          align-items: center;
        }

        .msg-copy-btn:hover {
          color: #fff;
        }

        .created-ticket-badge {
          margin-top: 0.5rem;
          padding: 0.5rem;
          border-radius: 8px;
          background: rgba(0, 255, 204, 0.08);
          border: 1px solid rgba(0, 255, 204, 0.3);
        }

        /* Quick Option Buttons */
        .chatbot-options-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin-top: 0.45rem;
          max-width: 90%;
        }

        .chatbot-option-btn {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.3rem;
          background: rgba(0, 255, 204, 0.06);
          border: 1px solid rgba(0, 255, 204, 0.2);
          color: #00ffcc;
          padding: 0.35rem 0.65rem;
          border-radius: 20px;
          font-size: 0.72rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .chatbot-option-btn:hover {
          background: rgba(0, 255, 204, 0.18);
          border-color: #00ffcc;
        }

        /* Typing Dots */
        .typing-bubble {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .typing-dots {
          display: flex;
          gap: 4px;
        }

        .typing-dots span {
          width: 5px;
          height: 5px;
          background: #00ffcc;
          border-radius: 50%;
          animation: blink 1.4s infinite both;
        }

        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes blink {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }

        /* Chat Controls Bar */
        .chat-controls-bar {
          display: flex;
          justify-content: space-between;
          padding: 0.35rem 0.75rem;
          background: #0b0d10;
          border-top: 1px solid var(--border-color);
        }

        .chat-action-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 0.68rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }

        .chat-action-btn:hover {
          color: #fff;
        }

        .chat-action-btn.highlight {
          color: #00ffcc;
        }

        /* Input Bar */
        .chatbot-input-bar {
          display: flex;
          gap: 0.5rem;
          padding: 0.65rem;
          border-top: 1px solid var(--border-color);
          background: #0b0d10;
        }

        .chatbot-input-bar input {
          font-size: 0.8rem;
          padding: 0.55rem 0.85rem;
          border-radius: 20px;
          background: #1e293b;
          border: 1px solid var(--border-color);
          color: #fff;
        }

        .chatbot-input-bar input:focus {
          border-color: #00ffcc;
          outline: none;
        }

        .send-btn {
          width: 36px;
          height: 36px;
          padding: 0;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Diet Planner Section */
        .diet-header-banner {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          background: rgba(0, 255, 204, 0.06);
          border: 1px solid rgba(0, 255, 204, 0.2);
          margin-bottom: 1rem;
        }

        .diet-planner-form {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .form-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }

        .form-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }

        .form-group-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .form-group-item label {
          font-size: 0.72rem;
          font-weight: 600;
          color: #94a3b8;
        }

        .form-input {
          padding: 0.5rem 0.65rem;
          font-size: 0.78rem;
          border-radius: 6px;
          background: #1e293b;
          border: 1px solid var(--border-color);
          color: #fff;
        }

        .form-input:focus {
          border-color: #00ffcc;
          outline: none;
        }

        .generate-plan-btn {
          margin-top: 0.5rem;
          width: 100%;
          padding: 0.75rem;
          font-size: 0.85rem;
          gap: 0.5rem;
        }

        /* Diet Results */
        .results-actions-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .small-btn {
          padding: 0.4rem 0.75rem;
          font-size: 0.72rem;
          border-radius: 6px;
          gap: 0.35rem;
        }

        .save-toast-banner {
          background: rgba(16, 185, 129, 0.2);
          border: 1px solid #10b981;
          color: #10b981;
          padding: 0.5rem;
          border-radius: 6px;
          font-size: 0.75rem;
          margin-bottom: 0.75rem;
          text-align: center;
        }

        .plan-summary-card {
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid rgba(0, 255, 204, 0.3);
          margin-bottom: 1rem;
        }

        .plan-heading {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
        }

        .plan-summary-text {
          font-size: 0.75rem;
          color: #94a3b8;
          margin: 0.35rem 0 0.75rem 0;
          line-height: 1.4;
        }

        .macros-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.4rem;
        }

        .macro-stat-box {
          background: #0b0d10;
          padding: 0.5rem 0.3rem;
          border-radius: 8px;
          text-align: center;
          border: 1px solid var(--border-color);
        }

        .macro-stat-box.highlight-protein {
          border-color: #00ffcc;
          background: rgba(0, 255, 204, 0.05);
        }

        .macro-num {
          display: block;
          font-size: 0.95rem;
          font-weight: 800;
          color: #fff;
        }

        .highlight-protein .macro-num {
          color: #00ffcc;
        }

        .macro-lbl {
          font-size: 0.6rem;
          color: #94a3b8;
          text-transform: uppercase;
        }

        .section-divider-title {
          font-size: 0.85rem;
          color: #fff;
          margin: 0.75rem 0 0.5rem 0;
          font-weight: 700;
        }

        .daily-meals-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .meal-card {
          padding: 0.85rem;
          border-radius: 10px;
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.06);
        }

        .meal-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .meal-clock-badge {
          background: rgba(0, 255, 204, 0.15);
          color: #00ffcc;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
        }

        .meal-title {
          margin: 0;
          font-size: 0.85rem;
          color: #fff;
        }

        .meal-cal-pill {
          font-size: 0.7rem;
          color: #94a3b8;
        }

        .meal-food-items {
          margin: 0 0 0.5rem 0;
          padding-left: 1.2rem;
          font-size: 0.75rem;
          line-height: 1.4;
          color: #e2e8f0;
        }

        .meal-portion-box, .meal-swap-box {
          font-size: 0.7rem;
          padding: 0.35rem 0.5rem;
          border-radius: 6px;
          background: #0b0d10;
          margin-top: 0.35rem;
          line-height: 1.35;
        }

        .replace-meal-btn {
          background: transparent;
          border: 1px dashed rgba(0, 255, 204, 0.3);
          color: #00ffcc;
          font-size: 0.68rem;
          padding: 0.25rem 0.6rem;
          border-radius: 4px;
          cursor: pointer;
        }

        .replace-meal-btn:hover {
          background: rgba(0, 255, 204, 0.1);
        }

        .hydration-card {
          padding: 0.85rem;
          border-radius: 10px;
          margin-top: 1rem;
          border: 1px solid rgba(0, 255, 204, 0.2);
          background: rgba(0, 255, 204, 0.04);
        }

        /* Weekly Table */
        .weekly-schedule-table-wrap {
          overflow-x: auto;
          border-radius: 8px;
          border: 1px solid var(--border-color);
        }

        .weekly-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.7rem;
          text-align: left;
        }

        .weekly-table th, .weekly-table td {
          padding: 0.5rem 0.65rem;
          border-bottom: 1px solid var(--border-color);
        }

        .weekly-table th {
          background: #0b0d10;
          color: #94a3b8;
        }

        .weekly-table td {
          background: #1e293b;
          color: #e2e8f0;
        }

        /* Grocery Checklist */
        .grocery-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }

        .grocery-box {
          padding: 0.65rem;
          border-radius: 8px;
          background: #1e293b;
        }

        .grocery-box h6 {
          margin: 0 0 0.35rem 0;
          font-size: 0.72rem;
          color: #00ffcc;
        }

        .grocery-box ul {
          margin: 0;
          padding-left: 1rem;
          font-size: 0.68rem;
          color: #94a3b8;
          line-height: 1.35;
        }

        .disclaimer-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.65rem;
          border-radius: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-color);
          margin-top: 1rem;
          font-size: 0.68rem;
          color: #94a3b8;
          line-height: 1.3;
        }

        /* Saved Plans */
        .saved-plans-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .saved-plan-card {
          padding: 0.85rem;
          border-radius: 10px;
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.06);
        }

        .saved-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .saved-plan-title {
          margin: 0;
          font-size: 0.85rem;
          color: #fff;
        }

        .saved-plan-date {
          font-size: 0.68rem;
          color: #94a3b8;
        }

        .delete-plan-icon-btn {
          background: transparent;
          border: none;
          color: #ef4444;
          cursor: pointer;
          padding: 0.2rem;
        }

        .saved-plan-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin: 0.5rem 0;
        }

        .pill-badge {
          background: #0b0d10;
          font-size: 0.65rem;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          color: #94a3b8;
          border: 1px solid var(--border-color);
        }

        .pill-badge.highlight {
          border-color: #00ffcc;
          color: #00ffcc;
        }

        .view-plan-btn {
          width: 100%;
          padding: 0.45rem;
          background: rgba(0, 255, 204, 0.08);
          border: 1px solid rgba(0, 255, 204, 0.2);
          color: #00ffcc;
          font-size: 0.72rem;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .view-plan-btn:hover {
          background: rgba(0, 255, 204, 0.2);
        }

        .empty-state-box {
          padding: 2.5rem 1rem;
        }

        /* Fitness Hub */
        .fitness-cards-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .fitness-topic-card {
          padding: 0.85rem;
          border-radius: 10px;
          background: #1e293b;
        }

        .fitness-topic-card h5 {
          margin: 0 0 0.35rem 0;
          font-size: 0.82rem;
          color: #00ffcc;
        }

        .fitness-topic-card p {
          margin: 0 0 0.4rem 0;
          font-size: 0.72rem;
          color: #94a3b8;
        }

        .fitness-topic-card ul {
          margin: 0;
          padding-left: 1.2rem;
          font-size: 0.72rem;
          color: #e2e8f0;
          line-height: 1.45;
        }

        .fitness-ask-box {
          padding: 1rem;
          border-radius: 10px;
          margin-top: 1rem;
        }

        @media (max-width: 480px) {
          .chatbot-widget-container {
            bottom: 12px;
            right: 12px;
            left: 12px;
          }
          .chatbot-window-panel {
            width: 100% !important;
            height: 82vh !important;
          }
          .form-grid-3, .form-grid-2 {
            grid-template-columns: 1fr;
          }
          .macros-stat-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .grocery-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
