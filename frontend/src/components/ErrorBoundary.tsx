import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GymConnect ErrorBoundary Caught]:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div 
          className="container flex-center text-center" 
          style={{ minHeight: '60vh', padding: '3rem 1.5rem' }}
          role="alert"
        >
          <div 
            className="glass-panel" 
            style={{ 
              maxWidth: '540px', 
              padding: '2.5rem 2rem', 
              borderRadius: '16px', 
              border: '1px solid rgba(255, 183, 3, 0.3)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)'
            }}
          >
            <div 
              style={{ 
                width: '60px', 
                height: '60px', 
                borderRadius: '50%', 
                background: 'rgba(255, 183, 3, 0.12)', 
                color: '#ffb703', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 1.25rem' 
              }}
            >
              <AlertTriangle size={32} aria-hidden="true" />
            </div>

            <h2 style={{ fontSize: '1.4rem', color: '#fff', margin: '0 0 0.75rem 0' }}>
              {this.props.fallbackTitle || 'Unable to Load Section'}
            </h2>

            <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 1.75rem 0' }}>
              We encountered an unexpected issue while rendering this page. You can try refreshing or returning to the home screen.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={this.handleRetry} 
                className="glow-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
              >
                <RefreshCw size={15} aria-hidden="true" /> Try Again
              </button>

              <button 
                onClick={() => window.location.href = '/'} 
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
              >
                <Home size={15} aria-hidden="true" /> Back Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
