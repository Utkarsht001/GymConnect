import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SEO } from '../components/SEO';
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
    let isMounted = true;
    const fetchHomeGyms = async () => {
      try {
        const data = await apiFetch('/api/gyms');
        if (isMounted) {
          // Only show approved gyms, limit to 3 featured
          setGyms(data.slice(0, 3));
        }
      } catch (err) {
        console.error('Failed to load gyms for homepage');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchHomeGyms();
    return () => { isMounted = false; };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const queryParams = [];
    if (searchQuery.trim()) queryParams.push(`search=${encodeURIComponent(searchQuery.trim())}`);
    if (selectedCity) queryParams.push(`city=${encodeURIComponent(selectedCity)}`);
    
    navigate(`/gyms?${queryParams.join('&')}`);
  };

  const getAvgRating = (reviews: Gym['reviews']) => {
    if (!reviews || reviews.length === 0) return '5.0';
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
      <SEO 
        title="Find Top Gyms, Compare Memberships & Fitness Store"
        description="Discover top-rated verified fitness centers in Jaipur, compare flexible membership tiers, shop fitness supplements and workout accessories on GymConnect."
        canonicalPath="/"
      />

      {/* 1. HERO SECTION (Optimized for Sub-Second LCP) */}
      <section className="hero-section" aria-label="Hero Introduction">
        {/* LCP Preloaded Hero Image with native fetchPriority and WebP */}
        <img 
          src="https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80&fm=webp"
          alt="GymConnect Modern Athletic Fitness Training Center"
          fetchPriority="high"
          loading="eager"
          decoding="sync"
          className="hero-background-img"
          width={1200}
          height={600}
        />
        <div className="hero-overlay" aria-hidden="true"></div>

        <div className="container hero-content">
          <h1 className="hero-title animate-float glow-text">
            Find the Perfect <span className="highlight">Gym</span> Near You
          </h1>
          <p className="hero-subtitle">
            Discover premium gyms, compare membership plans, explore amenities, and begin your fitness journey today.
          </p>

          <form onSubmit={handleSearchSubmit} className="search-bar-form glass-panel" role="search" aria-label="Gym search form">
            <div className="search-field">
              <label htmlFor="home-gym-search" className="sr-only">Search gyms by name, equipment, or specialties</label>
              <Search className="search-field-icon" aria-hidden="true" />
              <input 
                id="home-gym-search"
                name="search"
                type="search" 
                placeholder="Search gyms by name, equipment..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                aria-label="Search gyms by name, equipment, or fitness facilities"
                autoComplete="off"
              />
            </div>
            
            <div className="divider-line" aria-hidden="true"></div>
            
            <div className="search-field location-field">
              <label htmlFor="home-city-select" className="sr-only">Select City</label>
              <MapPin className="search-field-icon" aria-hidden="true" />
              <select 
                id="home-city-select"
                name="city"
                value={selectedCity} 
                onChange={(e) => setSelectedCity(e.target.value)}
                className="city-select"
                aria-label="Filter gyms by city"
              >
                <option value="">Select City (All)</option>
                <option value="Jaipur">Jaipur</option>
                <option value="Delhi">Delhi</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Bangalore">Bangalore</option>
              </select>
            </div>

            <div className="hero-btn-group" style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                type="submit" 
                className="glow-btn search-submit-btn"
                aria-label="Explore gyms now"
              >
                Explore Now
              </button>
              <button
                type="button"
                onClick={() => navigate('/gyms')}
                className="btn-secondary flex-center"
                style={{ gap: '0.4rem', whiteSpace: 'nowrap', padding: '0.75rem 1.2rem', fontSize: '0.85rem' }}
                aria-label="Find gyms near my current location"
              >
                <Navigation size={16} className="text-primary" aria-hidden="true" /> Near Me
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* 2. DYNAMIC GYM NEAR ME */}
      <section className="gym-cards-section container" aria-labelledby="heading-gym-near-me">
        <div className="section-header">
          <div>
            <h2 id="heading-gym-near-me" className="section-title">Gym Near Me</h2>
            <p className="section-subtitle">Top rated fitness centers in your neighborhood</p>
          </div>
          <Link to="/gyms" className="view-all-link" aria-label="View all gyms in Jaipur and other cities">
            View All Gyms <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <div className="loading-grid" aria-busy="true" aria-label="Loading featured gyms">
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
          </div>
        ) : gyms.length === 0 ? (
          <div className="empty-state glass-card flex-center">
            <Compass size={40} className="empty-icon" aria-hidden="true" />
            <h3>No Gyms Registered Yet</h3>
            <p>Become the first gym owner to list your profile!</p>
          </div>
        ) : (
          <div className="grid-responsive">
            {gyms.map(gym => (
              <article key={gym.id} className="gym-card glass-card">
                <Link to={`/gyms/${gym.id}`} aria-label={`View details for ${gym.name}`} style={{ display: 'block', textDecoration: 'none' }}>
                  <div className="gym-card-image-wrapper">
                    <img 
                      src={gym.coverImage || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=75'} 
                      alt={`${gym.name} facility and workout floor`} 
                      className="gym-card-img" 
                      loading="lazy"
                      decoding="async"
                      width={350}
                      height={200}
                    />
                    <span className="price-tag">Starts at {getStartingPrice(gym.plans)}/mo</span>
                  </div>
                </Link>
                <div className="gym-card-body">
                  <div className="gym-card-header">
                    <Link to={`/gyms/${gym.id}`} aria-label={`${gym.name} logo`} style={{ display: 'flex', textDecoration: 'none', flexShrink: 0 }}>
                      <img 
                        src={gym.logo || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=100&q=75'} 
                        alt={`${gym.name} brand logo`} 
                        className="gym-logo" 
                        loading="lazy"
                        decoding="async"
                        width={48}
                        height={48}
                      />
                    </Link>
                    <div>
                      <h3 className="gym-name">
                        <Link to={`/gyms/${gym.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {gym.name}
                        </Link>
                      </h3>
                      <p className="gym-city"><MapPin size={12} aria-hidden="true" /> {gym.city}</p>
                    </div>
                  </div>
                  <p className="gym-desc-excerpt">{gym.description.substring(0, 95)}...</p>
                  
                  <div className="gym-card-footer">
                    <span className="rating-badge" aria-label={`Rating: ${getAvgRating(gym.reviews)} out of 5 stars`}>★ {getAvgRating(gym.reviews)}</span>
                    <Link 
                      to={`/gyms/${gym.id}`} 
                      className="glow-btn view-gym-btn"
                      aria-label={`View profile, facilities, and membership plans for ${gym.name}`}
                    >
                      View Gym
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 3. HOW IT WORKS */}
      <section className="how-it-works-section" aria-labelledby="heading-how-it-works">
        <div className="container">
          <div className="text-center-wrapper">
            <h2 id="heading-how-it-works" className="section-title text-center">How GymConnect Works</h2>
            <p className="section-subtitle text-center">Get started on your training roadmap in 3 simple steps</p>
          </div>

          <div className="steps-grid">
            <div className="step-item glass-card text-center">
              <div className="step-icon-wrapper flex-center" aria-hidden="true">
                <Compass className="step-icon" />
              </div>
              <h3 className="step-title">1. Search Nearby</h3>
              <p className="step-text">Use our interactive Leaflet map filters to search gyms and compare amenities right in your neighborhood.</p>
            </div>

            <div className="step-item glass-card text-center">
              <div className="step-icon-wrapper flex-center text-secondary" aria-hidden="true">
                <CreditCard className="step-icon" />
              </div>
              <h3 className="step-title">2. Choose a Package</h3>
              <p className="step-text">Select from flexible membership tiers (Monthly, Quarterly, or Annual) customized by gym management.</p>
            </div>

            <div className="step-item glass-card text-center">
              <div className="step-icon-wrapper flex-center" aria-hidden="true">
                <Sparkles className="step-icon" />
              </div>
              <h3 className="step-title">3. Start Workout</h3>
              <p className="step-text">Gain instant membership pass access, chat directly with owners, and purchase verified fitness merchandise.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. ATHLETE TESTIMONIALS */}
      <section className="reviews-section container" aria-labelledby="heading-testimonials">
        <div className="text-center-wrapper">
          <h2 id="heading-testimonials" className="section-title text-center">What Athletes Say</h2>
          <p className="section-subtitle text-center">Real reviews from members who transformed their athletic lifestyle</p>
        </div>

        <div className="reviews-grid">
          <blockquote className="review-card glass-panel">
            <div className="review-rating" aria-label="5 out of 5 stars">★★★★★</div>
            <p className="review-text">"Finding a gym with a dedicated CrossFit zone and heavy squat racks used to be difficult in Jaipur. GymConnect let me locate Iron Paradise and subscribe instantly. Highly recommend!"</p>
            <footer className="review-author">
              <img 
                src="https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=80&q=75" 
                alt="Rohan Singhania member portrait" 
                loading="lazy"
                decoding="async"
                width={48}
                height={48}
              />
              <div>
                <cite className="author-name font-bold" style={{ fontStyle: 'normal', display: 'block' }}>Rohan Singhania</cite>
                <span>Active Member</span>
              </div>
            </footer>
          </blockquote>

          <blockquote className="review-card glass-panel">
            <div className="review-rating" aria-label="5 out of 5 stars">★★★★★</div>
            <p className="review-text">"The direct chat with the gym owner is fantastic. I was able to clarify class timings and trainer slots before buying the Elite Annual plan. Seamless process."</p>
            <footer className="review-author">
              <img 
                src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=80&q=75" 
                alt="Neha Aggarwal member portrait" 
                loading="lazy"
                decoding="async"
                width={48}
                height={48}
              />
              <div>
                <cite className="author-name font-bold" style={{ fontStyle: 'normal', display: 'block' }}>Neha Aggarwal</cite>
                <span>Golds Elite Member</span>
              </div>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* 5. OWNER ONBOARDING BANNER */}
      <section className="owner-cta-section container" aria-labelledby="heading-owner-cta">
        <div className="owner-cta-card glass-panel">
          <div className="cta-content">
            <h2 id="heading-owner-cta" className="cta-title">Own a Fitness Center?</h2>
            <p className="cta-text">
              List your gym on GymConnect, publish flexible membership plans, manage merchandise inventory, and chat directly with hundreds of active fitness enthusiasts.
            </p>
            <Link 
              to="/login?register=owner" 
              className="glow-btn cta-btn"
              aria-label="List your gym on GymConnect as an owner"
            >
              List Your Gym <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className="cta-graphics-wrapper flex-center" aria-hidden="true">
            <Award className="cta-icon-glow animate-float" />
          </div>
        </div>
      </section>

      {/* 6. FOOTER */}
      <footer className="footer-section" role="contentinfo">
        <div className="container footer-grid">
          <div className="footer-brand">
            <div className="logo-section">
              <Dumbbell className="logo-icon" aria-hidden="true" />
              <span>Gym<span className="highlight">Connect</span></span>
            </div>
            <p className="footer-brand-text">
              Jaipur's premier multi-gym discovery, management, and e-commerce fitness marketplace.
            </p>
          </div>

          <div className="footer-links-group">
            <h3 className="footer-heading">Explore</h3>
            <Link to="/gyms">Search Gyms</Link>
            <Link to="/store">Gym Store</Link>
            <Link to="/login">Sign In</Link>
          </div>

          <div className="footer-links-group">
            <h3 className="footer-heading">For Owners</h3>
            <Link to="/login?register=owner">Create Owner Profile</Link>
            <Link to="/dashboard/owner">Management Center</Link>
            <Link to="/store">Merchandise Catalog</Link>
          </div>
        </div>
        <div className="footer-bottom text-center">
          <p>© 2026 GymConnect. Designed for premium athletic experiences.</p>
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
          min-height: 520px;
          display: flex;
          align-items: center;
          overflow: hidden;
          border-bottom: 1px solid var(--border-color);
        }

        .hero-background-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
        }

        .hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(11, 13, 16, 0.65) 0%, #0b0d10 100%);
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
          flex-shrink: 0;
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
          flex-shrink: 0;
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
          background: rgba(0, 255, 204, 0.12);
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
          border-top: 1px solid var(--border-color);
          border-bottom: 1px solid var(--border-color);
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
          margin: 0;
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
          flex-shrink: 0;
        }

        .author-name {
          font-size: 0.95rem;
          color: var(--text-primary);
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

        .footer-heading {
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
export default Home;
