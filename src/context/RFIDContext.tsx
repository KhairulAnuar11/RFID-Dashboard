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
  statsTrends: {
    tagsToday: { value: number; isPositive: boolean };
    uniqueTags: { value: number; isPositive: boolean };
    activeReaders: { value: number; isPositive: boolean };
  };
  config: SystemConfig;
  isConnected: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  connectionMessage: string;
  dashboardSettings: DashboardSettings | null;
  // NEW: Add autoDetectedDevices property
  autoDetectedDevices: Device[];
  // NEW: Add saveAutoDetectedAsManual function
  saveAutoDetectedAsManual: (device: Device) => Promise<void>;
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
  // NEW: State for auto-detected devices
  const [autoDetectedDevices, setAutoDetectedDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalTagsToday: 0,
    activeReaders: 0,
    uniqueTags: 0,
    errorCount: 0
  });
  const [statsTrends, setStatsTrends] = useState({
    tagsToday: { value: 0, isPositive: true },
    uniqueTags: { value: 0, isPositive: true },
    activeReaders: { value: 0, isPositive: true }
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

  // Update stats periodically and on component mount
  useEffect(() => {
    // Update stats immediately
    updateDashboardStats();
    
    // Update stats every 30 seconds
    const interval = setInterval(() => {
      updateDashboardStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // FIXED: Added explicit type for the parameter
  const normalizeDevice = (d: any): Device => ({
    id: d.id,
    name: d.name,
    type: d.type,
    status: d.status,
    ipAddress: d.ip_address,
    macAddress: d.mac_address,
    location: d.location,
    zone: d.zone,
    signalStrength: d.signal_strength,
    tagsReadToday: d.tags_read_today,
    lastHeartbeat: d.last_heartbeat,
    uptime: d.uptime,
  });

  const loadInitialData = async () => {
    try {
      // Load devices from API
      const devicesResponse = await apiService.getDevices();
      if (devicesResponse.success && devicesResponse.data) {
        const normalizedDevices = devicesResponse.data.map(normalizeDevice);
        setDevices(normalizedDevices);
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

  // NEW: Function to save auto-detected device as manual
  const saveAutoDetectedAsManual = async (device: Device) => {
    try {
      // First, add the device to the database (manual devices)
      const response = await apiService.createDevice(device);
      if (response.success && response.data) {
        // Add to manual devices
        setDevices(prev => [...prev, response.data!]);
        // Remove from auto-detected devices
        setAutoDetectedDevices(prev => prev.filter(d => d.id !== device.id));
        toast.success('Device saved to database');
      } else {
        toast.error('Failed to save device', { description: response.error });
      }
    } catch (error) {
      console.error('[RFID] Failed to save auto-detected device:', error);
      toast.error('Failed to save device');
    }
  };

  const updateDashboardStats = async () => {
    try {
      // Fetch today's stats from backend API
      const statsResponse = await apiService.getDashboardStats();
      if (statsResponse.success && statsResponse.data) {
        setStats({
          totalTagsToday: statsResponse.data.totalTagsToday || 0,
          activeReaders: statsResponse.data.activeReaders || 0,
          uniqueTags: statsResponse.data.uniqueTags || 0,
          errorCount: statsResponse.data.errorCount || 0
        });

        // Fetch yesterday's stats for trend calculation
        try {
          const yesterdayResponse = await apiService.getYesterdayStats();
          if (yesterdayResponse.success && yesterdayResponse.data) {
            const yesterday = yesterdayResponse.data;
            const today = statsResponse.data;

            // Calculate percentage changes
            const tagsChangePercent = yesterday.totalTags > 0
              ? ((today.totalTagsToday - yesterday.totalTags) / yesterday.totalTags) * 100
              : (today.totalTagsToday > 0 ? 100 : 0);

            const uniqueChangePercent = yesterday.uniqueTags > 0
              ? ((today.uniqueTags - yesterday.uniqueTags) / yesterday.uniqueTags) * 100
              : (today.uniqueTags > 0 ? 100 : 0);

            const readersChangePercent = yesterday.activeReaders > 0
              ? ((today.activeReaders - yesterday.activeReaders) / yesterday.activeReaders) * 100
              : (today.activeReaders > 0 ? 100 : 0);

            setStatsTrends({
              tagsToday: {
                value: Math.round(tagsChangePercent * 10) / 10, // Round to 1 decimal
                isPositive: tagsChangePercent >= 0
              },
              uniqueTags: {
                value: Math.round(uniqueChangePercent * 10) / 10,
                isPositive: uniqueChangePercent >= 0
              },
              activeReaders: {
                value: Math.round(readersChangePercent * 10) / 10,
                isPositive: readersChangePercent >= 0
              }
            });
          }
        } catch (trendError) {
          console.warn('[RFID] Failed to calculate trends:', trendError);
        }
      }
    } catch (error) {
      console.error('[RFID] Failed to update stats:', error);
    }
  };

  const addTag = async (tag: RFIDTag) => {
    try {
      // Add to local state
      setTags(prev => {
        const newTags = [tag, ...prev];
        // Keep last 1000 tags in memory
        return newTags.slice(0, 1000);
      });

      // Also save to backend database
      await apiService.saveTags([tag]);
    } catch (error) {
      console.error('[RFID] Failed to save tag to backend:', error);
    }
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
      
      // Setup message handler for tags
      mqttService.onMessage(async (tag: RFIDTag) => {
        await addTag(tag);
      });

      // NEW: Setup message handler for device discovery
      // This would need to be implemented in your mqttService
      // mqttService.onDeviceDiscovery(async (deviceData: any) => {
      //   const device = normalizeDevice(deviceData);
      //   // Check if device already exists in autoDetectedDevices or manual devices
      //   setAutoDetectedDevices(prev => {
      //     const exists = prev.some(d => d.id === device.id) || devices.some(d => d.id === device.id);
      //     if (!exists) {
      //       return [...prev, device];
      //     }
      //     return prev;
      //   });
      // });

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
        statsTrends,
        config,
        dashboardSettings,
        // NEW: Added autoDetectedDevices and saveAutoDetectedAsManual
        autoDetectedDevices,
        saveAutoDetectedAsManual,
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