import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types/index.js';
import { api, setAccessToken } from './api.js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  changePassword: (password: string) => Promise<void>;
  refreshSession: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Silent refresh on startup
  const refreshSession = async (): Promise<User | null> => {
    try {
      const response = await api.post('/api/auth/refresh');
      const { accessToken, user: userData } = response.data.data;
      setAccessToken(accessToken);
      setUser(userData);
      return userData;
    } catch {
      setAccessToken(null);
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      await refreshSession();
      setLoading(false);
    };

    initAuth();

    // Listen to session expiration events from Axios interceptor
    const handleSessionExpired = () => {
      setUser(null);
    };

    window.addEventListener('auth_session_expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth_session_expired', handleSessionExpired);
    };
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { accessToken, user: userData } = response.data.data;
      setAccessToken(accessToken);
      setUser(userData);
      return userData;
    } catch (err: any) {
      setAccessToken(null);
      setUser(null);
      throw err.response?.data?.error || new Error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const changePassword = async (password: string): Promise<void> => {
    try {
      await api.post('/api/auth/change-password', { password });
      // Update local user state
      if (user) {
        setUser({ ...user, changePasswordOnFirstLogin: false });
      }
    } catch (err: any) {
      throw err.response?.data?.error || new Error('Password update failed');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, changePassword, refreshSession }}>
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
