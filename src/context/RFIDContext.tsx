// RFID Data Context Provider - Production Ready

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { RFIDTag, Device, DashboardStats, SystemConfig, DashboardSettings } from '../types';
import { mqttService, ConnectionStatusCallback } from '../services/realMqttService';
import { apiService } from '../services/apiService';
import { toast } from 'sonner';

interface RFIDContextType {
  tags: RFIDTag[];
  devices: Device[];
  stats: DashboardStats;
  config: SystemConfig;
  isConnected: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  connectionMessage: string;
  dashboardSettings: DashboardSettings | null;
  addTag: (tag: RFIDTag) => void;
  updateDevice: (device: Device) => void;
  deleteDevice: (deviceId: string) => void;
  addDevice: (device: Device) => void;
  updateConfig: (config: Partial<SystemConfig>) => void;
  updateDashboardSettings: (s: Partial<DashboardSettings>) => void;
  connectToMQTT: () => Promise<void>;
  disconnectFromMQTT: () => void;
  refreshData: () => Promise<void>;
  clearTags: () => void;
}

const defaultConfig: SystemConfig = {
  mqttConfig: {
    broker: import.meta.env.VITE_MQTT_BROKER || 'broker.emqx.io',
    port: parseInt(import.meta.env.VITE_MQTT_PORT) || 8083,
    protocol: (import.meta.env.VITE_MQTT_PROTOCOL as 'mqtt' | 'ws' | 'wss') || 'wss',
    username: '',
    password: '',
    topics: ['rfid/readers/+/tags', 'rfid/events', 'rfid/+/data'],
    enabled: true
  },
  dataRetentionDays: parseInt(import.meta.env.VITE_DATA_RETENTION_DAYS) || 30,
  apiKey: 'your-api-key-here',
  autoRefreshInterval: parseInt(import.meta.env.VITE_AUTO_REFRESH_INTERVAL) || 5000
};

const RFIDContext = createContext<RFIDContextType | undefined>(undefined);

export const RFIDProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [tags, setTags] = useState<RFIDTag[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalTagsToday: 0,
    activeReaders: 0,
    uniqueTags: 0,
    errorCount: 0
  });
  const [config, setConfig] = useState<SystemConfig>(() => {
    // Try to load config from localStorage
    const savedConfig = localStorage.getItem('rfid_system_config');
    return savedConfig ? JSON.parse(savedConfig) : defaultConfig;
  });
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting' | 'error'>('disconnected');
  const [connectionMessage, setConnectionMessage] = useState('Not connected');
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings | null>(null);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Save config to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('rfid_system_config', JSON.stringify(config));
  }, [config]);

  // Setup MQTT status change listener
  useEffect(() => {
    const statusCallback: ConnectionStatusCallback = (status, message) => {
      setConnectionStatus(status);
      setConnectionMessage(message || '');
      setIsConnected(status === 'connected');

      // Show toast notifications
      if (status === 'connected') {
        toast.success('MQTT Connected', { description: message });
      } else if (status === 'error') {
        toast.error('MQTT Error', { description: message });
      } else if (status === 'disconnected') {
        toast.info('MQTT Disconnected', { description: message });
      }
    };

    mqttService.onStatusChange(statusCallback);

    return () => {
      mqttService.removeStatusCallback(statusCallback);
    };
  }, []);

  // Update stats when tags or devices change
  useEffect(() => {
    updateDashboardStats();
  }, [tags, devices]);

  const loadInitialData = async () => {
    try {
      // Load devices from API
      const devicesResponse = await apiService.getDevices();
      if (devicesResponse.success && devicesResponse.data) {
        setDevices(devicesResponse.data);
      }

      // Load dashboard stats
      const statsResponse = await apiService.getDashboardStats();
      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }

      // Load dashboard settings
      const settingsResponse = await apiService.getDashboardSettings();
      if (settingsResponse.success && settingsResponse.data) {
        setDashboardSettings(settingsResponse.data);
      }

      // Load recent tags
      const tagsResponse = await apiService.getTags({ limit: 100 });
      if (tagsResponse.success && tagsResponse.data) {
        setTags(tagsResponse.data.tags);
      }
    } catch (error) {
      console.error('[RFID] Failed to load initial data:', error);
    }
  };

  const updateDashboardStats = () => {
    const today = new Date().toDateString();
    const todayTags = tags.filter(t => new Date(t.timestamp).toDateString() === today);
    const uniqueTagIds = new Set(tags.map(t => t.tagId));
    const activeDeviceCount = devices.filter(d => d.status === 'online').length;

    setStats({
      totalTagsToday: todayTags.length,
      activeReaders: activeDeviceCount,
      uniqueTags: uniqueTagIds.size,
      errorCount: devices.filter(d => d.status === 'offline').length
    });
  };

  const addTag = (tag: RFIDTag) => {
    setTags(prev => {
      const newTags = [tag, ...prev];
      // Keep last 1000 tags in memory
      return newTags.slice(0, 1000);
    });
  };

  const updateDevice = async (device: Device) => {
    try {
      const response = await apiService.updateDevice(device.id, device);
      if (response.success) {
        setDevices(prev => prev.map(d => d.id === device.id ? device : d));
        toast.success('Device updated successfully');
      } else {
        toast.error('Failed to update device', { description: response.error });
      }
    } catch (error) {
      console.error('[RFID] Failed to update device:', error);
      toast.error('Failed to update device');
    }
  };

  const deleteDevice = async (deviceId: string) => {
    try {
      const response = await apiService.deleteDevice(deviceId);
      if (response.success) {
        setDevices(prev => prev.filter(d => d.id !== deviceId));
        toast.success('Device deleted successfully');
      } else {
        toast.error('Failed to delete device', { description: response.error });
      }
    } catch (error) {
      console.error('[RFID] Failed to delete device:', error);
      toast.error('Failed to delete device');
    }
  };

  const addDevice = async (device: Device) => {
    try {
      const response = await apiService.createDevice(device);
      if (response.success && response.data) {
        setDevices(prev => [...prev, response.data!]);
        toast.success('Device added successfully');
      } else {
        toast.error('Failed to add device', { description: response.error });
      }
    } catch (error) {
      console.error('[RFID] Failed to add device:', error);
      toast.error('Failed to add device');
    }
  };

  const updateConfig = (newConfig: Partial<SystemConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  };

  const updateDashboardSettings = (s: Partial<DashboardSettings>) => {
    setDashboardSettings(prev => prev ? { ...prev, ...s } : (s as DashboardSettings));
  };

  const connectToMQTT = async () => {
    try {
      toast.info('Connecting to MQTT broker...');
      
      await mqttService.connect({
        broker: config.mqttConfig.broker,
        port: config.mqttConfig.port,
        protocol: config.mqttConfig.protocol,
        username: config.mqttConfig.username,
        password: config.mqttConfig.password,
      });

      // Subscribe to topics
      mqttService.subscribe(config.mqttConfig.topics);
      
      // Setup message handler
      mqttService.onMessage((tag: RFIDTag) => {
        addTag(tag);
      });

      setIsConnected(true);
    } catch (error: any) {
      console.error('[RFID] Failed to connect to MQTT:', error);
      setIsConnected(false);
      toast.error('MQTT Connection Failed', { 
        description: error.message || 'Could not connect to MQTT broker' 
      });
    }
  };

  const disconnectFromMQTT = () => {
    mqttService.disconnect();
    setIsConnected(false);
  };

  const refreshData = async () => {
    await loadInitialData();
    toast.success('Data refreshed');
  };

  const clearTags = () => {
    setTags([]);
    toast.info('Tag history cleared');
  };

  return (
    <RFIDContext.Provider
      value={{
        tags,
        devices,
        stats,
        config,
        dashboardSettings,
        isConnected,
        connectionStatus,
        connectionMessage,
        addTag,
        updateDevice,
        deleteDevice,
        addDevice,
        updateConfig,
        updateDashboardSettings,
        connectToMQTT,
        disconnectFromMQTT,
        refreshData,
        clearTags,
      }}
    >
      {children}
    </RFIDContext.Provider>
  );
};

export const useRFID = () => {
  const context = useContext(RFIDContext);
  if (!context) {
    throw new Error('useRFID must be used within RFIDProvider');
  }
  return context;
};