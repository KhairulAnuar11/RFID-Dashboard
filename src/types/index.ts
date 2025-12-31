// Core Types for RFID Tracking Dashboard

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface RFIDTag {
  id: string;
  tagId: string;
  epc: string;
  rssi: number;
  readerId: string;
  readerName: string;
  timestamp: string;
  readTime?: string;
  read_time?: string;
  antenna: number;
  count: number;
}

export interface Device {
  id: string;
  name: string;
  type: 'reader' | 'antenna';
  status: 'online' | 'offline';
  ipAddress: string;
  macAddress: string;
  location: string;
  zone?: string;
  signalStrength: number;
  lastHeartbeat: string;
  lastSeen?: string;
  discoverySource?: string;
  createdAt?: string;
  coordinates?: {
    x: number;
    y: number;
  };
  tagsReadToday: number;
  uptime: string;
}

export interface DashboardStats {
  totalTagsToday: number;
  activeReaders: number;
  uniqueTags: number;
  errorCount: number;
}

export interface TagActivity {
  time: string;
  count: number;
}

export interface TagsByDevice {
  device: string;
  count: number;
}

export interface MQTTConfig {
  broker: string;
  port: number;
  protocol: 'mqtt' | 'ws' | 'wss';
  username?: string;
  password?: string;
  topics: string[];
  client_id?: string;
  qos?: number;
  enabled: boolean;
}

export interface SystemConfig {
  mqttConfig: MQTTConfig;
  dataRetentionDays: number;
  apiKey: string;
  autoRefreshInterval: number;
}

export interface DashboardSettings {
  tag_dedupe_window_minutes: number;
  device_offline_minutes: number;
  auto_refresh_interval_seconds: number;
}

export interface FilterOptions {
  tagId?: string;
  epc?: string;
  readerId?: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  data: any[];
  filename: string;
  columns?: string[];
}

export interface ZoneHeatmap {
  zone: string;
  count: number;
  coordinates: {
    x: number;
    y: number;
  };
}

export interface DashboardSettings {
  tag_dedupe_window_minutes: number;
  device_offline_minutes: number;
  auto_refresh_interval_seconds: number;
}
