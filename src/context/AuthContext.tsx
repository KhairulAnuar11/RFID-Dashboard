// Authentication Context Provider

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthState } from '../types';
import { authService } from '../services/authService';

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false
  });

  // Check for existing session on mount
  useEffect(() => {
    const user = authService.getCurrentUser();
    const token = authService.getToken();
    
    if (user && token) {
      setAuthState({
        user,
        token,
        isAuthenticated: true
      });
    }
  }, []);

  const login = async (username: string, password: string) => {
    const response = await authService.login({ username, password });
    
    if (response.success && response.user && response.token) {
      setAuthState({
        user: response.user,
        token: response.token,
        isAuthenticated: true
      });
    }
    
    return {
      success: response.success,
      message: response.message
    };
  };

  const logout = () => {
    authService.logout();
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false
    });
  };

  const isAdmin = () => {
    return authState.user?.role === 'admin';
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
