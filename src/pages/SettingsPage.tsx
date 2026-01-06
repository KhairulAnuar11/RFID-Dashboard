// src/pages/SettingsPage.tsx
// Complete merged settings page with MQTT, System Config, Dashboard, User Preferences, and User Management

import React, { useState, useEffect } from 'react';
import { Save, Database, Wifi, Users, Plus, Edit, Trash2, X, Power, RefreshCw, Settings, User as UserIcon, Palette } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useRFID } from '../context/RFIDContext';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
const tabColorClasses: Record<string, string> = {
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-600',
  green: 'bg-green-100 text-green-700 border-green-600',
  blue: 'bg-blue-100 text-blue-700 border-blue-600',
  purple: 'bg-purple-100 text-purple-700 border-purple-600',
  orange: 'bg-orange-100 text-orange-700 border-orange-600',
};


type TabId = 'mqtt' | 'system' | 'dashboard' | 'preferences' | 'users';

interface SystemConfig {
  db_connection_limit: number;
  mqtt_reconnect_period_ms: number;
  mqtt_connect_timeout_ms: number;
  mqtt_keepalive_sec: number;
  jwt_expires_in: string;
  data_retention_days: number;
  default_page_size: number;
  device_offline_check_interval_sec: number;
}

interface UserPreferences {
  theme: string;
  default_page_size: number;
  auto_refresh_enabled: boolean;
  auto_refresh_interval_sec: number;
  default_map_zoom: number;
  desktop_notifications: boolean;
}

export const SettingsPage: React.FC = () => {
  const { config, updateConfig, isConnected, connectToMQTT, disconnectFromMQTT, connectionStatus, connectionMessage, dashboardSettings, updateDashboardSettings } = useRFID();
  const { isAdmin } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabId>('mqtt');
  
  // MQTT Configuration
  const [mqttConfig, setMqttConfig] = useState(config.mqttConfig);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // System Configuration
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  
  // Dashboard Settings
  const [dashboardSettingsState, setDashboardSettingsState] = useState({
    tag_dedupe_window_minutes: dashboardSettings?.tag_dedupe_window_minutes ?? 5,
    device_offline_minutes: dashboardSettings?.device_offline_minutes ?? 5,
    auto_refresh_interval_seconds: dashboardSettings?.auto_refresh_interval_seconds ?? 30
  });
  
  // User Preferences
  const [userPrefs, setUserPrefs] = useState<UserPreferences | null>(null);
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);
  
  // User Management
  const [users, setUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(true);

  const loadUsers = async () => {
    try {
      const resp = await apiService.getUsers();
      if (resp.success && resp.data) {
        setUsers(resp.data);
      }
    } catch (err) {
      console.error('[Settings] Error loading users:', err);
      toast.error('Failed to load users');
    }
  };

  // Load all configurations on mount
  useEffect(() => {
    loadConfigurations();
    if (isAdmin()) {
      loadUsers();
    }
  }, []);

 const loadConfigurations = async () => {
  try {
    // Dashboard settings
    const dashResp = await apiService.getDashboardSettings();
    if (dashResp.error === 'BACKEND_OFFLINE') {
      setBackendAvailable(false);
      return;
    }
    if (dashResp.success && dashResp.data) {
      setDashboardSettingsState(dashResp.data);
    }

    // System config (admin only)
    if (isAdmin()) {
      setIsLoadingConfig(true);
      const sysResp = await apiService.getSystemConfig();
      if (sysResp.error === 'BACKEND_OFFLINE') {
        setBackendAvailable(false);
        return;
      }
      if (sysResp.success && sysResp.data) {
        setSystemConfig(sysResp.data);
      }
      setIsLoadingConfig(false);
    }

    // User preferences
    setIsLoadingPrefs(true);
    const prefResp = await apiService.getUserPreferences();
    if (prefResp.error === 'BACKEND_OFFLINE') {
      setBackendAvailable(false);
      return;
    }
    if (prefResp.success && prefResp.data) {
      setUserPrefs(prefResp.data);
    }
    setIsLoadingPrefs(false);

  } catch (error) {
    console.error('[Settings] Failed to load configurations:', error);
    toast.error('Failed to load settings');
    setIsLoadingConfig(false);
    setIsLoadingPrefs(false);
  }
};

  // Save handlers for each tab
  const handleSaveMQTT = async () => {
    setIsSaving(true);
    try {
      // Update local config
      updateConfig({ mqttConfig });
      
      // Save to backend
      const response = await apiService.saveMQTTConfig(mqttConfig);
      if (response.success) {
        toast.success('MQTT configuration saved successfully!');
      } else {
        toast.error('Failed to save MQTT config', { description: response.error });
      }
    } catch (error) {
      console.error('[Settings] MQTT save error', error);
      toast.error('Failed to save MQTT configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSystem = async () => {
    if (!systemConfig) return;
    
    setIsSaving(true);
    try {
      const response = await apiService.updateSystemConfig(systemConfig);
      if (response.success) {
        toast.success('System configuration saved successfully!');
        
        // Show restart warning for certain settings
        if (systemConfig.db_connection_limit) {
          toast.info('⚠️ Some changes require a server restart to take effect', { duration: 5000 });
        }
      } else {
        toast.error('Failed to save system config', { description: response.error });
      }
    } catch (error) {
      console.error('[Settings] System save error', error);
      toast.error('Failed to save system configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDashboard = async () => {
    setIsSaving(true);
    try {
      const response = await apiService.updateDashboardSettings(dashboardSettingsState);
      if (response.success) {
        updateDashboardSettings(dashboardSettingsState);
        toast.success('Dashboard settings saved successfully!');
      } else {
        toast.error('Failed to save dashboard settings', { description: response.error });
      }
    } catch (error) {
      console.error('[Settings] Dashboard save error', error);
      toast.error('Failed to save dashboard settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!userPrefs) return;
    
    setIsSaving(true);
    try {
      const response = await apiService.updateUserPreferences(userPrefs);
      if (response.success) {
        toast.success('Your preferences saved successfully!');
      } else {
        toast.error('Failed to save preferences', { description: response.error });
      }
    } catch (error) {
      console.error('[Settings] Preferences save error', error);
      toast.error('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  // MQTT Connection handlers
  const handleMQTTConnect = async () => {
    setIsConnecting(true);
    try {
      updateConfig({ mqttConfig });
      await connectToMQTT();
    } catch (error) {
      console.error('MQTT connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleMQTTDisconnect = () => {
    disconnectFromMQTT();
  };

  const handleTestConnection = async () => {
    toast.info('Testing MQTT connection...');
    try {
      const response = await apiService.testMQTTConnection({
        broker: mqttConfig.broker,
        port: mqttConfig.port,
        protocol: mqttConfig.protocol,
        username: mqttConfig.username,
        password: mqttConfig.password,
      });
      
      if (response.success) {
        toast.success('Connection test successful!');
      } else {
        toast.error('Connection test failed', { description: response.error });
      }
    } catch (error) {
      toast.error('Connection test failed');
    }
  };

  // User management handlers
  const handleAddUser = () => {
    setEditingUser(null);
    setShowUserModal(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowUserModal(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    const response = await apiService.deleteUser(userId);
    if (response.success) {
      toast.success('User deleted successfully');
      loadUsers();
    } else {
      toast.error('Failed to delete user', { description: response.error });
    }
  };

  // Tab configuration
  const tabs = [
    { id: 'mqtt' as TabId, label: 'MQTT Settings', icon: Wifi, color: 'indigo' },
    ...(isAdmin() ? [{ id: 'system' as TabId, label: 'System Config', icon: Settings, color: 'green' }] : []),
    { id: 'dashboard' as TabId, label: 'Dashboard', icon: Database, color: 'blue' },
    { id: 'preferences' as TabId, label: 'My Preferences', icon: UserIcon, color: 'purple' },
    ...(isAdmin() ? [{ id: 'users' as TabId, label: 'User Management', icon: Users, color: 'orange' }] : [])
  ];

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600 bg-green-100';
      case 'reconnecting': return 'text-orange-600 bg-orange-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get appropriate save handler for current tab
  const handleSave = () => {
    switch (activeTab) {
      case 'mqtt':
        handleSaveMQTT();
        break;
      case 'system':
        handleSaveSystem();
        break;
      case 'dashboard':
        handleSaveDashboard();
        break;
      case 'preferences':
        handleSavePreferences();
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <Header title="Settings & Configuration" />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Navigation */}
        <div className="w-96 border-r border-gray-200 bg-white overflow-y-auto">
          <nav className="p-4 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${
                    activeTab === tab.id
                      ? `${tabColorClasses[tab.color]} border-l-4`
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="size-5 flex-shrink-0" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>



        {/* Main Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          {/* MQTT Settings Tab */}
          {activeTab === 'mqtt' && (
            <MQTTSettingsTab
              mqttConfig={mqttConfig}
              setMqttConfig={setMqttConfig}
              isConnected={isConnected}
              isConnecting={isConnecting}
              connectionStatus={connectionStatus}
              connectionMessage={connectionMessage}
              getConnectionStatusColor={getConnectionStatusColor}
              handleMQTTConnect={handleMQTTConnect}
              handleMQTTDisconnect={handleMQTTDisconnect}
              handleTestConnection={handleTestConnection}
            />
          )}

          {/* System Configuration Tab (Admin Only) */}
          {activeTab === 'system' && isAdmin() && (
            <>
              {isLoadingConfig ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading system configuration...</p>
                  </div>
                </div>
              ) : systemConfig ? (
                <SystemConfigTab
                  systemConfig={systemConfig}
                  setSystemConfig={setSystemConfig}
                />
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-3xl">
                  <p className="text-red-600">Failed to load system configuration. Please try refreshing the page.</p>
                </div>
              )}
            </>
          )}

          {/* Dashboard Settings Tab */}
          {activeTab === 'dashboard' && (
            <DashboardSettingsTab
              dashboardSettings={dashboardSettingsState}
              setDashboardSettings={setDashboardSettingsState}
            />
          )}

          {/* User Preferences Tab */}
          {activeTab === 'preferences' && (
            <>
              {isLoadingPrefs ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading your preferences...</p>
                  </div>
                </div>
              ) : userPrefs ? (
                <UserPreferencesTab
                  userPrefs={userPrefs}
                  setUserPrefs={setUserPrefs}
                />
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-3xl">
                  <p className="text-red-600">Failed to load preferences. Please try refreshing the page.</p>
                </div>
              )}
            </>
          )}

          {/* User Management Tab (Admin Only) */}
          {activeTab === 'users' && isAdmin() && (
            <UserManagementTab
              users={users}
              handleAddUser={handleAddUser}
              handleEditUser={handleEditUser}
              handleDeleteUser={handleDeleteUser}
            />
          )}

          {/* Save Button (for all tabs except user management) */}
          {activeTab !== 'users' && (
            <div className="flex gap-4 mt-6 max-w-3xl">
              <button
                onClick={handleSave}
                disabled={isSaving || !backendAvailable}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="size-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button 
                onClick={() => {
                  loadConfigurations();
                  toast.info('Changes discarded');
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* User Modal */}
      <AnimatePresence>
        {showUserModal && (
          <UserModal
            user={editingUser}
            onClose={() => setShowUserModal(false)}
            onSave={() => {
              setShowUserModal(false);
              loadUsers();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// TAB COMPONENTS
// ============================================

const MQTTSettingsTab: React.FC<any> = ({
  mqttConfig,
  setMqttConfig,
  isConnected,
  isConnecting,
  connectionStatus,
  connectionMessage,
  getConnectionStatusColor,
  handleMQTTConnect,
  handleMQTTDisconnect,
  handleTestConnection
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-lg border border-gray-200 p-6 max-w-3xl"
  >
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <Wifi className="size-6 text-indigo-600" />
        <h2 className="text-xl text-gray-900">MQTT Broker Configuration</h2>
      </div>
      
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${getConnectionStatusColor()}`}>
        <div className={`size-2 rounded-full ${isConnected ? 'bg-green-600 animate-pulse' : 'bg-gray-400'}`} />
        {connectionStatus === 'connected' ? 'Connected' : 
         connectionStatus === 'reconnecting' ? 'Reconnecting...' : 
         connectionStatus === 'error' ? 'Error' : 'Disconnected'}
      </div>
    </div>

    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-700 mb-2">Broker Address</label>
          <input
            type="text"
            value={mqttConfig.broker}
            onChange={(e) => setMqttConfig({ ...mqttConfig, broker: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="broker.emqx.io"
            disabled={isConnected}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-2">Port</label>
          <input
            type="number"
            value={mqttConfig.port}
            onChange={(e) => setMqttConfig({ ...mqttConfig, port: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isConnected}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-700 mb-2">Protocol</label>
        <select
          value={mqttConfig.protocol}
          onChange={(e) => setMqttConfig({ ...mqttConfig, protocol: e.target.value as any })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={isConnected}
        >
          <option value="mqtt">MQTT (TCP)</option>
          <option value="ws">WebSocket (WS)</option>
          <option value="wss">WebSocket Secure (WSS)</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Use 'wss' for secure browser connections (recommended for production)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-700 mb-2">Username (optional)</label>
          <input
            type="text"
            value={mqttConfig.username}
            onChange={(e) => setMqttConfig({ ...mqttConfig, username: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isConnected}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-2">Password (optional)</label>
          <input
            type="password"
            value={mqttConfig.password}
            onChange={(e) => setMqttConfig({ ...mqttConfig, password: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isConnected}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-700 mb-2">MQTT Topics (one per line)</label>
        <textarea
          value={mqttConfig.topics.join('\n')}
          onChange={(e) => setMqttConfig({ 
            ...mqttConfig, 
            topics: e.target.value.split('\n').filter(t => t.trim()) 
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
          rows={5}
          placeholder="rfid/readers/+/tags&#10;rfid/events&#10;rfid/+/data"
          disabled={isConnected}
        />
        <p className="text-xs text-gray-500 mt-1">
          Supports MQTT wildcards: + (single level), # (multi-level)
        </p>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600 mb-2">Connection URL Preview:</p>
        <code className="block px-4 py-3 bg-gray-100 rounded-lg text-sm font-mono">
          {mqttConfig.protocol}://{mqttConfig.broker}:{mqttConfig.port}
        </code>
      </div>

      {connectionMessage && (
        <div className={`p-3 rounded-lg text-sm ${
          connectionStatus === 'connected' ? 'bg-green-50 text-green-700' :
          connectionStatus === 'error' ? 'bg-red-50 text-red-700' :
          'bg-blue-50 text-blue-700'
        }`}>
          {connectionMessage}
        </div>
      )}

      <div className="flex gap-3 pt-4">
        {!isConnected ? (
          <>
            <button
              onClick={handleMQTTConnect}
              disabled={isConnecting}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Power className="size-4" />
              {isConnecting ? 'Connecting...' : 'Connect to MQTT'}
            </button>
            <button
              onClick={handleTestConnection}
              className="flex items-center gap-2 px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <RefreshCw className="size-4" />
              Test Connection
            </button>
          </>
        ) : (
          <button
            onClick={handleMQTTDisconnect}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Power className="size-4" />
            Disconnect
          </button>
        )}
      </div>
    </div>
  </motion.div>
);

const SystemConfigTab: React.FC<any> = ({ systemConfig, setSystemConfig }) => {
  const handleChange = (field: string, value: any) => {
    setSystemConfig({ ...systemConfig, [field]: value });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg border border-gray-200 p-6 max-w-3xl"
    >
      <div className="flex items-center gap-3 mb-6">
        <Settings className="size-6 text-green-600" />
        <div>
          <h2 className="text-xl text-gray-900">System Configuration</h2>
          <p className="text-sm text-gray-600">Global settings that affect all users</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Database Settings */}
        <section>
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Database className="size-5 text-indigo-600" />
            Database & Connection Pool
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Connection Limit
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={systemConfig.db_connection_limit}
                onChange={(e) => handleChange('db_connection_limit', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Max concurrent database connections (requires restart)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                JWT Token Expiration
              </label>
              <select
                value={systemConfig.jwt_expires_in}
                onChange={(e) => handleChange('jwt_expires_in', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="1h">1 Hour</option>
                <option value="8h">8 Hours</option>
                <option value="24h">24 Hours</option>
                <option value="7d">7 Days</option>
                <option value="30d">30 Days</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                How long users stay logged in
              </p>
            </div>
          </div>
        </section>

        {/* MQTT Tuning */}
        <section>
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Wifi className="size-5 text-green-600" />
            MQTT Connection Tuning
          </h3>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reconnect Period (ms)
              </label>
              <input
                type="number"
                min="1000"
                max="60000"
                step="1000"
                value={systemConfig.mqtt_reconnect_period_ms}
                onChange={(e) => handleChange('mqtt_reconnect_period_ms', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">Time between reconnects</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Connect Timeout (ms)
              </label>
              <input
                type="number"
                min="5000"
                max="60000"
                step="5000"
                value={systemConfig.mqtt_connect_timeout_ms}
                onChange={(e) => handleChange('mqtt_connect_timeout_ms', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">Connection timeout</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Keepalive (seconds)
              </label>
              <input
                type="number"
                min="10"
                max="300"
                step="10"
                value={systemConfig.mqtt_keepalive_sec}
                onChange={(e) => handleChange('mqtt_keepalive_sec', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">MQTT keepalive</p>
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section>
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Database className="size-5 text-purple-600" />
            Data Management
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Retention (days)
              </label>
              <input
                type="number"
                min="7"
                max="365"
                value={systemConfig.data_retention_days}
                onChange={(e) => handleChange('data_retention_days', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">Auto-archive data older than N days</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Page Size
              </label>
              <select
                value={systemConfig.default_page_size}
                onChange={(e) => handleChange('default_page_size', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="20">20 rows</option>
                <option value="50">50 rows</option>
                <option value="100">100 rows</option>
                <option value="200">200 rows</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Default records per page</p>
            </div>
          </div>
        </section>

        {/* Performance */}
        <section>
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="size-5 text-orange-600" />
            Performance & Monitoring
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Device Offline Check Interval (seconds)
            </label>
            <input
              type="number"
              min="10"
              max="300"
              step="10"
              value={systemConfig.device_offline_check_interval_sec}
              onChange={(e) => handleChange('device_offline_check_interval_sec', parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-xs text-gray-500 mt-1">How often to check device status</p>
          </div>
        </section>

        {/* Warning */}
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            ⚠️ <strong>Note:</strong> Some settings (like database connection limit) require a server restart to take effect.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const DashboardSettingsTab: React.FC<any> = ({ dashboardSettings, setDashboardSettings }) => {
  const handleChange = (field: string, value: any) => {
    setDashboardSettings({ ...dashboardSettings, [field]: value });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg border border-gray-200 p-6 max-w-3xl"
    >
      <div className="flex items-center gap-3 mb-6">
        <Database className="size-6 text-blue-600" />
        <div>
          <h2 className="text-xl text-gray-900">Dashboard Settings</h2>
          <p className="text-sm text-gray-600">Configure dashboard behavior and data processing</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tag Deduplication Window (minutes)
            </label>
            <input
              type="number"
              value={dashboardSettings.tag_dedupe_window_minutes}
              onChange={(e) => handleChange('tag_dedupe_window_minutes', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={1}
            />
            <p className="text-xs text-gray-500 mt-1">
              Window to deduplicate repeated tag reads from the same reader
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Device Offline Threshold (minutes)
            </label>
            <input
              type="number"
              value={dashboardSettings.device_offline_minutes}
              onChange={(e) => handleChange('device_offline_minutes', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={1}
            />
            <p className="text-xs text-gray-500 mt-1">
              Time without heartbeat before marking device offline
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Auto Refresh Interval (seconds)
            </label>
            <input
              type="number"
              value={dashboardSettings.auto_refresh_interval_seconds}
              onChange={(e) => handleChange('auto_refresh_interval_seconds', parseInt(e.target.value) || 10)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={1}
            />
            <p className="text-xs text-gray-500 mt-1">
              How often dashboard data auto-refreshes
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Tips</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Lower deduplication window = more tag reads counted</li>
            <li>• Higher offline threshold = more tolerance for network issues</li>
            <li>• Lower refresh interval = more real-time but higher server load</li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
};

const UserPreferencesTab: React.FC<any> = ({ userPrefs, setUserPrefs }) => {
  const handleChange = (field: string, value: any) => {
    setUserPrefs({ ...userPrefs, [field]: value });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg border border-gray-200 p-6 max-w-3xl"
    >
      <div className="flex items-center gap-3 mb-6">
        <UserIcon className="size-6 text-purple-600" />
        <div>
          <h2 className="text-xl text-gray-900">Personal Preferences</h2>
          <p className="text-sm text-gray-600">Customize your dashboard experience</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Appearance */}
        <section>
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Palette className="size-5 text-pink-600" />
            Appearance
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
            <div className="flex gap-3">
              {['light', 'dark', 'auto'].map((theme) => (
                <button
                  key={theme}
                  onClick={() => handleChange('theme', theme)}
                  className={`flex-1 px-4 py-3 border-2 rounded-lg transition-all ${
                    userPrefs.theme === theme
                      ? 'border-purple-600 bg-purple-50 text-purple-900 font-medium'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Auto mode follows your system preference
            </p>
          </div>
        </section>

        {/* Dashboard Behavior */}
        <section>
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Database className="size-5 text-blue-600" />
            Dashboard Behavior
          </h3>
          <div className="space-y-4">
            {/* Auto-Refresh Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Auto-Refresh</p>
                <p className="text-sm text-gray-600">Automatically update dashboard data</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={userPrefs.auto_refresh_enabled}
                  onChange={(e) => handleChange('auto_refresh_enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {/* Refresh Interval */}
            {userPrefs.auto_refresh_enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Refresh Interval (seconds)
                </label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  step="5"
                  value={userPrefs.auto_refresh_interval_sec}
                  onChange={(e) => handleChange('auto_refresh_interval_sec', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lower values provide more real-time updates
                </p>
              </div>
            )}

            {/* Page Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Page Size
              </label>
              <select
                value={userPrefs.default_page_size}
                onChange={(e) => handleChange('default_page_size', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="10">10 rows</option>
                <option value="20">20 rows</option>
                <option value="50">50 rows</option>
                <option value="100">100 rows</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Number of rows to display per page in tables
              </p>
            </div>
          </div>
        </section>

        {/* Location Map */}
        <section>
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Database className="size-5 text-green-600" />
            Location Map
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Zoom Level
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={userPrefs.default_map_zoom}
              onChange={(e) => handleChange('default_map_zoom', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-sm text-gray-600 mt-2">
              <span>Zoomed Out (0.5x)</span>
              <span className="font-medium text-purple-600">{userPrefs.default_map_zoom.toFixed(1)}x</span>
              <span>Zoomed In (2x)</span>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <UserIcon className="size-5 text-orange-600" />
            Notifications
          </h3>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Desktop Notifications</p>
              <p className="text-sm text-gray-600">Show browser notifications for important events</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={userPrefs.desktop_notifications}
                onChange={(e) => handleChange('desktop_notifications', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>
        </section>
      </div>
    </motion.div>
  );
};

const UserManagementTab: React.FC<any> = ({ users, handleAddUser, handleEditUser, handleDeleteUser }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-lg border border-gray-200 p-6"
  >
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <Users className="size-6 text-orange-600" />
        <div>
          <h2 className="text-xl text-gray-900">User Management</h2>
          <p className="text-sm text-gray-600">Manage system users and permissions</p>
        </div>
      </div>
      <button 
        onClick={handleAddUser}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <Plus className="size-4" />
        Add User
      </button>
    </div>

    <div className="space-y-4">
      {users.map((user: User) => (
        <motion.div
          key={user.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="size-12 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-indigo-600 font-semibold uppercase">
                {user.username.substring(0, 2)}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900">{user.username}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium uppercase ${
              user.role === 'admin' 
                ? 'bg-purple-100 text-purple-700' 
                : 'bg-blue-100 text-blue-700'
            }`}>
              {user.role}
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => handleEditUser(user)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Edit user"
              >
                <Edit className="size-4 text-gray-600" />
              </button>
              <button 
                onClick={() => handleDeleteUser(user.id)}
                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete user"
              >
                <Trash2 className="size-4 text-red-600" />
              </button>
            </div>
          </div>
        </motion.div>
      ))}

      {users.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Users className="size-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600">No users found</p>
          <p className="text-sm text-gray-400 mt-1">Click "Add User" to create a new user account</p>
        </div>
      )}
    </div>
  </motion.div>
);

// ============================================
// USER MODAL COMPONENT
// ============================================

const UserModal: React.FC<{
  user: User | null;
  onClose: () => void;
  onSave: () => void;
}> = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    role: user?.role || 'user',
    password: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (user) {
        const response = await apiService.updateUser(user.id, {
          username: formData.username,
          email: formData.email,
          role: formData.role as 'admin' | 'user',
        });
        
        if (response.success) {
          toast.success('User updated successfully');
          onSave();
        } else {
          toast.error('Failed to update user', { description: response.error });
        }
      } else {
        const response = await apiService.createUser({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role as 'admin' | 'user',
        });
        
        if (response.success) {
          toast.success('User created successfully');
          onSave();
        } else {
          toast.error('Failed to create user', { description: response.error });
        }
      }
    } catch (error) {
      toast.error('Operation failed');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg max-w-md w-full shadow-xl"
      >
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {user ? 'Edit User' : 'Add New User'}
          </h2>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="size-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {!user && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                minLength={6}
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Admins have full system access
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSaving ? 'Saving...' : user ? 'Update User' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};