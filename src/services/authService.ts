// Production Authentication Service with Real API Integration

import { User } from '../types';
import { apiService } from './apiService';

interface LoginCredentials {
  username: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}

class AuthService {
  private readonly TOKEN_KEY = 'rfid_auth_token';
  private readonly USER_KEY = 'rfid_user';

  /**
   * Login with credentials
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await apiService.login(credentials.username, credentials.password);
      
      if (response.success && response.data) {
        const { user, token } = response.data;
        
        // Store in localStorage
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        
        return {
          success: true,
          user,
          token,
          message: 'Login successful'
        };
      } else {
        return {
          success: false,
          message: response.error || 'Login failed'
        };
      }
    } catch (error) {
      console.error('[Auth] Login error:', error);
      return {
        success: false,
        message: 'Network error. Please try again.'
      };
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    } finally {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
  }

  /**
   * Get current user from localStorage
   */
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getCurrentUser();
  }

  /**
   * Check if user has admin role
   */
  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'admin';
  }

  /**
   * Refresh token
   */
  async refreshToken(): Promise<string | null> {
    try {
      const response = await apiService.refreshToken();
      
      if (response.success && response.data) {
        const newToken = response.data.token;
        localStorage.setItem(this.TOKEN_KEY, newToken);
        return newToken;
      }
      
      return null;
    } catch (error) {
      console.error('[Auth] Token refresh error:', error);
      return null;
    }
  }

  /**
   * Update user data in localStorage (after profile update)
   */
  updateUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  /**
   * Validate token expiration
   */
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      // Decode JWT payload (without verification - just check expiration)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      return Date.now() >= expirationTime;
    } catch {
      return true;
    }
  }

  /**
   * Auto-refresh token if expiring soon (within 5 minutes)
   */
  async checkAndRefreshToken(): Promise<void> {
    const token = this.getToken();
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000;
      const timeUntilExpiry = expirationTime - Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (timeUntilExpiry < fiveMinutes && timeUntilExpiry > 0) {
        await this.refreshToken();
      }
    } catch (error) {
      console.error('[Auth] Token check error:', error);
    }
  }
}

export const authService = new AuthService();