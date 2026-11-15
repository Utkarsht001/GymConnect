import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SEO } from '../components/SEO';
import { Dumbbell, Mail, Lock, User, Phone, ArrowRight, KeyRound, X, CheckCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const { user, login, apiFetch } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Mode: login or register
  const [isRegister, setIsRegister] = useState(false);
  const [roleSelection, setRoleSelection] = useState<'CUSTOMER' | 'GYM_OWNER' | 'EMPLOYEE' | 'ADMIN'>('CUSTOMER');

  // Input states
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Forgot Password Modal states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotErr, setForgotErr] = useState('');

  // Handle URL flags to pre-configure registration views
  useEffect(() => {
    const registerParam = searchParams.get('register');
    const roleParam = searchParams.get('role');
    if (registerParam) {
      setIsRegister(true);
      if (registerParam === 'owner' || roleParam === 'owner') setRoleSelection('GYM_OWNER');
      else if (registerParam === 'employee' || roleParam === 'employee') setRoleSelection('EMPLOYEE');
      else if (roleParam === 'admin') setRoleSelection('ADMIN');
    } else if (roleParam === 'admin') {
      setRoleSelection('ADMIN');
    }
  }, [searchParams]);

  // Already logged in redirect
  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') navigate('/dashboard/admin');
      else if (user.role === 'EMPLOYEE') navigate('/dashboard/employee');
      else if (user.role === 'GYM_OWNER') navigate('/dashboard/owner');
      else navigate('/dashboard/customer');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanInput = emailOrPhone.trim();
    if (!cleanInput) {
      setErrorMsg('Please enter your registered email address or mobile phone number.');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    if (isRegister) {
      if (!name.trim()) {
        setErrorMsg('Please enter your full name.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters long.');
        return;
      }
    }

    setSubmitting(true);

    try {
      if (isRegister) {
        // Register API call
        const data = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: cleanInput,
            phone: phone.trim() || undefined,
            password,
            name: name.trim(),
            role: roleSelection
          })
        });
        login(data.token, data.user);
      } else {
        // Login API call (Supports Email or Phone number)
        const data = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            loginInput: cleanInput,
            password,
            role: roleSelection
          })
        });
        login(data.token, data.user);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  // Forgot Password Reset Link Handler
  const handleRequestResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErr('');
    setForgotMsg('');

    const cleanEmail = forgotInput.trim();
    if (!cleanEmail) {
      setForgotErr('Please enter your registered email address.');
      return;
    }

    setForgotLoading(true);

    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          email: cleanEmail,
          frontendUrl: window.location.origin
        })
      });
      setForgotSent(true);
      setForgotMsg(res.message || 'If an account exists with this email, a password reset link has been dispatched. Please check your inbox.');
    } catch (err: any) {
      setForgotErr(err.message || 'Failed to request password reset link. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-page-container flex-center">
      <SEO 
        title={isRegister ? "Create Your GymConnect Account" : "Sign In to GymConnect"} 
        description="Access your GymConnect member dashboard, manage gym listings, view active membership passes, or track store orders."
        canonicalPath="/login" 
      />
      <div className="login-card-wrapper glass-panel">
        
        {/* Header */}
        <div className="login-card-header text-center">
          <Dumbbell className="logo-icon animate-float" aria-hidden="true" />
          <h2>{roleSelection === 'ADMIN' ? '🛡️ System Admin Cockpit' : isRegister ? 'Create Account' : 'Welcome Back'}</h2>
          <p>{roleSelection === 'ADMIN' ? 'Super Administrator Authentication Portal' : isRegister ? 'Join Jaipur\'s premium fitness circle' : 'Log in to access your workouts and dashboard'}</p>
        </div>

        {/* Account Type Selector Bar */}
        <div className="role-selector-row" role="tablist" aria-label="Account Role Selection" style={{ marginBottom: '1.25rem' }}>
          <button
            type="button"
            role="tab"
            aria-selected={roleSelection === 'CUSTOMER'}
            onClick={() => setRoleSelection('CUSTOMER')}
            className={`role-choice-btn ${roleSelection === 'CUSTOMER' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
            aria-label="Customer Role"
          >
            Customer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={roleSelection === 'GYM_OWNER'}
            onClick={() => setRoleSelection('GYM_OWNER')}
            className={`role-choice-btn ${roleSelection === 'GYM_OWNER' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
            aria-label="Gym Owner Role"
          >
            Gym Owner
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={roleSelection === 'EMPLOYEE'}
            onClick={() => setRoleSelection('EMPLOYEE')}
            className={`role-choice-btn ${roleSelection === 'EMPLOYEE' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
            aria-label="Support Staff Role"
          >
            Support Staff
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={roleSelection === 'ADMIN'}
            onClick={() => setRoleSelection('ADMIN')}
            className={`role-choice-btn ${roleSelection === 'ADMIN' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem', color: '#ef4444', borderColor: roleSelection === 'ADMIN' ? '#ef4444' : 'rgba(239,68,68,0.3)' }}
            aria-label="Super Administrator Role"
          >
            🛡️ Admin
          </button>
        </div>

        {errorMsg && (
          <div className="error-alert-bar" role="alert" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Auth form */}
        <form onSubmit={handleSubmit} className="auth-form" aria-label={isRegister ? "Registration Form" : "Login Form"}>
          {isRegister && (
            <>
              <div className="form-group">
                <label htmlFor="auth-name-input"><User size={14} aria-hidden="true" /> Full Name</label>
                <input 
                  id="auth-name-input"
                  name="name"
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-control"
                  required
                  autoComplete="name"
                />
              </div>

              {roleSelection !== 'ADMIN' && (
                <div className="form-group">
                  <label htmlFor="auth-phone-input"><Phone size={14} aria-hidden="true" /> Mobile Phone Number</label>
                  <input 
                    id="auth-phone-input"
                    name="phone"
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="form-control"
                    autoComplete="tel"
                  />
                </div>
              )}
            </>
          )}

          <div className="form-group">
            <label htmlFor="auth-login-input">
              <Mail size={14} aria-hidden="true" /> {isRegister ? 'Email Address' : 'Email Address or Mobile Phone Number'}
            </label>
            <input 
              id="auth-login-input"
              name="loginInput"
              type="text"
              placeholder={isRegister ? 'name@example.com' : 'Enter registered Email or Phone number...'}
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              className="form-control"
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="auth-password-input"><Lock size={14} aria-hidden="true" /> Password</label>
              {!isRegister && (
                <button 
                  type="button" 
                  onClick={() => {
                    setShowForgotModal(true);
                    setForgotInput(emailOrPhone.includes('@') ? emailOrPhone.trim() : '');
                    setForgotSent(false);
                    setForgotErr('');
                    setForgotMsg('');
                  }}
                  className="forgot-password-link-btn"
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', cursor: 'pointer' }}
                  aria-label="Open forgot password dialog"
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <input 
              id="auth-password-input"
              name="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-control"
              required
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>

          <button 
            type="submit" 
            disabled={submitting} 
            className="glow-btn login-submit-btn"
            aria-label={submitting ? 'Authenticating credentials...' : isRegister ? 'Complete account registration' : 'Sign in to account'}
          >
            {submitting ? 'Authenticating...' : isRegister ? 'Sign Up' : 'Sign In'} <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>

        {/* Footer toggler */}
        <div className="login-card-footer text-center">
          {isRegister ? (
            <p>
              Already have an account?{' '}
              <button onClick={() => { setIsRegister(false); setErrorMsg(''); }} className="toggle-mode-btn">
                Sign In
              </button>
            </p>
          ) : (
            <p>
              New to GYMGO?{' '}
              <button onClick={() => { setIsRegister(true); setErrorMsg(''); }} className="toggle-mode-btn">
                Create Account
              </button>
            </p>
          )}
        </div>
      </div>

      {/* FORGOT PASSWORD RESET LINK MODAL */}
      {showForgotModal && (
        <div 
          className="modal-overlay flex-center" 
          role="dialog"
          aria-modal="true"
          aria-label="Recover Password"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, padding: '1rem' }}
        >
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem', borderRadius: '12px', position: 'relative' }}>
            <button 
              onClick={() => setShowForgotModal(false)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              aria-label="Close password recovery dialog"
            >
              <X size={20} aria-hidden="true" />
            </button>

            <div className="text-center" style={{ marginBottom: '1.5rem' }}>
              <KeyRound size={36} className="text-primary animate-float" aria-hidden="true" />
              <h3 style={{ margin: '0.5rem 0 0.2rem 0' }}>Recover Password</h3>
              <p className="text-secondary" style={{ fontSize: '0.8rem' }}>Receive a secure reset link in your email</p>
            </div>

            {forgotMsg && (
              <div className="glass-card text-center" style={{ padding: '0.85rem', marginBottom: '1.25rem', border: '1px solid var(--primary-color)' }}>
                <CheckCircle size={24} style={{ color: 'var(--primary-color)', margin: '0 auto 0.5rem auto' }} aria-hidden="true" />
                <p style={{ fontSize: '0.82rem', color: '#f0f6fc', lineHeight: 1.5, margin: 0 }}>{forgotMsg}</p>
              </div>
            )}

            {forgotErr && (
              <div className="error-alert-bar" role="alert" style={{ marginBottom: '1rem' }}>
                <span>{forgotErr}</span>
              </div>
            )}

            {!forgotSent ? (
              <form onSubmit={handleRequestResetLink} aria-label="Password Reset Request Form">
                <div className="form-group">
                  <label htmlFor="forgot-email-field"><Mail size={14} aria-hidden="true" /> Registered Email Address</label>
                  <input 
                    id="forgot-email-field"
                    name="email"
                    type="email"
                    placeholder="e.g. name@example.com"
                    value={forgotInput}
                    onChange={(e) => setForgotInput(e.target.value)}
                    className="form-control"
                    required
                    autoComplete="email"
                    autoFocus
                  />
                  <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                    We'll send a 15-minute single-use password reset link via Brevo.
                  </small>
                </div>
                <button 
                  type="submit" 
                  disabled={forgotLoading} 
                  className="glow-btn" 
                  style={{ width: '100%', marginTop: '1.25rem' }}
                  aria-label={forgotLoading ? 'Dispatching Reset Link...' : 'Send Password Reset Link'}
                >
                  {forgotLoading ? 'Dispatching Reset Link...' : 'Send Password Reset Link'}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="glow-btn"
                  style={{ width: '100%' }}
                  aria-label="Return to Sign In"
                >
                  Return to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .login-page-container {
          padding-top: 70px;
          height: 100vh;
          width: 100vw;
          background: linear-gradient(135deg, #0b0d10 0%, #15181e 100%);
        }

        .login-card-wrapper {
          width: 100%;
          max-width: 440px;
          border-radius: var(--border-radius-lg);
          padding: 2.5rem;
        }

        .login-card-header {
          margin-bottom: 2rem;
        }

        .login-card-header .logo-icon {
          color: var(--primary-color);
          width: 48px;
          height: 48px;
          margin-bottom: 0.5rem;
        }

        .login-card-header h2 {
          font-size: 1.6rem;
        }

        .login-card-header p {
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        .role-selector-row {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .role-choice-btn {
          flex: 1;
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          padding: 0.5rem;
          border-radius: var(--border-radius-sm);
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .role-choice-btn:hover {
          color: var(--text-primary);
        }

        .role-choice-btn.active {
          background: rgba(0, 255, 204, 0.1);
          border-color: var(--primary-color);
          color: var(--primary-color);
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .error-alert-bar {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid var(--status-error);
          color: var(--status-error);
          padding: 0.75rem;
          border-radius: var(--border-radius-sm);
          font-size: 0.85rem;
          margin-bottom: 1.25rem;
          text-align: center;
        }

        .login-submit-btn {
          width: 100%;
          padding: 0.85rem;
          margin-top: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .login-card-footer {
          margin-top: 1.5rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .toggle-mode-btn {
          background: transparent;
          border: none;
          color: var(--primary-color);
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};
