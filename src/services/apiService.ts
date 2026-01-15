/// <reference types="vite/client" />

// API Service Layer for backend communication
// Complete merged version with all configuration endpoints
// Ready for production deployment with environment configuration

import { RFIDTag, Device, User, DashboardStats } from '../types';

// Fetch from window.location for dynamic API URL
const API_URL = `${window.location.protocol}//${window.location.hostname}:3001/api`;
const BACKEND_OPTIONAL = import.meta.env.VITE_BACKEND_OPTIONAL === 'true';

interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class APIService {
  private baseURL: string;
  private timeout: number;

  constructor(baseURL: string, timeout: number) {
    this.baseURL = baseURL;
    this.timeout = timeout;
  }

  /**
   * Generic HTTP request handler
   */
private async request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<APIResponse<T>> {
  const token = this.getAuthToken();
  const url = `${this.baseURL}${endpoint}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message };
    }

    return { success: true, data: data.data ?? data };

  } catch (error: any) {
    // 🔥 IMPORTANT: Handle backend-down case
    if (error.name === 'TypeError') {
      console.warn('[API] Backend unavailable');
      return {
        success: false,
        error: 'BACKEND_OFFLINE'
      };
    }

    return {
      success: false,
      error: error.message || 'Request failed'
    };
  }
}

  /**
   * GET request
   */
  private async get<T>(endpoint: string): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * POST request
   */
  private async post<T>(endpoint: string, body?: any): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * PUT request
   */
  private async put<T>(endpoint: string, body?: any): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * DELETE request
   */
  private async delete<T>(endpoint: string): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * Get auth token from localStorage
   */
  private getAuthToken(): string | null {
    return localStorage.getItem('rfid_auth_token');
  }

  // ==================== Authentication API ====================

  async login(username: string, password: string): Promise<APIResponse<{ user: User; token: string }>> {
    return this.post('/auth/login', { username, password });
  }

  async logout(): Promise<APIResponse> {
    return this.post('/auth/logout');
  }

  async refreshToken(): Promise<APIResponse<{ token: string }>> {
    return this.post('/auth/refresh');
  }

  async getCurrentUser(): Promise<APIResponse<User>> {
    return this.get('/auth/me');
  }

  // ==================== RFID Tags API ====================

  async getTags(params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    readerId?: string;
    tagId?: string;
    search?: string;
  }): Promise<APIResponse<{ tags: RFIDTag[]; total: number; page: number; totalPages: number }>> {
    const queryParams = new URLSearchParams(params as any).toString();
    return this.get(`/tags?${queryParams}`);
  }

  async saveTags(tags: RFIDTag[]): Promise<APIResponse> {
    return this.post(`/tags`, { tags });
  }

  async getTagById(id: string): Promise<APIResponse<RFIDTag>> {
    return this.get(`/tags/${id}`);
  }

  async deleteTag(id: string): Promise<APIResponse> {
    return this.delete(`/tags/${id}`);
  }

  async bulkDeleteTags(ids: string[]): Promise<APIResponse> {
    return this.post('/tags/bulk-delete', { ids });
  }

  async exportTags(params?: {
    format: 'csv' | 'excel' | 'pdf';
    startDate?: string;
    endDate?: string;
    readerId?: string;
  }): Promise<APIResponse<{ downloadUrl: string }>> {
    return this.post('/tags/export', params);
  }

  // ==================== Devices API ====================

  async getDevices(): Promise<APIResponse<Device[]>> {
    return this.get('/devices');
  }

  async getDeviceById(id: string): Promise<APIResponse<Device>> {
    return this.get(`/devices/${id}`);
  }

  async createDevice(device: Omit<Device, 'id'>): Promise<APIResponse<Device>> {
    return this.post('/devices', device);
  }

  async updateDevice(id: string, device: Partial<Device>): Promise<APIResponse<Device>> {
    return this.put(`/devices/${id}`, device);
  }

  async deleteDevice(id: string): Promise<APIResponse> {
    return this.delete(`/devices/${id}`);
  }

  async getDeviceStats(id: string): Promise<APIResponse<{
    tagsReadToday: number;
    tagsReadThisWeek: number;
    averageRSSI: number;
    uptime: string;
  }>> {
    return this.get(`/devices/${id}/stats`);
  }

  // ==================== Dashboard API ====================

  async getDashboardStats(): Promise<APIResponse<DashboardStats>> {
    return this.get('/dashboard/stats');
  }

  async getYesterdayStats(): Promise<APIResponse<{
    totalTags: number;
    uniqueTags: number;
    activeReaders: number;
  }>> {
    return this.get('/dashboard/stats-yesterday');
  }

  async getDashboardSettings(): Promise<APIResponse<{
    tag_dedupe_window_minutes: number;
    device_offline_minutes: number;
    auto_refresh_interval_seconds: number;
  }>> {
    return this.get('/settings/dashboard');
  }

  async updateDashboardSettings(body: {
    tag_dedupe_window_minutes: number;
    device_offline_minutes: number;
    auto_refresh_interval_seconds: number;
  }): Promise<APIResponse<any>> {
    return this.put('/settings/dashboard', body);
  }

  async getTagActivity(period: '24h' | '7d' | '30d' = '24h'): Promise<APIResponse<{
    time: string;
    count: number;
  }[]>> {
    return this.get(`/dashboard/activity?period=${period}`);
  }

  async getTagsByDevice(): Promise<APIResponse<{
    device: string;
    count: number;
  }[]>> {
    return this.get('/dashboard/tags-by-device');
  }

  async getZoneHeatmap(): Promise<APIResponse<{
    zone: string;
    count: number;
    coordinates: { x: number; y: number };
  }[]>> {
    return this.get('/dashboard/heatmap');
  }

  // ==================== MQTT Configuration API ====================

async getMQTTConfig(): Promise<APIResponse<{
  broker: string;
  port: number;
  protocol: string;
  username: string;
  clientId: string;  // Changed from client_id to clientId
  topics: string[];
  qos: number;
  enabled: boolean;
  hasPassword: boolean;
  updatedAt?: string;  // Added
  reconnectPeriodMs?: number;  // Added
  connectTimeoutMs?: number;  // Added
  keepaliveSec?: number;  // Added
  cleanSession?: boolean;  // Added
}>> {
  return this.get('/settings/mqtt');
}

async saveMQTTConfig(config: {
  broker: string;
  port: number;
  protocol: string;
  username?: string;
  password?: string;
  client_id?: string;  // Make sure this matches backend
  topics: string[];
  qos?: number;
  enabled: boolean;
}): Promise<APIResponse> {
  return this.put('/settings/mqtt', config);
}

  async testMQTTConnection(config: {
    broker: string;
    port: number;
    protocol: string;
    username?: string;
    password?: string;
    client_id?: string;
  }): Promise<APIResponse<{ connected: boolean; message: string; status?: string }>> {
    return this.post('/settings/mqtt/test', config);
  }

  async getMQTTStatus(): Promise<APIResponse<{
    status: 'connected' | 'reconnecting' | 'disconnected' | 'error';
    message?: string;
    uptime?: number;
    lastError?: string;
  }>> {
    return this.get('/settings/mqtt/status');
  }

  async getMQTTDebug(): Promise<APIResponse<any>> {
    return this.get('/settings/mqtt/debug');
  }

  // ==================== System Configuration API (Admin Only) ====================

  async getSystemConfig(): Promise<APIResponse<{
    db_connection_limit: number;
    db_queue_limit?: number;
    mqtt_reconnect_period_ms: number;
    mqtt_connect_timeout_ms: number;
    mqtt_keepalive_sec: number;
    mqtt_clean_session?: boolean;
    jwt_expires_in: string;
    session_timeout_minutes?: number;
    data_retention_days: number;
    cleanup_interval_hours?: number;
    default_page_size: number;
    max_page_size?: number;
    device_offline_check_interval_sec: number;
    stats_cache_duration_sec?: number;
    log_level?: string;
  }>> {
    return this.get('/config');
  }

  async updateSystemConfig(config: Partial<{
    db_connection_limit: number;
    db_queue_limit: number;
    mqtt_reconnect_period_ms: number;
    mqtt_connect_timeout_ms: number;
    mqtt_keepalive_sec: number;
    mqtt_clean_session: boolean;
    jwt_expires_in: string;
    data_retention_days: number;
    cleanup_interval_hours: number;
    default_page_size: number;
    max_page_size: number;
    device_offline_check_interval_sec: number;
  }>): Promise<APIResponse> {
    return this.put('/config', config);
  }

  // ==================== User Preferences API ====================

  async getUserPreferences(): Promise<APIResponse<any>> {
    return this.get('/user/preferences');
  }

  async updateUserPreferences(preferences: any): Promise<APIResponse<any>> {
    return this.put('/user/preferences', preferences);
  }

  // ==================== Frontend Configuration API (Public) ====================

  async getFrontendConfig(): Promise<APIResponse<{
    app_name: string;
    app_version: string;
    company_name: string;
    support_email: string;
    primary_color: string;
    features: {
      location_map: boolean;
      analytics: boolean;
      export: boolean;
    };
  }>> {
    return this.get('/config');
  }

  async updateFrontendConfig(config: Partial<{
    app_name: string;
    company_name: string;
    support_email: string;
    primary_color: string;
    enable_location_map: boolean;
    enable_analytics: boolean;
    enable_export: boolean;
  }>): Promise<APIResponse> {
    return this.put('/settings/frontend', config);
  }

  // ==================== User Management API ====================


  async getUsers(): Promise<APIResponse<User[]>> {
    return this.get('/users');
  }

  async getUserById(id: string): Promise<APIResponse<User>> {
    return this.get(`/users/${id}`);
  }

  async createUser(user: {
    username: string;
    email: string;
    password: string;
    role: 'admin' | 'user';
  }): Promise<APIResponse<User>> {
    return this.post('/users', user);
  }

  async updateUser(id: string, user: Partial<User>): Promise<APIResponse<User>> {
    return this.put(`/users/${id}`, user);
  }

  async deleteUser(id: string): Promise<APIResponse> {
    return this.delete(`/users/${id}`);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<APIResponse> {
    return this.post(`/users/${userId}/change-password`, {
      oldPassword,
      newPassword,
    });
  }

  // ==================== Analytics API ====================

  async getReaderPerformance(readerId?: string, period: '24h' | '7d' | '30d' = '24h'): Promise<APIResponse<{
    readerId: string;
    readerName: string;
    tagsRead: number;
    averageRSSI: number;
    uptime: number;
  }[]>> {
    const params = readerId ? `?readerId=${readerId}&period=${period}` : `?period=${period}`;
    return this.get(`/analytics/reader-performance${params}`);
  }

  async getTagHistory(tagId: string, limit: number = 100): Promise<APIResponse<RFIDTag[]>> {
    return this.get(`/analytics/tag-history/${tagId}?limit=${limit}`);
  }

  // ==================== Analytics Endpoints ====================

  async getWeeklyTrends(): Promise<APIResponse<any[]>> {
    return this.get('/analytics/weekly-trends');
  }

  async getAntennaStats(): Promise<APIResponse<any[]>> {
    return this.get('/analytics/antenna-stats');
  }

  async getHourlyPatterns(): Promise<APIResponse<any[]>> {
    return this.get('/analytics/hourly-patterns');
  }

  async getAssetsByLocation(): Promise<APIResponse<any[]>> {
    return this.get('/analytics/assets-by-location');
  }

  async getTopTags(days: number = 30, limit: number = 10): Promise<APIResponse<any[]>> {
    return this.get(`/analytics/top-tags?days=${days}&limit=${limit}`);
  }

  async getDevicePerformance(): Promise<APIResponse<any[]>> {
    return this.get('/analytics/device-performance');
  }

  async getDailyTrends(days: number = 30): Promise<APIResponse<any[]>> {
    return this.get(`/analytics/daily-trends?days=${days}`);
  }

  // ==================== Health Check ====================

  async healthCheck(): Promise<APIResponse<{
    status: 'healthy' | 'unhealthy';
    database: boolean;
    mqtt: boolean;
    uptime: number;
  }>> {
    return this.get('/health');
  }

  // Add to your apiService.ts file in the appropriate section (add after existing methods)

// ==================== Help & Support API ====================

async getHelpDocumentation(): Promise<APIResponse<any[]>> {
  return this.get('/help/documentation');
}

async getTroubleshootingGuide(): Promise<APIResponse<any>> {
  return this.get('/help/troubleshooting-guide');
}

async sendSupportEmail(formData: FormData): Promise<APIResponse> {
  // Create a custom request for FormData
  const token = this.getAuthToken();
  const url = `${this.baseURL}/help/support-email`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || data.error || 'Failed to send support email' };
    }

    return { success: true, data: data.data ?? data };

  } catch (error: any) {
    if (error.name === 'TypeError') {
      console.warn('[API] Backend unavailable');
      return {
        success: false,
        error: 'BACKEND_OFFLINE'
      };
    }

    return {
      success: false,
      error: error.message || 'Request failed'
    };
  }
}
}

// Export singleton instance
export const apiService = new APIService(API_URL, 30000);
export default apiService;