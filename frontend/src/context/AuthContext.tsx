import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  salary?: number;
  role: 'CUSTOMER' | 'GYM_OWNER' | 'ADMIN' | 'EMPLOYEE';
  avatar?: string;
  gym?: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUserGym: (gym: any) => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize from local storage
  useEffect(() => {
    const storedToken = localStorage.getItem('fithub_token');
    const storedUser = localStorage.getItem('fithub_user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('fithub_token', newToken);
    localStorage.setItem('fithub_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('fithub_token');
    localStorage.removeItem('fithub_user');
    setToken(null);
    setUser(null);
  };

  const updateUserGym = (gym: any) => {
    if (user) {
      const updatedUser = { ...user, gym };
      localStorage.setItem('fithub_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  // Global helper to query backend with correct Bearer header
  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    
    // Fallback to stored token if state hasn't hydrated yet
    const activeToken = token || localStorage.getItem('fithub_token');
    if (activeToken) {
      headers.set('Authorization', `Bearer ${activeToken}`);
    }
    
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers
      });

      const contentType = response.headers.get('content-type');
      let data: any = {};
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { error: text || `Server error (${response.status})` };
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message?.includes('fetch')) {
        throw new Error('Unable to connect to backend server. Please make sure the backend server (port 5000) is running.');
      }
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUserGym, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
