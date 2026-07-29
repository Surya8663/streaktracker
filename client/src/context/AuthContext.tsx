import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, LoginResponse } from '@streaktrack/shared';
import { API_ROUTES } from '@streaktrack/shared';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check current auth status
  const checkAuth = async () => {
    try {
      const res = await fetch(API_ROUTES.AUTH_ME, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to verify session', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(API_ROUTES.AUTH_LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(errorData.message || 'Invalid credentials');
    }

    const data: LoginResponse = await res.json();
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await fetch(API_ROUTES.AUTH_LOGOUT, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
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
