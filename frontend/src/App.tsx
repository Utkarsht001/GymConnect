import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CurrencyProvider } from './context/CurrencyContext';
import { Navbar } from './components/Navbar';
import { ErrorBoundary } from './components/ErrorBoundary';

// Route-level code splitting via React.lazy for sub-second FCP and low TBT
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const GymDiscovery = lazy(() => import('./pages/GymDiscovery').then(m => ({ default: m.GymDiscovery })));
const GymDetails = lazy(() => import('./pages/GymDetails').then(m => ({ default: m.GymDetails })));
const GymStore = lazy(() => import('./pages/GymStore').then(m => ({ default: m.GymStore })));
const Cart = lazy(() => import('./pages/Cart').then(m => ({ default: m.Cart })));
const Chat = lazy(() => import('./pages/Chat').then(m => ({ default: m.Chat })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const Notifications = lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));
const DashboardCustomer = lazy(() => import('./pages/DashboardCustomer').then(m => ({ default: m.DashboardCustomer })));
const DashboardOwner = lazy(() => import('./pages/DashboardOwner').then(m => ({ default: m.DashboardOwner })));
const DashboardAdmin = lazy(() => import('./pages/DashboardAdmin').then(m => ({ default: m.DashboardAdmin })));
const DashboardEmployee = lazy(() => import('./pages/DashboardEmployee').then(m => ({ default: m.DashboardEmployee })));

// Non-critical global widgets lazy-loaded to prevent initial bundle bloat
const CustomerSupportChatbot = lazy(() => import('./components/CustomerSupportChatbot').then(m => ({ default: m.CustomerSupportChatbot })));

// Accessible Route Loading Skeleton
const PageFallback: React.FC = () => (
  <div className="route-fallback-loader" role="status" aria-live="polite">
    <div className="route-fallback-spinner" aria-hidden="true" />
    <span className="sr-only">Loading page content, please wait...</span>
  </div>
);

export const App: React.FC = () => {
  return (
    <CurrencyProvider>
      <Router>
        <div className="app-viewport-wrapper">
          {/* Skip Navigation Link for Screen Readers and Keyboard Users (WCAG 2.4.1) */}
          <a href="#main-content" className="skip-to-content-link">
            Skip to main content
          </a>

          <Navbar />
          
          <main id="main-content" className="main-content-viewport" role="main" tabIndex={-1}>
            <ErrorBoundary fallbackTitle="Page Load Error">
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/gyms" element={<GymDiscovery />} />
                  <Route path="/gym-near-me" element={<GymDiscovery />} />
                  <Route path="/gyms/:id" element={<GymDetails />} />
                  <Route path="/gym/:id" element={<GymDetails />} />
                  <Route path="/gym/:gymId" element={<GymDetails />} />
                  <Route path="/store" element={<GymStore />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/dashboard/customer" element={<DashboardCustomer />} />
                  <Route path="/dashboard/owner" element={<DashboardOwner />} />
                  <Route path="/dashboard/admin" element={<DashboardAdmin />} />
                  <Route path="/dashboard/employee" element={<DashboardEmployee />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>

          {/* Global Customer Support Chatbot Widget (Deferred) */}
          <Suspense fallback={null}>
            <CustomerSupportChatbot />
          </Suspense>
        </div>
      </Router>
    </CurrencyProvider>
  );
};

export default App;
