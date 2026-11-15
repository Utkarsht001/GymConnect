import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { SEO } from '../components/SEO';
import { ShoppingCart, Trash2, MapPin, Phone, CreditCard, ChevronLeft } from 'lucide-react';

export const Cart: React.FC = () => {
  const { cartItems, totalPrice, removeFromCart, clearLocalCart } = useCart();
  const { apiFetch } = useAuth();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();

  // States
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;
    if (!address || !phone) {
      alert('Please fill out the shipping address and phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ address, phone })
      });
      alert('Order placed successfully! Check your dashboard for updates.');
      clearLocalCart();
      navigate('/dashboard/customer');
    } catch (err: any) {
      alert(err.message || 'Order checkout failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDiscountedPrice = (price: string, discount: number) => {
    const original = parseFloat(price);
    return (original * (1 - discount / 100)).toFixed(2);
  };

  if (cartItems.length === 0) {
    return (
      <div className="cart-page-container container text-center empty-cart-view flex-center">
        <SEO title="Shopping Cart - Empty" canonicalPath="/cart" noindex={true} />
        <ShoppingCart size={64} className="text-muted" aria-hidden="true" />
        <h2>Your Shopping Cart is Empty</h2>
        <p>Browse our gym store for high quality athletic gear and supplements.</p>
        <Link to="/store" className="glow-btn" aria-label="Browse the gym store">
          Go to Store
        </Link>
      </div>
    );
  }

  return (
    <div className="cart-page-container container">
      <SEO title="Shopping Cart & Checkout" canonicalPath="/cart" noindex={true} />
      <Link to="/store" className="back-link" aria-label="Return to store and continue shopping">
        <ChevronLeft size={16} aria-hidden="true" /> Continue Shopping
      </Link>
      <h1 className="cart-title">Your Cart</h1>

      <div className="cart-checkout-layout">
        {/* Left Column: Cart Items */}
        <div className="cart-items-section">
          {cartItems.map(item => (
            <div key={item.id} className="cart-item-row glass-panel">
              <img 
                src={item.product.image || 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=150&q=75'} 
                alt={`${item.product.name} product photo`} 
                className="cart-item-thumb" 
                loading="lazy"
                decoding="async"
                width={64}
                height={64}
              />
              
              <div className="cart-item-details">
                <h3 className="cart-item-name">{item.product.name}</h3>
                <p className="cart-item-gym">Sold by: {item.product.gym?.name}</p>
                <div className="cart-item-meta">
                  <span className="cart-item-qty">Qty: {item.quantity}</span>
                  <span className="cart-item-price">
                    ₹{getDiscountedPrice(item.product.price, item.product.discount)}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => removeFromCart(item.id)}
                className="cart-item-delete-btn"
                title="Remove item"
                aria-label={`Remove ${item.product.name} from shopping cart`}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        {/* Right Column: Checkout Form */}
        <aside className="checkout-summary-section glass-panel" aria-label="Order summary and shipping form">
          <h3>Order Summary</h3>
          
          <div className="summary-row">
            <span>Items count:</span>
            <span>{cartItems.reduce((acc, item) => acc + item.quantity, 0)}</span>
          </div>
          <div className="summary-row total-row">
            <span>Total Price:</span>
            <span className="highlight">{formatPrice(totalPrice)}</span>
          </div>

          <form onSubmit={handlePlaceOrder} className="checkout-form" aria-label="Customer Checkout Details">
            <div className="form-group">
              <label htmlFor="checkout-address"><MapPin size={14} aria-hidden="true" /> Shipping Address</label>
              <textarea 
                id="checkout-address"
                name="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter complete house number, street address, area pincode..."
                rows={3}
                className="form-control"
                required
                autoComplete="street-address"
              ></textarea>
            </div>

            <div className="form-group">
              <label htmlFor="checkout-phone"><Phone size={14} aria-hidden="true" /> Contact Phone</label>
              <input 
                id="checkout-phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 99887 76655"
                className="form-control"
                required
                autoComplete="tel"
              />
            </div>

            <div className="payment-notice glass-card" style={{ padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-color)', fontWeight: 600, marginBottom: '0.4rem' }}>
                <CreditCard size={18} aria-hidden="true" />
                <span>Direct Seller Payout &amp; Checkout</span>
              </div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                Pay directly via seller's UPI / Bank / QR code or select Cash on Delivery. Order status will be updated by gym owner upon dispatch.
              </p>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="glow-btn checkout-submit-btn"
              aria-label={isSubmitting ? 'Placing your order...' : 'Confirm and place order'}
            >
              {isSubmitting ? 'Placing Order...' : 'Confirm & Place Order'}
            </button>
          </form>
        </aside>
      </div>

      <style>{`
        .cart-page-container {
          padding-top: 90px;
          padding-bottom: 80px;
        }

        .back-link {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          color: var(--text-secondary);
          font-size: 0.85rem;
          margin-bottom: 1rem;
          font-weight: 500;
        }

        .back-link:hover {
          color: var(--primary-color);
        }

        .cart-title {
          font-size: 2rem;
          margin-bottom: 2rem;
        }

        .cart-checkout-layout {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 2rem;
          align-items: start;
        }

        /* Items Column */
        .cart-items-section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .cart-item-row {
          display: flex;
          align-items: center;
          padding: 1.25rem;
          border-radius: var(--border-radius-md);
          gap: 1.25rem;
        }

        .cart-item-thumb {
          width: 80px;
          height: 80px;
          border-radius: var(--border-radius-sm);
          object-fit: cover;
          border: 1px solid var(--border-color);
        }

        .cart-item-details {
          flex: 1;
        }

        .cart-item-name {
          font-size: 1.05rem;
          margin-bottom: 0.2rem;
        }

        .cart-item-gym {
          font-size: 0.75rem;
          color: var(--primary-color);
          margin-bottom: 0.5rem;
        }

        .cart-item-meta {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .cart-item-qty {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .cart-item-price {
          font-weight: 700;
          color: var(--text-primary);
        }

        .cart-item-delete-btn {
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
          padding: 0.5rem;
        }

        .cart-item-delete-btn:hover {
          color: var(--status-error);
        }

        /* Summary Column */
        .checkout-summary-section {
          padding: 2rem;
          border-radius: var(--border-radius-md);
        }

        .checkout-summary-section h3 {
          font-size: 1.25rem;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 0.5rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin-bottom: 0.75rem;
        }

        .total-row {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          border-top: 1px solid var(--border-color);
          padding-top: 0.75rem;
          margin-top: 0.75rem;
          margin-bottom: 2rem;
        }

        .checkout-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .checkout-form label {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .payment-notice {
          padding: 1rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          line-height: 1.4;
        }

        .checkout-submit-btn {
          width: 100%;
          justify-content: center;
          padding: 0.75rem;
          border-radius: var(--border-radius-sm);
        }

        .empty-cart-view {
          padding: 5rem 0;
          flex-direction: column;
          gap: 1.5rem;
          height: 70vh;
        }

        @media (max-width: 992px) {
          .cart-checkout-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
