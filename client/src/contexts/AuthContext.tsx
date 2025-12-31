/**
 * Authentication Context for user session management.
 *
 * Provides:
 * - Login/logout/register functions
 * - Current user state
 * - Authentication status
 * - Auth mode (single-owner vs multi-user)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_CONFIG } from '../config/api';

export interface User {
  id: number;
  email: string;
  display_name: string;
  is_owner: boolean;
}

export interface AuthStatus {
  auth_mode: 'single' | 'multi';
  authenticated: boolean;
  user: User | null;
  can_register: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authMode: 'single' | 'multi';
  canRegister: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, displayName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getApiBase = () => `${API_CONFIG.PYTHON_BASE_URL}/api/auth`;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'single' | 'multi'>('single');
  const [canRegister, setCanRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch(`${getApiBase()}/status`, {
        credentials: 'include'
      });
      const data: AuthStatus = await response.json();

      setAuthMode(data.auth_mode);
      setCanRegister(data.can_register);

      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to check auth status:', err);
      setUser(null);
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${getApiBase()}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || 'Login failed');
        setIsLoading(false);
        return false;
      }

      if (data.success && data.user) {
        setUser(data.user);
        setIsLoading(false);
        return true;
      }

      setError('Login failed');
      setIsLoading(false);
      return false;
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to connect to server');
      setIsLoading(false);
      return false;
    }
  }, []);

  const register = useCallback(async (
    email: string,
    password: string,
    displayName: string
  ): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${getApiBase()}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, display_name: displayName })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || 'Registration failed');
        setIsLoading(false);
        return false;
      }

      if (data.success && data.user) {
        setUser(data.user);
        setCanRegister(false); // After successful registration in single-owner mode
        setIsLoading(false);
        return true;
      }

      setError('Registration failed');
      setIsLoading(false);
      return false;
    } catch (err) {
      console.error('Register error:', err);
      setError('Failed to connect to server');
      setIsLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${getApiBase()}/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      // Re-check auth status to update canRegister
      await checkAuth();
    }
  }, [checkAuth]);

  const value: AuthContextType = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    authMode,
    canRegister,
    error,
    login,
    register,
    logout,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
