import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface Product {
  id: string;
  name: string;
  price: string;
  discount: number;
  image: string;
  gymId: string;
  gym?: { name: string };
}

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: Product;
}

interface CartContextType {
  cartItems: CartItem[];
  cartCount: number;
  totalPrice: number;
  loading: boolean;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  fetchCart: () => Promise<void>;
  clearLocalCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, apiFetch } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchCart = async () => {
    if (!user || user.role !== 'CUSTOMER') {
      setCartItems([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch('/api/orders/cart');
      setCartItems(data?.items || []);
    } catch (err) {
      console.error('Fetch cart error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, [user]);

  const addToCart = async (productId: string, quantity: number = 1) => {
    if (!user) {
      alert('Please log in as a customer to add products to your cart.');
      return;
    }
    if (user.role !== 'CUSTOMER') {
      alert('Only customers can purchase accessories.');
      return;
    }
    try {
      await apiFetch('/api/orders/cart/add', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity })
      });
      await fetchCart();
    } catch (err: any) {
      alert(err.message || 'Failed to add item to cart');
    }
  };

  const removeFromCart = async (cartItemId: string) => {
    try {
      await apiFetch(`/api/orders/cart/item/${cartItemId}`, {
        method: 'DELETE'
      });
      await fetchCart();
    } catch (err: any) {
      alert(err.message || 'Failed to remove item');
    }
  };

  const clearLocalCart = () => {
    setCartItems([]);
  };

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const totalPrice = cartItems.reduce((acc, item) => {
    const originalPrice = parseFloat(item.product.price);
    const discountedPrice = originalPrice * (1 - item.product.discount / 100);
    return acc + discountedPrice * item.quantity;
  }, 0);

  return (
    <CartContext.Provider value={{ cartItems, cartCount, totalPrice, loading, addToCart, removeFromCart, fetchCart, clearLocalCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
