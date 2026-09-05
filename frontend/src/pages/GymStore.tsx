import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { Search, ShoppingBag, ShoppingCart, Tag } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  discount: number;
  stock: number;
  image: string;
  category: string;
  isPromoted?: boolean;
  isFeatured?: boolean;
  gym: { name: string; city: string; upiId?: string; bankAccountNumber?: string; bankIfsc?: string; bankAccountName?: string; bankName?: string; paymentQrCode?: string };
}

export const GymStore: React.FC = () => {
  const { apiFetch } = useAuth();
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();

  // States
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (searchQuery) query.append('search', searchQuery);
      if (selectedCategory !== 'ALL') query.append('category', selectedCategory);

      const data = await apiFetch(`/api/products?${query.toString()}`);
      setProducts(data || []);
    } catch (err) {
      console.error('Failed to load store products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, searchQuery]);

  const getDiscountedPrice = (price: number, discount: number) => {
    return (price * (1 - discount / 100)).toFixed(2);
  };

  return (
    <div className="store-page-container container">
      {/* 1. STORE HERO SEARCH HEADER */}
      <section className="store-hero glass-panel text-center">
        <h1 className="glow-text">GYM<span className="highlight">GO Store</span></h1>
        <p>Premium training accessories, supplements, and workout gear listed directly by gym owners.</p>
        
        <div className="store-search-box">
          <Search className="search-icon" />
          <input 
            type="text" 
            placeholder="Search accessories, protein bars, wrist bands..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-control store-search-input"
          />
        </div>
      </section>

      {/* 2. CATEGORY SELECTOR TABS */}
      <div className="store-categories-row">
        {['ALL', 'EQUIPMENT', 'SUPPLEMENTS', 'ACCESSORIES', 'APPAREL'].map(cat => (
          <button 
            key={cat} 
            onClick={() => setSelectedCategory(cat)}
            className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 3. PRODUCT GRID */}
      {loading ? (
        <div className="loading-grid">
          <div className="skeleton-card" style={{ height: '320px' }}></div>
          <div className="skeleton-card" style={{ height: '320px' }}></div>
          <div className="skeleton-card" style={{ height: '320px' }}></div>
        </div>
      ) : products.length === 0 ? (
        <div className="empty-store flex-center text-center">
          <ShoppingBag size={48} className="text-muted" />
          <h3>No fitness accessories listed</h3>
          <p>Try switching categories or clearing search keywords.</p>
        </div>
      ) : (
        <div className="products-grid-layout">
          {products.map(prod => {
            const finalPrice = getDiscountedPrice(prod.price, prod.discount);
            const hasDiscount = prod.discount > 0;
            const isOutOfStock = prod.stock <= 0;

            return (
              <div key={prod.id} className="product-item-card glass-card">
                <div className="product-image-wrapper">
                  <img src={prod.image} alt={prod.name} className="product-thumbnail" />
                  {prod.isPromoted && (
                    <span className="badge" style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(255, 183, 3, 0.9)', color: '#000', fontWeight: 700, fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '4px', zIndex: 2 }}>
                      🔥 Promoted Ad
                    </span>
                  )}
                  {hasDiscount && (
                    <span className="discount-tag">
                      <Tag size={12} /> {prod.discount}% OFF
                    </span>
                  )}
                  {isOutOfStock && (
                    <div className="out-of-stock-overlay flex-center">
                      <span>Out of Stock</span>
                    </div>
                  )}
                </div>

                <div className="product-details-body">
                  <span className="product-category-label">{prod.category}</span>
                  <h3 className="product-title" title={prod.name}>{prod.name}</h3>
                  <p className="product-source-gym">Sold by: {prod.gym?.name}</p>
                  <p className="product-desc-excerpt">{prod.description.substring(0, 60)}...</p>

                  <div className="product-price-row">
                    {hasDiscount ? (
                      <>
                        <span className="discounted-price">{formatPrice(Number(finalPrice))}</span>
                        <span className="original-price">{formatPrice(prod.price)}</span>
                      </>
                    ) : (
                      <span className="discounted-price">{formatPrice(prod.price)}</span>
                    )}
                  </div>

                  <button 
                    onClick={() => addToCart(prod.id)}
                    disabled={isOutOfStock}
                    className="glow-btn add-to-cart-btn"
                  >
                    <ShoppingCart size={16} /> Add to Cart
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .store-page-container {
          padding-top: 90px;
          padding-bottom: 80px;
        }

        /* Store Hero */
        .store-hero {
          padding: 3rem 1.5rem;
          border-radius: var(--border-radius-lg);
          margin-bottom: 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .store-hero h1 {
          font-size: 2.5rem;
        }

        .store-hero p {
          color: var(--text-secondary);
          max-width: 500px;
          font-size: 0.95rem;
        }

        .store-search-box {
          position: relative;
          width: 100%;
          max-width: 500px;
          margin-top: 1.5rem;
        }

        .store-search-box .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--primary-color);
        }

        .store-search-input {
          padding-left: 2.5rem;
          width: 100%;
        }

        /* Category pills */
        .store-categories-row {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 2.5rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
        }

        .category-pill {
          padding: 0.5rem 1.25rem;
          border-radius: 9999px;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: var(--transition-smooth);
        }

        .category-pill:hover, .category-pill.active {
          border-color: var(--primary-color);
          color: var(--primary-color);
          background: rgba(0, 255, 204, 0.05);
        }

        /* Products Grid */
        .products-grid-layout {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 1.5rem;
        }

        .product-item-card {
          padding: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .product-image-wrapper {
          position: relative;
          height: 180px;
          background: var(--bg-surface-elevated);
          overflow: hidden;
          border-bottom: 1px solid var(--border-color);
        }

        .product-thumbnail {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: var(--transition-smooth);
        }

        .product-item-card:hover .product-thumbnail {
          transform: scale(1.05);
        }

        .discount-tag {
          position: absolute;
          top: 12px;
          left: 12px;
          background: var(--secondary-color);
          color: white;
          padding: 0.2rem 0.5rem;
          font-size: 0.7rem;
          font-weight: 700;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          box-shadow: 0 0 10px var(--secondary-glow);
        }

        .out-of-stock-overlay {
          position: absolute;
          inset: 0;
          background: rgba(11, 13, 16, 0.8);
          color: var(--status-error);
          font-weight: 700;
          font-size: 0.9rem;
          text-transform: uppercase;
        }

        .product-details-body {
          padding: 1.25rem;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .product-category-label {
          font-size: 0.65rem;
          text-transform: uppercase;
          color: var(--text-muted);
          font-weight: 700;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }

        .product-title {
          font-size: 1.05rem;
          margin-bottom: 0.25rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .product-source-gym {
          font-size: 0.75rem;
          color: var(--primary-color);
          margin-bottom: 0.5rem;
        }

        .product-desc-excerpt {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-bottom: 1.25rem;
          min-height: 38px;
        }

        .product-price-row {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }

        .discounted-price {
          font-size: 1.35rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .original-price {
          font-size: 0.85rem;
          text-decoration: line-through;
          color: var(--text-muted);
        }

        .add-to-cart-btn {
          width: 100%;
          justify-content: center;
          padding: 0.6rem;
          font-size: 0.85rem;
          border-radius: var(--border-radius-sm);
        }

        .empty-store {
          padding: 4rem 0;
          flex-direction: column;
          gap: 1rem;
        }

        .loading-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 1.5rem;
        }

        @media (max-width: 768px) {
          .store-hero {
            padding: 2rem 1rem;
          }
          .store-hero h1 {
            font-size: 2rem;
          }
          .products-grid-layout, .loading-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
