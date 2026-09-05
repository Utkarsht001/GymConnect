import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bell, ChevronLeft } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const Notifications: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const data = await apiFetch('/api/messages/notifications');
      setNotifications(data.notifications || []);

      // Auto mark as read on visit
      if (data.unreadCount > 0) {
        await apiFetch('/api/messages/notifications/read', { method: 'PUT' });
      }
    } catch (err) {
      console.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchNotifications();
  }, [user]);

  if (loading) {
    return (
      <div className="container flex-center" style={{ height: '70vh' }}>
        <div className="skeleton-card" style={{ width: '100%', height: '300px' }}></div>
      </div>
    );
  }

  return (
    <div className="notifications-page-container container" style={{ paddingTop: '90px', paddingBottom: '80px', maxWidth: '800px' }}>
      <div className="notifications-card glass-panel" style={{ padding: '2rem', borderRadius: '12px' }}>
        <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Bell size={24} className="text-primary" />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Notifications & Alerts</h2>
              <small className="text-muted">Stay updated with messages, gym news, and order updates</small>
            </div>
          </div>
          <button onClick={() => navigate(-1)} className="btn-secondary flex-center" style={{ gap: '0.3rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
            <ChevronLeft size={16} /> Back
          </button>
        </div>

        {notifications.length === 0 ? (
          <div className="empty-notifications text-center" style={{ padding: '3rem 0' }}>
            <Bell size={48} className="text-muted" style={{ opacity: 0.4 }} />
            <h3 style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>No Notifications Yet</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>You will receive updates when gym owners respond or order statuses change.</p>
          </div>
        ) : (
          <div className="notifications-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {notifications.map(item => (
              <div 
                key={item.id} 
                className="notification-item-card glass-card"
                style={{ 
                  padding: '1rem 1.25rem', 
                  borderRadius: '8px',
                  borderLeft: item.isRead ? '3px solid var(--border-color)' : '3px solid var(--primary-color)',
                  background: item.isRead ? 'var(--bg-surface)' : 'rgba(0, 255, 204, 0.03)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.3rem 0', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                      {item.title}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.message}</p>
                    <small className="text-muted" style={{ fontSize: '0.7rem', marginTop: '0.4rem', display: 'block' }}>
                      {new Date(item.createdAt).toLocaleString()}
                    </small>
                  </div>
                  {!item.isRead && (
                    <span className="badge badge-approved" style={{ fontSize: '0.65rem' }}>New</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
