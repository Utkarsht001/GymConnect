import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Dumbbell, ShoppingCart, MessageSquare, Bell, User, LogOut, Compass, Store } from 'lucide-react';
import { useCurrency, type CurrencyCode } from '../context/CurrencyContext';

export const Navbar: React.FC = () => {
  const { user, logout, apiFetch } = useAuth();
  const { cartCount } = useCart();
  const { currency, setCurrency } = useCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const [notificationCount, setNotificationCount] = useState(0);

  // Fetch unread notifications
  useEffect(() => {
    const fetchNotificationCount = async () => {
      if (!user) return;
      try {
        const data = await apiFetch('/api/messages/notifications');
        setNotificationCount(data.unreadCount || 0);
      } catch (err) {
        console.error('Failed to load notifications count');
      }
    };

    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* DESKTOP HEADER (Hidden on mobile via CSS) */}
      <header className="desktop-header glass-panel">
        <div className="container header-container">
          <Link to="/" className="logo-section">
            <Dumbbell className="logo-icon animate-float" />
            <span className="logo-text">FitHub <span className="highlight">Connect</span></span>
          </Link>

          <nav className="desktop-nav">
            <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>Home</Link>
            <Link to="/gyms" className={`nav-link ${isActive('/gyms') ? 'active' : ''}`}>Gym Near Me</Link>
            <Link to="/store" className={`nav-link ${isActive('/store') ? 'active' : ''}`}>Gym Store</Link>
            {user && (
              <>
                <Link to="/chat" className={`nav-link ${isActive('/chat') ? 'active' : ''}`}>Messages</Link>
                {user.role === 'CUSTOMER' && (
                  <Link to="/favorites" className={`nav-link ${isActive('/favorites') ? 'active' : ''}`}>Favorites</Link>
                )}
              </>
            )}
          </nav>

          <div className="actions-section">
            {/* Multi-Currency Dropdown */}
            <div className="currency-picker-wrapper">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="currency-select-dropdown"
                title="Select Currency"
              >
                <option value="INR">₹ INR</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
                <option value="GBP">£ GBP</option>
                <option value="AED">AED</option>
              </select>
            </div>

            {user ? (
              <>
                {user.role === 'CUSTOMER' && (
                  <Link to="/cart" className="action-icon-wrapper">
                    <ShoppingCart className="action-icon" />
                    {cartCount > 0 && <span className="icon-badge">{cartCount}</span>}
                  </Link>
                )}
                
                <Link to="/notifications" className="action-icon-wrapper">
                  <Bell className="action-icon" />
                  {notificationCount > 0 && <span className="icon-badge">{notificationCount}</span>}
                </Link>

                <div className="profile-dropdown-wrapper">
                  <Link 
                    to={
                      user.role === 'ADMIN' 
                        ? '/dashboard/admin' 
                        : user.role === 'EMPLOYEE'
                          ? '/dashboard/employee'
                          : user.role === 'GYM_OWNER' 
                            ? '/dashboard/owner' 
                            : '/dashboard/customer'
                    } 
                    className="profile-btn"
                  >
                    <img src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80'} alt="Avatar" className="user-avatar" />
                    <span className="user-name">{user.name.split(' ')[0]}</span>
                  </Link>
                  <button onClick={handleLogout} className="logout-btn" title="Log Out">
                    <LogOut className="logout-icon" />
                  </button>
                </div>
              </>
            ) : (
              <Link to="/login" className="glow-btn">Sign In</Link>
            )}
          </div>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="mobile-bottom-nav glass-panel">
        <Link to="/" className={`mobile-nav-item ${isActive('/') ? 'active' : ''}`}>
          <Dumbbell className="mobile-nav-icon" />
          <span>Home</span>
        </Link>
        <Link to="/gyms" className={`mobile-nav-item ${isActive('/gyms') ? 'active' : ''}`}>
          <Compass className="mobile-nav-icon" />
          <span>Gyms</span>
        </Link>
        <Link to="/store" className={`mobile-nav-item ${isActive('/store') ? 'active' : ''}`}>
          <Store className="mobile-nav-icon" />
          <span>Store</span>
        </Link>
        {user ? (
          <>
            <Link to="/chat" className={`mobile-nav-item ${isActive('/chat') ? 'active' : ''} relative`}>
              <MessageSquare className="mobile-nav-icon" />
              <span>Chat</span>
            </Link>
            <Link 
              to={
                user.role === 'ADMIN' 
                  ? '/dashboard/admin' 
                  : user.role === 'GYM_OWNER' 
                    ? '/dashboard/owner' 
                    : '/dashboard/customer'
              } 
              className={`mobile-nav-item ${location.pathname.startsWith('/dashboard') ? 'active' : ''}`}
            >
              <User className="mobile-nav-icon" />
              <span>Profile</span>
            </Link>
          </>
        ) : (
          <Link to="/login" className={`mobile-nav-item ${isActive('/login') ? 'active' : ''}`}>
            <User className="mobile-nav-icon" />
            <span>Login</span>
          </Link>
        )}
      </nav>

      {/* Styles for Navbar layout */}
      <style>{`
        /* Desktop Header styling */
        .desktop-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 70px;
          z-index: 1000;
          display: flex;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
        }

        .header-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 1.5rem;
          color: var(--text-primary);
        }

        .logo-icon {
          color: var(--primary-color);
          width: 28px;
          height: 28px;
        }

        .highlight {
          color: var(--primary-color);
        }

        .desktop-nav {
          display: flex;
          align-items: center;
          gap: 2rem;
        }

        .nav-link {
          font-weight: 500;
          color: var(--text-secondary);
          position: relative;
          padding: 0.5rem 0;
        }

        .nav-link:hover, .nav-link.active {
          color: var(--primary-color);
        }

        .nav-link::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0;
          height: 2px;
          background: var(--primary-color);
          transition: var(--transition-smooth);
        }

        .nav-link:hover::after, .nav-link.active::after {
          width: 100%;
        }

        .actions-section {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .action-icon-wrapper {
          position: relative;
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .currency-select-dropdown {
          background: var(--bg-surface-elevated);
          color: var(--primary-color);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 0.35rem 0.6rem;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          outline: none;
          transition: var(--transition-fast);
        }

        .currency-select-dropdown:hover {
          border-color: var(--primary-color);
        }

        .action-icon-wrapper:hover {
          color: var(--primary-color);
        }

        .action-icon {
          width: 22px;
          height: 22px;
        }

        .icon-badge {
          position: absolute;
          top: -6px;
          right: -8px;
          background: var(--secondary-color);
          color: white;
          font-size: 0.65rem;
          font-weight: 700;
          border-radius: 9999px;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 10px var(--secondary-glow);
        }

        .profile-dropdown-wrapper {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .profile-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--bg-surface-elevated);
          padding: 0.4rem 0.8rem;
          border-radius: 9999px;
          border: 1px solid var(--border-color);
          transition: var(--transition-smooth);
        }

        .profile-btn:hover {
          border-color: var(--primary-color);
        }

        .user-avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid var(--primary-color);
        }

        .user-name {
          font-size: 0.85rem;
          font-weight: 600;
        }

        .logout-btn {
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .logout-btn:hover {
          color: var(--status-error);
        }

        .logout-icon {
          width: 20px;
          height: 20px;
        }

        /* Mobile Bottom Nav styles */
        .mobile-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 64px;
          z-index: 1000;
          border-top: 1px solid var(--border-color);
          grid-template-columns: repeat(5, 1fr);
          align-items: center;
          justify-items: center;
        }

        .mobile-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          color: var(--text-secondary);
          font-size: 0.7rem;
          font-weight: 500;
          width: 100%;
          height: 100%;
        }

        .mobile-nav-item.active {
          color: var(--primary-color);
        }

        .mobile-nav-icon {
          width: 20px;
          height: 20px;
        }

        /* Responsiveness logic */
        @media (max-width: 768px) {
          .desktop-header {
            display: none;
          }
          .mobile-bottom-nav {
            display: grid;
          }
        }
      `}</style>
    </>
  );
};
