import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Dumbbell, Mail, Lock, User, Phone, ArrowRight, KeyRound, X } from 'lucide-react';

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

  // Forgot Password / OTP Modal states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [forgotInput, setForgotInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);
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
    setSubmitting(true);

    try {
      if (isRegister) {
        // Register API call
        const data = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: emailOrPhone,
            phone,
            password,
            name,
            role: roleSelection
          })
        });
        login(data.token, data.user);
      } else {
        // Login API call (Email or Phone number supported)
        const data = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ loginInput: emailOrPhone, password })
        });
        login(data.token, data.user);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  // Forgot Password OTP Handlers
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErr('');
    setForgotMsg('');
    setForgotLoading(true);

    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ emailOrPhone: forgotInput })
      });
      setForgotMsg(res.message);
      if (res.otp) setDemoOtp(res.otp);
      setForgotStep('verify');
    } catch (err: any) {
      setForgotErr(err.message || 'Failed to request OTP.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErr('');
    setForgotMsg('');
    setForgotLoading(true);

    try {
      await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ emailOrPhone: forgotInput, otp: otpInput })
      });
      setForgotMsg('OTP Code Verified! Enter your new password below.');
      setForgotStep('reset');
    } catch (err: any) {
      setForgotErr(err.message || 'Invalid OTP code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErr('');
    setForgotMsg('');
    setForgotLoading(true);

    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ emailOrPhone: forgotInput, otp: otpInput, newPassword })
      });
      alert('Password reset successfully! Please log in with your new password.');
      setShowForgotModal(false);
      setForgotStep('request');
      setPassword(newPassword);
      setEmailOrPhone(forgotInput);
    } catch (err: any) {
      setForgotErr(err.message || 'Failed to reset password.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-page-container flex-center">
      <div className="login-card-wrapper glass-panel">
        
        {/* Header */}
        <div className="login-card-header text-center">
          <Dumbbell className="logo-icon animate-float" />
          <h2>{roleSelection === 'ADMIN' ? '🛡️ System Admin Cockpit' : isRegister ? 'Create Account' : 'Welcome Back'}</h2>
          <p>{roleSelection === 'ADMIN' ? 'Super Administrator Authentication Portal' : isRegister ? 'Join Jaipur\'s premium fitness circle' : 'Log in to access your workouts and dashboard'}</p>
        </div>

        {/* Account Type Selector Bar */}
        <div className="role-selector-row" style={{ marginBottom: '1.25rem' }}>
          <button
            type="button"
            onClick={() => setRoleSelection('CUSTOMER')}
            className={`role-choice-btn ${roleSelection === 'CUSTOMER' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => setRoleSelection('GYM_OWNER')}
            className={`role-choice-btn ${roleSelection === 'GYM_OWNER' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
          >
            Gym Owner
          </button>
          <button
            type="button"
            onClick={() => setRoleSelection('EMPLOYEE')}
            className={`role-choice-btn ${roleSelection === 'EMPLOYEE' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
          >
            Support Staff
          </button>
          <button
            type="button"
            onClick={() => setRoleSelection('ADMIN')}
            className={`role-choice-btn ${roleSelection === 'ADMIN' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem', color: '#ef4444', borderColor: roleSelection === 'ADMIN' ? '#ef4444' : 'rgba(239,68,68,0.3)' }}
          >
            🛡️ Admin
          </button>
        </div>

        {errorMsg && (
          <div className="error-alert-bar">
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Auth form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <>
              <div className="form-group">
                <label><User size={14} /> Full Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-control"
                  required
                />
              </div>

              {roleSelection !== 'ADMIN' && (
                <div className="form-group">
                  <label><Phone size={14} /> Mobile Phone Number</label>
                  <input 
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="form-control"
                    required
                  />
                </div>
              )}
            </>
          )}

          <div className="form-group">
            <label>
              <Mail size={14} /> {isRegister ? 'Email Address' : 'Email Address or Mobile Phone Number'}
            </label>
            <input 
              type="text"
              placeholder={isRegister ? 'name@example.com' : 'Enter registered Email or Phone number...'}
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label><Lock size={14} /> Password</label>
              {!isRegister && roleSelection !== 'ADMIN' && (
                <button 
                  type="button" 
                  onClick={() => { setShowForgotModal(true); setForgotInput(emailOrPhone); }}
                  className="forgot-password-link-btn"
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <input 
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-control"
              required
            />
          </div>

          <button type="submit" disabled={submitting} className="glow-btn login-submit-btn">
            {submitting ? 'Authenticating...' : isRegister ? 'Sign Up' : 'Sign In'} <ArrowRight size={18} />
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
              New to FitHub?{' '}
              <button onClick={() => { setIsRegister(true); setErrorMsg(''); }} className="toggle-mode-btn">
                Create Account
              </button>
            </p>
          )}
        </div>
      </div>

      {/* FORGOT PASSWORD OTP MODAL */}
      {showForgotModal && (
        <div className="modal-overlay flex-center" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '2rem', borderRadius: '12px', position: 'relative' }}>
            <button 
              onClick={() => setShowForgotModal(false)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div className="text-center" style={{ marginBottom: '1.5rem' }}>
              <KeyRound size={36} className="text-primary animate-float" />
              <h3 style={{ margin: '0.5rem 0 0.2rem 0' }}>Reset Password OTP</h3>
              <p className="text-secondary" style={{ fontSize: '0.8rem' }}>Verify registered Email or Phone number</p>
            </div>

            {forgotMsg && (
              <div className="glass-card text-center" style={{ padding: '0.6rem', marginBottom: '1rem', border: '1px solid var(--primary-color)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)' }}>{forgotMsg}</span>
              </div>
            )}

            {demoOtp && forgotStep === 'verify' && (
              <div className="glass-card text-center" style={{ padding: '0.6rem', marginBottom: '1rem', background: 'rgba(0,255,204,0.1)' }}>
                <small className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>Verification OTP Code:</small>
                <code style={{ fontSize: '1.4rem', color: '#00ffcc', fontWeight: 800, letterSpacing: '3px' }}>{demoOtp}</code>
              </div>
            )}

            {forgotErr && (
              <div className="error-alert-bar" style={{ marginBottom: '1rem' }}>
                <span>{forgotErr}</span>
              </div>
            )}

            {/* STEP 1: Request OTP */}
            {forgotStep === 'request' && (
              <form onSubmit={handleRequestOtp}>
                <div className="form-group">
                  <label><Mail size={14} /> Registered Email or Phone</label>
                  <input 
                    type="text"
                    placeholder="e.g. name@example.com or 9876543210"
                    value={forgotInput}
                    onChange={(e) => setForgotInput(e.target.value)}
                    className="form-control"
                    required
                  />
                </div>
                <button type="submit" disabled={forgotLoading} className="glow-btn" style={{ width: '100%', marginTop: '1rem' }}>
                  {forgotLoading ? 'Sending OTP...' : 'Send Verification OTP'}
                </button>
              </form>
            )}

            {/* STEP 2: Verify OTP */}
            {forgotStep === 'verify' && (
              <form onSubmit={handleVerifyOtp}>
                <div className="form-group">
                  <label><KeyRound size={14} /> Enter 6-Digit OTP Code</label>
                  <input 
                    type="text"
                    placeholder="Enter 6-digit code..."
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    className="form-control"
                    maxLength={6}
                    required
                    style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 }}
                  />
                </div>
                <button type="submit" disabled={forgotLoading} className="glow-btn" style={{ width: '100%', marginTop: '1rem' }}>
                  {forgotLoading ? 'Verifying...' : 'Verify OTP Code'}
                </button>
              </form>
            )}

            {/* STEP 3: Reset Password */}
            {forgotStep === 'reset' && (
              <form onSubmit={handleResetPassword}>
                <div className="form-group">
                  <label><Lock size={14} /> Enter New Password</label>
                  <input 
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="form-control"
                    required
                  />
                </div>
                <button type="submit" disabled={forgotLoading} className="glow-btn" style={{ width: '100%', marginTop: '1rem' }}>
                  {forgotLoading ? 'Updating Password...' : 'Save New Password & Login'}
                </button>
              </form>
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
