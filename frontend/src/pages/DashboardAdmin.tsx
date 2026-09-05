import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Check, X, Users, Dumbbell, Trash2, UserCheck, AlertTriangle, Briefcase, MessageSquare, Settings } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';

import { ImageInput } from '../components/ImageInput';

interface GymRecord {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  contactNumber: string;
  email: string;
  logo: string;
  coverImage: string;
  trialMonths?: number;
  remainingTrialDays?: number;
  isTrialExpired?: boolean;
  trialStatus?: string;
  isApproved: boolean;
  priorityOrder?: number;
  isFeatured?: boolean;
  isPromoted?: boolean;
  ownerId?: string;
  owner?: { id: string; name: string; email: string; phone?: string; avatar?: string; lastLoginAt?: string };
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  salary?: number;
  role: string;
  isApproved: boolean;
  createdAt: string;
  avatar: string;
}

interface ComplaintRecord {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  customer: { name: string; email: string };
  gym?: { id: string; name: string; city: string };
}

interface SubscriptionPaymentRecord {
  id: string;
  amount: number;
  paymentMethod: string;
  transactionId?: string;
  proofUrl?: string;
  status: string;
  createdAt: string;
  gym: {
    name: string;
    city: string;
    owner: { name: string; email: string; phone?: string };
  };
}

export const DashboardAdmin: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();

  // Active Tab
  const [adminTab, setAdminTab] = useState<'gyms' | 'users' | 'employees' | 'complaints' | 'settings' | 'subpayments' | 'promotions'>('gyms');

  // Data states
  const [gyms, setGyms] = useState<GymRecord[]>([]);
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [subPayments, setSubPayments] = useState<SubscriptionPaymentRecord[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Platform Payout Settings
  const [adminUpiId, setAdminUpiId] = useState('');
  const [adminBankName, setAdminBankName] = useState('');
  const [adminBankAccountNumber, setAdminBankAccountNumber] = useState('');
  const [adminBankIfsc, setAdminBankIfsc] = useState('');
  const [adminBankAccountName, setAdminBankAccountName] = useState('');
  const [adminQrCode, setAdminQrCode] = useState('');
  const [listingFee, setListingFee] = useState<number>(999);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all gyms (approved & pending)
      const gymsData = await apiFetch('/api/gyms?isApproved=false');
      setGyms(gymsData || []);

      // 2. Fetch all users
      const usersData = await apiFetch('/api/auth/admin/users');
      setUsersList(usersData || []);

      // 3. Fetch complaints
      const complaintsData = await apiFetch('/api/complaints');
      setComplaints(complaintsData || []);

      // 4. Fetch admin platform settings
      const settingsData = await apiFetch('/api/subscriptions/platform-payment');
      if (settingsData) {
        setAdminUpiId(settingsData.adminUpiId || '');
        setAdminBankName(settingsData.adminBankName || '');
        setAdminBankAccountNumber(settingsData.adminBankAccountNumber || '');
        setAdminBankIfsc(settingsData.adminBankIfsc || '');
        setAdminBankAccountName(settingsData.adminBankAccountName || '');
        setAdminQrCode(settingsData.adminQrCode || '');
        setListingFee(settingsData.listingFeeRupees || 999);
      }

      // 5. Fetch platform subscription payments
      const paymentsData = await apiFetch('/api/subscriptions/admin/payments');
      setSubPayments(paymentsData || []);

      // 6. Fetch store products for promotion controls
      const prodsData = await apiFetch('/api/products');
      setProductsList(prodsData || []);
    } catch (err) {
      console.error('Failed to load admin dashboard records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'ADMIN') {
      navigate('/');
      return;
    }
    fetchAdminData();
  }, [user]);

  // Actions: Gyms
  const handleApproveGym = async (gymId: string) => {
    try {
      await apiFetch(`/api/gyms/${gymId}/approve`, { method: 'PUT' });
      alert('Gym listing approved!');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Approval failed.');
    }
  };

  const handleRemoveGym = async (gymId: string, gymName: string) => {
    const confirmDel = window.confirm(`Are you sure you want to PERMANENTLY REMOVE fake/violating gym "${gymName}"?`);
    if (!confirmDel) return;

    try {
      await apiFetch(`/api/gyms/admin/${gymId}`, { method: 'DELETE' });
      alert(`Gym "${gymName}" deleted successfully.`);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove gym.');
    }
  };

  // Actions: Users & Employees
  const handleApproveUser = async (userId: string) => {
    try {
      await apiFetch(`/api/auth/admin/users/${userId}/approve`, { method: 'PUT' });
      alert('User / Employee account approved!');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Approval failed.');
    }
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    const confirmDel = window.confirm(`Are you sure you want to REMOVE account "${userName}"?`);
    if (!confirmDel) return;

    try {
      await apiFetch(`/api/auth/admin/users/${userId}`, { method: 'DELETE' });
      alert(`User account "${userName}" removed.`);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    }
  };

  const handleUpdateEmployeeSalary = async (userId: string, salary: number) => {
    try {
      await apiFetch(`/api/auth/admin/employees/${userId}/salary`, {
        method: 'PUT',
        body: JSON.stringify({ salary })
      });
      alert(`Employee monthly salary updated to ₹${salary}`);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update salary.');
    }
  };

  const handleUpdateTrialMonths = async (gymId: string, currentMonths: number) => {
    const input = window.prompt(`Set platform free trial duration in months for this gym:`, String(currentMonths || 3));
    if (input === null) return;
    const newMonths = parseInt(input);
    if (isNaN(newMonths) || newMonths < 0) {
      alert('Please enter a valid number of months.');
      return;
    }

    try {
      await apiFetch(`/api/gyms/admin/${gymId}/trial`, {
        method: 'PUT',
        body: JSON.stringify({ trialMonths: newMonths })
      });
      alert(`Updated gym trial duration to ${newMonths} months.`);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update trial months.');
    }
  };

  // Actions: Complaints
  const handleUpdateComplaintStatus = async (complaintId: string, newStatus: string) => {
    try {
      await apiFetch(`/api/complaints/${complaintId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      alert(`Complaint status updated to ${newStatus}`);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update complaint.');
    }
  };

  // Actions: Admin Platform Payment Settings
  const handleSavePlatformSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await apiFetch('/api/subscriptions/admin/platform-payment', {
        method: 'PUT',
        body: JSON.stringify({
          adminUpiId,
          adminBankName,
          adminBankAccountNumber,
          adminBankIfsc,
          adminBankAccountName,
          adminQrCode,
          listingFeeRupees: listingFee
        })
      });
      alert('Platform Admin payment settings saved successfully!');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to save platform payment settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Actions: Gym Priority & Featured Promotion Controls
  const handleUpdateGymPriority = async (gymId: string, currentPriority: number) => {
    const pInput = window.prompt(`Set Gym Rank Priority Order (higher numbers appear first in search):`, String(currentPriority || 0));
    if (pInput === null) return;
    const newPriority = parseInt(pInput);
    if (isNaN(newPriority)) {
      alert('Please enter a valid numeric priority rank.');
      return;
    }

    const toggleFeatured = window.confirm(`Mark this gym as FEATURED (⭐ Glowing Badge at top of Gym Near Me)?\n\nClick OK for YES, Cancel for NO.`);
    const togglePromoted = window.confirm(`Mark this gym as PROMOTED / SPONSORED AD (🔥 Top Listing Badge)?\n\nClick OK for YES, Cancel for NO.`);

    try {
      await apiFetch(`/api/gyms/admin/${gymId}/priority`, {
        method: 'PUT',
        body: JSON.stringify({
          priorityOrder: newPriority,
          isFeatured: toggleFeatured,
          isPromoted: togglePromoted
        })
      });
      alert('Gym priority rank and promotion settings updated successfully!');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update priority settings.');
    }
  };

  // Actions: Platform Subscription Payment Verification
  const handleVerifySubPayment = async (paymentId: string, status: 'VERIFIED' | 'REJECTED') => {
    const confirmAction = window.confirm(`Are you sure you want to mark this subscription payment submission as ${status}?`);
    if (!confirmAction) return;

    try {
      await apiFetch(`/api/subscriptions/admin/payments/${paymentId}/verify`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      alert(`Subscription payment ${status.toLowerCase()} successfully!`);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to verify payment.');
    }
  };

  // Actions: Product Promotion Controls
  const handleToggleProductPromote = async (productId: string) => {
    const togglePromoted = window.confirm(`Promote this product to Featured Store Banner?\n\nClick OK for PROMOTED YES, Cancel for NO.`);
    try {
      await apiFetch(`/api/products/admin/${productId}/promote`, {
        method: 'PUT',
        body: JSON.stringify({
          isPromoted: togglePromoted,
          isFeatured: togglePromoted
        })
      });
      alert('Product promotion status updated successfully!');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update product promotion.');
    }
  };

  if (loading) {
    return (
      <div className="container flex-center" style={{ height: '70vh' }}>
        <div className="skeleton-card" style={{ width: '100%', height: '400px' }}></div>
      </div>
    );
  }

  const pendingEmployees = usersList.filter(u => u.role === 'EMPLOYEE' && !u.isApproved);
  const pendingGyms = gyms.filter(g => !g.isApproved);

  return (
    <div className="admin-dashboard-container container">
      {/* 1. ADMIN HEADER */}
      <section className="profile-banner-card glass-panel">
        <Shield className="profile-large-avatar text-primary" style={{ width: '70px', height: '70px' }} />
        <div className="profile-meta">
          <h2>FitHub Control Cockpit</h2>
          <p className="profile-email">System Administrator: <b>utkarsht721@gmail.com</b></p>
          <div className="role-tag" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            SUPER ADMIN ACCESS
          </div>
        </div>
      </section>

      {/* 2. STATS OVERVIEW */}
      <div className="analytics-metrics-grid" style={{ marginTop: '1.5rem' }}>
        <div className="metric-card glass-panel">
          <Dumbbell className="metric-icon text-primary" />
          <div>
            <span className="metric-label">Total Gyms</span>
            <h3 className="metric-value">{gyms.length} ({pendingGyms.length} pending)</h3>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <Users className="metric-icon text-secondary" />
          <div>
            <span className="metric-label">Registered Accounts</span>
            <h3 className="metric-value">{usersList.length}</h3>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <Briefcase className="metric-icon" style={{ color: '#ffb703' }} />
          <div>
            <span className="metric-label">Support Employees</span>
            <h3 className="metric-value">{usersList.filter(u => u.role === 'EMPLOYEE').length} ({pendingEmployees.length} pending)</h3>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <AlertTriangle className="metric-icon" style={{ color: '#ef4444' }} />
          <div>
            <span className="metric-label">Listing Fee (₹)</span>
            <h3 className="metric-value">{formatPrice(listingFee)}</h3>
          </div>
        </div>
      </div>

      {/* 3. TABS NAVIGATION */}
      <div className="admin-tabs-nav glass-panel" style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', padding: '0.75rem 1.5rem', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setAdminTab('gyms')} 
          className={`btn-secondary ${adminTab === 'gyms' ? 'active-tab-glow' : ''}`}
          style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
        >
          <Dumbbell size={16} /> Manage Gyms ({gyms.length})
        </button>
        <button 
          onClick={() => setAdminTab('subpayments')} 
          className={`btn-secondary ${adminTab === 'subpayments' ? 'active-tab-glow' : ''}`}
          style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
        >
          💳 Subscription Payments ({subPayments.filter(p => p.status === 'PENDING').length} Pending)
        </button>
        <button 
          onClick={() => setAdminTab('promotions')} 
          className={`btn-secondary ${adminTab === 'promotions' ? 'active-tab-glow' : ''}`}
          style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
        >
          🔥 Store Ads & Promotions
        </button>
        <button 
          onClick={() => setAdminTab('users')} 
          className={`btn-secondary ${adminTab === 'users' ? 'active-tab-glow' : ''}`}
          style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
        >
          <Users size={16} /> Accounts ({usersList.length})
        </button>
        <button 
          onClick={() => setAdminTab('employees')} 
          className={`btn-secondary ${adminTab === 'employees' ? 'active-tab-glow' : ''}`}
          style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
        >
          <Briefcase size={16} /> Staff ({usersList.filter(u => u.role === 'EMPLOYEE').length})
        </button>
        <button 
          onClick={() => setAdminTab('complaints')} 
          className={`btn-secondary ${adminTab === 'complaints' ? 'active-tab-glow' : ''}`}
          style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
        >
          <AlertTriangle size={16} /> Complaints ({complaints.length})
        </button>
        <button 
          onClick={() => setAdminTab('settings')} 
          className={`btn-secondary ${adminTab === 'settings' ? 'active-tab-glow' : ''}`}
          style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
        >
          <Settings size={16} /> Platform Payout Setup
        </button>
      </div>

      {/* TAB CONTENT: GYMS MANAGEMENT */}
      {adminTab === 'gyms' && (
        <section className="dashboard-block-panel glass-panel" style={{ marginTop: '1.5rem' }}>
          <h2><Dumbbell size={18} /> Listed Fitness Centers ({gyms.length})</h2>
          <p className="text-secondary" style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            Review, approve new listings, or remove fake/violating gyms directly from the network.
          </p>

          <div className="gyms-admin-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {gyms.map(gym => (
              <div key={gym.id} className="pending-gym-row-card glass-card" style={{ display: 'flex', gap: '1.25rem', padding: '1.25rem', alignItems: 'flex-start' }}>
                <img src={gym.logo || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=200'} alt="Logo" style={{ width: '70px', height: '70px', borderRadius: '8px', objectFit: 'cover' }} />
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0 }}>{gym.name}</h3>
                    <span className={`badge badge-${gym.isApproved ? 'approved' : 'pending'}`}>
                      {gym.isApproved ? 'Approved' : 'Pending Approval'}
                    </span>
                    <code style={{ background: '#0b0d10', color: '#00ffcc', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid rgba(0,255,204,0.3)' }}>
                      Gym ID: {gym.id}
                    </code>
                  </div>
                  
                  <p className="pending-address" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.3rem 0' }}>
                    📍 <b>Address:</b> {gym.address}, {gym.city}
                  </p>
                  <p className="pending-owner-details" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0' }}>
                    📞 <b>Phone:</b> {gym.contactNumber} | ✉️ <b>Email:</b> {gym.email}
                  </p>
                  {gym.owner && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--primary-color)', margin: '0.3rem 0 0 0' }}>
                      👤 <b>Gym Owner:</b> {gym.owner.name} ({gym.owner.email}) 
                      {gym.owner.lastLoginAt ? (
                        <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                          🔑 <b>Last Login:</b> {new Date(gym.owner.lastLoginAt).toLocaleString()}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>🔑 <b>Last Login:</b> Never</span>
                      )}
                    </p>
                  )}

                  {/* Platform Free Trial Tracking Status */}
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span 
                      className="badge" 
                      style={{ 
                        background: gym.isTrialExpired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 255, 204, 0.15)', 
                        color: gym.isTrialExpired ? '#ef4444' : '#00ffcc', 
                        border: `1px solid ${gym.isTrialExpired ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 255, 204, 0.3)'}`,
                        fontSize: '0.75rem'
                      }}
                    >
                      {gym.trialStatus === 'SUBSCRIBED' 
                        ? '🟢 Site Subscription Paid' 
                        : gym.isTrialExpired 
                          ? '🔴 Platform Trial Expired (Subscription Needed)' 
                          : `🎁 Free Platform Trial: ${gym.trialMonths || 3} Months (${gym.remainingTrialDays ?? 90} Days Remaining)`}
                    </span>

                    <button 
                      onClick={() => handleUpdateTrialMonths(gym.id, gym.trialMonths || 3)}
                      className="btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                    >
                      ⚙️ Change Trial ({gym.trialMonths || 3} Months)
                    </button>

                    <button 
                      onClick={() => handleUpdateGymPriority(gym.id, gym.priorityOrder || 0)}
                      className="btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderColor: gym.isFeatured || gym.isPromoted ? '#00ffcc' : undefined, color: gym.isFeatured || gym.isPromoted ? '#00ffcc' : undefined }}
                    >
                      ⚡ Rank Priority ({gym.priorityOrder || 0}) {gym.isFeatured ? '⭐ Featured' : ''} {gym.isPromoted ? '🔥 Promoted' : ''}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                  {gym.owner && (
                    <button 
                      onClick={() => navigate('/chat', { state: { startChatWith: { id: gym.owner!.id, name: gym.owner!.name, avatar: gym.owner!.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=owner', role: 'GYM_OWNER' } } })} 
                      className="glow-btn flex-center" 
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', gap: '0.3rem' }}
                    >
                      <MessageSquare size={14} /> Connect with Owner
                    </button>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {!gym.isApproved && (
                      <button onClick={() => handleApproveGym(gym.id)} className="glow-btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                        <Check size={14} /> Approve
                      </button>
                    )}
                    <button 
                      onClick={() => handleRemoveGym(gym.id, gym.name)} 
                      className="btn-secondary" 
                      style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                    >
                      <Trash2 size={14} /> Remove Gym
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB CONTENT: USER ACCOUNTS MANAGEMENT */}
      {adminTab === 'users' && (
        <section className="dashboard-block-panel glass-panel" style={{ marginTop: '1.5rem' }}>
          <h2><Users size={18} /> User & Account Moderation ({usersList.length})</h2>
          
          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table className="overview-data-table">
              <thead>
                <tr>
                  <th>User Profile</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img src={u.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=user'} alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                        <div>
                          <b>{u.name}</b><br/>
                          <span className="table-meta-text">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="user-role-badge">{u.role}</span>
                    </td>
                    <td>
                      <span className={`badge badge-${u.isApproved ? 'approved' : 'pending'}`}>
                        {u.isApproved ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      {u.role !== 'ADMIN' && (
                        <button 
                          onClick={() => handleRemoveUser(u.id, u.name)} 
                          className="btn-secondary"
                          style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                        >
                          <Trash2 size={12} /> Remove Account
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB CONTENT: EMPLOYEES & SALARY PAYROLL */}
      {adminTab === 'employees' && (
        <section className="dashboard-block-panel glass-panel" style={{ marginTop: '1.5rem' }}>
          <h2><Briefcase size={18} /> Support Staff Payroll & Salary Management</h2>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Manage support staff employee accounts, view contact phone numbers, and assign monthly salaries in ₹.
          </p>

          {usersList.filter(u => u.role === 'EMPLOYEE').length === 0 ? (
            <div className="empty-feed-card text-center" style={{ padding: '3rem 0' }}>
              <UserCheck size={40} className="text-primary" />
              <p>No support employees registered yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {usersList.filter(u => u.role === 'EMPLOYEE').map(emp => (
                <div key={emp.id} className="pending-gym-row-card glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img src={emp.avatar} alt="Avatar" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h4 style={{ margin: 0 }}>{emp.name}</h4>
                        <span className={`badge badge-${emp.isApproved ? 'approved' : 'pending'}`}>
                          {emp.isApproved ? 'Approved Staff' : 'Pending Approval'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0' }}>
                        ✉️ {emp.email} {emp.phone ? `| 📞 ${emp.phone}` : ''}
                      </p>
                      <small className="text-muted">Joined: {new Date(emp.createdAt).toLocaleDateString()}</small>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* Salary Edit Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Monthly Salary:</span>
                      <input 
                        type="number"
                        defaultValue={emp.salary || 0}
                        id={`salary-input-${emp.id}`}
                        className="form-control"
                        style={{ width: '110px', fontSize: '0.85rem', padding: '0.35rem 0.6rem' }}
                      />
                      <button 
                        onClick={() => {
                          const inputEl = document.getElementById(`salary-input-${emp.id}`) as HTMLInputElement;
                          if (inputEl) handleUpdateEmployeeSalary(emp.id, Number(inputEl.value));
                        }}
                        className="glow-btn"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}
                      >
                        Set Salary
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {!emp.isApproved && (
                        <button onClick={() => handleApproveUser(emp.id)} className="glow-btn" style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}>
                          <Check size={14} /> Approve
                        </button>
                      )}
                      <button onClick={() => handleRemoveUser(emp.id, emp.name)} className="btn-secondary" style={{ color: '#ef4444', fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}>
                        <X size={14} /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB CONTENT: COMPLAINTS CENTER */}
      {adminTab === 'complaints' && (
        <section className="dashboard-block-panel glass-panel" style={{ marginTop: '1.5rem' }}>
          <h2><AlertTriangle size={18} /> Customer Complaints & Violations ({complaints.length})</h2>

          {complaints.length === 0 ? (
            <div className="empty-feed-card text-center" style={{ padding: '3rem 0' }}>
              <Check size={40} className="text-primary" />
              <p>No customer complaints reported against any gym.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
              {complaints.map(comp => (
                <div key={comp.id} className="glass-card" style={{ padding: '1.25rem', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ color: '#ef4444', margin: '0 0 0.3rem 0' }}>{comp.title}</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{comp.description}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Lodged by: <b>{comp.customer.name}</b> ({comp.customer.email})
                        {comp.gym && <span> | Target Gym: <b>{comp.gym.name}</b> ({comp.gym.city})</span>}
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

                      {comp.gym && (
                        <button
                          onClick={() => handleRemoveGym(comp.gym!.id, comp.gym!.name)}
                          className="btn-secondary"
                          style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                        >
                          <Trash2 size={12} /> Remove Reported Gym
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB CONTENT: SUBSCRIPTION PAYMENTS VERIFICATION */}
      {adminTab === 'subpayments' && (
        <section className="dashboard-block-panel glass-panel" style={{ marginTop: '1.5rem' }}>
          <h2>💳 Gym Subscription Payment Verification ({subPayments.length})</h2>
          <p className="text-secondary" style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            Review payments submitted by Gym Owners for platform site listing after free trial.
          </p>

          {subPayments.length === 0 ? (
            <div className="empty-feed-card text-center" style={{ padding: '3rem 0' }}>
              <Check size={40} className="text-primary" />
              <p>No subscription payment submissions recorded yet.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="overview-data-table">
                <thead>
                  <tr>
                    <th>Gym & Owner Details</th>
                    <th>Amount Paid</th>
                    <th>Payment Method</th>
                    <th>Transaction / UTR ID</th>
                    <th>Receipt Proof</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subPayments.map(pay => (
                    <tr key={pay.id}>
                      <td>
                        <b>{pay.gym.name}</b> ({pay.gym.city})<br />
                        <span className="table-meta-text">Owner: {pay.gym.owner.name} ({pay.gym.owner.email})</span>
                      </td>
                      <td><b>₹{pay.amount}</b></td>
                      <td><span className="badge badge-primary">{pay.paymentMethod}</span></td>
                      <td><code>{pay.transactionId || 'N/A'}</code></td>
                      <td>
                        {pay.proofUrl ? (
                          <a href={pay.proofUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#00ffcc', textDecoration: 'underline', fontSize: '0.8rem' }}>
                            View Receipt Image ↗
                          </a>
                        ) : (
                          <span className="text-muted">No Receipt Image</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${pay.status === 'VERIFIED' ? 'approved' : pay.status === 'REJECTED' ? 'cancelled' : 'pending'}`}>
                          {pay.status}
                        </span>
                      </td>
                      <td>
                        {pay.status === 'PENDING' ? (
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button 
                              onClick={() => handleVerifySubPayment(pay.id, 'VERIFIED')}
                              className="glow-btn"
                              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                            >
                              <Check size={12} /> Approve
                            </button>
                            <button 
                              onClick={() => handleVerifySubPayment(pay.id, 'REJECTED')}
                              className="btn-secondary"
                              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                            >
                              <X size={12} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Decided</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB CONTENT: STORE ADS & PROMOTIONS */}
      {adminTab === 'promotions' && (
        <section className="dashboard-block-panel glass-panel" style={{ marginTop: '1.5rem' }}>
          <h2>🔥 Store Products & Sponsored Promotions ({productsList.length})</h2>
          <p className="text-secondary" style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            Promote products from any gym store to display with special "Featured/Promoted" badges across customer pages.
          </p>

          <div className="table-wrapper">
            <table className="overview-data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Gym Seller</th>
                  <th>Price</th>
                  <th>Category</th>
                  <th>Promotion Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {productsList.map(prod => (
                  <tr key={prod.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img src={prod.image} alt="Product" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                        <b>{prod.name}</b>
                      </div>
                    </td>
                    <td>{prod.gym?.name} ({prod.gym?.city})</td>
                    <td><b>₹{prod.price}</b></td>
                    <td><span className="badge badge-primary">{prod.category}</span></td>
                    <td>
                      {prod.isPromoted ? (
                        <span className="badge" style={{ background: 'rgba(255, 183, 3, 0.2)', color: '#ffb703', border: '1px solid #ffb703' }}>
                          🔥 Promoted Ad
                        </span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>Standard Listing</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleProductPromote(prod.id)}
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', borderColor: prod.isPromoted ? '#ffb703' : undefined, color: prod.isPromoted ? '#ffb703' : undefined }}
                      >
                        {prod.isPromoted ? 'Remove Promotion' : '🔥 Promote Product'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB CONTENT: PLATFORM PAYOUT SETUP */}
      {adminTab === 'settings' && (
        <section className="dashboard-block-panel glass-panel" style={{ marginTop: '1.5rem', padding: '2rem', borderRadius: '12px' }}>
          <h2><Settings size={20} /> Platform Admin Payout Setup & Subscription Fee</h2>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Configure Admin Bank details, UPI ID, and QR Code image. Gym owners will transfer website subscription fees directly to these account details.
          </p>

          <form onSubmit={handleSavePlatformSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '650px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Platform Listing Fee (₹ Rupees)</label>
                <input
                  type="number"
                  className="form-control"
                  value={listingFee}
                  onChange={(e) => setListingFee(Math.max(0, Number(e.target.value)))}
                  placeholder="e.g. 999"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Admin UPI ID</label>
                <input
                  type="text"
                  className="form-control"
                  value={adminUpiId}
                  onChange={(e) => setAdminUpiId(e.target.value)}
                  placeholder="e.g. admin@upi or 9450558546@paytm"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Admin Bank Account Holder Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={adminBankAccountName}
                  onChange={(e) => setAdminBankAccountName(e.target.value)}
                  placeholder="Legal Account Name"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Bank Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={adminBankName}
                  onChange={(e) => setAdminBankName(e.target.value)}
                  placeholder="Bank Name"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Bank Account Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={adminBankAccountNumber}
                  onChange={(e) => setAdminBankAccountNumber(e.target.value)}
                  placeholder="Account Number"
                />
              </div>

              <div className="form-group">
                <label className="form-label">IFSC Code</label>
                <input
                  type="text"
                  className="form-control"
                  value={adminBankIfsc}
                  onChange={(e) => setAdminBankIfsc(e.target.value)}
                  placeholder="IFSC Code"
                />
              </div>
            </div>

            <div className="form-group">
              <ImageInput
                label="Admin Payment QR Code Image"
                value={adminQrCode}
                onChange={(url) => setAdminQrCode(url)}
                placeholder="Paste QR Code URL or upload local payment QR image..."
                helpText="Upload your Google Pay / PhonePe / Paytm QR Code image for Gym Owners to scan and pay platform subscription"
              />
            </div>

            {adminQrCode && (
              <div style={{ textAlign: 'center', padding: '1rem', background: '#0b0d10', borderRadius: '8px', border: '1px solid var(--border-color)', maxWidth: '220px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Active Admin QR Preview:</span>
                <img src={adminQrCode} alt="Admin Payment QR" style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: '6px' }} />
              </div>
            )}

            <button
              type="submit"
              disabled={isSavingSettings}
              className="glow-btn"
              style={{ padding: '0.75rem 1.5rem', alignSelf: 'flex-start' }}
            >
              {isSavingSettings ? 'Saving Settings...' : 'Save Platform Payout Setup'}
            </button>
          </form>
        </section>
      )}

      <style>{`
        .admin-dashboard-container {
          padding-top: 90px;
          padding-bottom: 80px;
        }

        .active-tab-glow {
          background: var(--primary-color) !important;
          color: #0b0d10 !important;
          font-weight: 700 !important;
        }

        .profile-banner-card {
          display: flex;
          align-items: center;
          padding: 2rem;
          border-radius: var(--border-radius-lg);
          gap: 2rem;
        }

        .profile-meta h2 {
          font-size: 1.8rem;
        }

        .profile-email {
          color: var(--text-secondary);
          font-size: 0.85rem;
          margin-bottom: 0.5rem;
        }

        .role-tag {
          display: inline-block;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
        }

        .analytics-metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
        }

        .metric-card {
          padding: 1.25rem;
          border-radius: var(--border-radius-md);
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .metric-icon {
          width: 28px;
          height: 28px;
        }

        .metric-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
        }

        .metric-value {
          font-size: 1.4rem;
          font-weight: 800;
        }

        @media (max-width: 992px) {
          .analytics-metrics-grid {
            grid-template-columns: 1fr 1fr;
          }
          .admin-tabs-nav {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
};
