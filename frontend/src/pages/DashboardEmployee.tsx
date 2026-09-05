import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { Briefcase, MessageSquare, AlertTriangle, Clock, Check, ShieldCheck, Dumbbell, DollarSign } from 'lucide-react';

interface GymRecord {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  contactNumber: string;
  email: string;
  logo: string;
  isApproved: boolean;
  ownerId?: string;
  owner?: { id: string; name: string; email: string; avatar?: string };
}

interface EscalatedMessage {
  id: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string; email: string; avatar: string };
  receiver: { id: string; name: string; email: string; gym?: { name: string } };
}

interface ComplaintRecord {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  customer: { id: string; name: string; email: string };
  gym?: { id: string; name: string; city: string };
}

export const DashboardEmployee: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'escalations' | 'complaints' | 'gyms'>('escalations');
  const [escalations, setEscalations] = useState<EscalatedMessage[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [gyms, setGyms] = useState<GymRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployeeData = async () => {
    setLoading(true);
    try {
      // 1. Fetch 2-day unreplied escalations
      const escalationsData = await apiFetch('/api/messages/escalations');
      setEscalations(escalationsData || []);

      // 2. Fetch customer complaints
      const complaintsData = await apiFetch('/api/complaints');
      setComplaints(complaintsData || []);

      // 3. Fetch gym directory
      const gymsData = await apiFetch('/api/gyms?isApproved=false');
      setGyms(gymsData || []);
    } catch (err) {
      console.error('Failed to load employee support records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'EMPLOYEE' && user.role !== 'ADMIN') {
      navigate('/');
      return;
    }
    fetchEmployeeData();
  }, [user]);

  const handleStartChatWithCustomer = (customerUser: any) => {
    navigate('/chat', { state: { startChatWith: customerUser } });
  };

  const handleUpdateComplaintStatus = async (id: string, newStatus: string) => {
    try {
      await apiFetch(`/api/complaints/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      alert(`Complaint status updated to ${newStatus}`);
      fetchEmployeeData();
    } catch (err: any) {
      alert(err.message || 'Failed to update complaint');
    }
  };

  if (loading) {
    return (
      <div className="container flex-center" style={{ height: '70vh' }}>
        <div className="skeleton-card" style={{ width: '100%', height: '400px' }}></div>
      </div>
    );
  }

  return (
    <div className="employee-dashboard-container container">
      {/* 1. EMPLOYEE HEADER */}
      <section className="profile-banner-card glass-panel flex-center" style={{ justifyContent: 'flex-start', padding: '2rem', gap: '1.5rem', borderRadius: '12px' }}>
        <Briefcase className="text-primary" style={{ width: '64px', height: '64px' }} />
        <div>
          <h2 style={{ margin: 0 }}>Customer Support Employee Cockpit</h2>
          <p className="text-secondary" style={{ fontSize: '0.85rem', margin: '0.2rem 0' }}>
            Officer: <b>{user?.name}</b> ({user?.email}) | Support Staff Status: <span className="badge badge-approved">Active</span>
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Handling 2-Day Unresponsive Gym Owner Escalations, Customer Refunds & Resolution Tickets.
          </p>
        </div>
      </section>

      {/* 2. STATS */}
      <div className="analytics-metrics-grid" style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
        <div className="metric-card glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderRadius: '8px' }}>
          <Clock className="metric-icon" style={{ color: '#ef4444' }} />
          <div>
            <span className="metric-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>2-Day Gym Escalations</span>
            <h3 className="metric-value" style={{ margin: 0 }}>{escalations.length}</h3>
          </div>
        </div>

        <div className="metric-card glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderRadius: '8px' }}>
          <AlertTriangle className="metric-icon" style={{ color: '#ffb703' }} />
          <div>
            <span className="metric-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pending Complaints</span>
            <h3 className="metric-value" style={{ margin: 0 }}>{complaints.filter(c => c.status === 'PENDING').length}</h3>
          </div>
        </div>

        <div className="metric-card glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderRadius: '8px' }}>
          <ShieldCheck className="metric-icon text-primary" />
          <div>
            <span className="metric-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Resolved Tickets</span>
            <h3 className="metric-value" style={{ margin: 0 }}>{complaints.filter(c => c.status !== 'PENDING').length}</h3>
          </div>
        </div>

        <div className="metric-card glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderRadius: '8px' }}>
          <DollarSign className="metric-icon" style={{ color: 'var(--status-success)' }} />
          <div>
            <span className="metric-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>My Monthly Salary</span>
            <h3 className="metric-value" style={{ margin: 0 }}>{formatPrice(user?.salary || 0)}</h3>
          </div>
        </div>
      </div>

      {/* 3. NAVIGATION TABS */}
      <div className="glass-panel" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', padding: '0.75rem 1.5rem', borderRadius: '8px' }}>
        <button 
          onClick={() => setActiveTab('escalations')} 
          className={`btn-secondary ${activeTab === 'escalations' ? 'active-tab-glow' : ''}`}
          style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
        >
          <Clock size={16} /> 2-Day Unresponsive Escalations ({escalations.length})
        </button>
        <button 
          onClick={() => setActiveTab('complaints')} 
          className={`btn-secondary ${activeTab === 'complaints' ? 'active-tab-glow' : ''}`}
          style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
        >
          <AlertTriangle size={16} /> Customer Complaints ({complaints.length})
        </button>
        <button 
          onClick={() => setActiveTab('gyms')} 
          className={`btn-secondary ${activeTab === 'gyms' ? 'active-tab-glow' : ''}`}
          style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
        >
          <Dumbbell size={16} /> Gym Directory & Owner Connect ({gyms.length})
        </button>
      </div>

      {/* TAB: ESCALATIONS */}
      {activeTab === 'escalations' && (
        <section className="dashboard-block-panel glass-panel" style={{ marginTop: '1.5rem', padding: '1.5rem', borderRadius: '12px' }}>
          <h3><Clock size={18} /> 2-Day Unresponsive Gym Owner Messages ({escalations.length})</h3>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            These messages were sent by customers to gym owners over 48 hours ago without any gym owner response. Support employees can intervene directly.
          </p>

          {escalations.length === 0 ? (
            <div className="text-center" style={{ padding: '3rem 0' }}>
              <Check size={40} className="text-primary" />
              <p className="text-muted">No pending 2-day gym owner response escalations! All owners are responding on time.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {escalations.map(item => (
                <div key={item.id} className="glass-card" style={{ padding: '1.25rem', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', marginBottom: '0.5rem' }}>
                        ⚠️ Escalated (&gt; 48h Unreplied)
                      </span>
                      <h4 style={{ margin: '0.3rem 0' }}>Message: "{item.content}"</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Customer: <b>{item.sender.name}</b> ({item.sender.email})
                      </p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Target Gym Owner: <b>{item.receiver.name}</b> {item.receiver.gym ? `(${item.receiver.gym.name})` : ''}
                      </p>
                      <small className="text-muted">Sent on: {new Date(item.createdAt).toLocaleString()}</small>
                    </div>

                    <button 
                      onClick={() => handleStartChatWithCustomer(item.sender)}
                      className="glow-btn flex-center"
                      style={{ gap: '0.4rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                    >
                      <MessageSquare size={14} /> Respond to Customer Live
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB: COMPLAINTS */}
      {activeTab === 'complaints' && (
        <section className="dashboard-block-panel glass-panel" style={{ marginTop: '1.5rem', padding: '1.5rem', borderRadius: '12px' }}>
          <h3><AlertTriangle size={18} /> Customer Complaints & Refund Requests ({complaints.length})</h3>

          {complaints.length === 0 ? (
            <div className="text-center" style={{ padding: '3rem 0' }}>
              <Check size={40} className="text-primary" />
              <p className="text-muted">No complaints reported.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
              {complaints.map(comp => (
                <div key={comp.id} className="glass-card" style={{ padding: '1.25rem', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ color: '#00ffcc', margin: '0 0 0.3rem 0' }}>{comp.title}</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{comp.description}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Customer: <b>{comp.customer.name}</b> ({comp.customer.email})
                        {comp.gym && <span> | Gym: <b>{comp.gym.name}</b></span>}
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                      <select
                        value={comp.status}
                        onChange={(e) => handleUpdateComplaintStatus(comp.id, e.target.value)}
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem', width: '130px' }}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="ACTION_TAKEN">Action Taken</option>
                      </select>

                      <button
                        onClick={() => handleStartChatWithCustomer({ id: comp.customer.id, name: comp.customer.name, avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=cust', role: 'CUSTOMER' })}
                        className="btn-secondary flex-center"
                        style={{ gap: '0.3rem', fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                      >
                        <MessageSquare size={12} /> Contact Customer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB: GYM DIRECTORY & OWNER CONNECT */}
      {activeTab === 'gyms' && (
        <section className="dashboard-block-panel glass-panel" style={{ marginTop: '1.5rem', padding: '1.5rem', borderRadius: '12px' }}>
          <h3><Dumbbell size={18} /> Network Gym Directory ({gyms.length})</h3>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Comprehensive list of all gyms, Gym IDs, location details, and direct Gym Owner chat connect.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {gyms.map(gym => (
              <div key={gym.id} className="glass-card" style={{ display: 'flex', gap: '1.25rem', padding: '1.25rem', alignItems: 'flex-start', borderRadius: '8px' }}>
                <img src={gym.logo || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=200'} alt="Logo" style={{ width: '65px', height: '65px', borderRadius: '8px', objectFit: 'cover' }} />

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <h4 style={{ margin: 0 }}>{gym.name}</h4>
                    <code style={{ background: '#0b0d10', color: '#00ffcc', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid rgba(0,255,204,0.3)' }}>
                      Gym ID: {gym.id}
                    </code>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.3rem 0' }}>
                    📍 <b>Address:</b> {gym.address}, {gym.city}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0' }}>
                    📞 <b>Phone:</b> {gym.contactNumber} | ✉️ <b>Email:</b> {gym.email}
                  </p>
                  {gym.owner && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--primary-color)', margin: '0.3rem 0 0 0' }}>
                      👤 <b>Gym Owner:</b> {gym.owner.name} ({gym.owner.email})
                    </p>
                  )}
                </div>

                <div>
                  {gym.owner && (
                    <button 
                      onClick={() => navigate('/chat', { state: { startChatWith: { id: gym.owner!.id, name: gym.owner!.name, avatar: gym.owner!.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=owner', role: 'GYM_OWNER' } } })} 
                      className="glow-btn flex-center" 
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', gap: '0.3rem' }}
                    >
                      <MessageSquare size={14} /> Connect with Owner
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <style>{`
        .employee-dashboard-container {
          padding-top: 90px;
          padding-bottom: 80px;
        }
        .active-tab-glow {
          background: var(--primary-color) !important;
          color: #0b0d10 !important;
          font-weight: 700 !important;
        }
      `}</style>
    </div>
  );
};
