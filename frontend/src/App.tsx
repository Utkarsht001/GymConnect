import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CurrencyProvider } from './context/CurrencyContext';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { GymDiscovery } from './pages/GymDiscovery';
import { GymDetails } from './pages/GymDetails';
import { GymStore } from './pages/GymStore';
import { Cart } from './pages/Cart';
import { Chat } from './pages/Chat';
import { Login } from './pages/Login';
import { Notifications } from './pages/Notifications';
import { DashboardCustomer } from './pages/DashboardCustomer';
import { DashboardOwner } from './pages/DashboardOwner';
import { DashboardAdmin } from './pages/DashboardAdmin';
import { DashboardEmployee } from './pages/DashboardEmployee';
import { CustomerSupportChatbot } from './components/CustomerSupportChatbot';

const App: React.FC = () => {
  return (
    <CurrencyProvider>
      <Router>
        <div className="app-viewport-wrapper">
          <Navbar />
          
          <div className="main-content-viewport">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/gyms" element={<GymDiscovery />} />
              <Route path="/gyms/:id" element={<GymDetails />} />
              <Route path="/store" element={<GymStore />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/login" element={<Login />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/dashboard/customer" element={<DashboardCustomer />} />
              <Route path="/dashboard/owner" element={<DashboardOwner />} />
              <Route path="/dashboard/admin" element={<DashboardAdmin />} />
              <Route path="/dashboard/employee" element={<DashboardEmployee />} />
            </Routes>
          </div>

          {/* Global Customer Support Chatbot Widget */}
          <CustomerSupportChatbot />
        </div>
      </Router>
    </CurrencyProvider>
  );
};

export default App;
