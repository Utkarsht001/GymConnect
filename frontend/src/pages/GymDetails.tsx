import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { MapPin, Phone, Mail, Clock, ShieldCheck, Heart, MessageSquare, Star, ArrowRight, UserCheck, Image as ImageIcon, Calendar } from 'lucide-react';
import L from 'leaflet';

interface GymDetailsData {
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
  freeTrialDays?: number;
  isApproved: boolean;
  upiId?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankAccountName?: string;
  bankName?: string;
  paymentQrCode?: string;
  owner: { id: string; name: string; avatar: string };
  facilities: Array<{ facility: { id: string; name: string; icon: string } }>;
  plans: Array<{ id: string; name: string; price: number; durationDays: number; description: string; features: string }>;
  photos: Array<{ id: string; url: string; category: string }>;
  updates: Array<{ id: string; title: string; description: string; imageUrl: string | null; createdAt: string }>;
  reviews: Array<{ id: string; rating: number; comment: string; ownerReply: string | null; createdAt: string; customer: { id: string; name: string; avatar: string } }>;
}

export const GymDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, apiFetch } = useAuth();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();

  // States
  const [gym, setGym] = useState<GymDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhotoCategory, setActivePhotoCategory] = useState<string>('ALL');
  const [isFavorite, setIsFavorite] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [ratingInput, setRatingInput] = useState(5);
  const [commentInput, setCommentInput] = useState('');
  const [replyInputs, setReplyInputs] = useState<{ [reviewId: string]: string }>({});

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);

  const fetchGymDetails = async () => {
    try {
      const data = await apiFetch(`/api/gyms/${id}`);
      setGym(data);
      
      // Check if favorited
      if (user && user.role === 'CUSTOMER') {
        const favs = JSON.parse(localStorage.getItem('fithub_favorites') || '[]');
        setIsFavorite(favs.includes(id));
      }
    } catch (err) {
      console.error('Failed to load gym details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGymDetails();
  }, [id, user]);

  // Map drawing
  useEffect(() => {
    if (loading || !gym || !mapRef.current) return;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, {
        zoomControl: false,
        scrollWheelZoom: false
      }).setView([gym.latitude, gym.longitude], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance.current);

      L.marker([gym.latitude, gym.longitude])
        .bindPopup(`<b>${gym.name}</b><br/>${gym.address}`)
        .addTo(mapInstance.current);

      L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);
    } else {
      mapInstance.current.setView([gym.latitude, gym.longitude], 14);
    }
  }, [gym, loading]);

  const toggleFavorite = () => {
    if (!user) {
      alert('Please log in to save favorites.');
      return;
    }
    const favs = JSON.parse(localStorage.getItem('fithub_favorites') || '[]');
    let updatedFavs = [];
    if (isFavorite) {
      updatedFavs = favs.filter((fId: string) => fId !== id);
      setIsFavorite(false);
    } else {
      updatedFavs = [...favs, id];
      setIsFavorite(true);
    }
    localStorage.setItem('fithub_favorites', JSON.stringify(updatedFavs));
  };

  const handleStartChat = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'CUSTOMER') {
      alert('Only customers can launch conversations with gym owners.');
      return;
    }
    if (gym) {
      // Navigate to chat, passing state of user to start messaging
      navigate('/chat', { state: { startChatWith: gym.owner } });
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'CUSTOMER') {
      alert('Only customers can subscribe to gym plans.');
      return;
    }

    const confirmSub = window.confirm('Would you like to subscribe to this membership plan?');
    if (!confirmSub) return;

    try {
      await apiFetch('/api/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ planId })
      });
      alert('Membership subscription completed successfully!');
      navigate('/dashboard/customer');
    } catch (err: any) {
      alert(err.message || 'Subscription failed.');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmittingReview(true);
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          gymId: id,
          rating: ratingInput,
          comment: commentInput
        })
      });
      alert('Review posted!');
      setCommentInput('');
      fetchGymDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleReplySubmit = async (reviewId: string) => {
    const text = replyInputs[reviewId];
    if (!text) return;
    try {
      await apiFetch(`/api/reviews/${reviewId}/reply`, {
        method: 'PUT',
        body: JSON.stringify({ reply: text })
      });
      alert('Response posted.');
      setReplyInputs(prev => ({ ...prev, [reviewId]: '' }));
      fetchGymDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to reply.');
    }
  };

  const getFilteredPhotos = () => {
    if (!gym) return [];
    if (activePhotoCategory === 'ALL') return gym.photos;
    return gym.photos.filter(p => p.category === activePhotoCategory);
  };

  const getAvgRating = () => {
    if (!gym || gym.reviews.length === 0) return '5.0';
    const sum = gym.reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / gym.reviews.length).toFixed(1);
  };

  if (loading) {
    return (
      <div className="container flex-center" style={{ height: '80vh' }}>
        <div className="skeleton-card" style={{ width: '100%', height: '500px' }}></div>
      </div>
    );
  }

  if (!gym) {
    return (
      <div className="container text-center" style={{ padding: '5rem 0' }}>
        <h2>Gym profile not found</h2>
        <button onClick={() => navigate('/gyms')} className="glow-btn">Back to Directory</button>
      </div>
    );
  }

  return (
    <div className="gym-details-page">
      {/* 1. COVER HERO HEADER */}
      <section className="gym-hero-header" style={{ backgroundImage: `url(${gym.coverImage})` }}>
        <div className="hero-overlay"></div>
        <div className="container gym-header-container">
          <div className="header-info-block">
            <img src={gym.logo} alt="Logo" className="gym-detail-logo" />
            <div className="gym-detail-title-row">
              <h1 className="gym-detail-name glow-text">{gym.name}</h1>
              <p className="gym-detail-location">
                <MapPin size={16} /> {gym.address}, {gym.city}
              </p>
              <div className="gym-ratings-row">
                <Star className="star-icon" />
                <span className="avg-rating">{getAvgRating()}</span>
                <span className="reviews-count">({gym.reviews.length} customer reviews)</span>
              </div>
            </div>
          </div>

          <div className="header-actions-block">
            <button onClick={toggleFavorite} className={`btn-secondary fav-toggle-btn ${isFavorite ? 'favorite' : ''}`}>
              <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} /> {isFavorite ? 'Saved' : 'Favorite'}
            </button>
            <button onClick={handleStartChat} className="glow-btn chat-trigger-btn">
              <MessageSquare size={18} /> Chat with Gym
            </button>
          </div>
        </div>
      </section>

      {/* 2. BODY CONTENT SPLIT */}
      <div className="container details-body-grid">
        <main className="details-main-content">
          
          {/* Section: About */}
          <section className="details-card-panel glass-panel">
            <h2>About {gym.name}</h2>
            <p className="about-text-content">{gym.description}</p>
          </section>

          {/* GATED ACCESS CALL-TO-ACTION FOR UNAUTHENTICATED VISITORS */}
          {!user ? (
            <section className="details-card-panel glass-panel text-center" style={{ padding: '3rem 2rem', borderRadius: '16px', border: '1px solid rgba(0,255,204,0.3)', background: 'linear-gradient(135deg, rgba(0,255,204,0.06) 0%, rgba(15,23,42,0.85) 100%)' }}>
              <div style={{ maxWidth: '520px', margin: '0 auto' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0,255,204,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto', border: '1px solid rgba(0,255,204,0.3)' }}>
                  <ShieldCheck size={32} className="text-primary animate-float" />
                </div>

                <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }} className="glow-text">Sign In to Unlock Full Gym Profile</h2>
                <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                  Create a free account or sign in to view full membership packages, photo gallery, customer reviews, gym updates, and connect with the owner.
                </p>

                <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '12px', textAlign: 'left', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#00ffcc' }}>💳</span> <b>Membership Plans & Pricing</b> (Monthly, Quarterly, Annual Tiers)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#00ffcc' }}>📷</span> <b>HD Photo Gallery</b> (Interior, Exterior, Equipment Photos)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#00ffcc' }}>⭐</span> <b>Verified Customer Reviews & Ratings</b>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#00ffcc' }}>📢</span> <b>Latest Gym News & Daily Class Announcements</b>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#00ffcc' }}>💬</span> <b>Direct 1-on-1 Real-time Chat with Gym Owner</b>
                  </div>
                </div>

                <button 
                  onClick={() => navigate('/login')} 
                  className="glow-btn flex-center"
                  style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', gap: '0.5rem' }}
                >
                  Sign In / Create Account <ArrowRight size={18} />
                </button>
              </div>
            </section>
          ) : (
            <>

          {/* Section: Gallery */}
          <section className="details-card-panel glass-panel">
            <div className="flex-header-row">
              <h2>Photo Gallery</h2>
              <div className="category-tabs">
                {['ALL', 'INTERIOR', 'EXTERIOR', 'EQUIPMENT', 'OTHER'].map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => setActivePhotoCategory(cat)}
                    className={`tab-btn ${activePhotoCategory === cat ? 'active' : ''}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {getFilteredPhotos().length === 0 ? (
              <div className="empty-gallery flex-center">
                <ImageIcon size={32} className="text-muted" />
                <p>No photos listed in this category.</p>
              </div>
            ) : (
              <div className="gallery-grid">
                {getFilteredPhotos().map(pic => (
                  <div key={pic.id} className="gallery-img-wrapper">
                    <img src={pic.url} alt="Gallery" />
                    <span className="gallery-category-badge">{pic.category}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section: Facilities */}
          <section className="details-card-panel glass-panel">
            <h2>Facilities & Amenities</h2>
            <div className="facilities-grid-detail">
              {gym.facilities.length === 0 ? (
                <p className="text-muted">No facilities specific lists provided.</p>
              ) : (
                gym.facilities.map(gf => (
                  <div key={gf.facility.id} className="facility-pill-item glass-card">
                    <span className="facility-name">{gf.facility.name}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Section: Pricing Packages */}
          <section className="details-card-panel glass-panel">
            <h2>Membership Packages</h2>
            {gym.plans.length === 0 ? (
              <div className="empty-plans flex-center text-center">
                <p className="text-muted">No membership plans published by this gym yet.</p>
              </div>
            ) : (
              <div className="plans-detail-grid">
                {gym.plans.map(plan => (
                  <div key={plan.id} className="plan-detail-card glass-card">
                    <h3 className="plan-tier-name">{plan.name}</h3>
                    <div className="plan-price-row">
                      <span className="amount">{formatPrice(plan.price)}</span>
                      <span className="duration">/{plan.durationDays} Days</span>
                    </div>
                    <p className="plan-tier-desc">{plan.description}</p>
                    
                    <div className="plan-features-list">
                      {plan.features.split(',').map((f, i) => (
                        <div key={i} className="feature-item">
                          <ShieldCheck size={16} className="feature-check-icon" />
                          <span>{f.trim()}</span>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => handleSubscribe(plan.id)} 
                      className="glow-btn purchase-plan-btn"
                    >
                      Subscribe Now <ArrowRight size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Direct Pay QR Code & UPI Card */}
            {(gym.paymentQrCode || gym.upiId || gym.bankAccountNumber) && (
              <div className="glass-card" style={{ marginTop: '2rem', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(0,255,204,0.3)', background: 'linear-gradient(135deg, rgba(0,255,204,0.05) 0%, rgba(15,23,42,0.8) 100%)' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  💳 Direct Pay to Gym (Scan QR / UPI / Bank)
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: gym.paymentQrCode ? '180px 1fr' : '1fr', gap: '1.5rem', alignItems: 'center' }}>
                  {gym.paymentQrCode && (
                    <div style={{ textAlign: 'center', background: '#0b0d10', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <img src={gym.paymentQrCode} alt="Gym Payment QR Code" style={{ width: '100%', maxHeight: '160px', objectFit: 'contain', borderRadius: '6px' }} />
                      <span style={{ fontSize: '0.7rem', color: '#00ffcc', display: 'block', marginTop: '0.4rem', fontWeight: 600 }}>Scan with GPay/PhonePe/Paytm</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                    {gym.upiId && <p style={{ margin: 0 }}><b>Direct UPI ID:</b> <span style={{ color: '#ffb703', fontWeight: 600 }}>{gym.upiId}</span></p>}
                    {gym.bankAccountName && <p style={{ margin: 0 }}><b>Account Holder:</b> {gym.bankAccountName}</p>}
                    {gym.bankName && <p style={{ margin: 0 }}><b>Bank Name:</b> {gym.bankName} ({gym.bankAccountNumber})</p>}
                    {gym.bankIfsc && <p style={{ margin: 0 }}><b>IFSC Code:</b> {gym.bankIfsc}</p>}
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      💡 You can pay directly to the gym using UPI or QR scan. Contact gym owner after payment for instant account activation!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Section: Updates */}
          <section className="details-card-panel glass-panel">
            <h2>Latest Gym Updates</h2>
            {gym.updates.length === 0 ? (
              <p className="text-muted">No news updates published recently.</p>
            ) : (
              <div className="updates-feed-wrapper">
                {gym.updates.map(upd => (
                  <div key={upd.id} className="update-feed-item glass-card">
                    <div className="update-meta">
                      <Calendar size={14} />
                      <span>{new Date(upd.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h3 className="update-title">{upd.title}</h3>
                    <p className="update-body">{upd.description}</p>
                    {upd.imageUrl && (
                      <img src={upd.imageUrl} alt="Update" className="update-media-img" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section: Reviews */}
          <section className="details-card-panel glass-panel">
            <h2>Reviews ({gym.reviews.length})</h2>
            
            {/* Create review form (For active customers) */}
            {user && user.role === 'CUSTOMER' && (
              <form onSubmit={handleReviewSubmit} className="add-review-form glass-card">
                <h3>Write a Review</h3>
                <div className="form-group">
                  <label>Rating (Stars)</label>
                  <select 
                    value={ratingInput} 
                    onChange={(e) => setRatingInput(parseInt(e.target.value))}
                    className="form-control"
                  >
                    <option value="5">★★★★★ (5 Stars)</option>
                    <option value="4">★★★★☆ (4 Stars)</option>
                    <option value="3">★★★☆☆ (3 Stars)</option>
                    <option value="2">★★☆☆☆ (2 Stars)</option>
                    <option value="1">★☆☆☆☆ (1 Star)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Review Comment</label>
                  <textarea 
                    value={commentInput} 
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Describe your workout experience, trainers feedback, locker cleanliness..."
                    rows={4}
                    className="form-control"
                    required
                  ></textarea>
                </div>
                <button type="submit" disabled={submittingReview} className="glow-btn submit-review-btn">
                  Submit Review
                </button>
              </form>
            )}

            {/* Review list */}
            <div className="reviews-feed">
              {gym.reviews.length === 0 ? (
                <p className="text-muted">No member reviews yet. Be the first to share your training session feedback!</p>
              ) : (
                gym.reviews.map(rev => (
                  <div key={rev.id} className="review-feed-card glass-card">
                    <div className="review-card-header">
                      <div className="reviewer-info">
                        <img src={rev.customer.avatar} alt="Avatar" />
                        <div>
                          <h4>{rev.customer.name}</h4>
                          <span className="date-span">{new Date(rev.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span className="stars-badge">★ {rev.rating}</span>
                    </div>
                    <p className="review-comment-body">{rev.comment}</p>

                    {/* Owner reply */}
                    {rev.ownerReply ? (
                      <div className="owner-reply-card glass-panel">
                        <div className="reply-header">
                          <UserCheck size={14} className="text-primary" />
                          <h5>Response from Gym Owner:</h5>
                        </div>
                        <p>{rev.ownerReply}</p>
                      </div>
                    ) : (
                      // Allow reply if logged in user is the owner of this gym
                      user && user.role === 'GYM_OWNER' && user.id === gym.owner.id && (
                        <div className="owner-reply-action-row">
                          <input 
                            type="text" 
                            placeholder="Write a response to customer feedback..."
                            value={replyInputs[rev.id] || ''}
                            onChange={(e) => setReplyInputs({ ...replyInputs, [rev.id]: e.target.value })}
                            className="form-control reply-input-field"
                          />
                          <button 
                            onClick={() => handleReplySubmit(rev.id)} 
                            className="glow-btn reply-btn"
                          >
                            Send
                          </button>
                        </div>
                      )
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
          </>
          )}
        </main>

        {/* SIDE COLUMN: CONTACT & LOCATION MAP */}
        <aside className="details-sidebar">
          {/* Panel: Contact card */}
          <div className="sidebar-card glass-panel">
            <h3>Contact Information</h3>
            <div className="contact-details-list">
              <div className="contact-item">
                <Clock className="contact-icon" />
                <div>
                  <h4>Operating Hours</h4>
                  <p>{gym.openingHours}</p>
                </div>
              </div>
              <div className="contact-item">
                <Phone className="contact-icon" />
                <div>
                  <h4>Phone Number</h4>
                  <p>{user ? gym.contactNumber : `${gym.contactNumber.substring(0, 6)}***** (Sign in to view)`}</p>
                </div>
              </div>
              <div className="contact-item">
                <Mail className="contact-icon" />
                <div>
                  <h4>Email Address</h4>
                  <p>{user ? gym.email : '••••••••@••••.com (Sign in to view)'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Panel: Map location */}
          <div className="sidebar-card glass-panel">
            <h3>Gym Location</h3>
            <div className="sidebar-map-wrapper">
              <div ref={mapRef} id="leaflet-map-detail" className="leaflet-map-element"></div>
            </div>
            <a 
              href={`https://www.openstreetmap.org/?mlat=${gym.latitude}&mlon=${gym.longitude}#map=16/${gym.latitude}/${gym.longitude}`} 
              target="_blank" 
              rel="noreferrer" 
              className="btn-secondary map-directions-btn"
            >
              Get Directions on Map
            </a>
          </div>
        </aside>
      </div>

      <style>{`
        .gym-details-page {
          padding-top: 70px;
          padding-bottom: 80px;
        }

        /* Cover Hero Header */
        .gym-hero-header {
          position: relative;
          height: 350px;
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: flex-end;
          border-bottom: 1px solid var(--border-color);
        }

        .gym-header-container {
          position: relative;
          z-index: 2;
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-bottom: 2rem;
        }

        .header-info-block {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .gym-detail-logo {
          width: 100px;
          height: 100px;
          border-radius: var(--border-radius-md);
          object-fit: cover;
          border: 2px solid var(--primary-color);
          background: var(--bg-surface);
        }

        .gym-detail-name {
          font-size: 2.2rem;
          margin-bottom: 0.25rem;
        }

        .gym-detail-location {
          font-size: 0.9rem;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 0.35rem;
          margin-bottom: 0.5rem;
        }

        .gym-ratings-row {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .star-icon {
          fill: var(--primary-color);
          color: var(--primary-color);
          width: 16px;
          height: 16px;
        }

        .avg-rating {
          font-weight: 700;
          color: var(--primary-color);
        }

        .reviews-count {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .header-actions-block {
          display: flex;
          gap: 1rem;
        }

        .fav-toggle-btn.favorite {
          color: var(--secondary-color);
          border-color: var(--secondary-color);
        }

        /* Body Split Grid */
        .details-body-grid {
          margin-top: 2rem;
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
          align-items: start;
        }

        .details-card-panel {
          padding: 2rem;
          border-radius: var(--border-radius-md);
          margin-bottom: 2rem;
        }

        .details-card-panel h2 {
          font-size: 1.5rem;
          margin-bottom: 1.25rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 0.75rem;
        }

        .about-text-content {
          font-size: 0.95rem;
          color: var(--text-secondary);
          white-space: pre-line;
        }

        .flex-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 0.75rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .flex-header-row h2 {
          border: none;
          margin: 0;
          padding: 0;
        }

        .category-tabs {
          display: flex;
          gap: 0.5rem;
        }

        .tab-btn {
          padding: 0.35rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 4px;
          background: var(--bg-surface-elevated);
          color: var(--text-secondary);
          cursor: pointer;
        }

        .tab-btn.active {
          background: var(--primary-color);
          color: #0b0d10;
        }

        /* Gallery Grid */
        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 1rem;
        }

        .gallery-img-wrapper {
          position: relative;
          height: 120px;
          border-radius: var(--border-radius-sm);
          overflow: hidden;
          border: 1px solid var(--border-color);
        }

        .gallery-img-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: var(--transition-smooth);
        }

        .gallery-img-wrapper:hover img {
          transform: scale(1.05);
        }

        .gallery-category-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          background: rgba(11, 13, 16, 0.75);
          font-size: 0.6rem;
          padding: 0.15rem 0.4rem;
          border-radius: 2px;
          font-weight: 700;
        }

        /* Facilities Grid */
        .facilities-grid-detail {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 1rem;
        }

        .facility-pill-item {
          padding: 1rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          border-radius: var(--border-radius-sm);
          text-align: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .facility-pill-item:hover {
          border-color: var(--primary-color);
          color: var(--primary-color);
        }

        /* Plan Tiers */
        .plans-detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 1.5rem;
        }

        .plan-detail-card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 2rem 1.5rem;
          height: 100%;
        }

        .plan-tier-name {
          font-size: 1.25rem;
          margin-bottom: 0.75rem;
          color: var(--text-primary);
        }

        .plan-price-row {
          margin-bottom: 1.25rem;
          display: flex;
          align-items: baseline;
        }

        .plan-price-row .currency {
          font-size: 1.25rem;
          color: var(--primary-color);
          font-weight: 700;
        }

        .plan-price-row .amount {
          font-size: 2.2rem;
          font-weight: 800;
          color: var(--primary-color);
          line-height: 1;
        }

        .plan-price-row .duration {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-left: 0.25rem;
        }

        .plan-tier-desc {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
          min-height: 48px;
        }

        .plan-features-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 2rem;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .feature-check-icon {
          color: var(--primary-color);
          flex-shrink: 0;
        }

        .purchase-plan-btn {
          width: 100%;
          justify-content: center;
          border-radius: var(--border-radius-sm);
          font-size: 0.9rem;
        }

        /* Updates Feed */
        .updates-feed-wrapper {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .update-feed-item {
          padding: 1.5rem;
        }

        .update-meta {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-bottom: 0.5rem;
        }

        .update-title {
          font-size: 1.15rem;
          margin-bottom: 0.5rem;
        }

        .update-body {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: 1rem;
        }

        .update-media-img {
          max-width: 100%;
          max-height: 300px;
          border-radius: var(--border-radius-sm);
          object-fit: cover;
          border: 1px solid var(--border-color);
        }

        /* Reviews Feed */
        .add-review-form {
          margin-bottom: 2rem;
          padding: 1.5rem;
        }

        .add-review-form h3 {
          margin-bottom: 1rem;
          font-size: 1.15rem;
        }

        .submit-review-btn {
          padding: 0.6rem 1.5rem;
          font-size: 0.875rem;
          border-radius: var(--border-radius-sm);
        }

        .review-feed-card {
          margin-bottom: 1.5rem;
        }

        .review-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .reviewer-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .reviewer-info img {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid var(--border-color);
        }

        .reviewer-info h4 {
          font-size: 0.9rem;
        }

        .reviewer-info .date-span {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .stars-badge {
          background: rgba(245, 158, 11, 0.15);
          color: var(--status-warning);
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 700;
        }

        .review-comment-body {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: 1rem;
        }

        .owner-reply-card {
          margin-top: 1rem;
          padding: 1rem;
          border-radius: var(--border-radius-sm);
          background: var(--bg-surface-elevated);
        }

        .reply-header {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          margin-bottom: 0.35rem;
        }

        .reply-header h5 {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--primary-color);
        }

        .owner-reply-card p {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .owner-reply-action-row {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .reply-input-field {
          flex: 1;
          padding: 0.5rem;
          font-size: 0.8rem;
        }

        .reply-btn {
          padding: 0.5rem 1rem;
          font-size: 0.8rem;
          border-radius: var(--border-radius-sm);
        }

        /* Sidebar Column */
        .details-sidebar {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .sidebar-card {
          padding: 1.5rem;
          border-radius: var(--border-radius-md);
        }

        .sidebar-card h3 {
          font-size: 1.15rem;
          margin-bottom: 1.25rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 0.5rem;
        }

        .contact-details-list {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .contact-item {
          display: flex;
          gap: 0.75rem;
        }

        .contact-icon {
          color: var(--primary-color);
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          margin-top: 0.2rem;
        }

        .contact-item h4 {
          font-size: 0.85rem;
          margin-bottom: 0.15rem;
        }

        .contact-item p {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .sidebar-map-wrapper {
          height: 200px;
          border-radius: var(--border-radius-sm);
          overflow: hidden;
          margin-bottom: 1rem;
        }

        .map-directions-btn {
          display: block;
          text-align: center;
          padding: 0.6rem;
          font-size: 0.85rem;
          width: 100%;
        }

        /* Responsive Media Queries */
        @media (max-width: 992px) {
          .details-body-grid {
            grid-template-columns: 1fr;
          }
          .details-sidebar {
            order: -1; /* Place map and info on top of detail content on small screens */
          }
        }

        @media (max-width: 768px) {
          .gym-hero-header {
            height: auto;
            padding: 3rem 0 1.5rem 0;
          }
          .gym-header-container {
            flex-direction: column;
            align-items: flex-start;
            gap: 1.5rem;
          }
          .header-actions-block {
            width: 100%;
          }
          .header-actions-block button {
            flex: 1;
            justify-content: center;
          }
          .category-tabs {
            overflow-x: auto;
            width: 100%;
            padding-bottom: 0.5rem;
          }
          .tab-btn {
            white-space: nowrap;
          }
          .details-card-panel {
            padding: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
};
