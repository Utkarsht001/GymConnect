import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bot, X, Send } from 'lucide-react';

interface ChatbotMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  options?: Array<{ label: string; action: string }>;
}

export const CustomerSupportChatbot: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatbotMessage[]>([
    {
      id: '1',
      sender: 'bot',
      text: "Hello! 👋 Welcome to GYMGO Customer Support. I'm here 24/7 to help you with refunds, gym complaints, membership passes, or live support.",
      options: [
        { label: '💳 Refund / Billing Query', action: 'refund' },
        { label: '🚨 Complain About a Gym', action: 'complaint' },
        { label: '💬 Talk to Support Staff', action: 'live_support' },
        { label: '🏋️‍♂️ How Memberships Work', action: 'faq' }
      ]
    }
  ]);

  const handleUserOptionClick = async (action: string, label: string) => {
    // Append user message
    const userMsg: ChatbotMessage = { id: Date.now().toString(), sender: 'user', text: label };
    setMessages(prev => [...prev, userMsg]);

    // Bot response logic
    let botReply: ChatbotMessage = {
      id: (Date.now() + 1).toString(),
      sender: 'bot',
      text: ''
    };

    if (action === 'refund') {
      botReply.text = "For refund requests on memberships or store retail orders, please specify your order/subscription ID and reason below. I will file a priority refund ticket for our support team!";
      if (user) {
        // Auto register complaint ticket
        try {
          await apiFetch('/api/complaints', {
            method: 'POST',
            body: JSON.stringify({
              title: 'Refund Request',
              description: 'Customer requested refund via Support Chatbot'
            })
          });
        } catch (e) {}
      }
    } else if (action === 'complaint') {
      botReply.text = "We take gym hygiene, equipment safety, and trainer behavior seriously! Please type your gym complaint in detail below. Our Admin & Support team will review and take action immediately.";
    } else if (action === 'live_support') {
      botReply.text = "You can chat live with our support team or gym owners anytime!";
      botReply.options = [{ label: 'Open Live Support Chat', action: 'go_chat' }];
    } else if (action === 'faq') {
      botReply.text = "With FitHub, your pass gives you instant QR entry to your selected gym. You can also buy gear from gym stores and chat with owners directly!";
    } else if (action === 'go_chat') {
      setIsOpen(false);
      navigate('/chat');
      return;
    }

    setMessages(prev => [...prev, botReply]);
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userText = inputText;
    setInputText('');

    const userMsg: ChatbotMessage = { id: Date.now().toString(), sender: 'user', text: userText };
    setMessages(prev => [...prev, userMsg]);

    // Bot auto-response
    let replyText = "Thank you for sharing your query. I have logged this with our Customer Support Team. If a gym owner doesn't reply to your messages within 2 days, your ticket is automatically escalated to Admin & Support Staff!";
    
    if (userText.toLowerCase().includes('refund') || userText.toLowerCase().includes('money') || userText.toLowerCase().includes('cancel')) {
      replyText = "I have submitted your refund request ticket to our Support Desk. Our team will process it shortly.";
      if (user) {
        try {
          await apiFetch('/api/complaints', {
            method: 'POST',
            body: JSON.stringify({
              title: 'Refund Ticket',
              description: userText
            })
          });
        } catch (err) {}
      }
    } else if (userText.toLowerCase().includes('fake') || userText.toLowerCase().includes('complaint') || userText.toLowerCase().includes('scam')) {
      replyText = "A formal complaint has been filed with the System Admin for investigation.";
      if (user) {
        try {
          await apiFetch('/api/complaints', {
            method: 'POST',
            body: JSON.stringify({
              title: 'Gym Complaint / Investigation',
              description: userText
            })
          });
        } catch (err) {}
      }
    }

    setMessages(prev => [
      ...prev,
      {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: replyText,
        options: [{ label: 'Chat Live with Support', action: 'go_chat' }]
      }
    ]);
  };

  return (
    <div className="chatbot-widget-container">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="chatbot-trigger-btn glow-btn flex-center animate-pulse"
          title="GYMGO AI Customer Support"
        >
          <Bot size={22} />
          <span>Support Bot</span>
        </button>
      )}

      {/* Chatbot Window */}
      {isOpen && (
        <div className="chatbot-window-panel glass-panel">
          {/* Header */}
          <div className="chatbot-header flex-center">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Bot size={20} className="text-primary" />
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem' }}>GYMGO Assistant</h4>
                <small className="text-muted" style={{ fontSize: '0.7rem' }}>24/7 AI & Support Ticket Desk</small>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="close-chatbot-btn">
              <X size={18} />
            </button>
          </div>

          {/* Messages scroll feed */}
          <div className="chatbot-feed-area">
            {messages.map(msg => (
              <div key={msg.id} className={`chatbot-msg-row ${msg.sender === 'user' ? 'user-row' : 'bot-row'}`}>
                <div className="chatbot-msg-bubble">
                  <p>{msg.text}</p>
                </div>
                {msg.options && (
                  <div className="chatbot-options-grid">
                    {msg.options.map((opt, idx) => (
                      <button 
                        key={idx}
                        onClick={() => handleUserOptionClick(opt.action, opt.label)}
                        className="chatbot-option-btn"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Text Input */}
          <form onSubmit={handleSendText} className="chatbot-input-bar">
            <input 
              type="text" 
              placeholder="Ask a question or report a problem..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="form-control"
              style={{ fontSize: '0.8rem', padding: '0.5rem 0.8rem' }}
            />
            <button type="submit" className="glow-btn" style={{ padding: '0.5rem 0.8rem' }}>
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

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
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border-radius: 30px;
          box-shadow: 0 8px 25px rgba(0, 255, 204, 0.3);
          cursor: pointer;
        }

        .chatbot-window-panel {
          width: 340px;
          height: 440px;
          display: flex;
          flex-direction: column;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 15px 35px rgba(0,0,0,0.6);
          border: 1px solid var(--border-color);
          background: var(--bg-surface);
        }

        .chatbot-header {
          padding: 0.85rem 1rem;
          background: var(--bg-surface-elevated);
          border-bottom: 1px solid var(--border-color);
          justify-content: space-between;
        }

        .close-chatbot-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
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
        }

        .chatbot-msg-row.user-row {
          align-items: flex-end;
        }

        .chatbot-msg-row.bot-row {
          align-items: flex-start;
        }

        .chatbot-msg-bubble {
          max-width: 85%;
          padding: 0.6rem 0.85rem;
          border-radius: 8px;
          font-size: 0.8rem;
          line-height: 1.4;
        }

        .user-row .chatbot-msg-bubble {
          background: var(--primary-color);
          color: #0b0d10;
          font-weight: 500;
        }

        .bot-row .chatbot-msg-bubble {
          background: var(--bg-surface-elevated);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }

        .chatbot-options-grid {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          margin-top: 0.5rem;
          width: 100%;
        }

        .chatbot-option-btn {
          background: rgba(0, 255, 204, 0.08);
          border: 1px solid rgba(0, 255, 204, 0.2);
          color: var(--primary-color);
          padding: 0.4rem 0.6rem;
          border-radius: 4px;
          font-size: 0.75rem;
          text-align: left;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .chatbot-option-btn:hover {
          background: rgba(0, 255, 204, 0.2);
        }

        .chatbot-input-bar {
          display: flex;
          gap: 0.5rem;
          padding: 0.6rem;
          border-top: 1px solid var(--border-color);
          background: var(--bg-surface-elevated);
        }
      `}</style>
    </div>
  );
};
