import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Dumbbell, Lock, KeyRound, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { apiFetch } = useAuth();

  const token = searchParams.get('token') || '';

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [tokenError, setTokenError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      setTokenError('No password reset token was provided in the URL. Please request a new reset link.');
      return;
    }

    // Verify token validity with backend
    const checkToken = async () => {
      try {
        const res = await apiFetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
        if (res.valid) {
          setTokenValid(true);
          setTargetEmail(res.email || '');
        } else {
          setTokenValid(false);
          setTokenError(res.error || 'The reset link is invalid or has expired.');
        }
      } catch (err: any) {
        setTokenValid(false);
        setTokenError(err.message || 'Unable to verify reset token. Please request a new link.');
      } finally {
        setVerifying(false);
      }
    };

    checkToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);

    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword
        })
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="reset-page-container flex-center">
      <div className="reset-card-wrapper glass-panel">
        
        {/* Header */}
        <div className="text-center" style={{ marginBottom: '1.75rem' }}>
          <Dumbbell className="logo-icon animate-float" style={{ color: 'var(--primary-color)', width: 44, height: 44, marginBottom: '0.5rem' }} />
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.35rem 0' }}>Reset Password</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
            {targetEmail ? `Create a new password for ${targetEmail}` : 'GymConnect Secure Password Recovery'}
          </p>
        </div>

        {/* Verifying state */}
        {verifying && (
          <div className="text-center" style={{ padding: '2rem 1rem' }}>
            <KeyRound className="animate-spin text-primary" size={36} style={{ margin: '0 auto 1rem auto' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Verifying your reset security token...</p>
          </div>
        )}

        {/* Invalid or Expired Token State */}
        {!verifying && !tokenValid && !success && (
          <div className="token-invalid-box text-center">
            <AlertCircle size={44} style={{ color: 'var(--status-error)', margin: '0 auto 1rem auto' }} />
            <h4 style={{ color: '#fff', margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Reset Link Invalid or Expired</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              {tokenError || 'This password reset link is invalid, has already been used, or has expired after 15 minutes.'}
            </p>
            <Link to="/login" className="glow-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
              Return to Login & Request New Link <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="reset-success-box text-center" style={{ padding: '1rem 0' }}>
            <CheckCircle size={48} style={{ color: 'var(--primary-color)', margin: '0 auto 1rem auto' }} />
            <h3 style={{ color: '#fff', margin: '0 0 0.5rem 0' }}>Password Reset Successful!</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Your password has been securely updated. You can now log into your GymConnect account with your new password.
            </p>
            <p style={{ color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 600 }}>
              Redirecting to login portal in 3 seconds...
            </p>
            <button
              onClick={() => navigate('/login')}
              className="glow-btn"
              style={{ marginTop: '1rem', width: '100%' }}
            >
              Sign In Now <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Valid Token - Reset Form */}
        {!verifying && tokenValid && !success && (
          <form onSubmit={handleSubmit} className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {errorMsg && (
              <div className="error-alert-bar" style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--status-error)',
                color: 'var(--status-error)',
                padding: '0.75rem',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: '0.85rem',
                textAlign: 'center'
              }}>
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <Lock size={14} /> New Password
              </label>
              <input
                type="password"
                placeholder="Enter new password (min. 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-control"
                required
                minLength={6}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <Lock size={14} /> Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-control"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="glow-btn"
              style={{
                width: '100%',
                padding: '0.85rem',
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {submitting ? 'Updating Password...' : 'Save New Password & Continue'} <ArrowRight size={18} />
            </button>

            <div className="text-center" style={{ marginTop: '0.5rem' }}>
              <Link to="/login" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textDecoration: 'none' }}>
                Back to Sign In
              </Link>
            </div>
          </form>
        )}

      </div>

      <style>{`
        .reset-page-container {
          padding-top: 70px;
          min-height: 100vh;
          width: 100vw;
          background: linear-gradient(135deg, #0b0d10 0%, #15181e 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .reset-card-wrapper {
          width: 100%;
          max-width: 440px;
          border-radius: var(--border-radius-lg);
          padding: 2.5rem;
          margin: 1.5rem;
          background: rgba(21, 24, 30, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }
      `}</style>
    </div>
  );
};
