import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Dumbbell, CreditCard, ShoppingBag, ClipboardList, Settings, Sparkles, MapPin, Trash2, Check, TrendingUp, Users, DollarSign, Calendar, Search, Navigation, Loader2 } from 'lucide-react';
import L from 'leaflet';
import { ImageInput } from '../components/ImageInput';

interface Gym {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  contactNumber: string;
  email: string;
  logo: string;
  coverImage: string;
  openingHours: string;
  isApproved: boolean;
  upiId?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankAccountName?: string;
  bankName?: string;
  paymentQrCode?: string;
  facilities: Array<{ facilityId: string }>;
  plans: Array<{ id: string; name: string; price: number; durationDays: number }>;
}

interface FacilityType {
  id: string;
  name: string;
}

interface Order {
  id: string;
  createdAt: string;
  status: string;
  address: string;
  phone: string;
  customerName: string;
  customerEmail: string;
  items: Array<{ productName: string; quantity: number; pricePaid: number; image: string }>;
  totalPrice: number;
}

interface Subscription {
  id: string;
  createdAt: string;
  status: string;
  startDate: string;
  endDate: string;
  pricePaid: number;
  plan: { name: string };
  customer: { name: string; email: string };
}

export const DashboardOwner: React.FC = () => {
  const { user, apiFetch, updateUserGym } = useAuth();
  const navigate = useNavigate();

  // Active sub-dashboard section
  const [activeTab, setActiveTab] = useState<'overview' | 'mygym' | 'facilities' | 'plans' | 'products' | 'orders' | 'updates' | 'payout'>('overview');
  
  // Dashboard records
  const [gym, setGym] = useState<Gym | null>(null);
  const [facilitiesList, setFacilitiesList] = useState<FacilityType[]>([]);
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states: Payout & QR Code
  const [upiId, setUpiId] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [paymentQrCode, setPaymentQrCode] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);

  // Form states: Platform Subscription Payment
  const [platformSettings, setPlatformSettings] = useState<any>(null);
  const [showSubPayModal, setShowSubPayModal] = useState(false);
  const [subPayAmount, setSubPayAmount] = useState('999');
  const [subPayMethod, setSubPayMethod] = useState('UPI');
  const [subPayTxId, setSubPayTxId] = useState('');
  const [subPayProofUrl, setSubPayProofUrl] = useState('');
  const [subPaySubmitting, setSubPaySubmitting] = useState(false);

  // Form states: My Gym
  const [gymName, setGymName] = useState('');
  const [gymDesc, setGymDesc] = useState('');
  const [gymAddress, setGymAddress] = useState('');
  const [gymCity, setGymCity] = useState('Jaipur');
  const [gymLat, setGymLat] = useState(26.9124);
  const [gymLng, setGymLng] = useState(75.7873);
  const [gymPhone, setGymPhone] = useState('');
  const [gymEmail, setGymEmail] = useState('');
  const [gymLogo, setGymLogo] = useState('');
  const [gymCover, setGymCover] = useState('');
  const [gymHours, setGymHours] = useState('06:00 AM - 10:00 PM');
  const [freeTrialDays, setFreeTrialDays] = useState(3);

  // Form states: Plans
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planDays, setPlanDays] = useState('30');
  const [planDesc, setPlanDesc] = useState('');
  const [planFeatures, setPlanFeatures] = useState('');

  // Form states: Products
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodDiscount, setProdDiscount] = useState('0');
  const [prodStock, setProdStock] = useState('10');
  const [prodCategory, setProdCategory] = useState('ACCESSORIES');
  const [prodImage, setProdImage] = useState('');
  const [products, setProducts] = useState<any[]>([]);

  // Form states: Updates
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateDesc, setUpdateDesc] = useState('');
  const [updateImage, setUpdateImage] = useState('');

  // Map search & Geolocation states
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [searchingMap, setSearchingMap] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);

  // Geolocation Access: Get current owner position
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setGymLat(lat);
        setGymLng(lng);

        if (mapInstance.current && markerInstance.current) {
          mapInstance.current.setView([lat, lng], 15);
          markerInstance.current.setLatLng([lat, lng]);
        }

        // Reverse geocoding via Nominatim
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          if (data && data.address) {
            const street = data.address.road || data.address.suburb || data.address.neighbourhood || '';
            const city = data.address.city || data.address.town || data.address.state_district || 'Jaipur';
            if (street && !gymAddress) setGymAddress(street);
            setGymCity(city);
          }
        } catch (err) {
          console.warn('Reverse geocoding failed:', err);
        } finally {
          setLocatingUser(false);
        }
      },
      (err) => {
        setLocatingUser(false);
        alert('Unable to retrieve location: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // OpenStreetMap Nominatim Location Search
  const handleSearchMapLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapSearchQuery.trim()) return;

    setSearchingMap(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery)}`);
      const results = await res.json();

      if (results && results.length > 0) {
        const top = results[0];
        const lat = Number(parseFloat(top.lat).toFixed(6));
        const lng = Number(parseFloat(top.lon).toFixed(6));

        setGymLat(lat);
        setGymLng(lng);

        if (mapInstance.current && markerInstance.current) {
          mapInstance.current.setView([lat, lng], 14);
          markerInstance.current.setLatLng([lat, lng]);
        }

        if (top.display_name && !gymAddress) {
          const parts = top.display_name.split(',');
          setGymAddress(parts.slice(0, 2).join(', ').trim());
        }
      } else {
        alert('No locations found for: ' + mapSearchQuery);
      }
    } catch (err) {
      alert('Search failed. Please try again.');
    } finally {
      setSearchingMap(false);
    }
  };

  // Leaflet map setup for coordinates selection
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerInstance = useRef<L.Marker | null>(null);

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch facilities list
      const facs = await apiFetch('/api/gyms/facilities/all');
      setFacilitiesList(facs || []);

      // 2. Fetch current owner's gym details
      const ownerData = await apiFetch('/api/auth/me');
      if (ownerData.gym) {
        const gymData = await apiFetch(`/api/gyms/${ownerData.gym.id}`);
        setGym(gymData);
        updateUserGym(gymData); // Sync auth state

        // Initialize My Gym form fields
        setGymName(gymData.name);
        setGymDesc(gymData.description);
        setGymAddress(gymData.address);
        setGymCity(gymData.city);
        setGymLat(gymData.latitude);
        setGymLng(gymData.longitude);
        setGymPhone(gymData.contactNumber);
        setGymEmail(gymData.email);
        setGymLogo(gymData.logo || '');
        setGymCover(gymData.coverImage || '');
        setGymHours(gymData.openingHours);
        setFreeTrialDays(gymData.freeTrialDays || 3);

        // Payout fields initialization
        setUpiId(gymData.upiId || '');
        setBankAccountNumber(gymData.bankAccountNumber || '');
        setBankIfsc(gymData.bankIfsc || '');
        setBankAccountName(gymData.bankAccountName || '');
        setBankName(gymData.bankName || '');
        setPaymentQrCode(gymData.paymentQrCode || '');

        // Selected facilities mapping
        setSelectedFacilities(gymData.facilities.map((gf: any) => gf.facilityId));

        // Fetch gym products
        const prods = await apiFetch(`/api/products?gymId=${gymData.id}`);
        setProducts(prods || []);

        // Fetch gym subscriptions
        const subs = await apiFetch('/api/subscriptions/my');
        setSubscriptions(subs || []);

        // Fetch gym product orders
        const ords = await apiFetch('/api/orders/my');
        setOrders(ords || []);

        // Fetch platform settings for subscription renewal
        try {
          const platSettings = await apiFetch('/api/subscriptions/platform-payment');
          setPlatformSettings(platSettings);
          if (platSettings && platSettings.listingFeeRupees) {
            setSubPayAmount(platSettings.listingFeeRupees.toString());
          }
        } catch (e) {
          console.warn('Could not fetch platform settings');
        }
      }
    } catch (err) {
      console.error('Failed to load owner dashboard details');
    } finally {
      setLoading(false);
    }
  };

  // Save Owner Payout Settings (Bank details, UPI ID, Payment QR)
  const handleSavePayoutDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gym) return;
    setSavingPayout(true);
    try {
      await apiFetch(`/api/gyms/${gym.id}/payout`, {
        method: 'PUT',
        body: JSON.stringify({
          upiId,
          bankAccountNumber,
          bankIfsc,
          bankAccountName,
          bankName,
          paymentQrCode
        })
      });
      alert('Payment collection and payout details saved successfully!');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to save payout details.');
    } finally {
      setSavingPayout(false);
    }
  };

  // Submit Platform Subscription Payment Proof to Admin
  const handleSubmitSubPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subPayTxId && !subPayProofUrl) {
      alert('Please enter a Transaction ID or upload Payment Proof screenshot.');
      return;
    }
    setSubPaySubmitting(true);
    try {
      await apiFetch('/api/subscriptions/pay-platform', {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(subPayAmount),
          paymentMethod: subPayMethod,
          transactionId: subPayTxId,
          proofUrl: subPayProofUrl
        })
      });
      alert('Subscription payment proof submitted successfully! Admin will verify your payment.');
      setShowSubPayModal(false);
      setSubPayTxId('');
      setSubPayProofUrl('');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit platform subscription payment.');
    } finally {
      setSubPaySubmitting(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'GYM_OWNER') {
      navigate('/');
      return;
    }
    fetchDashboardData();
  }, [user?.id]);

  // Leaflet coordinates picker logic
  useEffect(() => {
    if (activeTab !== 'mygym' || !mapRef.current) return;

    // Set map instances
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([gymLat, gymLng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance.current);

      markerInstance.current = L.marker([gymLat, gymLng], { draggable: true })
        .addTo(mapInstance.current);

      // Handle marker drag
      markerInstance.current.on('dragend', () => {
        const position = markerInstance.current?.getLatLng();
        if (position) {
          setGymLat(Number(position.lat.toFixed(6)));
          setGymLng(Number(position.lng.toFixed(6)));
        }
      });

      // Handle map clicks
      mapInstance.current.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setGymLat(Number(lat.toFixed(6)));
        setGymLng(Number(lng.toFixed(6)));
        markerInstance.current?.setLatLng([lat, lng]);
      });
    } else {
      mapInstance.current.setView([gymLat, gymLng], 13);
      markerInstance.current?.setLatLng([gymLat, gymLng]);
    }
  }, [activeTab]);

  const handleCreateOrUpdateGym = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: gymName,
      description: gymDesc,
      address: gymAddress,
      city: gymCity,
      latitude: gymLat,
      longitude: gymLng,
      contactNumber: gymPhone,
      email: gymEmail,
      logo: gymLogo,
      coverImage: gymCover,
      openingHours: gymHours,
      freeTrialDays: Number(freeTrialDays)
    };

    try {
      if (gym) {
        // Update
        await apiFetch(`/api/gyms/${gym.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        alert('Gym profile updated successfully!');
      } else {
        // Create
        await apiFetch('/api/gyms', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        alert('Gym profile created successfully! Sent for Admin approval.');
      }
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Gym management transaction failed.');
    }
  };

  const handleFacilitiesUpdate = async () => {
    if (!gym) {
      alert('Please create your Gym Profile first in the "My Gym Setup" tab before saving facilities.');
      return;
    }
    try {
      await apiFetch(`/api/gyms/${gym.id}/facilities`, {
        method: 'POST',
        body: JSON.stringify({ facilityIds: selectedFacilities })
      });
      alert('Facilities updated successfully!');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to update facilities.');
    }
  };

  const toggleFacilitySelection = (facId: string) => {
    setSelectedFacilities(prev => 
      prev.includes(facId) ? prev.filter(id => id !== facId) : [...prev, facId]
    );
  };

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gym) return;
    try {
      await apiFetch(`/api/gyms/${gym.id}/plans`, {
        method: 'POST',
        body: JSON.stringify({
          name: planName,
          price: planPrice,
          durationDays: planDays,
          description: planDesc,
          features: planFeatures
        })
      });
      alert('Membership package published!');
      setPlanName('');
      setPlanPrice('');
      setPlanDesc('');
      setPlanFeatures('');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to add plan.');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    const confirmDel = window.confirm('Are you sure you want to delete this membership plan?');
    if (!confirmDel) return;
    try {
      await apiFetch(`/api/gyms/plans/${planId}`, { method: 'DELETE' });
      alert('Plan deleted.');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete plan.');
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          name: prodName,
          description: prodDesc,
          price: prodPrice,
          discount: prodDiscount,
          stock: prodStock,
          category: prodCategory,
          image: prodImage
        })
      });
      alert('Product listed in store!');
      setProdName('');
      setProdDesc('');
      setProdPrice('');
      setProdDiscount('0');
      setProdImage('');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to add product.');
    }
  };

  const handleDeleteProduct = async (prodId: string) => {
    const confirmDel = window.confirm('Are you sure you want to remove this product?');
    if (!confirmDel) return;
    try {
      await apiFetch(`/api/products/${prodId}`, { method: 'DELETE' });
      alert('Product removed.');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete product.');
    }
  };

  const handleOrderStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      alert(`Order status updated to ${newStatus}`);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to update order status');
    }
  };

  const handlePublishUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gym) return;
    try {
      await apiFetch(`/api/gyms/${gym.id}/updates`, {
        method: 'POST',
        body: JSON.stringify({
          title: updateTitle,
          description: updateDesc,
          imageUrl: updateImage
        })
      });
      alert('Gym news update published and notifications broadcasted!');
      setUpdateTitle('');
      setUpdateDesc('');
      setUpdateImage('');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to publish update');
    }
  };

  if (loading) {
    return (
      <div className="container flex-center" style={{ height: '80vh' }}>
        <div className="skeleton-card" style={{ width: '100%', height: '400px' }}></div>
      </div>
    );
  }

  // Analytics helper calculations
  const totalRevenue = subscriptions.reduce((acc, sub) => acc + sub.pricePaid, 0) +
                       orders.reduce((acc, o) => o.status !== 'CANCELLED' ? acc + o.totalPrice : acc, 0);

  return (
    <div className="owner-dashboard-container container">
      {/* Sidebar Nav & Main Panel wrapper */}
      <div className="owner-dashboard-layout">
        
        {/* SIDEBAR TABS */}
        <aside className="dashboard-navigation-sidebar glass-panel">
          <div className="sidebar-brand text-center">
            <Dumbbell className="text-primary" />
            <h3>GYMGO Owner</h3>
            {gym ? (
              <span className={`badge badge-${gym.isApproved ? 'approved' : 'pending'}`}>
                {gym.isApproved ? 'Approved' : 'Pending Approval'}
              </span>
            ) : (
              <span className="badge badge-pending">Gym Profile Missing</span>
            )}
          </div>

          <nav className="sidebar-tabs-nav">
            <button 
              onClick={() => setActiveTab('overview')} 
              className={`sidebar-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            >
              <TrendingUp size={16} /> Overview
            </button>
            <button 
              onClick={() => setActiveTab('mygym')} 
              className={`sidebar-tab-btn ${activeTab === 'mygym' ? 'active' : ''}`}
            >
              <Settings size={16} /> My Gym Setup
            </button>
            {gym && (
              <>
                <button 
                  onClick={() => setActiveTab('facilities')} 
                  className={`sidebar-tab-btn ${activeTab === 'facilities' ? 'active' : ''}`}
                >
                  <Sparkles size={16} /> Amenities
                </button>
                <button 
                  onClick={() => setActiveTab('plans')} 
                  className={`sidebar-tab-btn ${activeTab === 'plans' ? 'active' : ''}`}
                >
                  <CreditCard size={16} /> Membership Plans
                </button>
                <button 
                  onClick={() => setActiveTab('products')} 
                  className={`sidebar-tab-btn ${activeTab === 'products' ? 'active' : ''}`}
                >
                  <ShoppingBag size={16} /> Store Products
                </button>
                <button 
                  onClick={() => setActiveTab('orders')} 
                  className={`sidebar-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
                >
                  <ClipboardList size={16} /> Retail Orders
                </button>
                <button 
                  onClick={() => setActiveTab('updates')} 
                  className={`sidebar-tab-btn ${activeTab === 'updates' ? 'active' : ''}`}
                >
                  <Calendar size={16} /> Gym News/Updates
                </button>
                <button 
                  onClick={() => setActiveTab('payout')} 
                  className={`sidebar-tab-btn ${activeTab === 'payout' ? 'active' : ''}`}
                >
                  <DollarSign size={16} /> Payout & Payment QR
                </button>
              </>
            )}
          </nav>
        </aside>

        {/* MAIN PANEL CONTENT */}
        <main className="owner-main-panel">
          
          {/* TAB: OVERVIEW ANALYTICS */}
          {activeTab === 'overview' && (
            <div className="overview-tab-panel">
              {/* Platform 3-Month Free Trial Banner */}
              <div className="glass-card" style={{ padding: '1.25rem 1.5rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(0,255,204,0.3)', background: 'linear-gradient(135deg, rgba(0,255,204,0.08) 0%, rgba(15,23,42,0.6) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🎁 3-Month Free Platform Trial Active
                  </h3>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Your gym profile is listed on GYMGO for <b>3 Months FREE</b>. After trial, renew platform site subscription to stay listed.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: '#0b0d10', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Trial Period:</span>
                    <b style={{ color: '#00ffcc', fontSize: '1rem' }}>3 Months (90 Days)</b>
                  </div>
                  <button
                    onClick={() => setShowSubPayModal(true)}
                    className="btn btn-primary"
                    style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <CreditCard size={14} /> Pay Subscription
                  </button>
                </div>
              </div>

              <h2 className="panel-title">Business Analytics</h2>
              
              <div className="analytics-metrics-grid">
                <div className="metric-card glass-panel">
                  <DollarSign className="metric-icon text-primary" />
                  <div>
                    <span className="metric-label">Total Revenue</span>
                    <h3 className="metric-value">₹{totalRevenue.toFixed(2)}</h3>
                  </div>
                </div>

                <div className="metric-card glass-panel">
                  <Users className="metric-icon text-secondary" />
                  <div>
                    <span className="metric-label">Active Members</span>
                    <h3 className="metric-value">{subscriptions.filter(s => s.status === 'ACTIVE').length}</h3>
                  </div>
                </div>

                <div className="metric-card glass-panel">
                  <ShoppingBag className="metric-icon" style={{ color: '#ffb703' }} />
                  <div>
                    <span className="metric-label">Store Orders</span>
                    <h3 className="metric-value">{orders.length}</h3>
                  </div>
                </div>
              </div>

              {/* Subscriptions detail */}
              <div className="dashboard-block-panel glass-panel" style={{ marginTop: '2rem' }}>
                <h3>Recent Subscriptions</h3>
                {subscriptions.length === 0 ? (
                  <p className="text-muted text-center" style={{ padding: '2rem 0' }}>No active subscriptions yet.</p>
                ) : (
                  <div className="table-wrapper">
                    <table className="overview-data-table">
                      <thead>
                        <tr>
                          <th>Member Name</th>
                          <th>Package Tier</th>
                          <th>Price Paid</th>
                          <th>Expiry Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions.slice(0, 5).map(sub => (
                          <tr key={sub.id}>
                            <td>
                              <b>{sub.customer.name}</b><br/>
                              <span className="table-meta-text">{sub.customer.email}</span>
                            </td>
                            <td>{sub.plan.name}</td>
                            <td>₹{sub.pricePaid}</td>
                            <td>{new Date(sub.endDate).toLocaleDateString()}</td>
                            <td>
                              <span className={`badge badge-${sub.status.toLowerCase()}`}>
                                {sub.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: MY GYM PROFILE SETUP */}
          {activeTab === 'mygym' && (
            <div className="mygym-tab-panel glass-panel">
              <h2 className="panel-title">{gym ? 'Edit Gym Profile' : 'Register Gym Profile'}</h2>
              
              <form onSubmit={handleCreateOrUpdateGym} className="mygym-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Gym Name</label>
                    <input 
                      type="text" 
                      value={gymName} 
                      onChange={(e) => setGymName(e.target.value)}
                      placeholder="e.g. Iron Gym Vaishali"
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>City Location</label>
                    <select
                      value={gymCity}
                      onChange={(e) => setGymCity(e.target.value)}
                      className="form-control"
                    >
                      <option value="Jaipur">Jaipur</option>
                      <option value="Delhi">Delhi</option>
                      <option value="Mumbai">Mumbai</option>
                      <option value="Bangalore">Bangalore</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Gym Tagline/Description</label>
                  <textarea 
                    value={gymDesc}
                    onChange={(e) => setGymDesc(e.target.value)}
                    placeholder="Brief description of training programs, machines, hygiene standards, trainer expertise..."
                    rows={4}
                    className="form-control"
                    required
                  ></textarea>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Contact Phone</label>
                    <input 
                      type="text" 
                      value={gymPhone} 
                      onChange={(e) => setGymPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Business Email</label>
                    <input 
                      type="email" 
                      value={gymEmail} 
                      onChange={(e) => setGymEmail(e.target.value)}
                      placeholder="e.g. goldsvaishali@gmail.com"
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>🎁 Free Trial / Guest Pass Days</label>
                    <input 
                      type="number" 
                      value={freeTrialDays} 
                      onChange={(e) => setFreeTrialDays(Math.max(0, Number(e.target.value)))}
                      placeholder="e.g. 3"
                      className="form-control"
                      min={0}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <ImageInput
                      label="Gym Logo"
                      value={gymLogo}
                      onChange={(url) => setGymLogo(url)}
                      placeholder="Paste Image URL, Google Drive link, or upload local file..."
                      helpText="Supports Google Drive share links & local saved file uploads"
                    />
                  </div>

                  <div className="form-group">
                    <ImageInput
                      label="Cover Banner Image"
                      value={gymCover}
                      onChange={(url) => setGymCover(url)}
                      placeholder="Paste Image URL, Google Drive link, or upload local file..."
                      helpText="Supports Google Drive share links & local saved file uploads"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Opening & Closing Hours</label>
                    <input 
                      type="text" 
                      value={gymHours} 
                      onChange={(e) => setGymHours(e.target.value)}
                      placeholder="e.g. 05:30 AM - 10:00 PM"
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Address</label>
                    <input 
                      type="text" 
                      value={gymAddress} 
                      onChange={(e) => setGymAddress(e.target.value)}
                      placeholder="Plot number, block street name..."
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                {/* Map coordinate picker with Search & GPS Access */}
                <div className="form-group map-picker-section">
                  <div className="map-picker-header">
                    <label><MapPin size={14} className="text-primary" /> Map Location Picker</label>
                    <button
                      type="button"
                      onClick={handleGetCurrentLocation}
                      disabled={locatingUser}
                      className="btn-secondary gps-location-btn"
                    >
                      {locatingUser ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                      {locatingUser ? 'Fetching Location...' : 'Use My Current Location'}
                    </button>
                  </div>

                  {/* Map Search Bar */}
                  <div className="map-search-bar flex-center" style={{ gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input
                        type="text"
                        placeholder="Search city, area, or landmark on map (e.g. Vaishali Nagar, Jaipur)..."
                        value={mapSearchQuery}
                        onChange={(e) => setMapSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchMapLocation(e); } }}
                        className="form-control"
                        style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSearchMapLocation}
                      disabled={searchingMap}
                      className="btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '0.6rem 1rem' }}
                    >
                      {searchingMap ? 'Searching...' : 'Search Location'}
                    </button>
                  </div>

                  <div className="coordinates-display-row">
                    <span>Latitude: <b>{gymLat}</b></span>
                    <span>Longitude: <b>{gymLng}</b></span>
                    <span className="text-muted" style={{ fontSize: '0.75rem', marginLeft: 'auto' }}>
                      (Drag marker or click anywhere on map to reposition)
                    </span>
                  </div>

                  <div className="coordinate-map-wrapper">
                    <div ref={mapRef} id="leaflet-map-picker" className="leaflet-map-element"></div>
                  </div>
                </div>

                <button type="submit" className="glow-btn save-gym-btn">
                  Save Gym Profile
                </button>
              </form>
            </div>
          )}

          {/* TAB: FACILITIES / AMENITIES */}
          {activeTab === 'facilities' && (
            <div className="facilities-tab-panel glass-panel">
              <h2 className="panel-title">Manage Gym Facilities</h2>
              <p className="text-secondary" style={{ marginBottom: '1.5rem' }}>Select all facilities and features available inside your club:</p>

              <div className="facilities-selector-grid">
                {facilitiesList.map(fac => {
                  const isChecked = selectedFacilities.includes(fac.id);
                  return (
                    <div 
                      key={fac.id}
                      onClick={() => toggleFacilitySelection(fac.id)}
                      className={`facility-select-item glass-card ${isChecked ? 'selected' : ''}`}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      role="checkbox"
                      aria-checked={isChecked}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          toggleFacilitySelection(fac.id);
                        }
                      }}
                    >
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Controlled by div onClick
                        style={{ display: 'none' }}
                      />
                      <span className="checkbox-box flex-center">
                        {isChecked && <Check size={14} strokeWidth={3} />}
                      </span>
                      <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {fac.name}
                      </span>
                    </div>
                  );
                })}
              </div>

              <button 
                onClick={handleFacilitiesUpdate} 
                className="glow-btn save-facilities-btn"
                style={{ marginTop: '2rem' }}
              >
                Save Selected Amenities
              </button>
            </div>
          )}

          {/* TAB: MEMBERSHIP PLANS */}
          {activeTab === 'plans' && (
            <div className="plans-tab-panel">
              <div className="dashboard-block-panel glass-panel">
                <h2 className="panel-title">Add Membership Plan</h2>
                <form onSubmit={handleAddPlan} className="add-plan-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Plan Name</label>
                      <input 
                        type="text" 
                        value={planName} 
                        onChange={(e) => setPlanName(e.target.value)}
                        placeholder="e.g. Pro Quarterly Package"
                        className="form-control"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Price (₹)</label>
                      <input 
                        type="number" 
                        value={planPrice} 
                        onChange={(e) => setPlanPrice(e.target.value)}
                        placeholder="e.g. 2999"
                        className="form-control"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Duration (Days)</label>
                      <select 
                        value={planDays} 
                        onChange={(e) => setPlanDays(e.target.value)}
                        className="form-control"
                      >
                        <option value="30">30 Days (Monthly)</option>
                        <option value="90">90 Days (Quarterly)</option>
                        <option value="180">180 Days (Half-Yearly)</option>
                        <option value="365">365 Days (Annual)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Features / Amenities Included (Comma-separated)</label>
                      <input 
                        type="text" 
                        value={planFeatures} 
                        onChange={(e) => setPlanFeatures(e.target.value)}
                        placeholder="Gym Access, Cardio Area, 1x Free Shaker Bottle, Locker Access"
                        className="form-control"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Package Description</label>
                    <textarea
                      value={planDesc}
                      onChange={(e) => setPlanDesc(e.target.value)}
                      placeholder="Describe restrictions, specialized trainers availability, steam bath access limits..."
                      rows={2}
                      className="form-control"
                    ></textarea>
                  </div>

                  <button type="submit" className="glow-btn">
                    Create & Publish Package
                  </button>
                </form>
              </div>

              {/* Published plans list */}
              <div className="dashboard-block-panel glass-panel" style={{ marginTop: '2rem' }}>
                <h2>Active Packages</h2>
                {gym?.plans.length === 0 ? (
                  <p className="text-muted text-center" style={{ padding: '2rem 0' }}>No membership plans active.</p>
                ) : (
                  <div className="plans-owner-list">
                    {gym?.plans.map(p => (
                      <div key={p.id} className="plan-owner-row glass-card">
                        <div>
                          <h4>{p.name}</h4>
                          <span className="price-bold">₹{p.price}</span>
                          <span className="text-muted"> / {p.durationDays} Days</span>
                        </div>
                        <button 
                          onClick={() => handleDeletePlan(p.id)}
                          className="btn-secondary delete-plan-btn"
                          style={{ color: 'var(--status-error)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        >
                          <Trash2 size={16} /> Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: STORE PRODUCTS */}
          {activeTab === 'products' && (
            <div className="products-tab-panel">
              <div className="dashboard-block-panel glass-panel">
                <h2>Add Product to E-Store</h2>
                
                <form onSubmit={handleAddProduct} className="add-product-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Product Name</label>
                      <input 
                        type="text" 
                        value={prodName} 
                        onChange={(e) => setProdName(e.target.value)}
                        placeholder="e.g. Ultra Grip Gym Gloves"
                        className="form-control"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Category</label>
                      <select 
                        value={prodCategory} 
                        onChange={(e) => setProdCategory(e.target.value)}
                        className="form-control"
                      >
                        <option value="ACCESSORIES">Accessories</option>
                        <option value="EQUIPMENT">Equipment</option>
                        <option value="SUPPLEMENTS">Supplements</option>
                        <option value="APPAREL">Apparel</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Price (₹)</label>
                      <input 
                        type="number" 
                        value={prodPrice} 
                        onChange={(e) => setProdPrice(e.target.value)}
                        placeholder="e.g. 899"
                        className="form-control"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Discount percentage (%)</label>
                      <input 
                        type="number" 
                        value={prodDiscount} 
                        onChange={(e) => setProdDiscount(e.target.value)}
                        placeholder="e.g. 15 (for 15% off)"
                        className="form-control"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Stock Quantity Available</label>
                      <input 
                        type="number" 
                        value={prodStock} 
                        onChange={(e) => setProdStock(e.target.value)}
                        placeholder="e.g. 15"
                        className="form-control"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <ImageInput
                        label="Product Image"
                        value={prodImage}
                        onChange={(url) => setProdImage(url)}
                        placeholder="Paste Image URL, Google Drive link, or upload local file..."
                        helpText="Supports Google Drive share links & local saved file uploads"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <textarea 
                      value={prodDesc} 
                      onChange={(e) => setProdDesc(e.target.value)}
                      placeholder="Size, materials quality, dimensions weight, washing/care instructions..."
                      rows={2}
                      className="form-control"
                    ></textarea>
                  </div>

                  <button type="submit" className="glow-btn">
                    List Product
                  </button>
                </form>
              </div>

              {/* Listed Products list */}
              <div className="dashboard-block-panel glass-panel" style={{ marginTop: '2rem' }}>
                <h2>Listed Products</h2>
                {products.length === 0 ? (
                  <p className="text-muted text-center" style={{ padding: '2rem 0' }}>No products listed yet.</p>
                ) : (
                  <div className="owner-product-rows-list">
                    {products.map(prod => (
                      <div key={prod.id} className="plan-owner-row glass-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <img 
                            src={prod.image} 
                            alt="thumb" 
                            style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px' }} 
                          />
                          <div>
                            <h4>{prod.name}</h4>
                            <span className="price-bold">₹{prod.price}</span>
                            <span className="text-muted"> (Stock: {prod.stock} | Discount: {prod.discount}%)</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteProduct(prod.id)}
                          className="btn-secondary delete-plan-btn"
                          style={{ color: 'var(--status-error)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        >
                          <Trash2 size={16} /> Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: RETAIL ORDERS */}
          {activeTab === 'orders' && (
            <div className="orders-tab-panel glass-panel">
              <h2 className="panel-title">Customer Store Orders</h2>
              
              {orders.length === 0 ? (
                <p className="text-muted text-center" style={{ padding: '3rem 0' }}>No orders placed for your store yet.</p>
              ) : (
                <div className="orders-dashboard-list">
                  {orders.map(order => (
                    <div key={order.id} className="order-dashboard-card glass-card" style={{ marginBottom: '1.5rem' }}>
                      <div className="order-card-header">
                        <div>
                          <h4>Order #{order.id.substring(0, 8)}</h4>
                          <p className="order-date">Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                          <p className="customer-meta">Customer: <b>{order.customerName}</b> ({order.customerEmail})</p>
                        </div>
                        
                        <div className="status-updater-row">
                          <label>Status: </label>
                          <select
                            value={order.status}
                            onChange={(e) => handleOrderStatusUpdate(order.id, e.target.value)}
                            className="form-control status-select"
                          >
                            <option value="PENDING">Pending</option>
                            <option value="CONFIRMED">Confirmed</option>
                            <option value="PACKED">Packed</option>
                            <option value="SHIPPED">Shipped</option>
                            <option value="DELIVERED">Delivered</option>
                            <option value="CANCELLED">Cancelled</option>
                          </select>
                        </div>
                      </div>

                      <div className="order-items-preview">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="order-item-inline">
                            <img src={item.image} alt="product" />
                            <div>
                              <h5>{item.productName}</h5>
                              <span className="item-qty">Qty: {item.quantity} × ₹{item.pricePaid}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="order-card-footer">
                        <span>Total Price:</span>
                        <span className="price-bold">₹{order.totalPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: GYM NEWS UPDATES */}
          {activeTab === 'updates' && (
            <div className="updates-tab-panel">
              <div className="dashboard-block-panel glass-panel">
                <h2>Publish Gym News Update</h2>
                <p className="text-secondary" style={{ marginBottom: '1.5rem' }}>Broadcasting a post will notify all your active members automatically.</p>
                
                <form onSubmit={handlePublishUpdate} className="add-update-form">
                  <div className="form-group">
                    <label>Update Title</label>
                    <input 
                      type="text" 
                      value={updateTitle} 
                      onChange={(e) => setUpdateTitle(e.target.value)}
                      placeholder="e.g. New Squat Cages Added / Holi Holiday Operating Hours"
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Post Body Content</label>
                    <textarea 
                      value={updateDesc} 
                      onChange={(e) => setUpdateDesc(e.target.value)}
                      placeholder="Describe the news in detail..."
                      rows={4}
                      className="form-control"
                      required
                    ></textarea>
                  </div>

                  <div className="form-group">
                    <ImageInput
                      label="Update Photo (Optional)"
                      value={updateImage}
                      onChange={(url) => setUpdateImage(url)}
                      placeholder="Paste Image URL, Google Drive link, or upload local file..."
                      helpText="Supports Google Drive share links & local saved file uploads"
                    />
                  </div>

                  <button type="submit" className="glow-btn">
                    Broadcast Update
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB: PAYOUT & PAYMENT COLLECTION SETTINGS */}
          {activeTab === 'payout' && (
            <div className="payout-tab-panel">
              <h2 className="panel-title">Payment Collection & Payout Setup</h2>
              <p className="section-subtitle" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Configure your Bank Account, UPI ID, and Payment QR Code. Customers purchasing products or joining your gym can transfer funds directly to your accounts!
              </p>

              <div className="dashboard-block-panel glass-panel">
                <form onSubmit={handleSavePayoutDetails} className="mygym-form">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    <div className="form-group">
                      <label className="form-label">UPI ID (Google Pay / PhonePe / Paytm)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="e.g. yourname@upi or 9876543210@paytm"
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Direct UPI handle for customer scanning/payments</span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Bank Account Holder Name</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={bankAccountName}
                        onChange={(e) => setBankAccountName(e.target.value)}
                        placeholder="Legal Account Holder Name"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Bank Name</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. State Bank of India, HDFC, ICICI"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Bank Account Number</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        placeholder="Account Number"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">IFSC Code</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={bankIfsc}
                        onChange={(e) => setBankIfsc(e.target.value)}
                        placeholder="e.g. SBIN0001234"
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <ImageInput
                      label="Payment QR Code Image"
                      value={paymentQrCode}
                      onChange={(url) => setPaymentQrCode(url)}
                      placeholder="Paste QR Code URL or upload local payment QR image..."
                      helpText="Upload your Google Pay / PhonePe / Paytm QR Code image for direct customer scanning"
                    />
                  </div>

                  {paymentQrCode && (
                    <div style={{ textAlign: 'center', padding: '1rem', background: '#0b0d10', borderRadius: '8px', border: '1px solid var(--border-color)', maxWidth: '240px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Active Payment QR Preview:</span>
                      <img src={paymentQrCode} alt="Payment QR Code" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '6px' }} />
                    </div>
                  )}

                  <button type="submit" className="glow-btn" disabled={savingPayout} style={{ marginTop: '1rem' }}>
                    {savingPayout ? 'Saving Payout Details...' : 'Save Payout & QR Settings'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* PLATFORM SUBSCRIPTION PAYMENT MODAL */}
      {showSubPayModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-card" style={{ maxWidth: '520px', width: '100%', padding: '2rem', borderRadius: '16px', border: '1px solid var(--primary-color)', background: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                💳 Renew Platform Site Subscription
              </h3>
              <button onClick={() => setShowSubPayModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            {platformSettings ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ background: '#0b0d10', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.875rem' }}>
                  <b style={{ color: '#00ffcc', display: 'block', marginBottom: '0.5rem' }}>Admin Platform Payout Details:</b>
                  {platformSettings.adminUpiId && <p style={{ margin: '0.2rem 0' }}><b>Admin UPI:</b> <span style={{ color: '#ffb703' }}>{platformSettings.adminUpiId}</span></p>}
                  {platformSettings.adminBankName && <p style={{ margin: '0.2rem 0' }}><b>Bank:</b> {platformSettings.adminBankName} ({platformSettings.adminBankAccountNumber})</p>}
                  {platformSettings.adminBankIfsc && <p style={{ margin: '0.2rem 0' }}><b>IFSC:</b> {platformSettings.adminBankIfsc}</p>}
                  {platformSettings.adminBankAccountName && <p style={{ margin: '0.2rem 0' }}><b>Name:</b> {platformSettings.adminBankAccountName}</p>}
                  <p style={{ margin: '0.5rem 0 0 0', fontWeight: 700, color: 'var(--primary-color)' }}>
                    Listing Fee Required: ₹{platformSettings.listingFeeRupees || 999}
                  </p>
                </div>

                {platformSettings.adminQrCode && (
                  <div style={{ textAlign: 'center', background: '#0b0d10', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Scan Admin QR Code to Pay:</span>
                    <img src={platformSettings.adminQrCode} alt="Admin QR Code" style={{ width: '180px', height: '180px', objectFit: 'contain', margin: '0 auto', borderRadius: '8px', border: '1px solid #fff' }} />
                  </div>
                )}

                <form onSubmit={handleSubmitSubPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Payment Method Used</label>
                    <select className="form-input" value={subPayMethod} onChange={(e) => setSubPayMethod(e.target.value)}>
                      <option value="UPI">UPI Direct / QR Scan</option>
                      <option value="BANK_TRANSFER">Bank IMPS / NEFT / RTGS</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Transaction ID / UTR Number</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={subPayTxId} 
                      onChange={(e) => setSubPayTxId(e.target.value)} 
                      placeholder="e.g. UTR 425619873012 or UPI Ref ID"
                    />
                  </div>

                  <div className="form-group">
                    <ImageInput 
                      label="Payment Receipt Screenshot URL / Upload"
                      value={subPayProofUrl}
                      onChange={(url) => setSubPayProofUrl(url)}
                      placeholder="Paste receipt image URL or upload payment screenshot..."
                    />
                  </div>

                  <button type="submit" className="glow-btn" disabled={subPaySubmitting} style={{ width: '100%', marginTop: '0.5rem' }}>
                    {subPaySubmitting ? 'Submitting Payment Proof...' : 'Submit Payment for Verification'}
                  </button>
                </form>
              </div>
            ) : (
              <p className="text-muted text-center" style={{ padding: '1rem' }}>Loading Admin Payment Details...</p>
            )}
          </div>
        </div>
      )}

      <style>{`
        .owner-dashboard-container {
          padding-top: 90px;
          padding-bottom: 80px;
        }

        .owner-dashboard-layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 2rem;
          align-items: start;
        }

        /* Sidebar Tabs */
        .dashboard-navigation-sidebar {
          padding: 2rem 1.5rem;
          border-radius: var(--border-radius-lg);
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .sidebar-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 1.5rem;
        }

        .sidebar-brand h3 {
          font-size: 1.15rem;
        }

        .sidebar-tabs-nav {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .sidebar-tab-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: var(--border-radius-sm);
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.85rem;
          width: 100%;
          cursor: pointer;
          transition: var(--transition-fast);
          text-align: left;
        }

        .sidebar-tab-btn:hover {
          background: rgba(255,255,255,0.02);
          color: var(--text-primary);
        }

        .sidebar-tab-btn.active {
          background: var(--primary-color);
          color: #0b0d10;
        }

        /* Main Panel Content */
        .owner-main-panel {
          min-width: 0;
        }

        .panel-title {
          font-size: 1.8rem;
          margin-bottom: 1.5rem;
        }

        /* Overview Metrics */
        .analytics-metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }

        .metric-card {
          padding: 1.5rem;
          border-radius: var(--border-radius-md);
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }

        .metric-icon {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
        }

        .metric-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          font-weight: 500;
        }

        .metric-value {
          font-size: 1.6rem;
          font-weight: 800;
          line-height: 1.2;
        }

        /* Table */
        .table-wrapper {
          overflow-x: auto;
          margin-top: 1rem;
        }

        .overview-data-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.875rem;
        }

        .overview-data-table th, .overview-data-table td {
          padding: 1rem;
          border-bottom: 1px solid var(--border-color);
        }

        .overview-data-table th {
          font-family: var(--font-display);
          color: var(--text-secondary);
          font-weight: 600;
        }

        .table-meta-text {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        /* Forms My Gym */
        .mygym-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .coordinates-display-row {
          display: flex;
          gap: 2rem;
          font-size: 0.85rem;
          background: var(--bg-surface-elevated);
          padding: 0.5rem 1rem;
          border-radius: 4px;
          border: 1px solid var(--border-color);
        }

        .coordinate-map-wrapper {
          height: 250px;
          border-radius: var(--border-radius-sm);
          overflow: hidden;
          border: 1px solid var(--border-color);
        }

        .save-gym-btn {
          align-self: flex-start;
          border-radius: var(--border-radius-sm);
        }

        /* Facilities selector */
        .facilities-selector-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
        }

        .facility-select-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          border-radius: var(--border-radius-sm);
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid var(--border-color);
        }

        .facility-select-item:hover {
          border-color: var(--primary-color);
          background: rgba(0, 255, 204, 0.04);
        }

        .checkbox-box {
          width: 22px;
          height: 22px;
          border: 2px solid var(--border-color);
          border-radius: 6px;
          background: var(--bg-surface);
          color: var(--primary-color);
          flex-shrink: 0;
          transition: all 0.2s ease;
        }

        .facility-select-item.selected {
          border-color: var(--primary-color);
          background: rgba(0, 255, 204, 0.08);
          box-shadow: 0 0 15px rgba(0, 255, 204, 0.15);
        }

        .facility-select-item.selected .checkbox-box {
          border-color: var(--primary-color);
          background: var(--primary-color);
          color: #0b0d10;
        }

        /* Plans & Products Lists */
        .plans-owner-list, .owner-product-rows-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .plan-owner-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem;
        }

        .plan-owner-row h4 {
          font-size: 1.05rem;
          margin-bottom: 0.2rem;
        }

        .delete-plan-btn {
          font-size: 0.8rem;
          padding: 0.4rem 0.8rem;
          border-radius: var(--border-radius-sm);
        }

        /* Order fulfillment list */
        .status-updater-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .status-select {
          padding: 0.35rem;
          font-size: 0.8rem;
          width: 130px;
        }

        .customer-meta {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-top: 0.25rem;
        }

        /* Responsive Layout */
        @media (max-width: 992px) {
          .owner-dashboard-layout {
            grid-template-columns: 1fr;
          }
          .analytics-metrics-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .dashboard-navigation-sidebar {
            padding: 1.5rem;
          }
          .metric-card {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
};
