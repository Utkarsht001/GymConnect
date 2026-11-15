import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SEO } from '../components/SEO';
import { io, Socket } from 'socket.io-client';
import { 
  MessageSquare, Send, User, ChevronLeft, Smile, Image as ImageIcon, 
  X, Check, CheckCheck, Loader2, Search, Building2 
} from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  gymName?: string;
  gymId?: string;
}

interface Conversation {
  otherUser: Participant;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageSenderId?: string;
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  imageUrl?: string;
  isRead?: boolean;
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    avatar?: string;
    role: string;
  };
}

export const Chat: React.FC = () => {
  const { user, token, apiFetch } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // States
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const activeConversationRef = useRef<Conversation | null>(null);

  // Keep ref synchronized for socket event closures
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  // Emojis list for quick picker
  const EMOJI_LIST = ['😀', '🔥', '💪', '👍', '❤️', '🏋️‍♂️', '🏆', '⚡', '😊', '🙏', '🎉', '💯', '🤝', '🌟', '🥊', '🚴‍♀️', '🤩', '🚀'];

  // Scroll to bottom helper
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messageEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    scrollToBottom(messages.length <= 1 ? 'auto' : 'smooth');
  }, [messages, scrollToBottom]);

  // Handle image upload
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

  // Load conversation list from backend
  const loadConversations = useCallback(async () => {
    try {
      const data: Conversation[] = await apiFetch('/api/messages/conversations');
      setConversations(data || []);
      return data || [];
    } catch (err) {
      console.error('Failed to load conversations:', err);
      return [];
    }
  }, [apiFetch]);

  // Load chat history for a specific user
  const loadHistory = useCallback(async (otherUserId: string) => {
    setLoadingHistory(true);
    setSendError(null);
    try {
      const history: Message[] = await apiFetch(`/api/messages/history/${otherUserId}`);
      setMessages(history || []);

      // Reset unread count locally
      setConversations(prev =>
        prev.map(c =>
          c.otherUser.id === otherUserId ? { ...c, unreadCount: 0 } : c
        )
      );

      // Tell socket we are viewing this conversation
      if (socketRef.current?.connected) {
        socketRef.current.emit('join_conversation', { otherUserId });
        socketRef.current.emit('mark_read', { otherUserId });
      }
    } catch (err) {
      console.error('Failed to fetch message history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [apiFetch]);

  // Initial load and URL/State navigation handling
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const initializeChat = async () => {
      const convList = await loadConversations();
      if (!isMounted) return;

      const searchParams = new URLSearchParams(location.search);
      const queryUserId = searchParams.get('userId');
      const stateObj = location.state as { startChatWith?: Participant } | null;
      const targetUserId = queryUserId || stateObj?.startChatWith?.id;

      if (targetUserId) {
        // 1. Check if conversation already exists in fetched list
        const existing = convList.find(c => c.otherUser.id === targetUserId);
        if (existing) {
          setActiveConversation(existing);
          loadHistory(existing.otherUser.id);
        } else if (stateObj?.startChatWith) {
          // 2. Use passed state object
          const newConv: Conversation = {
            otherUser: stateObj.startChatWith,
            lastMessage: '',
            lastMessageAt: new Date().toISOString(),
            unreadCount: 0
          };
          setConversations(prev => [newConv, ...prev.filter(c => c.otherUser.id !== newConv.otherUser.id)]);
          setActiveConversation(newConv);
          loadHistory(newConv.otherUser.id);
        } else {
          // 3. Fetch user info by ID from backend
          try {
            const userInfo: Participant = await apiFetch(`/api/messages/user-info/${targetUserId}`);
            if (userInfo && isMounted) {
              const newConv: Conversation = {
                otherUser: userInfo,
                lastMessage: '',
                lastMessageAt: new Date().toISOString(),
                unreadCount: 0
              };
              setConversations(prev => [newConv, ...prev.filter(c => c.otherUser.id !== newConv.otherUser.id)]);
              setActiveConversation(newConv);
              loadHistory(newConv.otherUser.id);
            }
          } catch (e) {
            console.error('Could not fetch target user info:', e);
          }
        }

        // Clean router state
        if (window.history.replaceState) {
          window.history.replaceState({}, document.title, location.pathname);
        }
      }
    };

    initializeChat();

    return () => {
      isMounted = false;
    };
  }, [user, location.search, location.state, loadConversations, loadHistory, apiFetch]);

  // Setup Socket.IO connection
  useEffect(() => {
    if (!user) return;

    const rawApiUrl = import.meta.env.VITE_API_URL || '';
    const socketEndpoint = import.meta.env.VITE_SOCKET_URL || rawApiUrl || (import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin);

    const socket = io(socketEndpoint, {
      auth: { token: token || undefined },
      query: { token: token || undefined },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('register', user.id);
      if (activeConversationRef.current) {
        socket.emit('join_conversation', { otherUserId: activeConversationRef.current.otherUser.id });
      }
    });

    // Handle incoming live message
    socket.on('receive_message', (msg: Message) => {
      const currentActive = activeConversationRef.current;
      const otherId = currentActive?.otherUser.id;

      if (otherId && (msg.senderId === otherId || msg.receiverId === otherId)) {
        // Message is part of active open chat
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });

        // Mark read on backend
        if (msg.senderId === otherId) {
          apiFetch(`/api/messages/read/${otherId}`, { method: 'PUT' }).catch(() => {});
          socket.emit('mark_read', { otherUserId: otherId });
        }
      }

      // Update conversations sidebar
      setConversations(prev => {
        const partnerId = msg.senderId === user.id ? msg.receiverId : msg.senderId;
        const exists = prev.find(c => c.otherUser.id === partnerId);
        const isActive = currentActive?.otherUser.id === partnerId;

        if (exists) {
          return prev.map(c => {
            if (c.otherUser.id === partnerId) {
              return {
                ...c,
                lastMessage: msg.content || (msg.imageUrl ? '📷 [Image attachment]' : ''),
                lastMessageAt: msg.createdAt,
                lastMessageSenderId: msg.senderId,
                unreadCount: isActive || msg.senderId === user.id ? 0 : c.unreadCount + 1
              };
            }
            return c;
          }).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
        } else {
          // If conversation doesn't exist in sidebar yet, reload conversation list
          loadConversations();
          return prev;
        }
      });
    });

    // Handle read receipt from other user
    socket.on('messages_read', ({ readBy }: { readBy: string }) => {
      if (activeConversationRef.current?.otherUser.id === readBy) {
        setMessages(prev =>
          prev.map(m => (m.senderId === user.id ? { ...m, isRead: true } : m))
        );
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, token, apiFetch, loadConversations]);

  // Periodic polling fallback (every 6 seconds while conversation is open)
  useEffect(() => {
    if (!activeConversation) return;

    const interval = setInterval(async () => {
      try {
        const history: Message[] = await apiFetch(`/api/messages/history/${activeConversation.otherUser.id}`);
        if (Array.isArray(history)) {
          setMessages(prev => {
            // Only update if message count or latest ID changed
            if (prev.length !== history.length || (prev[prev.length - 1]?.id !== history[history.length - 1]?.id)) {
              return history;
            }
            return prev;
          });
        }
      } catch (e) {
        // Silently ignore polling hiccups
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [activeConversation, apiFetch]);

  // Select conversation from sidebar
  const handleSelectConversation = (conv: Conversation) => {
    setActiveConversation(conv);
    loadHistory(conv.otherUser.id);
  };

  // Send message handler (Robust REST save + Socket broadcast)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSending || !activeConversation || !user) return;

    const trimmed = inputText.trim();
    if (!trimmed && !selectedImage) return;

    setIsSending(true);
    setSendError(null);

    const payload = {
      receiverId: activeConversation.otherUser.id,
      content: trimmed,
      imageUrl: selectedImage || null
    };

    try {
      // 1. Send via REST endpoint (guarantees DB persistence)
      const savedMessage: Message = await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // 2. Add to local state immediately
      setMessages(prev => {
        if (prev.some(m => m.id === savedMessage.id)) return prev;
        return [...prev, savedMessage];
      });

      // 3. Clear input fields only after successful submission
      setInputText('');
      setSelectedImage(null);
      setShowEmojiPicker(false);

      // 4. Update sidebar conversation preview
      setConversations(prev => {
        return prev.map(c => {
          if (c.otherUser.id === activeConversation.otherUser.id) {
            return {
              ...c,
              lastMessage: savedMessage.content || (savedMessage.imageUrl ? '📷 [Image attachment]' : ''),
              lastMessageAt: savedMessage.createdAt,
              lastMessageSenderId: user.id
            };
          }
          return c;
        }).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      });

      // 5. Also broadcast via socket if available
      if (socketRef.current?.connected) {
        socketRef.current.emit('send_message', {
          senderId: user.id,
          receiverId: activeConversation.otherUser.id,
          content: trimmed,
          imageUrl: selectedImage || null
        });
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setSendError(err.message || 'Failed to send message. Please retry.');
    } finally {
      setIsSending(false);
    }
  };

  // Filter conversations based on search box
  const filteredConversations = conversations.filter(c => {
    const q = searchFilter.toLowerCase();
    const nameMatch = c.otherUser.name.toLowerCase().includes(q);
    const gymMatch = c.otherUser.gymName ? c.otherUser.gymName.toLowerCase().includes(q) : false;
    const msgMatch = c.lastMessage.toLowerCase().includes(q);
    return nameMatch || gymMatch || msgMatch;
  });

  if (!user) {
    return (
      <div className="chat-page-container container text-center flex-center" style={{ height: '70vh' }}>
        <SEO title="Access Denied - Chat" canonicalPath="/chat" noindex={true} />
        <MessageSquare size={64} className="text-muted" aria-hidden="true" />
        <h2>Access Denied</h2>
        <p>Please log in to chat with gym owners or members.</p>
        <button onClick={() => navigate('/login')} className="glow-btn" aria-label="Go to login page">Login Page</button>
      </div>
    );
  }

  return (
    <div className="chat-page-container container">
      <SEO title="Direct Messages & Real-Time Chat | GymConnect" canonicalPath="/chat" noindex={true} />
      <div className="chat-interface-wrapper glass-panel">
        
        {/* SIDEBAR: CONVERSATIONS LIST */}
        <aside className={`chat-channels-sidebar ${activeConversation ? 'chat-active' : ''}`} aria-label="Conversation Channels">
          <div className="sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Messages</h3>
              <span className="role-tag-mini">{user.role}</span>
            </div>

            {/* Search conversations */}
            <div className="chat-search-wrap">
              <Search size={14} className="search-icon" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="chat-search-input"
                aria-label="Filter conversations by name or gym"
              />
              {searchFilter && (
                <button type="button" onClick={() => setSearchFilter('')} className="clear-search-btn" aria-label="Clear search">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          
          <div className="channels-list" role="list">
            {filteredConversations.length === 0 ? (
              <div className="empty-channels text-center" style={{ padding: '2rem 1rem' }}>
                <User size={36} className="text-muted" aria-hidden="true" style={{ margin: '0 auto 0.75rem' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                  {conversations.length === 0
                    ? user.role === 'GYM_OWNER'
                      ? 'No customer inquiries yet. Messages from members will appear here.'
                      : 'No active chats. Visit gym discovery to message a gym owner.'
                    : 'No conversations match your search.'}
                </p>
                {conversations.length === 0 && user.role === 'CUSTOMER' && (
                  <button onClick={() => navigate('/gyms')} className="glow-btn" style={{ marginTop: '1rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                    Find Gyms
                  </button>
                )}
              </div>
            ) : (
              filteredConversations.map(conv => {
                const isSelected = activeConversation?.otherUser.id === conv.otherUser.id;
                return (
                  <div 
                    key={conv.otherUser.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`channel-item ${isSelected ? 'active' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Conversation with ${conv.otherUser.name}`}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectConversation(conv); }}
                  >
                    <div className="channel-avatar-wrap">
                      <img 
                        src={conv.otherUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=75'} 
                        alt={`${conv.otherUser.name}'s avatar`} 
                        className="channel-avatar" 
                        loading="lazy"
                        decoding="async"
                        width={44}
                        height={44}
                      />
                      {conv.unreadCount > 0 && <span className="online-dot" aria-hidden="true" />}
                    </div>

                    <div className="channel-info">
                      <div className="channel-title-row">
                        <h4>{conv.otherUser.name}</h4>
                        {conv.lastMessageAt && (
                          <span className="channel-timestamp">
                            {new Date(conv.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>

                      {conv.otherUser.gymName && (
                        <span className="channel-gym-badge">
                          <Building2 size={11} aria-hidden="true" /> {conv.otherUser.gymName}
                        </span>
                      )}

                      <div className="channel-preview-row">
                        <p className="channel-last-msg">
                          {conv.lastMessageSenderId === user.id && <span className="you-prefix">You: </span>}
                          {conv.lastMessage || 'Click to start conversation...'}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="unread-bubble" aria-label={`${conv.unreadCount} unread messages`}>
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* FEED PANEL: ACTIVE CHAT SCREEN */}
        <section className={`chat-messages-viewport ${!activeConversation ? 'empty-thread' : ''}`} aria-label="Active Chat Conversation">
          {activeConversation ? (
            <>
              {/* Thread Header */}
              <div className="thread-header">
                <button 
                  onClick={() => setActiveConversation(null)} 
                  className="back-channels-btn"
                  aria-label="Back to conversations list"
                >
                  <ChevronLeft size={18} aria-hidden="true" /> Back
                </button>
                <div className="thread-user-info">
                  <img 
                    src={activeConversation.otherUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=75'} 
                    alt={`${activeConversation.otherUser.name}'s profile avatar`} 
                    className="thread-avatar" 
                    width={42}
                    height={42}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h4 style={{ margin: 0 }}>{activeConversation.otherUser.name}</h4>
                      <span className="user-role-badge">{activeConversation.otherUser.role.replace('_', ' ')}</span>
                    </div>
                    {activeConversation.otherUser.gymName && (
                      <span className="gym-affiliation-text">
                        <Building2 size={12} aria-hidden="true" /> {activeConversation.otherUser.gymName}
                      </span>
                    )}
                  </div>
                </div>

                {activeConversation.otherUser.gymId && (
                  <button 
                    onClick={() => navigate(`/gyms/${activeConversation.otherUser.gymId}`)}
                    className="btn-secondary"
                    style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    aria-label="View gym profile"
                  >
                    View Gym
                  </button>
                )}
              </div>

              {/* Message Feed */}
              <div className="messages-scroll-area">
                {loadingHistory ? (
                  <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-secondary)' }}>
                    <Loader2 size={32} className="animate-spin text-primary" />
                    <span>Loading conversation history...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex-center text-center" style={{ height: '100%', flexDirection: 'column', gap: '0.75rem', padding: '2rem' }}>
                    <MessageSquare size={48} className="text-muted animate-float" />
                    <h4>No messages yet</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '320px' }}>
                      Send a message below to begin your direct communication with {activeConversation.otherUser.name}.
                    </p>
                  </div>
                ) : (
                  messages.map(msg => {
                    // SENDER vs RECEIVER IDENTIFICATION
                    // Own message: ALWAYS on the right side
                    // Incoming message: ALWAYS on the left side
                    // This automatically inverts when logged in as Gym Owner vs Customer!
                    const isOwnMessage = msg.senderId === user.id;

                    return (
                      <div 
                        key={msg.id} 
                        className={`message-bubble-wrapper ${isOwnMessage ? 'own-msg' : 'incoming-msg'}`}
                      >
                        {!isOwnMessage && (
                          <img 
                            src={msg.sender?.avatar || activeConversation.otherUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=40&q=75'} 
                            alt={`${msg.sender?.name || activeConversation.otherUser.name}'s avatar`}
                            className="bubble-avatar-mini"
                            width={28}
                            height={28}
                          />
                        )}

                        <div className="message-bubble-container">
                          {!isOwnMessage && (
                            <span className="bubble-sender-name">
                              {msg.sender?.name || activeConversation.otherUser.name}
                            </span>
                          )}

                          <div className="message-bubble">
                            {msg.imageUrl && (
                              <img 
                                src={msg.imageUrl} 
                                alt="Attached content" 
                                className="chat-bubble-image" 
                                onClick={() => window.open(msg.imageUrl, '_blank')}
                              />
                            )}
                            {msg.content && <p>{msg.content}</p>}

                            <div className="msg-meta-row">
                              <span className="msg-time">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isOwnMessage && (
                                <span className="read-status-indicator" title={msg.isRead ? 'Read' : 'Delivered'}>
                                  {msg.isRead ? (
                                    <CheckCheck size={14} className="status-read text-primary" />
                                  ) : (
                                    <Check size={14} className="status-sent" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messageEndRef} />
              </div>

              {/* Image Preview attachment bar */}
              {selectedImage && (
                <div className="chat-image-preview-bar glass-card">
                  <img src={selectedImage} alt="Attachment Preview" className="preview-attachment-thumb" />
                  <span className="text-secondary" style={{ fontSize: '0.8rem' }}>Photo attached and ready to send</span>
                  <button 
                    type="button" 
                    onClick={() => setSelectedImage(null)} 
                    className="clear-attachment-btn"
                    aria-label="Remove image attachment"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* Error feedback if sending failed */}
              {sendError && (
                <div className="chat-error-bar" role="alert">
                  <span>⚠️ {sendError}</span>
                  <button type="button" onClick={() => setSendError(null)} className="clear-attachment-btn">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div className="emoji-picker-popover glass-panel" role="region" aria-label="Emoji Picker">
                  <div className="emoji-grid">
                    {EMOJI_LIST.map((emoji, idx) => (
                      <button 
                        key={idx} 
                        type="button" 
                        onClick={() => handleInsertEmoji(emoji)}
                        className="emoji-btn"
                        aria-label={`Insert emoji ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Form */}
              <form onSubmit={handleSendMessage} className="message-input-form" aria-label="Send Message Form">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`chat-action-btn ${showEmojiPicker ? 'active' : ''}`}
                  title="Choose Emoji"
                  aria-label="Open emoji picker"
                >
                  <Smile size={20} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="chat-action-btn"
                  title="Attach Saved Image"
                  aria-label="Attach image from device"
                >
                  <ImageIcon size={20} aria-hidden="true" />
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleChatFileChange}
                  accept="image/*"
                  style={{ display: 'none' }}
                  aria-label="Upload chat image attachment"
                />

                <label htmlFor="chat-message-field" className="sr-only">Type your message</label>
                <input 
                  id="chat-message-field"
                  name="chatMessage"
                  type="text" 
                  placeholder="Type a message (press Enter to send)..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="form-control msg-input-box"
                  aria-label="Type your message here"
                  autoComplete="off"
                  disabled={isSending}
                />
                
                <button 
                  type="submit" 
                  disabled={isSending || (!inputText.trim() && !selectedImage)}
                  className="glow-btn send-msg-btn flex-center"
                  aria-label="Send chat message"
                >
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} aria-hidden="true" />}
                </button>
              </form>
            </>
          ) : (
            <div className="no-active-conversation flex-center text-center">
              <MessageSquare size={64} className="empty-icon animate-float" aria-hidden="true" />
              <h3>Select a Conversation</h3>
              <p style={{ maxWidth: '420px', color: 'var(--text-secondary)', margin: '0 auto 1.5rem' }}>
                {user.role === 'GYM_OWNER'
                  ? 'Select an active member inquiry from the sidebar to review questions, membership interest, and send replies.'
                  : 'Choose a conversation from the sidebar or click "Chat with Gym" on any gym profile page to start a direct line.'}
              </p>
              {user.role === 'CUSTOMER' && (
                <button onClick={() => navigate('/gyms')} className="glow-btn">
                  Browse Gyms Directory
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      <style>{`
        .chat-page-container {
          padding-top: 85px;
          height: calc(100vh - 65px);
          overflow: hidden;
          padding-bottom: 1.5rem;
        }

        .chat-interface-wrapper {
          display: flex;
          height: 100%;
          border-radius: var(--border-radius-lg, 12px);
          overflow: hidden;
          border: 1px solid var(--border-color);
          background: #0f172a;
        }

        /* Sidebar Channel List */
        .chat-channels-sidebar {
          width: 330px;
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          background: #0b0f19;
        }

        .chat-channels-sidebar .sidebar-header {
          padding: 1.25rem;
          border-bottom: 1px solid var(--border-color);
          background: rgba(255, 255, 255, 0.02);
        }

        .role-tag-mini {
          font-size: 0.65rem;
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
          background: rgba(0, 255, 204, 0.1);
          color: #00ffcc;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .chat-search-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 0.75rem;
          color: var(--text-muted);
          pointer-events: none;
        }

        .chat-search-input {
          width: 100%;
          padding: 0.45rem 2rem 0.45rem 2.2rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: #fff;
          font-size: 0.85rem;
        }

        .chat-search-input:focus {
          outline: none;
          border-color: #00ffcc;
        }

        .clear-search-btn {
          position: absolute;
          right: 0.5rem;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
        }

        .channels-list {
          flex: 1;
          overflow-y: auto;
          padding: 0.75rem;
        }

        .channel-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
          margin-bottom: 0.35rem;
          border: 1px solid transparent;
        }

        .channel-item:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        .channel-item.active {
          background: rgba(0, 255, 204, 0.08);
          border: 1px solid rgba(0, 255, 204, 0.3);
        }

        .channel-avatar-wrap {
          position: relative;
          flex-shrink: 0;
        }

        .channel-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid var(--border-color);
        }

        .online-dot {
          position: absolute;
          bottom: 1px;
          right: 1px;
          width: 10px;
          height: 10px;
          background: #00ffcc;
          border-radius: 50%;
          border: 2px solid #0b0f19;
        }

        .channel-info {
          flex: 1;
          min-width: 0;
        }

        .channel-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.15rem;
        }

        .channel-title-row h4 {
          font-size: 0.95rem;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #fff;
        }

        .channel-timestamp {
          font-size: 0.7rem;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .channel-gym-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.7rem;
          color: #00ffcc;
          margin-bottom: 0.2rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        .channel-preview-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .channel-last-msg {
          font-size: 0.75rem;
          color: var(--text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin: 0;
          flex: 1;
        }

        .you-prefix {
          color: #00ffcc;
          font-weight: 600;
        }

        .unread-bubble {
          background: #ef4444;
          color: white;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.15rem 0.45rem;
          border-radius: 9999px;
          box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
          flex-shrink: 0;
        }

        /* Message feed */
        .chat-messages-viewport {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #0b0d14;
        }

        .thread-header {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          gap: 1rem;
          background: rgba(255, 255, 255, 0.02);
        }

        .back-channels-btn {
          display: none;
          color: var(--text-secondary);
          align-items: center;
          font-weight: 600;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
        }

        .thread-user-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .thread-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #00ffcc;
        }

        .user-role-badge {
          font-size: 0.65rem;
          font-weight: 700;
          color: #00ffcc;
          background: rgba(0, 255, 204, 0.1);
          padding: 0.1rem 0.4rem;
          border-radius: 3px;
          letter-spacing: 0.5px;
        }

        .gym-affiliation-text {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 0.15rem;
        }

        .messages-scroll-area {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .message-bubble-wrapper {
          display: flex;
          width: 100%;
          gap: 0.5rem;
          align-items: flex-end;
        }

        .message-bubble-wrapper.own-msg {
          justify-content: flex-end;
        }

        .message-bubble-wrapper.incoming-msg {
          justify-content: flex-start;
        }

        .bubble-avatar-mini {
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          margin-bottom: 2px;
          border: 1px solid var(--border-color);
        }

        .message-bubble-container {
          max-width: 68%;
          display: flex;
          flex-direction: column;
        }

        .own-msg .message-bubble-container {
          align-items: flex-end;
        }

        .incoming-msg .message-bubble-container {
          align-items: flex-start;
        }

        .bubble-sender-name {
          font-size: 0.7rem;
          color: var(--text-muted);
          margin-bottom: 0.25rem;
          margin-left: 0.25rem;
        }

        .message-bubble {
          padding: 0.75rem 1rem;
          border-radius: 12px;
          position: relative;
          word-break: break-word;
        }

        /* OWN MESSAGE: Right Side, Cyan Glowing / Dark Background */
        .own-msg .message-bubble {
          background: linear-gradient(135deg, rgba(0, 255, 204, 0.25), rgba(0, 255, 204, 0.12));
          border: 1px solid rgba(0, 255, 204, 0.4);
          color: #ffffff;
          border-bottom-right-radius: 2px;
          box-shadow: 0 4px 15px rgba(0, 255, 204, 0.08);
        }

        /* INCOMING MESSAGE: Left Side, Dark Slate Card */
        .incoming-msg .message-bubble {
          background: #1e293b;
          color: #f1f5f9;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-bottom-left-radius: 2px;
        }

        .message-bubble p {
          font-size: 0.88rem;
          line-height: 1.45;
          margin: 0;
          white-space: pre-wrap;
        }

        .msg-meta-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.35rem;
          margin-top: 0.35rem;
        }

        .msg-time {
          font-size: 0.65rem;
          opacity: 0.65;
        }

        .read-status-indicator {
          display: flex;
          align-items: center;
        }

        .status-sent {
          color: rgba(255, 255, 255, 0.5);
        }

        .status-read {
          color: #00ffcc;
        }

        .chat-bubble-image {
          max-width: 100%;
          max-height: 240px;
          border-radius: 8px;
          margin-bottom: 0.4rem;
          cursor: pointer;
          object-fit: cover;
          display: block;
        }

        .chat-action-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 0.5rem;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition-fast);
        }

        .chat-action-btn:hover, .chat-action-btn.active {
          color: #00ffcc;
          background: rgba(0, 255, 204, 0.1);
        }

        .chat-image-preview-bar {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 1rem;
          margin: 0 1.5rem 0.5rem;
          border-radius: 8px;
          border: 1px dashed #00ffcc;
          background: rgba(0, 255, 204, 0.05);
        }

        .chat-error-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 1rem;
          margin: 0 1.5rem 0.5rem;
          border-radius: 8px;
          border: 1px solid rgba(239, 68, 68, 0.4);
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          font-size: 0.8rem;
        }

        .preview-attachment-thumb {
          width: 38px;
          height: 38px;
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
          border-radius: 8px;
          background: #1e293b;
          border: 1px solid var(--border-color);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
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
          transform: scale(1.25);
          background: rgba(255, 255, 255, 0.08);
        }

        .message-input-form {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border-color);
          display: flex;
          gap: 0.75rem;
          align-items: center;
          background: rgba(255, 255, 255, 0.02);
        }

        .msg-input-box {
          flex: 1;
          border-radius: 8px;
          background: #131d2e;
          border: 1px solid var(--border-color);
          color: #fff;
          padding: 0.65rem 1rem;
          font-size: 0.9rem;
        }

        .msg-input-box:focus {
          outline: none;
          border-color: #00ffcc;
        }

        .send-msg-btn {
          border-radius: 8px;
          padding: 0 1.25rem;
          height: 42px;
          min-width: 50px;
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
            padding-bottom: 75px;
            height: calc(100vh - 135px);
          }

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
