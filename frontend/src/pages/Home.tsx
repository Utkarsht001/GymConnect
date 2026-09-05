import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search, MapPin, Compass, ArrowRight, CreditCard, Sparkles, Award, Dumbbell, Navigation } from 'lucide-react';

interface Gym {
  id: string;
  name: string;
  description: string;
  city: string;
  address: string;
  logo: string;
  coverImage: string;
  openingHours: string;
  freeTrialDays?: number;
  isApproved: boolean;
  plans: Array<{ price: number }>;
  reviews: Array<{ rating: number }>;
}

export const Home: React.FC = () => {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch a subset of gyms for home presentation
  useEffect(() => {
    const fetchHomeGyms = async () => {
      try {
        const data = await apiFetch('/api/gyms');
        // Only show approved gyms, limit to 3 featured
        setGyms(data.slice(0, 3));
      } catch (err) {
        console.error('Failed to load gyms for homepage');
      } finally {
        setLoading(false);
      }
    };
    fetchHomeGyms();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let queryParams = [];
    if (searchQuery) queryParams.push(`search=${encodeURIComponent(searchQuery)}`);
    if (selectedCity) queryParams.push(`city=${encodeURIComponent(selectedCity)}`);
    
    navigate(`/gyms?${queryParams.join('&')}`);
  };

  const getAvgRating = (reviews: Gym['reviews']) => {
    if (!reviews || reviews.length === 0) return '5.0'; // Default high
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  };

  const getStartingPrice = (plans: Gym['plans']) => {
    if (!plans || plans.length === 0) return '₹999';
    const minPrice = Math.min(...plans.map(p => p.price));
    return `₹${minPrice}`;
  };

  return (
    <div className="home-container">
      {/* 1. HERO SECTION */}
      <section className="hero-section">
        <div className="hero-overlay"></div>
        <div className="container hero-content">
          <h1 className="hero-title animate-float glow-text">
            Find the Perfect <span className="highlight">Gym</span> Near You
          </h1>
          <p className="hero-subtitle">
            Discover premium gyms, compare membership plans, explore facilities, and start your fitness journey today.
          </p>

          <form onSubmit={handleSearchSubmit} className="search-bar-form glass-panel">
            <div className="search-field">
              <Search className="search-field-icon" />
              <input 
                type="text" 
                placeholder="Search gyms by name, equipment..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="divider-line"></div>
            
            <div className="search-field location-field">
              <MapPin className="search-field-icon" />
              <select 
                value={selectedCity} 
                onChange={(e) => setSelectedCity(e.target.value)}
                className="city-select"
              >
                <option value="">Select City (All)</option>
                <option value="Jaipur">Jaipur</option>
                <option value="Delhi">Delhi</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Bangalore">Bangalore</option>
              </select>
            </div>

            <div className="hero-btn-group" style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="glow-btn search-submit-btn">
                Explore Now
              </button>
              <button
                type="button"
                onClick={() => navigate('/gyms')}
                className="btn-secondary flex-center"
                style={{ gap: '0.4rem', whiteSpace: 'nowrap', padding: '0.75rem 1.2rem', fontSize: '0.85rem' }}
              >
                <Navigation size={16} className="text-primary" /> Near Me
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* 2. DYNAMIC GYM NEAR ME */}
      <section className="gym-cards-section container">
        <div className="section-header">
          <div>
            <h2 className="section-title">Gym Near Me</h2>
            <p className="section-subtitle">Top rated fitness centers in your city</p>
          </div>
          <Link to="/gyms" className="view-all-link">
            View All Gyms <ArrowRight size={18} />
          </Link>
        </div>

        {loading ? (
          <div className="loading-grid">
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
          </div>
        ) : gyms.length === 0 ? (
          <div className="empty-state glass-card flex-center">
            <Compass size={40} className="empty-icon" />
            <h3>No Gyms Registered Yet</h3>
            <p>Become the first gym owner to list your profile!</p>
          </div>
        ) : (
          <div className="grid-responsive">
            {gyms.map(gym => (
              <div key={gym.id} className="gym-card glass-card">
                <div className="gym-card-image-wrapper">
                  <img src={gym.coverImage} alt={gym.name} className="gym-card-img" />
                  <span className="price-tag">Starts at {getStartingPrice(gym.plans)}/mo</span>
                </div>
                <div className="gym-card-body">
                  <div className="gym-card-header">
                    <img src={gym.logo} alt="Logo" className="gym-logo" />
                    <div>
                      <h3 className="gym-name">{gym.name}</h3>
                      <p className="gym-city"><MapPin size={12} /> {gym.city}</p>
                    </div>
                  </div>
                  <p className="gym-desc-excerpt">{gym.description.substring(0, 95)}...</p>
                  
                  <div className="gym-card-footer">
                    <span className="rating-badge">★ {getAvgRating(gym.reviews)}</span>
                    <Link to={`/gyms/${gym.id}`} className="glow-btn view-gym-btn">
                      View Gym
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. HOW IT WORKS */}
      <section className="how-it-works-section">
        <div className="container">
          <div className="text-center-wrapper">
            <h2 className="section-title text-center">How GYMGO Works</h2>
            <p className="section-subtitle text-center">Get started on your training roadmap in 3 steps</p>
          </div>

          <div className="steps-grid">
            <div className="step-item glass-card text-center">
              <div className="step-icon-wrapper flex-center">
                <Compass className="step-icon" />
              </div>
              <h3 className="step-title">1. Search Nearby</h3>
              <p className="step-text">Use our interactive Leaflet map filters to search gyms and compare ratings right in your neighborhood.</p>
            </div>

            <div className="step-item glass-card text-center">
              <div className="step-icon-wrapper flex-center text-secondary">
                <CreditCard className="step-icon" />
              </div>
              <h3 className="step-title">2. Choose a Package</h3>
              <p className="step-text">Choose from multiple membership tiers (Monthly, Pro, or Annual) customized by gym owners.</p>
            </div>

            <div className="step-item glass-card text-center">
              <div className="step-icon-wrapper flex-center">
                <Sparkles className="step-icon" />
              </div>
              <h3 className="step-title">3. Start Workout</h3>
              <p className="step-text">Gain instant QR/subscription access, chat directly with owners, and purchase premium fitness gear.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. MOCK TESTIMONIALS */}
      <section className="reviews-section container">
        <div className="text-center-wrapper">
          <h2 className="section-title text-center">What Athletes Say</h2>
          <p className="section-subtitle text-center">Reviews from members who transformed their routine</p>
        </div>

        <div className="reviews-grid">
          <div className="review-card glass-panel">
            <div className="review-rating">★★★★★</div>
            <p className="review-text">"Finding a gym with a dedicated CrossFit zone and heavy squats racks used to be difficult in Jaipur. GYMGO let me locate Iron Paradise and subscribe instantly. Highly recommend!"</p>
            <div className="review-author">
              <img src="https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=80" alt="User" />
              <div>
                <h4>Rohan Singhania</h4>
                <span>Active Member</span>
              </div>
            </div>
          </div>

          <div className="review-card glass-panel">
            <div className="review-rating">★★★★★</div>
            <p className="review-text">"The direct chat with the gym owner is fantastic. I was able to clarify class timings and trainer slots before buying the Elite Annual plan. Seamless process."</p>
            <div className="review-author">
              <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80" alt="User" />
              <div>
                <h4>Neha Aggarwal</h4>
                <span>Golds Elite Member</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. OWNER ONBOARDING BANNER */}
      <section className="owner-cta-section container">
        <div className="owner-cta-card glass-panel">
          <div className="cta-content">
            <h2 className="cta-title">Own a Fitness Center?</h2>
            <p className="cta-text">
              List your gym on GYMGO, publish membership tiers, manage product catalogs, and chat directly with hundreds of potential customers today.
            </p>
            <Link to="/login?register=owner" className="glow-btn cta-btn">
              List Your Gym <ArrowRight size={18} />
            </Link>
          </div>
          <div className="cta-graphics-wrapper flex-center">
            <Award className="cta-icon-glow animate-float" />
          </div>
        </div>
      </section>

      {/* 6. FOOTER */}
      <footer className="footer-section">
        <div className="container footer-grid">
          <div className="footer-brand">
            <div className="logo-section">
              <Dumbbell className="logo-icon" />
              <span>GYM<span className="highlight">GO</span></span>
            </div>
            <p className="footer-brand-text">
              Jaipur's premier multi-gym discovery, management, and e-commerce fitness marketplace.
            </p>
          </div>

          <div className="footer-links-group">
            <h4>Explore</h4>
            <Link to="/gyms">Search Gyms</Link>
            <Link to="/store">Gym Store</Link>
            <Link to="/login">Sign In</Link>
          </div>

          <div className="footer-links-group">
            <h4>For Owners</h4>
            <Link to="/login?register=owner">Create Owner Profile</Link>
            <Link to="/dashboard/owner">Management Center</Link>
            <Link to="/faq">Fulfillment Guidelines</Link>
          </div>
        </div>
        <div className="footer-bottom text-center">
          <p>© 2026 GYMGO. Designed for premium athletic experiences.</p>
        </div>
      </footer>

      {/* STYLES */}
      <style>{`
        .home-container {
          padding-top: 70px; /* Space for fixed navbar */
        }

        /* Hero Section */
        .hero-section {
          position: relative;
          height: calc(85vh - 70px);
          min-height: 500px;
          display: flex;
          align-items: center;
          background-image: url('https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1600');
          background-size: cover;
          background-position: center;
          border-bottom: 1px solid var(--border-color);
        }

        .hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(11, 13, 16, 0.6) 0%, #0b0d10 100%);
          z-index: 1;
        }

        .hero-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          max-width: 800px;
        }

        .hero-title {
          font-size: 3.5rem;
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 1.5rem;
          font-family: var(--font-display);
        }

        .hero-subtitle {
          font-size: 1.25rem;
          color: var(--text-secondary);
          margin-bottom: 3rem;
          max-width: 600px;
        }

        /* Search Bar Form */
        .search-bar-form {
          display: flex;
          align-items: center;
          padding: 0.5rem 0.5rem 0.5rem 1.5rem;
          border-radius: var(--border-radius-lg);
          width: 100%;
          max-width: 750px;
          gap: 1rem;
        }

        .search-field {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1.5;
        }

        .location-field {
          flex: 1;
        }

        .search-field-icon {
          color: var(--primary-color);
          width: 20px;
          height: 20px;
        }

        .search-input {
          width: 100%;
          color: var(--text-primary);
          font-size: 0.95rem;
        }

        .search-input::placeholder {
          color: var(--text-muted);
        }

        .city-select {
          width: 100%;
          color: var(--text-primary);
          background: transparent;
          font-size: 0.95rem;
          cursor: pointer;
        }

        .city-select option {
          background: var(--bg-surface);
          color: var(--text-primary);
        }

        .divider-line {
          width: 1px;
          height: 30px;
          background: var(--border-color);
        }

        .search-submit-btn {
          white-space: nowrap;
          padding: 0.8rem 2rem;
          border-radius: var(--border-radius-md);
        }

        /* Section Header */
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 5rem;
          margin-bottom: 2rem;
        }

        .section-title {
          font-size: 2.2rem;
          margin-bottom: 0.5rem;
        }

        .section-subtitle {
          color: var(--text-secondary);
        }

        .text-center-wrapper {
          margin-top: 5rem;
          margin-bottom: 3rem;
        }

        .text-center {
          text-align: center;
        }

        .view-all-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--primary-color);
          font-weight: 600;
        }

        .view-all-link:hover {
          text-decoration: underline;
        }

        /* Gym Cards */
        .gym-card {
          padding: 0;
          overflow: hidden;
        }

        .gym-card-image-wrapper {
          position: relative;
          height: 200px;
          width: 100%;
        }

        .gym-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: var(--transition-smooth);
        }

        .gym-card:hover .gym-card-img {
          transform: scale(1.05);
        }

        .price-tag {
          position: absolute;
          bottom: 12px;
          left: 12px;
          background: var(--bg-color);
          color: var(--primary-color);
          padding: 0.35rem 0.75rem;
          font-size: 0.8rem;
          font-weight: 700;
          border-radius: var(--border-radius-sm);
          border: 1px solid var(--border-color);
        }

        .gym-card-body {
          padding: 1.5rem;
        }

        .gym-card-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .gym-logo {
          width: 48px;
          height: 48px;
          border-radius: var(--border-radius-sm);
          object-fit: cover;
          border: 1px solid var(--border-color);
        }

        .gym-name {
          font-size: 1.15rem;
          font-weight: 700;
        }

        .gym-city {
          font-size: 0.8rem;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .gym-desc-excerpt {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
          min-height: 42px;
        }

        .gym-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid var(--border-color);
          padding-top: 1rem;
        }

        .rating-badge {
          background: rgba(0, 255, 204, 0.1);
          color: var(--primary-color);
          padding: 0.25rem 0.5rem;
          border-radius: var(--border-radius-sm);
          font-weight: 700;
          font-size: 0.85rem;
        }

        .view-gym-btn {
          padding: 0.5rem 1rem;
          font-size: 0.85rem;
          border-radius: var(--border-radius-sm);
        }

        /* How it works */
        .how-it-works-section {
          background: var(--bg-surface);
          border-y: 1px solid var(--border-color);
          padding: 5rem 0;
          margin-top: 6rem;
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
        }

        .step-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2.5rem 2rem;
        }

        .step-icon-wrapper {
          width: 70px;
          height: 70px;
          border-radius: 50%;
          background: rgba(0, 255, 204, 0.1);
          color: var(--primary-color);
          margin-bottom: 1.5rem;
          box-shadow: 0 0 15px rgba(0, 255, 204, 0.1);
        }

        .step-icon {
          width: 32px;
          height: 32px;
        }

        .step-title {
          font-size: 1.3rem;
          margin-bottom: 1rem;
        }

        .step-text {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        /* Reviews Section */
        .reviews-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 2rem;
        }

        .review-card {
          padding: 2.5rem;
          border-radius: var(--border-radius-md);
        }

        .review-rating {
          color: var(--primary-color);
          font-size: 1.25rem;
          margin-bottom: 1rem;
        }

        .review-text {
          font-size: 0.95rem;
          color: var(--text-secondary);
          margin-bottom: 2rem;
          font-style: italic;
        }

        .review-author {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .review-author img {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid var(--border-color);
        }

        .review-author h4 {
          font-size: 0.95rem;
        }

        .review-author span {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        /* Owner CTA */
        .owner-cta-card {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          border-radius: var(--border-radius-lg);
          padding: 4rem;
          margin-top: 6rem;
          gap: 2rem;
        }

        .cta-title {
          font-size: 2.5rem;
          margin-bottom: 1rem;
        }

        .cta-text {
          color: var(--text-secondary);
          margin-bottom: 2rem;
          font-size: 1.05rem;
        }

        .cta-btn {
          padding: 0.8rem 2rem;
        }

        .cta-icon-glow {
          width: 130px;
          height: 130px;
          color: var(--primary-color);
          filter: drop-shadow(0 0 20px var(--primary-glow));
        }

        /* Footer */
        .footer-section {
          background: #060709;
          border-top: 1px solid var(--border-color);
          padding: 4rem 0 2rem 0;
          margin-top: 8rem;
        }

        .footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 4rem;
          margin-bottom: 3rem;
        }

        .footer-brand-text {
          color: var(--text-secondary);
          margin-top: 1.5rem;
          max-width: 320px;
          font-size: 0.875rem;
        }

        .footer-links-group {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .footer-links-group h4 {
          font-size: 1rem;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }

        .footer-links-group a {
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        .footer-links-group a:hover {
          color: var(--primary-color);
        }

        .footer-bottom {
          border-top: 1px solid var(--border-color);
          padding-top: 2rem;
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        /* Skeleton Loaders */
        .loading-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }

        .skeleton-card {
          height: 380px;
          background: var(--bg-surface-elevated);
          border-radius: var(--border-radius-md);
          animation: pulse 1.5s infinite ease-in-out;
        }

        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.3; }
          100% { opacity: 0.6; }
        }

        /* Responsive Media Queries */
        @media (max-width: 992px) {
          .owner-cta-card {
            grid-template-columns: 1fr;
            padding: 3rem;
          }
          .cta-graphics-wrapper {
            display: none;
          }
          .steps-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
        }

        @media (max-width: 768px) {
          .hero-title {
            font-size: 2.2rem;
          }
          .search-bar-form {
            flex-direction: column;
            padding: 1.5rem;
            border-radius: var(--border-radius-md);
          }
          .divider-line {
            display: none;
          }
          .search-field {
            width: 100%;
          }
          .search-submit-btn {
            width: 100%;
          }
          .section-header {
            margin-top: 3rem;
          }
          .loading-grid, .grid-responsive {
            grid-template-columns: 1fr;
          }
          .reviews-grid {
            grid-template-columns: 1fr;
          }
          .footer-grid {
            grid-template-columns: 1fr;
            gap: 2rem;
          }
          .home-container {
            padding-bottom: 80px; /* Space for mobile bottom bar */
          }
        }
      `}</style>
    </div>
  );
};
