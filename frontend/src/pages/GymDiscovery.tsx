import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { Search, MapPin, SlidersHorizontal, Map as MapIcon, List as ListIcon, X, Info, Navigation, Loader2 } from 'lucide-react';
import L from 'leaflet';

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
      {/* Search Header */}
      <section className="search-header-container glass-panel">
        <div className="discovery-search-row">
          <div className="search-input-wrapper">
            <Search className="search-icon" />
            <input 
              type="text" 
              placeholder="Search gyms by title, address, specialties..." 
              value={searchInput}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="search-input-field"
            />
          </div>

          <div className="select-wrapper">
            <MapPin className="select-icon" />
            <select
              value={cityInput}
              onChange={(e) => handleFilterChange('city', e.target.value)}
              className="filter-select"
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
          >
            {locatingUser ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
            {userLocation ? 'Location Active (Nearest First)' : 'Find Gyms Near Me'}
          </button>

          <button 
            onClick={() => setShowFiltersMobile(!showFiltersMobile)} 
            className="filter-toggle-mobile btn-secondary"
          >
            <SlidersHorizontal size={18} /> Filters
          </button>
        </div>
      </section>

      {/* Main split viewport */}
      <div className="split-viewport">
        {/* LEFT COLUMN: FILTERS & LISTINGS */}
        <div className={`listings-column ${mobileView === 'list' ? 'active' : ''}`}>
          
          {/* Filters Panel (Desktop Sidebar / Mobile Modal) */}
          <aside className={`filters-sidebar glass-panel ${showFiltersMobile ? 'show' : ''}`}>
            <div className="sidebar-header">
              <h3>Filter Options</h3>
              <button 
                onClick={() => setShowFiltersMobile(false)} 
                className="close-filters-btn"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter Group: Facilities */}
            <div className="filter-group">
              <label>Amenities</label>
              <select
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
              <label>Price Range (Monthly)</label>
              <div className="price-inputs">
                <input 
                  type="number" 
                  placeholder="Min" 
                  value={minPriceInput}
                  onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                  className="form-control"
                />
                <span>-</span>
                <input 
                  type="number" 
                  placeholder="Max" 
                  value={maxPriceInput}
                  onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                  className="form-control"
                />
              </div>
            </div>

            {/* Filter Group: Rating */}
            <div className="filter-group">
              <label>Minimum Rating</label>
              <select
                value={minRatingInput}
                onChange={(e) => handleFilterChange('rating', e.target.value)}
                className="form-control"
              >
                <option value="">Any Rating</option>
                <option value="4">★★★★☆ & Up</option>
                <option value="4.5">★★★★★ & Up (4.5+)</option>
              </select>
            </div>

            <button onClick={clearFilters} className="btn-secondary clear-filters-btn">
              Reset Filters
            </button>
          </aside>

          {/* List panel */}
          <div className="gyms-list-container">
            {loading ? (
              <div className="list-loading-state">
                <div className="skeleton-item"></div>
                <div className="skeleton-item"></div>
                <div className="skeleton-item"></div>
              </div>
            ) : gyms.length === 0 ? (
              <div className="empty-results text-center">
                <Info size={48} className="text-muted" />
                <h3>No gyms match your criteria</h3>
                <p>Try widening your search terms or clearing your location filters.</p>
                <button onClick={clearFilters} className="glow-btn">Reset All Filters</button>
              </div>
            ) : (
              <div className="list-scroll-wrapper">
                <p className="results-count">{gyms.length} gyms found near you</p>
                {gyms.map(gym => (
                  <div key={gym.id} className="gym-list-row-card glass-panel">
                    <img src={gym.coverImage} alt={gym.name} className="list-card-cover" />
                    <div className="list-card-details">
                      <div className="list-card-header">
                        <img src={gym.logo} alt="Logo" className="list-card-logo" />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <h3 className="list-card-title" style={{ margin: 0 }}>{gym.name}</h3>
                            {gym.isFeatured && (
                              <span className="badge" style={{ background: 'rgba(0, 255, 204, 0.15)', color: '#00ffcc', border: '1px solid rgba(0, 255, 204, 0.3)', fontSize: '0.65rem' }}>
                                ⭐ Featured Gym
                              </span>
                            )}
                            {gym.isPromoted && (
                              <span className="badge" style={{ background: 'rgba(255, 183, 3, 0.15)', color: '#ffb703', border: '1px solid #ffb703', fontSize: '0.65rem' }}>
                                🔥 Promoted Ad
                              </span>
                            )}
                          </div>
                          <p className="list-card-address">
                            <MapPin size={12} /> {gym.address}, {gym.city}
                            {gym.distanceKm !== undefined && (
                              <span className="distance-badge-tag">
                                <Navigation size={10} /> {gym.distanceKm} km away
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="facilities-pills">
                        {gym.facilities.slice(0, 4).map(gf => (
                          <span key={gf.facility.id} className="pill">{gf.facility.name}</span>
                        ))}
                        {gym.facilities.length > 4 && (
                          <span className="pill-more">+{gym.facilities.length - 4} more</span>
                        )}
                      </div>

                      <div className="list-card-footer">
                        <div>
                          <span className="rating-tag">★ {getAvgRating(gym.reviews)}</span>
                          <span className="starting-price">Starts at {formatPrice(getStartingPriceNum(gym.plans))}/mo</span>
                        </div>
                        <Link to={`/gyms/${gym.id}`} className="glow-btn view-btn">
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: LEAFLET MAP VIEW */}
        <div className={`map-column ${mobileView === 'map' ? 'active' : ''}`}>
          <div ref={mapRef} id="leaflet-map-discovery" className="leaflet-map-element"></div>
        </div>
      </div>

      {/* MOBILE TOGGLE FOOTER BAR (Switch between List & Map views) */}
      <div className="mobile-toggle-footer glass-panel">
        <button 
          onClick={() => setMobileView('list')} 
          className={`toggle-tab-btn ${mobileView === 'list' ? 'active' : ''}`}
        >
          <ListIcon size={18} /> List View
        </button>
        <button 
          onClick={() => setMobileView('map')} 
          className={`toggle-tab-btn ${mobileView === 'map' ? 'active' : ''}`}
        >
          <MapIcon size={18} /> Map View
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

        .gym-list-row-card {
          display: flex;
          border-radius: var(--border-radius-md);
          overflow: hidden;
          margin-bottom: 1.5rem;
          transition: var(--transition-smooth);
          height: 180px;
        }

        .gym-list-row-card:hover {
          border-color: var(--primary-color);
        }

        .list-card-cover {
          width: 200px;
          object-fit: cover;
        }

        .list-card-details {
          flex: 1;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .list-card-header {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .list-card-logo {
          width: 40px;
          height: 40px;
          border-radius: var(--border-radius-sm);
          object-fit: cover;
          border: 1px solid var(--border-color);
        }

        .list-card-title {
          font-size: 1.1rem;
        }

        .list-card-address {
          font-size: 0.75rem;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 0.2rem;
          flex-wrap: wrap;
        }

        .distance-badge-tag {
          background: rgba(0, 240, 255, 0.15);
          color: #00f0ff;
          font-weight: 700;
          font-size: 0.7rem;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          margin-left: 0.5rem;
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
          border: 1px solid rgba(0, 240, 255, 0.3);
        }

        .facilities-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin: 0.5rem 0;
        }

        .facilities-pills .pill {
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          font-size: 0.7rem;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
        }

        .facilities-pills .pill-more {
          color: var(--primary-color);
          font-size: 0.7rem;
          align-self: center;
          font-weight: 600;
        }

        .list-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.5rem;
        }

        .rating-tag {
          background: rgba(0, 255, 204, 0.15);
          color: var(--primary-color);
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-weight: 700;
          font-size: 0.8rem;
          margin-right: 0.75rem;
        }

        .starting-price {
          font-size: 0.85rem;
          font-weight: 600;
        }

        .view-btn {
          padding: 0.4rem 1rem;
          font-size: 0.8rem;
          border-radius: var(--border-radius-sm);
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
          .gym-list-row-card {
            flex-direction: column;
            height: auto;
          }
          .list-card-cover {
            width: 100%;
            height: 120px;
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

        /* Skeletons */
        .list-loading-state {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .skeleton-item {
          height: 180px;
          background: var(--bg-surface-elevated);
          border-radius: var(--border-radius-md);
          animation: pulse 1.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};
