import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io, Socket } from 'socket.io-client';
import { MessageSquare, Send, User, ChevronLeft, Smile, Image as ImageIcon, X } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  avatar: string;
  role: string;
}

interface Conversation {
  otherUser: Participant;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
}

export const Chat: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // States
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  // Emojis list for quick picker
  const EMOJI_LIST = ['😀', '🔥', '💪', '👍', '❤️', '🏋️‍♂️', '🏆', '⚡', '😊', '🙏', '🎉', '💯', '🤝', '🌟', '🥊', '🚴‍♀️', '🤩', '🚀'];

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleChatFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB. Please choose a smaller image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInsertEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedImage) || !activeConversation || !socketRef.current || !user) return;

    const newMsgPayload = {
      senderId: user.id,
      receiverId: activeConversation.otherUser.id,
      content: inputText,
      imageUrl: selectedImage || null
    };

    // Emit via WebSocket
    socketRef.current.emit('send_message', newMsgPayload);
    setInputText('');
    setSelectedImage(null);
    setShowEmojiPicker(false);
  };

  // Load conversations list
  const loadConversations = async () => {
    try {
      const data = await apiFetch('/api/messages/conversations');
      setConversations(data || []);

      // If redirected from "Chat with Gym" profile button, activate that channel
      const redirectState = location.state as { startChatWith?: Participant } | null;
      if (redirectState && redirectState.startChatWith) {
        const other = redirectState.startChatWith;
        
        // Check if conversation already exists in lists
        const existing = data.find((c: Conversation) => c.otherUser.id === other.id);
        if (existing) {
          setActiveConversation(existing);
        } else {
          // Create temporary channel item
          const tempConv: Conversation = {
            otherUser: other,
            lastMessage: '',
            lastMessageAt: new Date().toISOString(),
            unreadCount: 0
          };
          setConversations(prev => [tempConv, ...prev]);
          setActiveConversation(tempConv);
        }
        
        // Clear react router history state to prevent reactivation on refresh
        window.history.replaceState({}, document.title);
      }
    } catch (err) {
      console.error('Failed to load conversations');
    }
  };

  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user]);

  // Socket connection initialization
  useEffect(() => {
    if (!user) return;

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';
    socketRef.current = io(SOCKET_URL);

    // Register current user room
    socketRef.current.emit('register', user.id);

    // Socket message listener
    socketRef.current.on('receive_message', (msg: Message) => {
      // If message belongs to active thread, append it
      if (activeConversation && 
         (msg.senderId === activeConversation.otherUser.id || msg.receiverId === activeConversation.otherUser.id)) {
        setMessages(prev => [...prev, msg]);
        
        // Mark message as read on backend
        apiFetch(`/api/messages/history/${activeConversation.otherUser.id}`);
      } else {
        // Reload conversations list to update unread counts and bubbles
        loadConversations();
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user, activeConversation]);

  // Fetch thread history when active conversation changes
  useEffect(() => {
    const fetchHistory = async () => {
      if (!activeConversation) return;
      try {
        const data = await apiFetch(`/api/messages/history/${activeConversation.otherUser.id}`);
        setMessages(data || []);
        
        // Reset unread count locally
        setConversations(prev => 
          prev.map(c => 
            c.otherUser.id === activeConversation.otherUser.id 
              ? { ...c, unreadCount: 0 } 
              : c
          )
        );
      } catch (err) {
        console.error('Failed to fetch message history');
      }
    };
    fetchHistory();
  }, [activeConversation]);

  if (!user) {
    return (
      <div className="chat-page-container container text-center flex-center" style={{ height: '70vh' }}>
        <MessageSquare size={64} className="text-muted" />
        <h2>Access Denied</h2>
        <p>Please log in to chat with gym owners.</p>
        <button onClick={() => navigate('/login')} className="glow-btn">Login Page</button>
      </div>
    );
  }

  return (
    <div className="chat-page-container container">
      <div className="chat-interface-wrapper glass-panel">
        
        {/* SIDEBAR: CONVERSATIONS LIST */}
        <aside className={`chat-channels-sidebar ${activeConversation ? 'chat-active' : ''}`}>
          <div className="sidebar-header">
            <h3>Conversations</h3>
          </div>
          
          <div className="channels-list">
            {conversations.length === 0 ? (
              <div className="empty-channels text-center">
                <User size={32} className="text-muted" />
                <p>No active chats. Start a conversation from a gym profile page.</p>
              </div>
            ) : (
              conversations.map(conv => (
                <div 
                  key={conv.otherUser.id}
                  onClick={() => setActiveConversation(conv)}
                  className={`channel-item ${activeConversation?.otherUser.id === conv.otherUser.id ? 'active' : ''}`}
                >
                  <img src={conv.otherUser.avatar} alt="Avatar" className="channel-avatar" />
                  <div className="channel-info">
                    <div className="channel-title-row">
                      <h4>{conv.otherUser.name}</h4>
                      {conv.unreadCount > 0 && (
                        <span className="unread-bubble">{conv.unreadCount}</span>
                      )}
                    </div>
                    <p className="channel-last-msg">
                      {conv.lastMessage || 'Click to start chat...'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* FEED PANEL: ACTIVE CHAT SCREEN */}
        <main className={`chat-messages-viewport ${!activeConversation ? 'empty-thread' : ''}`}>
          {activeConversation ? (
            <>
              {/* Thread Header */}
              <div className="thread-header">
                <button onClick={() => setActiveConversation(null)} className="back-channels-btn">
                  <ChevronLeft size={20} /> Back
                </button>
                <div className="thread-user-info">
                  <img src={activeConversation.otherUser.avatar} alt="Avatar" className="thread-avatar" />
                  <div>
                    <h4>{activeConversation.otherUser.name}</h4>
                    <span className="user-role-badge">{activeConversation.otherUser.role}</span>
                  </div>
                </div>
              </div>

              {/* Message Feed */}
              <div className="messages-scroll-area">
                {messages.map(msg => {
                  const isOwnMessage = msg.senderId === user.id;
                  return (
                    <div 
                      key={msg.id} 
                      className={`message-bubble-wrapper ${isOwnMessage ? 'own-msg' : 'incoming-msg'}`}
                    >
                      <div className="message-bubble">
                        {msg.imageUrl && (
                          <img 
                            src={msg.imageUrl} 
                            alt="Attached" 
                            className="chat-bubble-image" 
                            onClick={() => window.open(msg.imageUrl, '_blank')}
                          />
                        )}
                        {msg.content && <p>{msg.content}</p>}
                        <span className="msg-time">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messageEndRef} />
              </div>

              {/* Image Preview attachment bar */}
              {selectedImage && (
                <div className="chat-image-preview-bar glass-card">
                  <img src={selectedImage} alt="Attachment Preview" className="preview-attachment-thumb" />
                  <span className="text-secondary" style={{ fontSize: '0.8rem' }}>Image ready to send</span>
                  <button type="button" onClick={() => setSelectedImage(null)} className="clear-attachment-btn">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div className="emoji-picker-popover glass-panel">
                  <div className="emoji-grid">
                    {EMOJI_LIST.map((emoji, idx) => (
                      <button 
                        key={idx} 
                        type="button" 
                        onClick={() => handleInsertEmoji(emoji)}
                        className="emoji-btn"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Form */}
              <form onSubmit={handleSendMessage} className="message-input-form">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`chat-action-btn ${showEmojiPicker ? 'active' : ''}`}
                  title="Choose Emoji"
                >
                  <Smile size={18} />
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="chat-action-btn"
                  title="Attach Saved Image"
                >
                  <ImageIcon size={18} />
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleChatFileChange}
                  accept="image/*"
                  style={{ display: 'none' }}
                />

                <input 
                  type="text" 
                  placeholder="Type your message here..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="form-control msg-input-box"
                />
                <button type="submit" className="glow-btn send-msg-btn">
                  <Send size={16} />
                </button>
              </form>
            </>
          ) : (
            <div className="no-active-conversation flex-center text-center">
              <MessageSquare size={64} className="empty-icon animate-float" />
              <h3>Select a Conversation</h3>
              <p>Choose an active chat from the sidebar or visit the Find Gyms directory to contact an owner.</p>
            </div>
          )}
        </main>
      </div>

      <style>{`
        .chat-page-container {
          padding-top: 90px;
          height: calc(100vh - 70px);
          overflow: hidden;
          padding-bottom: 2rem;
        }

        .chat-interface-wrapper {
          display: flex;
          height: 100%;
          border-radius: var(--border-radius-lg);
          overflow: hidden;
        }

        /* Sidebar Channel List */
        .chat-channels-sidebar {
          width: 320px;
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          background: var(--bg-color);
        }

        .chat-channels-sidebar .sidebar-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--border-color);
        }

        .channels-list {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
        }

        .channel-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border-radius: var(--border-radius-sm);
          cursor: pointer;
          transition: var(--transition-fast);
          margin-bottom: 0.5rem;
        }

        .channel-item:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .channel-item.active {
          background: rgba(0, 255, 204, 0.05);
          border: 1px solid var(--border-glow);
        }

        .channel-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid var(--border-color);
        }

        .channel-info {
          flex: 1;
          min-width: 0; /* Enable ellipsis formatting */
        }

        .channel-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.2rem;
        }

        .channel-title-row h4 {
          font-size: 0.95rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .unread-bubble {
          background: var(--secondary-color);
          color: white;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.15rem 0.4rem;
          border-radius: 9999px;
          box-shadow: 0 0 8px var(--secondary-glow);
        }

        .channel-last-msg {
          font-size: 0.75rem;
          color: var(--text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Message feed */
        .chat-messages-viewport {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: var(--bg-surface);
        }

        .thread-header {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .back-channels-btn {
          display: none;
          color: var(--text-secondary);
          align-items: center;
          font-weight: 600;
        }

        .thread-user-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .thread-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid var(--primary-color);
        }

        .thread-user-info h4 {
          font-size: 0.95rem;
        }

        .user-role-badge {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--primary-color);
          text-transform: uppercase;
        }

        .messages-scroll-area {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .message-bubble-wrapper {
          display: flex;
          width: 100%;
        }

        .message-bubble-wrapper.own-msg {
          justify-content: flex-end;
        }

        .message-bubble-wrapper.incoming-msg {
          justify-content: flex-start;
        }

        .message-bubble {
          max-width: 65%;
          padding: 0.75rem 1rem;
          border-radius: var(--border-radius-sm);
          position: relative;
        }

        .own-msg .message-bubble {
          background: var(--primary-color);
          color: #0b0d10;
          border-bottom-right-radius: 0;
          font-weight: 500;
        }

        .incoming-msg .message-bubble {
          background: var(--bg-surface-elevated);
          color: var(--text-primary);
          border-bottom-left-radius: 0;
          border: 1px solid var(--border-color);
        }

        .message-bubble p {
          font-size: 0.875rem;
          word-break: break-word;
        }

        .msg-time {
          display: block;
          font-size: 0.65rem;
          text-align: right;
          margin-top: 0.35rem;
          opacity: 0.7;
        }

        .chat-bubble-image {
          max-width: 100%;
          max-height: 220px;
          border-radius: 6px;
          margin-bottom: 0.35rem;
          cursor: pointer;
          object-fit: cover;
          display: block;
        }

        .chat-action-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 0.5rem;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition-fast);
        }

        .chat-action-btn:hover, .chat-action-btn.active {
          color: var(--primary-color);
          background: rgba(0, 255, 204, 0.1);
        }

        .chat-image-preview-bar {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 1rem;
          margin: 0 1.5rem 0.5rem;
          border-radius: 6px;
          border: 1px dashed var(--primary-color);
        }

        .preview-attachment-thumb {
          width: 36px;
          height: 36px;
          object-fit: cover;
          border-radius: 4px;
        }

        .clear-attachment-btn {
          margin-left: auto;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
        }

        .clear-attachment-btn:hover {
          color: #ef4444;
        }

        .emoji-picker-popover {
          position: absolute;
          bottom: 75px;
          left: 1.5rem;
          z-index: 100;
          padding: 0.75rem;
          border-radius: var(--border-radius-sm);
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-color);
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }

        .emoji-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 0.4rem;
        }

        .emoji-btn {
          font-size: 1.25rem;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          transition: transform 0.1s ease;
        }

        .emoji-btn:hover {
          transform: scale(1.3);
          background: rgba(255,255,255,0.05);
        }

        .message-input-form {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border-color);
          display: flex;
          gap: 0.75rem;
        }

        .msg-input-box {
          flex: 1;
          border-radius: var(--border-radius-sm);
        }

        .send-msg-btn {
          border-radius: var(--border-radius-sm);
          padding: 0 1.25rem;
        }

        .no-active-conversation {
          flex: 1;
          flex-direction: column;
          gap: 1rem;
          padding: 2rem;
        }

        .empty-icon {
          color: var(--text-muted);
        }

        /* Mobile Responsive Logic */
        @media (max-width: 768px) {
          .chat-page-container {
            padding-bottom: 80px; /* Space for mobile bar */
            height: calc(100vh - 150px);
          }

          /* Hide/Show chat or channels lists on small screens */
          .chat-channels-sidebar {
            width: 100%;
          }
          .chat-channels-sidebar.chat-active {
            display: none;
          }

          .chat-messages-viewport {
            display: none;
            width: 100%;
          }
          .chat-interface-wrapper:has(.chat-active) .chat-messages-viewport {
            display: flex;
          }

          .back-channels-btn {
            display: flex;
          }
        }
      `}</style>
    </div>
  );
};
