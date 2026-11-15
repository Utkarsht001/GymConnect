import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SEO } from '../components/SEO';
import { Dumbbell, CreditCard, ShoppingBag, Heart, Calendar, Mail, MapPin, MessageSquare } from 'lucide-react';

interface Subscription {
  id: string;
  startDate: string;
  endDate: string;
  pricePaid: number;
  status: string;
  plan: { name: string; durationDays: number };
  gym: { id: string; name: string; logo: string; city: string; address: string; ownerId?: string };
}

interface Order {
  id: string;
  totalPrice: number;
  status: string;
  createdAt: string;
  items: Array<{
    id: string;
    quantity: number;
    pricePaid: number;
    product: { name: string; image: string };
  }>;
}

interface Gym {
  id: string;
  name: string;
  logo: string;
  coverImage: string;
  city: string;
  address: string;
}

export const DashboardCustomer: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const navigate = useNavigate();

  // States
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [favorites, setFavorites] = useState<Gym[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch customer stats & records
  const loadDashboardData = async () => {
    setErrorMsg(null);
    try {
      // 1. Fetch subscriptions
      const subs = await apiFetch('/api/subscriptions/my');
      setSubscriptions(subs || []);

      // 2. Fetch orders
      const ords = await apiFetch('/api/orders/my');
      setOrders(ords || []);

      // 3. Fetch conversations
      try {
        const convs = await apiFetch('/api/messages/conversations');
        setConversations(convs || []);
      } catch (e) {
        console.warn('Could not fetch conversations:', e);
      }

      // 4. Fetch favorites from localStorage list
      const favIds = JSON.parse(localStorage.getItem('fithub_favorites') || '[]');
      if (favIds.length > 0) {
        const allGyms = await apiFetch('/api/gyms');
        const favGyms = allGyms.filter((g: any) => favIds.includes(g.id));
        setFavorites(favGyms);
      } else {
        setFavorites([]);
      }
    } catch (err: any) {
      console.error('Failed to load customer dashboard records:', err);
      setErrorMsg(err.message || 'Failed to connect or fetch user data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'CUSTOMER') {
      // Redirect other roles to their dashboards
      if (user.role === 'ADMIN') navigate('/dashboard/admin');
      else if (user.role === 'GYM_OWNER') navigate('/dashboard/owner');
    }
    loadDashboardData();
  }, [user]);

  const handleCancelSub = async (subId: string) => {
    const confirmCancel = window.confirm('Are you sure you want to cancel this membership?');
    if (!confirmCancel) return;

    try {
      await apiFetch(`/api/subscriptions/${subId}/cancel`, { method: 'PUT' });
      alert('Membership cancelled.');
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || 'Cancellation failed.');
    }
  };

  if (loading) {
    return (
      <div className="container flex-center" style={{ height: '70vh' }}>
        <div className="skeleton-card" style={{ width: '100%', height: '400px' }}></div>
      </div>
    );
  }

  const activeSubs = subscriptions.filter(s => s.status === 'ACTIVE');

  return (
    <div className="customer-dashboard-container container">
      <SEO title="Member Dashboard & Active Passes" canonicalPath="/dashboard/customer" noindex={true} />
      {/* 1. PROFILE HEADER */}
      <section className="profile-banner-card glass-panel" aria-label="Customer Profile Summary">
        <img 
          src={user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=75'} 
          alt={`${user?.name || 'Customer'}'s profile avatar`} 
          className="profile-large-avatar" 
          width={72}
          height={72}
        />
        <div className="profile-meta">
          <h2>{user?.name}</h2>
          <p className="profile-email"><Mail size={14} aria-hidden="true" /> {user?.email}</p>
          <div className="role-tag">CUSTOMER</div>
        </div>
        <div className="dashboard-quick-stats">
          <div className="stat-bubble">
            <span className="count">{activeSubs.length}</span>
            <span className="label">Active Gyms</span>
          </div>
          <div className="stat-bubble">
            <span className="count">{orders.length}</span>
            <span className="label">Store Orders</span>
          </div>
          <div className="stat-bubble" onClick={() => navigate('/chat')} style={{ cursor: 'pointer' }} title="Open Live Chat">
            <span className="count" style={{ color: '#00ffcc' }}>{conversations.length}</span>
            <span className="label">Messages</span>
          </div>
          <div className="stat-bubble">
            <span className="count">{favorites.length}</span>
            <span className="label">Favorites</span>
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="error-alert-bar" role="alert" style={{ margin: '1rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {errorMsg}</span>
          <button 
            type="button" 
            onClick={loadDashboardData} 
            style={{ background: 'var(--primary-color)', color: '#000', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            aria-label="Retry loading dashboard data"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. MAIN LAYOUT GRID */}
      <div className="dashboard-content-split">
        
        {/* Left main: Active Subscriptions & Orders */}
        <div className="main-feed-column">
          
          {/* Active Memberships */}
          <section className="dashboard-block-panel glass-panel" aria-label="Active Gym Memberships">
            <h2><CreditCard size={18} aria-hidden="true" /> My Memberships</h2>
            
            {activeSubs.length === 0 ? (
              <div className="empty-feed-card text-center">
                <Dumbbell size={32} className="text-muted" aria-hidden="true" />
                <p>No active memberships found.</p>
                <Link to="/gyms" className="glow-btn" aria-label="Discover gyms and purchase a membership pass">Discover Gyms</Link>
              </div>
            ) : (
              <div className="subs-list">
                {activeSubs.map(sub => (
                  <article key={sub.id} className="sub-dashboard-card glass-card">
                    <img 
                      src={sub.gym.logo || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=80&q=75'} 
                      alt={`${sub.gym.name} brand logo`} 
                      className="gym-logo-sub" 
                      width={48}
                      height={48}
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="sub-info">
                      <div className="sub-title-row">
                        <h3>{sub.gym.name}</h3>
                        <span className="badge badge-approved">Active</span>
                      </div>
                      <p className="sub-plan-name">Plan: <b>{sub.plan.name}</b> (Paid: ₹{sub.pricePaid})</p>
                      
                      <div className="sub-dates-row">
                        <Calendar size={14} aria-hidden="true" />
                        <span>Valid: {new Date(sub.startDate).toLocaleDateString()} - <b>{new Date(sub.endDate).toLocaleDateString()}</b></span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>
                      <button 
                        onClick={() => navigate(`/chat?userId=${sub.gym.ownerId || sub.gym.id}`, { state: { startChatWith: { id: sub.gym.ownerId || sub.gym.id, name: sub.gym.name, avatar: sub.gym.logo, role: 'GYM_OWNER', gymName: sub.gym.name, gymId: sub.gym.id } } })}
                        className="glow-btn flex-center"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', gap: '0.25rem' }}
                        aria-label={`Chat with ${sub.gym.name} owner`}
                      >
                        <MessageSquare size={12} aria-hidden="true" /> Message Gym
                      </button>
                      <button 
                        onClick={() => handleCancelSub(sub.id)}
                        className="btn-secondary cancel-sub-btn"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                        aria-label={`Cancel active subscription for ${sub.gym.name}`}
                      >
                        Cancel
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* E-Store Orders History */}
          <section className="dashboard-block-panel glass-panel" aria-label="Product Order History">
            <h2><ShoppingBag size={18} aria-hidden="true" /> Product Orders ({orders.length})</h2>
            
            {orders.length === 0 ? (
              <div className="empty-feed-card text-center">
                <p className="text-muted">No shopping orders found.</p>
                <Link to="/store" className="btn-secondary" aria-label="Browse the gym accessories store">Visit Gym Store</Link>
              </div>
            ) : (
              <div className="orders-feed-list">
                {orders.map(order => (
                  <article key={order.id} className="order-dashboard-card glass-card">
                    <div className="order-card-header">
                      <div>
                        <h4>Order #{order.id.substring(0, 8)}</h4>
                        <span className="order-date">Date: {new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                      <span className={`badge badge-${order.status.toLowerCase() === 'delivered' ? 'approved' : 'pending'}`}>
                        {order.status}
                      </span>
                    </div>

                    <div className="order-items-preview">
                      {order.items.map(item => (
                        <div key={item.id} className="order-item-inline">
                          <img 
                            src={item.product.image || 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=60&q=75'} 
                            alt={`${item.product.name} product photo`} 
                            width={36}
                            height={36}
                            loading="lazy"
                            decoding="async"
                          />
                          <div>
                            <h5>{item.product.name}</h5>
                            <span className="item-qty">Qty: {item.quantity} × ₹{item.pricePaid}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="order-card-footer">
                      <span>Total Price Paid:</span>
                      <span className="price-bold">₹{order.totalPrice.toFixed(2)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right sidebar: Messages & Favorite Gyms */}
        <aside className="dashboard-sidebar-column" aria-label="Customer Communications and Saved Gyms">
          
          {/* Gym Conversations Panel */}
          <section className="dashboard-block-panel glass-panel" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}><MessageSquare size={16} aria-hidden="true" /> Gym Chats ({conversations.length})</h2>
              <button onClick={() => navigate('/chat')} className="glow-btn" style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}>
                Open Chat
              </button>
            </div>

            {conversations.length === 0 ? (
              <p className="text-muted text-center" style={{ padding: '1.5rem 0', fontSize: '0.85rem' }}>
                No active conversations yet. Click "Chat with Gym" on any gym profile.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {conversations.slice(0, 4).map(c => (
                  <div 
                    key={c.otherUser.id}
                    onClick={() => navigate(`/chat?userId=${c.otherUser.id}`, { state: { startChatWith: c.otherUser } })}
                    className="fav-sidebar-card glass-card"
                    style={{ cursor: 'pointer', padding: '0.6rem 0.75rem' }}
                  >
                    <img 
                      src={c.otherUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60'} 
                      alt={c.otherUser.name} 
                      className="fav-logo" 
                      width={32} 
                      height={32} 
                    />
                    <div className="fav-info" style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.otherUser.name}
                        </h4>
                        {c.unreadCount > 0 && (
                          <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '999px' }}>
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      {c.otherUser.gymName && (
                        <span style={{ fontSize: '0.7rem', color: '#00ffcc', display: 'block' }}>
                          {c.otherUser.gymName}
                        </span>
                      )}
                      <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.lastMessage || 'Click to view messages'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-block-panel glass-panel">
            <h2><Heart size={18} aria-hidden="true" /> Favorites ({favorites.length})</h2>
            
            {favorites.length === 0 ? (
              <p className="text-muted text-center" style={{ padding: '2rem 0' }}>No saved gyms.</p>
            ) : (
              <div className="favorites-list-sidebar">
                {favorites.map(gym => (
                  <div key={gym.id} className="fav-sidebar-card glass-card">
                    <img 
                      src={gym.logo || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=60&q=75'} 
                      alt={`${gym.name} logo`} 
                      className="fav-logo" 
                      width={36}
                      height={36}
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="fav-info">
                      <h4>{gym.name}</h4>
                      <p><MapPin size={12} aria-hidden="true" /> {gym.city}</p>
                      <Link to={`/gyms/${gym.id}`} className="view-fav-link" aria-label={`View profile for ${gym.name}`}>
                        View Profile
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <style>{`
        .customer-dashboard-container {
          padding-top: 90px;
          padding-bottom: 80px;
        }

        /* Profile Banner */
        .profile-banner-card {
          display: flex;
          align-items: center;
          padding: 2.5rem;
          border-radius: var(--border-radius-lg);
          gap: 2rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }

        .profile-large-avatar {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          object-fit: cover;
          border: 2.5px solid var(--primary-color);
        }

        .profile-meta {
          flex: 1;
        }

        .profile-meta h2 {
          font-size: 1.8rem;
          margin-bottom: 0.25rem;
        }

        .profile-email {
          color: var(--text-secondary);
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.35rem;
          margin-bottom: 0.5rem;
        }

        .role-tag {
          display: inline-block;
          background: rgba(0, 255, 204, 0.1);
          color: var(--primary-color);
          border: 1px solid var(--border-glow);
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          letter-spacing: 0.05em;
        }

        .dashboard-quick-stats {
          display: flex;
          gap: 1.5rem;
        }

        .stat-bubble {
          background: var(--bg-surface-elevated);
          padding: 0.75rem 1.25rem;
          border-radius: var(--border-radius-sm);
          text-align: center;
          min-width: 100px;
          border: 1px solid var(--border-color);
        }

        .stat-bubble .count {
          display: block;
          font-size: 1.35rem;
          font-weight: 800;
          color: var(--primary-color);
        }

        .stat-bubble .label {
          font-size: 0.7rem;
          color: var(--text-secondary);
          font-weight: 500;
          text-transform: uppercase;
        }

        /* Main split layouts */
        .dashboard-content-split {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
          align-items: start;
        }

        .dashboard-block-panel {
          padding: 2rem;
          border-radius: var(--border-radius-md);
          margin-bottom: 2rem;
        }

        .dashboard-block-panel h2 {
          font-size: 1.35rem;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 0.5rem;
        }

        .empty-feed-card {
          padding: 3rem 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        /* Subscriptions cards */
        .subs-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .sub-dashboard-card {
          display: flex;
          align-items: center;
          padding: 1.25rem;
          gap: 1.25rem;
        }

        .gym-logo-sub {
          width: 56px;
          height: 56px;
          border-radius: var(--border-radius-sm);
          object-fit: cover;
          border: 1px solid var(--border-color);
        }

        .sub-info {
          flex: 1;
        }

        .sub-title-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.25rem;
        }

        .sub-title-row h3 {
          font-size: 1.05rem;
        }

        .sub-plan-name {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: 0.25rem;
        }

        .sub-dates-row {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .cancel-sub-btn {
          font-size: 0.8rem;
          padding: 0.4rem 0.8rem;
          border-radius: var(--border-radius-sm);
        }

        /* Orders styles */
        .orders-feed-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .order-dashboard-card {
          padding: 1.25rem;
        }

        .order-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .order-card-header h4 {
          font-size: 0.95rem;
        }

        .order-date {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .order-items-preview {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .order-item-inline {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .order-item-inline img {
          width: 40px;
          height: 40px;
          object-fit: cover;
          border-radius: 4px;
          border: 1px solid var(--border-color);
        }

        .order-item-inline h5 {
          font-size: 0.85rem;
        }

        .item-qty {
          font-size: 0.75rem;
          color: var(--text-secondary);
          display: block;
        }

        .order-card-footer {
          display: flex;
          justify-content: space-between;
          margin-top: 1rem;
          border-top: 1px solid var(--border-color);
          padding-top: 0.75rem;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .price-bold {
          color: var(--primary-color);
          font-weight: 700;
        }

        /* Favorites sidebar */
        .favorites-list-sidebar {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .fav-sidebar-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
        }

        .fav-logo {
          width: 44px;
          height: 44px;
          object-fit: cover;
          border-radius: var(--border-radius-sm);
        }

        .fav-info h4 {
          font-size: 0.9rem;
        }

        .fav-info p {
          font-size: 0.7rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 0.2rem;
          margin-bottom: 0.25rem;
        }

        .view-fav-link {
          font-size: 0.75rem;
          color: var(--primary-color);
          font-weight: 600;
        }

        .view-fav-link:hover {
          text-decoration: underline;
        }

        @media (max-width: 992px) {
          .dashboard-content-split {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .profile-banner-card {
            padding: 1.5rem;
            flex-direction: column;
            text-align: center;
          }
          .dashboard-quick-stats {
            width: 100%;
            justify-content: center;
          }
          .sub-dashboard-card {
            flex-direction: column;
            text-align: center;
          }
          .gym-logo-sub {
            margin: 0 auto;
          }
          .sub-title-row {
            justify-content: center;
          }
          .sub-dates-row {
            justify-content: center;
          }
          .cancel-sub-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};
