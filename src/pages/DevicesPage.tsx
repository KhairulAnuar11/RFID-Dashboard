import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Activity, Save, Wifi, Database, List } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useRFID } from '../context/RFIDContext';
import { Device } from '../types';

export const DevicesPage: React.FC = () => {
  const { 
    devices = [], // Default to empty array
    autoDetectedDevices = [], // Default to empty array
    updateDevice, 
    deleteDevice, 
    addDevice,
    saveAutoDetectedAsManual,
    dashboardSettings 
  } = useRFID();
  
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [isEditingAutoDetected, setIsEditingAutoDetected] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto' | 'all'>('all'); // Added 'all' tab

  // Combine all devices for the "All" tab
  const allDevices = [...devices, ...autoDetectedDevices];
  
  const handleEdit = (device: Device, isAutoDetected: boolean = false) => {
    setEditingDevice(device);
    setIsEditingAutoDetected(isAutoDetected);
    setShowModal(true);
  };

  const handleDelete = (deviceId: string) => {
    if (confirm('Are you sure you want to delete this device from database?')) {
      deleteDevice(deviceId);
    }
  };

  const handleAdd = () => {
    setEditingDevice(null);
    setIsEditingAutoDetected(false);
    setShowModal(true);
  };

  const handleSaveAutoDetected = async (device: Device) => {
    if (confirm('Save this auto-detected device to database as a manual device?')) {
      await saveAutoDetectedAsManual(device);
    }
  };

  const getDeviceProperty = (device: Device, property: keyof Device, defaultValue: any = 'N/A') => {
    const value = device[property];
    return value !== undefined && value !== null ? value : defaultValue;
  };

  const renderDeviceCard = (device: Device, isAutoDetected: boolean = false) => {
    const deviceName = getDeviceProperty(device, 'name', 'Unnamed Device');
    const deviceStatus = getDeviceProperty(device, 'status', 'offline');
    const ipAddress = getDeviceProperty(device, 'ipAddress', 'N/A');
    const macAddress = getDeviceProperty(device, 'macAddress', 'N/A');
    const location = getDeviceProperty(device, 'location', 'Unknown');
    const zone = getDeviceProperty(device, 'zone', 'N/A');
    const rssi = Number(device.signalStrength ?? -100);
    const signalStrength = Math.min(
      100,
      Math.max(0, Math.round(((rssi + 100) / 70) * 100))
    );
    const tagsReadToday = Number(getDeviceProperty(device, 'tagsReadToday', 0));
    const uptime = getDeviceProperty(device, 'uptime', '0d 0h');
    const lastHeartbeat = getDeviceProperty(device, 'lastHeartbeat', new Date().toISOString());
    
    return (
      <div key={`${device.id}-${isAutoDetected ? 'auto' : 'manual'}`} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`size-12 rounded-lg flex items-center justify-center ${
              deviceStatus === 'online' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {isAutoDetected ? (
                <Wifi className={`size-6 ${
                  deviceStatus === 'online' ? 'text-blue-600' : 'text-gray-600'
                }`} />
              ) : (
                <Activity className={`size-6 ${
                  deviceStatus === 'online' ? 'text-green-600' : 'text-red-600'
                }`} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-gray-900">{deviceName}</h3>
                <span className={`text-xs px-2 py-1 rounded ${
                  isAutoDetected 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {isAutoDetected ? 'Auto' : 'Manual'}
                </span>
              </div>
              <span className={`text-xs uppercase px-2 py-1 rounded ${
                deviceStatus === 'online' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {deviceStatus}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {isAutoDetected ? (
              <>
                <button
                  onClick={() => handleSaveAutoDetected(device)}
                  className="p-2 hover:bg-green-50 rounded-lg transition-colors"
                  title="Save to database"
                >
                  <Save className="size-4 text-green-600" />
                </button>
                <button
                  onClick={() => handleEdit(device, true)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="View details"
                >
                  <Edit className="size-4 text-gray-600" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleEdit(device, false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Edit className="size-4 text-gray-600" />
                </button>
                <button
                  onClick={() => handleDelete(device.id)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Trash2 className="size-4 text-red-600" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">IP Address:</span>
            <span className="text-gray-900 font-mono">{ipAddress}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">MAC Address:</span>
            <span className="text-gray-900 font-mono">{macAddress}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Location:</span>
            <span className="text-gray-900">{location}</span>
          </div>
          {zone && zone !== 'N/A' && (
            <div className="flex justify-between">
              <span className="text-gray-600">Zone:</span>
              <span className="text-gray-900">{zone}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Signal:</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${
                    signalStrength > 80 ? 'bg-green-500' :
                    signalStrength > 50 ? 'bg-orange-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(Math.max(signalStrength, 0), 100)}%` }}
                />
              </div>
              <span className="text-gray-900">{signalStrength}%</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Tags Today:</span>
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-xs text-gray-400 hover:text-gray-600 cursor-help">(?)</span>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Counts unique tag reads per {dashboardSettings?.tag_dedupe_window_minutes ?? 5} minute(s) window.
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-gray-900">{tagsReadToday}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Uptime:</span>
            <span className="text-gray-900">{uptime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Last Heartbeat:</span>
            <span className="text-gray-900 text-xs">
              {(() => {
                try {
                  return new Date(lastHeartbeat).toLocaleString();
                } catch (error) {
                  return 'Invalid date';
                }
              })()}
            </span>
          </div>
          {isAutoDetected && (
            <div className="pt-2 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs">Source:</span>
                <span className="text-blue-600 text-xs font-medium">Live MQTT Data</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const manualDevices = devices || [];
  const autoDevices = autoDetectedDevices || [];

  const getTabStats = () => {
    switch (activeTab) {
      case 'manual':
        return `Manual Devices: ${manualDevices.length} | Online: ${manualDevices.filter(d => d.status === 'online').length}`;
      case 'auto':
        return `Auto-detected Devices: ${autoDevices.length} | Online: ${autoDevices.filter(d => d.status === 'online').length}`;
      case 'all':
        return `All Devices: ${allDevices.length} | Online: ${allDevices.filter(d => d.status === 'online').length} | Manual: ${manualDevices.length} | Auto: ${autoDevices.length}`;
      default:
        return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <Header title="Device Management" />
      
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-gray-600">
              {getTabStats()}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Tab Switcher - Now with 3 tabs */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                  activeTab === 'all'
                    ? 'bg-white shadow-sm text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="size-4" />
                All Devices
                <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                  {allDevices.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('manual')}
                className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                  activeTab === 'manual'
                    ? 'bg-white shadow-sm text-purple-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Database className="size-4" />
                Manual
                <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">
                  {manualDevices.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('auto')}
                className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                  activeTab === 'auto'
                    ? 'bg-white shadow-sm text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Wifi className="size-4" />
                Auto-detected
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                  {autoDevices.length}
                </span>
              </button>
            </div>

            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="size-4" />
              Add Device
            </button>
          </div>
        </div>

        {/* Devices Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTab === 'manual' 
            ? manualDevices.map((device) => renderDeviceCard(device, false))
            : activeTab === 'auto'
            ? autoDevices.map((device) => renderDeviceCard(device, true))
            : allDevices.map((device) => {
                // Check if device is in manual or auto list
                const isAuto = autoDevices.some(d => d.id === device.id);
                return renderDeviceCard(device, isAuto);
              })
          }
        </div>

        {activeTab === 'manual' && manualDevices.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Database className="size-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No manual devices found</p>
            <p className="text-sm">Click "Add Device" to register a new RFID reader in the database.</p>
          </div>
        )}

        {activeTab === 'auto' && autoDevices.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Wifi className="size-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No auto-detected devices</p>
            <p className="text-sm">Auto-detected devices will appear here when discovered via MQTT.</p>
            <p className="text-xs mt-2 text-gray-400">Make sure MQTT is connected and devices are sending heartbeat messages.</p>
          </div>
        )}

        {activeTab === 'all' && allDevices.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <List className="size-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No devices found</p>
            <p className="text-sm">Add manual devices or connect MQTT to auto-detect devices.</p>
            <div className="flex gap-4 justify-center mt-4">
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="size-4" />
                Add Manual Device
              </button>
              <button
                onClick={() => window.location.hash = '/settings'}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Wifi className="size-4" />
                Configure MQTT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <DeviceModal
          device={editingDevice}
          isAutoDetected={isEditingAutoDetected}
          onClose={() => setShowModal(false)}
          onSave={(device) => {
            if (editingDevice) {
              if (isEditingAutoDetected) {
                saveAutoDetectedAsManual(device);
              } else {
                updateDevice(device);
              }
            } else {
              addDevice(device);
            }
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
};

// Device Modal Component
const DeviceModal: React.FC<{
  device: Device | null;
  isAutoDetected: boolean;
  onClose: () => void;
  onSave: (device: Device) => void;
}> = ({ device, isAutoDetected, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Device>>(device || {
    name: '',
    type: 'reader',
    status: 'offline',
    ipAddress: '',
    macAddress: '',
    location: '',
    zone: '',
    signalStrength: 100,
    lastHeartbeat: new Date().toISOString(),
    tagsReadToday: 0,
    uptime: '0d 0h'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const completeDevice: Device = {
      id: device?.id || `device-${Date.now()}`,
      name: formData.name || '',
      type: formData.type || 'reader',
      status: formData.status || 'offline',
      ipAddress: formData.ipAddress || '',
      macAddress: formData.macAddress || '',
      location: formData.location || '',
      zone: formData.zone || '',
      signalStrength: Number(formData.signalStrength) || 100,
      lastHeartbeat: formData.lastHeartbeat || new Date().toISOString(),
      tagsReadToday: Number(formData.tagsReadToday) || 0,
      uptime: formData.uptime || '0d 0h'
    };
    
    onSave(completeDevice);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl text-gray-900">
              {isAutoDetected ? 'Auto-detected Device' : device ? 'Edit Device' : 'Add New Device'}
            </h2>
            <span className={`text-xs px-3 py-1 rounded-full ${
              isAutoDetected ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {isAutoDetected ? 'Auto-detected' : 'Manual'}
            </span>
          </div>
          {isAutoDetected && (
            <p className="text-sm text-gray-600 mt-2">
              This device was auto-detected via MQTT. You can save it to the database to make it a permanent device.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">Device Name *</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required={!isAutoDetected}
                readOnly={isAutoDetected}
                placeholder="e.g., RFID Reader 01"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Status *</label>
              <select
                value={formData.status || 'offline'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'online' | 'offline' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required={!isAutoDetected}
                disabled={isAutoDetected}
              >
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">IP Address *</label>
              <input
                type="text"
                value={formData.ipAddress || ''}
                onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required={!isAutoDetected}
                readOnly={isAutoDetected}
                placeholder="e.g., 192.168.1.100"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">MAC Address *</label>
              <input
                type="text"
                value={formData.macAddress || ''}
                onChange={(e) => setFormData({ ...formData, macAddress: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required={!isAutoDetected}
                readOnly={isAutoDetected}
                placeholder="e.g., 00:1A:2B:3C:4D:5E"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Location *</label>
              <input
                type="text"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required={!isAutoDetected}
                readOnly={isAutoDetected}
                placeholder="e.g., Warehouse A, Entrance"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Zone</label>
              <input
                type="text"
                value={formData.zone || ''}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                readOnly={isAutoDetected}
                placeholder="e.g., Zone 1"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Signal Strength (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.signalStrength || 100}
                onChange={(e) => setFormData({ ...formData, signalStrength: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                readOnly={isAutoDetected}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Uptime</label>
              <input
                type="text"
                value={formData.uptime || '0d 0h'}
                onChange={(e) => setFormData({ ...formData, uptime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                readOnly={isAutoDetected}
                placeholder="e.g., 5d 12h"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm text-gray-700 mb-2">Tags Read Today</label>
            <input
              type="number"
              min="0"
              value={formData.tagsReadToday || 0}
              onChange={(e) => setFormData({ ...formData, tagsReadToday: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              readOnly={isAutoDetected}
            />
          </div>

          <div className="flex gap-4 mt-6">
            {isAutoDetected ? (
              <>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Save to Database
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {device ? 'Update Device' : 'Add Device'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};