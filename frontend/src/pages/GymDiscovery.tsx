import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { SEO } from '../components/SEO';
import { Search, MapPin, SlidersHorizontal, Map as MapIcon, List as ListIcon, X, Info, Navigation, Loader2, ArrowRight } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Gym {
  id: string;
  name: string;
  description: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  logo: string;
  coverImage: string;
  openingHours: string;
  freeTrialDays?: number;
  plans: Array<{ price: number }>;
  reviews: Array<{ rating: number }>;
  facilities: Array<{ facility: { id: string; name: string } }>;
  distanceKm?: number;
  isFeatured?: boolean;
  isPromoted?: boolean;
  priorityOrder?: number;
}

interface FacilityType {
  id: string;
  name: string;
  icon: string;
}

export const GymDiscovery: React.FC = () => {
  const { apiFetch } = useAuth();
  const { formatPrice } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // States
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [facilitiesList, setFacilitiesList] = useState<FacilityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Filters state mapping to search params
  const searchInput = searchParams.get('search') || '';
  const cityInput = searchParams.get('city') || '';
  const facilityInput = searchParams.get('facility') || '';
  const minPriceInput = searchParams.get('minPrice') || '';
  const maxPriceInput = searchParams.get('maxPrice') || '';
  const minRatingInput = searchParams.get('rating') || '';

  // Map references
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersGroup = useRef<L.LayerGroup | null>(null);

  // Fetch all facilities for selector filter
  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const data = await apiFetch('/api/gyms/facilities/all');
        setFacilitiesList(data || []);
      } catch (err) {
        console.error('Failed to load facilities');
      }
    };
    fetchFacilities();
  }, []);

  // Geolocation states
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);

  // Haversine Distance Calculation Formula
  const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  // Request Customer Location Access
  const handleRequestCustomerLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation({ lat, lng });
        setLocatingUser(false);
      },
      (err) => {
        setLocatingUser(false);
        console.warn('Could not access location:', err.message);
      },
      { enableHighAccuracy: false, timeout: 15000 }
    );
  };

  // Fetch gyms based on params
  useEffect(() => {
    const fetchGyms = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (searchInput) query.append('search', searchInput);
        if (cityInput) query.append('city', cityInput);
        if (facilityInput) query.append('facility', facilityInput);
        if (minPriceInput) query.append('minPrice', minPriceInput);
        if (maxPriceInput) query.append('maxPrice', maxPriceInput);
        if (minRatingInput) query.append('rating', minRatingInput);

        const data: Gym[] = await apiFetch(`/api/gyms?${query.toString()}`);

        if (userLocation) {
          const withDistances = data.map(g => ({
            ...g,
            distanceKm: (g.latitude && g.longitude)
              ? calculateDistanceKm(userLocation.lat, userLocation.lng, g.latitude, g.longitude)
              : undefined
          }));
          withDistances.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
          setGyms(withDistances);
        } else {
          setGyms(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch gyms list');
      } finally {
        setLoading(false);
      }
    };
    fetchGyms();
  }, [searchParams, userLocation]);

  // Leaflet map setup & updates
  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map if it doesn't exist
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([26.9124, 75.7873], 12);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance.current);

      markersGroup.current = L.layerGroup().addTo(mapInstance.current);

      // Fix default icon path issues in bundle
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });
    }

    // Refresh markers whenever gyms list changes
    if (markersGroup.current && mapInstance.current) {
      markersGroup.current.clearLayers();

      // Render User Location Pin if available
      if (userLocation) {
        const userIcon = L.divIcon({
          className: 'custom-user-pin',
          html: `<div style="background:#00f0ff; width:18px; height:18px; border-radius:50%; border:3px solid #0b0d10; box-shadow:0 0 15px #00f0ff; animation: pulse 1.5s infinite;"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
          .bindPopup('<b style="color:#00f0ff;">📍 Your Current Location</b>')
          .addTo(markersGroup.current);
      }

      if (gyms.length > 0) {
        const bounds: L.LatLngTuple[] = [];

        if (userLocation) {
          bounds.push([userLocation.lat, userLocation.lng]);
        }

        gyms.forEach(gym => {
          if (gym.latitude && gym.longitude) {
            const distanceText = gym.distanceKm !== undefined ? `<p style="margin: 0 0 5px 0; font-size: 11px; font-weight: bold; color: #00ffcc;">📍 ${gym.distanceKm} km away</p>` : '';

            const popupContent = `
              <div style="font-family: sans-serif; min-width: 140px;">
                <h4 style="margin: 0 0 5px 0; color: #00ffcc;">${gym.name}</h4>
                ${distanceText}
                <p style="margin: 0 0 10px 0; font-size: 11px; color: #ccc;">${gym.address}</p>
                <a href="/gyms/${gym.id}" style="
                  display: block; 
                  text-align: center;
                  background: #00ffcc; 
                  color: #0b0d10; 
                  padding: 4px 8px; 
                  border-radius: 4px;
                  font-weight: 600;
                  font-size: 11px;
                  text-decoration: none;
                ">View Profile</a>
              </div>
            `;

            const marker = L.marker([gym.latitude, gym.longitude])
              .bindPopup(popupContent);
            
            markersGroup.current?.addLayer(marker);
            bounds.push([gym.latitude, gym.longitude]);
          }
        });

        // Center map to bounds
        if (bounds.length > 0) {
          mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    }
  }, [gyms, mobileView, userLocation]);

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const getAvgRating = (reviews: Gym['reviews']) => {
    if (!reviews || reviews.length === 0) return '5.0';
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  };

  const getStartingPriceNum = (plans: Gym['plans']) => {
    if (!plans || plans.length === 0) return 999;
    return Math.min(...plans.map(p => p.price));
  };

  return (
    <div className="discovery-page-container">
      <SEO 
        title="Find Gyms Near You - Interactive Map & Pricing"
        description="Search, filter, and compare verified fitness centers in Jaipur and other cities. View live amenities, monthly membership prices, and trainer ratings on Leaflet OpenStreetMap."
        canonicalPath="/gyms"
      />

      {/* Search Header */}
      <section className="search-header-container glass-panel" aria-label="Gym search and location filter">
        <div className="discovery-search-row">
          <div className="search-input-wrapper">
            <label htmlFor="discovery-search-field" className="sr-only">Search gyms by title, address, specialties</label>
            <Search className="search-icon" aria-hidden="true" />
            <input 
              id="discovery-search-field"
              name="search"
              type="search" 
              placeholder="Search gyms by title, address, specialties..." 
              value={searchInput}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="search-input-field"
              aria-label="Search gyms by title, address, specialties"
            />
          </div>

          <div className="select-wrapper">
            <label htmlFor="discovery-city-select" className="sr-only">Filter by city</label>
            <MapPin className="select-icon" aria-hidden="true" />
            <select
              id="discovery-city-select"
              name="city"
              value={cityInput}
              onChange={(e) => handleFilterChange('city', e.target.value)}
              className="filter-select"
              aria-label="Filter gyms by city"
            >
              <option value="">All Cities</option>
              <option value="Jaipur">Jaipur</option>
              <option value="Delhi">Delhi</option>
              <option value="Mumbai">Mumbai</option>
              <option value="Bangalore">Bangalore</option>
            </select>
          </div>

          {/* GPS Location access button for customer */}
          <button
            type="button"
            onClick={handleRequestCustomerLocation}
            disabled={locatingUser}
            className="glow-btn near-me-btn flex-center"
            style={{ gap: '0.4rem', whiteSpace: 'nowrap', padding: '0.65rem 1.1rem', fontSize: '0.85rem' }}
            aria-label="Detect GPS coordinates and sort gyms nearest to my location"
          >
            {locatingUser ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Navigation size={16} aria-hidden="true" />}
            {userLocation ? 'Location Active (Nearest First)' : 'Find Gyms Near Me'}
          </button>

          <button 
            onClick={() => setShowFiltersMobile(!showFiltersMobile)} 
            className="filter-toggle-mobile btn-secondary"
            aria-label="Toggle filter options panel"
            aria-expanded={showFiltersMobile}
          >
            <SlidersHorizontal size={18} aria-hidden="true" /> Filters
          </button>
        </div>
      </section>

      {/* Main split viewport */}
      <div className="split-viewport">
        {/* LEFT COLUMN: FILTERS & LISTINGS */}
        <div className={`listings-column ${mobileView === 'list' ? 'active' : ''}`}>
          
          {/* Filters Panel (Desktop Sidebar / Mobile Modal) */}
          <aside className={`filters-sidebar glass-panel ${showFiltersMobile ? 'show' : ''}`} aria-label="Gym search filters">
            <div className="sidebar-header">
              <h3>Filter Options</h3>
              <button 
                onClick={() => setShowFiltersMobile(false)} 
                className="close-filters-btn"
                aria-label="Close filters drawer"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {/* Filter Group: Facilities */}
            <div className="filter-group">
              <label htmlFor="facility-filter-select">Amenities</label>
              <select
                id="facility-filter-select"
                name="facility"
                value={facilityInput}
                onChange={(e) => handleFilterChange('facility', e.target.value)}
                className="form-control"
              >
                <option value="">Any Facility</option>
                {facilitiesList.map(fac => (
                  <option key={fac.id} value={fac.name}>{fac.name}</option>
                ))}
              </select>
            </div>

            {/* Filter Group: Price */}
            <div className="filter-group">
              <span className="filter-group-title" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Price Range (Monthly)</span>
              <div className="price-inputs">
                <label htmlFor="min-price-input" className="sr-only">Minimum monthly price</label>
                <input 
                  id="min-price-input"
                  name="minPrice"
                  type="number" 
                  placeholder="Min" 
                  value={minPriceInput}
                  onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                  className="form-control"
                  aria-label="Minimum price in Rupees"
                />
                <span aria-hidden="true">-</span>
                <label htmlFor="max-price-input" className="sr-only">Maximum monthly price</label>
                <input 
                  id="max-price-input"
                  name="maxPrice"
                  type="number" 
                  placeholder="Max" 
                  value={maxPriceInput}
                  onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                  className="form-control"
                  aria-label="Maximum price in Rupees"
                />
              </div>
            </div>

            {/* Filter Group: Rating */}
            <div className="filter-group">
              <label htmlFor="rating-filter-select">Minimum Rating</label>
              <select
                id="rating-filter-select"
                name="rating"
                value={minRatingInput}
                onChange={(e) => handleFilterChange('rating', e.target.value)}
                className="form-control"
              >
                <option value="">Any Rating</option>
                <option value="4">★★★★☆ &amp; Up</option>
                <option value="4.5">★★★★★ &amp; Up (4.5+)</option>
              </select>
            </div>

            <button 
              onClick={clearFilters} 
              className="btn-secondary clear-filters-btn"
              aria-label="Reset all search filters"
            >
              Reset Filters
            </button>
          </aside>

          {/* List panel */}
          <div className="gyms-list-container">
            {loading ? (
              <div className="list-loading-state" aria-busy="true" aria-label="Loading search results">
                <div className="skeleton-item"></div>
                <div className="skeleton-item"></div>
                <div className="skeleton-item"></div>
              </div>
            ) : gyms.length === 0 ? (
              <div className="empty-results text-center">
                <Info size={48} className="text-muted" aria-hidden="true" />
                <h3>No gyms match your criteria</h3>
                <p>Try widening your search terms or clearing your location filters.</p>
                <button onClick={clearFilters} className="glow-btn" aria-label="Reset all search filters">Reset All Filters</button>
              </div>
            ) : (
              <div className="list-scroll-wrapper">
                <p className="results-count" aria-live="polite">{gyms.length} gyms found near you</p>
                {gyms.map(gym => (
                  <article key={gym.id} className="gym-card-redesign glass-panel">
                    {/* 1. Clickable Image Container */}
                    <Link 
                      to={`/gyms/${gym.id}`} 
                      className="gym-card-image-link"
                      aria-label={`View ${gym.name} profile and facilities`}
                    >
                      <div className="gym-card-image-wrapper">
                        <img 
                          src={gym.coverImage || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=75'} 
                          alt={`${gym.name} facility`} 
                          className="gym-card-cover-img" 
                          loading="lazy"
                          decoding="async"
                          width={280}
                          height={200}
                        />
                        <div className="gym-card-image-overlay">
                          <span className="quick-view-hint">View Profile &rarr;</span>
                        </div>
                        {gym.distanceKm !== undefined && (
                          <span className="image-distance-badge">
                            <Navigation size={11} aria-hidden="true" /> {gym.distanceKm} km away
                          </span>
                        )}
                      </div>
                    </Link>

                    {/* 2. Content Details Section */}
                    <div className="gym-card-content">
                      {/* Header with Logo, Title, Badges */}
                      <div className="gym-card-top">
                        <div className="gym-card-identity">
                          <Link 
                            to={`/gyms/${gym.id}`} 
                            className="gym-card-logo-link"
                            aria-label={`View ${gym.name} logo`}
                          >
                            <img 
                              src={gym.logo || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=80&q=75'} 
                              alt={`${gym.name} logo`} 
                              className="gym-card-logo" 
                              loading="lazy"
                              decoding="async"
                              width={44}
                              height={44}
                            />
                          </Link>
                          <div className="gym-card-headings">
                            <div className="gym-title-row">
                              <Link 
                                to={`/gyms/${gym.id}`} 
                                className="gym-card-title-link"
                                title={`View ${gym.name}`}
                              >
                                <h3 className="gym-card-title">{gym.name}</h3>
                              </Link>
                              {gym.isFeatured && (
                                <span className="status-badge featured-badge">
                                  ★ Featured
                                </span>
                              )}
                              {gym.isPromoted && (
                                <span className="status-badge promoted-badge">
                                  🔥 Promoted
                                </span>
                              )}
                            </div>
                            <p className="gym-card-address" title={`${gym.address}, ${gym.city}`}>
                              <MapPin size={13} className="address-pin-icon" aria-hidden="true" />
                              <span>{gym.address}, {gym.city}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Facilities Badges */}
                      <div className="gym-facilities-row" aria-label="Available amenities">
                        {gym.facilities && gym.facilities.slice(0, 4).map(gf => (
                          <span key={gf.facility.id} className="facility-badge">
                            {gf.facility.name}
                          </span>
                        ))}
                        {gym.facilities && gym.facilities.length > 4 && (
                          <span className="facility-badge-more">
                            +{gym.facilities.length - 4} more
                          </span>
                        )}
                      </div>

                      {/* Footer with Rating, Starting Price, and View Details Button */}
                      <div className="gym-card-bottom">
                        <div className="gym-card-meta">
                          <span className="meta-rating-badge" aria-label={`Rating: ${getAvgRating(gym.reviews)} out of 5 stars`}>
                            ★ {getAvgRating(gym.reviews)}
                          </span>
                          <div className="meta-price-box">
                            <span className="price-prefix">From</span>
                            <span className="price-value">{formatPrice(getStartingPriceNum(gym.plans))}</span>
                            <span className="price-period">/mo</span>
                          </div>
                        </div>

                        <Link 
                          to={`/gyms/${gym.id}`} 
                          className="glow-btn gym-view-details-btn"
                          aria-label={`View details and membership plans for ${gym.name}`}
                        >
                          <span>View Details</span>
                          <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: LEAFLET MAP VIEW */}
        <div className={`map-column ${mobileView === 'map' ? 'active' : ''}`}>
          <div ref={mapRef} id="leaflet-map-discovery" className="leaflet-map-element" role="application" aria-label="Interactive Gym Map"></div>
        </div>
      </div>

      {/* MOBILE TOGGLE FOOTER BAR (Switch between List & Map views) */}
      <div className="mobile-toggle-footer glass-panel">
        <button 
          onClick={() => setMobileView('list')} 
          className={`toggle-tab-btn ${mobileView === 'list' ? 'active' : ''}`}
          aria-label="Switch to gym list view"
        >
          <ListIcon size={18} aria-hidden="true" /> List View
        </button>
        <button 
          onClick={() => setMobileView('map')} 
          className={`toggle-tab-btn ${mobileView === 'map' ? 'active' : ''}`}
          aria-label="Switch to interactive map view"
        >
          <MapIcon size={18} aria-hidden="true" /> Map View
        </button>
      </div>

      {/* STYLES */}
      <style>{`
        .discovery-page-container {
          padding-top: 70px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Search Header */
        .search-header-container {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--border-color);
          z-index: 10;
        }

        .discovery-search-row {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          gap: 1.5rem;
          align-items: center;
        }

        .search-input-wrapper {
          position: relative;
          flex: 2;
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--primary-color);
          width: 18px;
        }

        .search-input-field {
          width: 100%;
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          padding: 0.65rem 1rem 0.65rem 2.5rem;
          color: var(--text-primary);
        }

        .select-wrapper {
          position: relative;
          flex: 1;
        }

        .select-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--primary-color);
          width: 16px;
        }

        .filter-select {
          width: 100%;
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          padding: 0.65rem 1rem 0.65rem 2.5rem;
          color: var(--text-primary);
          cursor: pointer;
        }

        .filter-toggle-mobile {
          display: none;
        }

        /* Split Viewport */
        .split-viewport {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        /* Listings Column */
        .listings-column {
          flex: 1.3;
          display: flex;
          overflow: hidden;
          position: relative;
        }

        /* Filters Sidebar */
        .filters-sidebar {
          width: 250px;
          border-right: 1px solid var(--border-color);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          overflow-y: auto;
          background: var(--bg-color);
        }

        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .sidebar-header h3 {
          font-size: 1.1rem;
        }

        .close-filters-btn {
          display: none;
          color: var(--text-secondary);
        }

        .price-inputs {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .price-inputs input {
          width: 100%;
          text-align: center;
          padding: 0.5rem;
        }

        .clear-filters-btn {
          margin-top: 1rem;
          padding: 0.6rem;
          width: 100%;
          font-size: 0.85rem;
        }

        /* Gyms List Container */
        .gyms-list-container {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .results-count {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: 1rem;
          font-weight: 500;
        }

        /* Gym Card Redesign - Horizontal on Desktop, Vertical on Mobile */
        .gym-card-redesign {
          display: flex;
          flex-direction: row;
          background: var(--bg-surface-elevated, #13171e);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 1.25rem;
          transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          box-sizing: border-box;
          min-height: 200px;
        }

        .gym-card-redesign:hover {
          border-color: rgba(0, 240, 255, 0.45);
          box-shadow: 0 10px 30px rgba(0, 240, 255, 0.12);
          transform: translateY(-2px);
        }

        .gym-card-image-link {
          display: block;
          width: 250px;
          min-width: 250px;
          position: relative;
          overflow: hidden;
          text-decoration: none;
        }

        .gym-card-image-wrapper {
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
        }

        .gym-card-cover-img {
          width: 100%;
          height: 100%;
          min-height: 200px;
          object-fit: cover;
          transition: transform 0.4s ease;
          display: block;
        }

        .gym-card-redesign:hover .gym-card-cover-img {
          transform: scale(1.06);
        }

        .gym-card-image-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%);
          opacity: 0;
          transition: opacity 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gym-card-redesign:hover .gym-card-image-overlay {
          opacity: 1;
        }

        .quick-view-hint {
          color: #ffffff;
          font-size: 0.8rem;
          font-weight: 700;
          padding: 0.35rem 0.85rem;
          background: rgba(0, 240, 255, 0.35);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(0, 240, 255, 0.6);
          border-radius: 20px;
        }

        .image-distance-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          background: rgba(11, 13, 16, 0.88);
          backdrop-filter: blur(8px);
          color: #00f0ff;
          border: 1px solid rgba(0, 240, 255, 0.35);
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.25rem 0.55rem;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 0.3rem;
          z-index: 2;
        }

        /* Content Details */
        .gym-card-content {
          flex: 1;
          min-width: 0;
          padding: 1.25rem 1.4rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .gym-card-identity {
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
        }

        .gym-card-logo-link {
          text-decoration: none;
          flex-shrink: 0;
        }

        .gym-card-logo {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          object-fit: cover;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: #1a1e24;
          display: block;
        }

        .gym-card-headings {
          flex: 1;
          min-width: 0;
        }

        .gym-title-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .gym-card-title-link {
          text-decoration: none;
          color: inherit;
        }

        .gym-card-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #ffffff;
          transition: color 0.2s ease;
          line-height: 1.3;
        }

        .gym-card-title-link:hover .gym-card-title {
          color: #00f0ff;
        }

        .status-badge {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .featured-badge {
          background: rgba(0, 240, 255, 0.15);
          color: #00f0ff;
          border: 1px solid rgba(0, 240, 255, 0.4);
        }

        .promoted-badge {
          background: rgba(255, 183, 3, 0.15);
          color: #ffb703;
          border: 1px solid rgba(255, 183, 3, 0.5);
        }

        .gym-card-address {
          margin: 0.35rem 0 0 0;
          font-size: 0.8rem;
          color: #94a3b8;
          display: flex;
          align-items: flex-start;
          gap: 0.35rem;
          line-height: 1.4;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .address-pin-icon {
          flex-shrink: 0;
          color: #00f0ff;
          margin-top: 2px;
        }

        /* Facilities Badges */
        .gym-facilities-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          align-items: center;
        }

        .facility-badge {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          font-size: 0.72rem;
          font-weight: 500;
          padding: 0.22rem 0.55rem;
          border-radius: 6px;
          white-space: nowrap;
        }

        .facility-badge-more {
          color: #00f0ff;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.2rem 0.4rem;
        }

        /* Bottom Meta Row */
        .gym-card-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          margin-top: auto;
        }

        .gym-card-meta {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          flex-wrap: wrap;
        }

        .meta-rating-badge {
          background: rgba(0, 240, 255, 0.12);
          color: #00f0ff;
          border: 1px solid rgba(0, 240, 255, 0.3);
          font-size: 0.82rem;
          font-weight: 700;
          padding: 0.22rem 0.55rem;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
        }

        .meta-price-box {
          display: inline-flex;
          align-items: baseline;
          gap: 0.25rem;
        }

        .price-prefix {
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .price-value {
          font-size: 1.05rem;
          font-weight: 700;
          color: #ffffff;
        }

        .price-period {
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .gym-view-details-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.55rem 1.15rem;
          font-size: 0.82rem;
          font-weight: 600;
          border-radius: 8px;
          text-decoration: none;
          white-space: nowrap;
          background: linear-gradient(135deg, #00f0ff 0%, #00b4d8 100%);
          color: #0b0d10;
          border: none;
          box-shadow: 0 4px 15px rgba(0, 240, 255, 0.25);
          transition: all 0.2s ease;
        }

        .gym-view-details-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0, 240, 255, 0.4);
          filter: brightness(1.08);
        }

        /* Map Column */
        .map-column {
          flex: 1;
          height: 100%;
          position: relative;
        }

        .leaflet-map-element {
          width: 100%;
          height: 100%;
          z-index: 1;
        }

        /* Mobile footer control */
        .mobile-toggle-footer {
          display: none;
          position: fixed;
          bottom: 64px; /* Above bottom bar */
          left: 0;
          right: 0;
          height: 48px;
          z-index: 100;
          border-top: 1px solid var(--border-color);
          grid-template-columns: 1fr 1fr;
          align-items: center;
        }

        .toggle-tab-btn {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.85rem;
        }

        .toggle-tab-btn.active {
          color: var(--primary-color);
          background: rgba(0, 255, 204, 0.05);
        }

        /* Responsive */
        @media (max-width: 992px) {
          .listings-column {
            flex: 1.1;
          }
          .filters-sidebar {
            width: 200px;
            padding: 1rem;
          }
          .gym-card-image-link {
            width: 210px;
            min-width: 210px;
          }
        }

        @media (max-width: 768px) {
          .discovery-search-row {
            gap: 0.75rem;
          }
          .filter-toggle-mobile {
            display: inline-flex;
            font-size: 0.8rem;
            padding: 0.6rem 0.8rem;
          }
          .select-wrapper {
            display: none; /* Hide city select on mobile header, use filters */
          }

          .gym-card-redesign {
            flex-direction: column;
            min-height: auto;
          }
          .gym-card-image-link {
            width: 100%;
            min-width: 100%;
            height: 190px;
          }
          .gym-card-cover-img {
            min-height: 190px;
            height: 190px;
          }
          .gym-card-content {
            padding: 1.1rem;
            gap: 0.75rem;
          }
          .gym-card-bottom {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
          }
          .gym-view-details-btn {
            padding: 0.5rem 1rem;
            font-size: 0.8rem;
          }

          /* Listings panel toggle logic */
          .listings-column {
            display: none;
            width: 100%;
            height: 100%;
          }
          .listings-column.active {
            display: flex;
          }

          .map-column {
            display: none;
            width: 100%;
            height: 100%;
          }
          .map-column.active {
            display: block;
          }

          /* Mobile Sidebar filters */
          .filters-sidebar {
            position: fixed;
            inset: 0 0 0 auto;
            width: 80%;
            max-width: 320px;
            z-index: 1000;
            display: none;
            box-shadow: -10px 0 30px rgba(0,0,0,0.5);
          }
          .filters-sidebar.show {
            display: flex;
          }
          .close-filters-btn {
            display: block;
          }

          .mobile-toggle-footer {
            display: grid;
          }
          .discovery-page-container {
            padding-bottom: 112px; /* Bottom bar + Mobile toggle */
          }
          .gyms-list-container {
            padding: 1rem;
          }
        }

        @media (max-width: 480px) {
          .gym-card-bottom {
            flex-direction: column;
            align-items: stretch;
            gap: 0.65rem;
          }
          .gym-view-details-btn {
            width: 100%;
            justify-content: center;
          }
        }

        /* Skeletons */
        .list-loading-state {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .skeleton-item {
          height: 200px;
          background: var(--bg-surface-elevated, #13171e);
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          animation: pulse 1.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};
