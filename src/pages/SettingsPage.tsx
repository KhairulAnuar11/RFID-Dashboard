import React, { useState } from 'react';
import { Save, Database, Wifi, Key, Users, Plus, Edit, Trash2, X, Power, RefreshCw } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useRFID } from '../context/RFIDContext';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';

export const SettingsPage: React.FC = () => {
  const { config, updateConfig, isConnected, connectToMQTT, disconnectFromMQTT, connectionStatus, connectionMessage, dashboardSettings, updateDashboardSettings } = useRFID();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'mqtt' | 'system' | 'dashboard' | 'users'>('mqtt');
  const [mqttConfig, setMqttConfig] = useState(config.mqttConfig);
  const [systemConfig, setSystemConfig] = useState({
    dataRetentionDays: config.dataRetentionDays,
    apiKey: config.apiKey,
    autoRefreshInterval: config.autoRefreshInterval
  });
  const [dashboardSettingsState, setDashboardSettingsState] = useState({
    tag_dedupe_window_minutes: dashboardSettings?.tag_dedupe_window_minutes ?? 5,
    device_offline_minutes: dashboardSettings?.device_offline_minutes ?? 5,
    auto_refresh_interval_seconds: dashboardSettings?.auto_refresh_interval_seconds ?? 30
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load users for admin
  React.useEffect(() => {
    if (isAdmin()) {
      loadUsers();
    }

    // Load dashboard settings
    (async () => {
      const resp = await apiService.getDashboardSettings();
      if (resp.success && resp.data) {
        setDashboardSettingsState(resp.data);
      }
    })();
  }, []);

  const loadUsers = async () => {
    const response = await apiService.getUsers();
    if (response.success && response.data) {
      setUsers(response.data);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Update local config
      updateConfig({
        mqttConfig,
        ...systemConfig
      });

      // Save system config to backend
      await apiService.updateSystemConfig({
        mqttConfig,
        ...systemConfig
      });

      // Save dashboard settings (admin only)
      if (isAdmin()) {
        const dsBody = {
          tag_dedupe_window_minutes: dashboardSettingsState.tag_dedupe_window_minutes,
          device_offline_minutes: dashboardSettingsState.device_offline_minutes,
          auto_refresh_interval_seconds: dashboardSettingsState.auto_refresh_interval_seconds
        };

        const resp = await apiService.updateDashboardSettings(dsBody);
        if (resp.success) {
          // update context so UI reacts live
          updateDashboardSettings(dsBody);
        } else {
          toast.error('Failed to save dashboard settings', { description: resp.error });
        }
      }

      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('[Settings] save error', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMQTTConnect = async () => {
    setIsConnecting(true);
    try {
      // Save config first
      updateConfig({ mqttConfig });
      
      // Connect to MQTT
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
      
      if (response.success && response.data?.connected) {
        toast.success('Connection test successful!');
      } else {
        toast.error('Connection test failed', { description: response.data?.message });
      }
    } catch (error) {
      toast.error('Connection test failed');
    }
  };

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

  const tabs = [
    { id: 'mqtt', label: 'MQTT Settings', icon: Wifi },
    { id: 'system', label: 'System Config', icon: Database },
    { id: 'dashboard', label: 'Dashboard Settings', icon: Database },
    ...(isAdmin() ? [{ id: 'users', label: 'User Management', icon: Users }] : [])
  ];

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600 bg-green-100';
      case 'reconnecting': return 'text-orange-600 bg-orange-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <Header title="Settings & Configuration" />
      
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all $\{
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* MQTT Settings */}
        {activeTab === 'mqtt' && (
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
              
              {/* Connection Status */}
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

              {/* Connection Controls */}
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
        )}

        {/* System Configuration */}
        {activeTab === 'system' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg border border-gray-200 p-6 max-w-3xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <Database className="size-6 text-indigo-600" />
              <h2 className="text-xl text-gray-900">System Preferences</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Data Retention Period (days)
                </label>
                <input
                  type="number"
                  value={systemConfig.dataRetentionDays}
                  onChange={(e) => setSystemConfig({ 
                    ...systemConfig, 
                    dataRetentionDays: parseInt(e.target.value) || 0
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tag data older than this will be automatically archived
                </p>
              </div>

            </div>
          </motion.div>
        )}

        {/* Dashboard Settings */}
        {activeTab === 'dashboard' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg border border-gray-200 p-6 max-w-3xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <Database className="size-6 text-indigo-600" />
              <h2 className="text-xl text-gray-900">Dashboard Settings</h2>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Deduplication Window (minutes)</label>
                  <input
                    type="number"
                    value={dashboardSettingsState.tag_dedupe_window_minutes}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDashboardSettingsState({ ...dashboardSettingsState, tag_dedupe_window_minutes: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min={1}
                  />
                  <p className="text-xs text-gray-500 mt-1">Window to deduplicate repeated tag reads</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-2">Offline Threshold (minutes)</label>
                  <input
                    type="number"
                    value={dashboardSettingsState.device_offline_minutes}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDashboardSettingsState({ ...dashboardSettingsState, device_offline_minutes: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min={1}
                  />
                  <p className="text-xs text-gray-500 mt-1">Time without last_seen to mark device offline</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-2">Auto Refresh Interval (seconds)</label>
                  <input
                    type="number"
                    value={dashboardSettingsState.auto_refresh_interval_seconds}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDashboardSettingsState({ ...dashboardSettingsState, auto_refresh_interval_seconds: parseInt(e.target.value) || 10 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min={1}
                  />
                  <p className="text-xs text-gray-500 mt-1">How often dashboard data auto-refreshes (seconds)</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* User Management */}
        {activeTab === 'users' && isAdmin() && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Users className="size-6 text-indigo-600" />
                <h2 className="text-xl text-gray-900">User Management</h2>
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
              {users.map((user) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="size-12 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 uppercase">
                        {user.username.substring(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-900">{user.username}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded text-sm uppercase $\{
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
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
                  No users found. Click "Add User" to create a new user account.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Save Button */}
        <div className="flex gap-4 mt-6 max-w-3xl">
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Save className="size-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          <button 
            onClick={() => {
              setMqttConfig(config.mqttConfig);
              setSystemConfig({
                dataRetentionDays: config.dataRetentionDays,
                apiKey: config.apiKey,
                autoRefreshInterval: config.autoRefreshInterval
              });
              toast.info('Changes discarded');
            }}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
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

// User Modal Component
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
        // Update existing user
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
        // Create new user
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
        className="bg-white rounded-lg max-w-md w-full"
      >
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl text-gray-900">
            {user ? 'Edit User' : 'Add New User'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="size-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Email</label>
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
              <label className="block text-sm text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                minLength={6}
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-700 mb-2">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : user ? 'Update User' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
