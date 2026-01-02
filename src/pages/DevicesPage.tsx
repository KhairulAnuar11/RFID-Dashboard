import React, { useState, useEffect } from 'react'; // Added useEffect
import { Plus, Edit, Trash2, Activity } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useRFID } from '../context/RFIDContext';
import { Device } from '../types';

export const DevicesPage: React.FC = () => {
  const { devices, updateDevice, deleteDevice, addDevice, dashboardSettings } = useRFID();
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  // Add useEffect to log devices data
  useEffect(() => {
    console.log('[DevicesPage] Devices data:', devices);
    if (devices.length > 0) {
      console.log('[DevicesPage] First device structure:', devices[0]);
      console.log('[DevicesPage] First device keys:', Object.keys(devices[0]));
    }
  }, [devices]);

  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    setShowModal(true);
  };

  const handleDelete = (deviceId: string) => {
    if (confirm('Are you sure you want to delete this device?')) {
      deleteDevice(deviceId);
    }
  };

  const handleAdd = () => {
    setEditingDevice(null);
    setShowModal(true);
  };

  // Helper function to get device property with fallback
  const getDeviceProperty = (device: Device, property: keyof Device, defaultValue: any = 'N/A') => {
    const value = device[property];
    return value !== undefined && value !== null ? value : defaultValue;
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <Header title="Device Management" />
      
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-gray-600">
              Total Devices: {devices.length} | Online: {devices.filter(d => d.status === 'online').length}
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="size-4" />
            Add Device
          </button>
        </div>

        {/* Devices Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device) => {
            // Log individual device data for debugging
            console.log(`[DevicesPage] Rendering device ${device.id}:`, device);
            
            // Safely get all device properties with defaults
            const deviceName = getDeviceProperty(device, 'name', 'Unnamed Device');
            const deviceStatus = getDeviceProperty(device, 'status', 'offline');
            const ipAddress = getDeviceProperty(device, 'ipAddress', 'N/A');
            const macAddress = getDeviceProperty(device, 'macAddress', 'N/A');
            const location = getDeviceProperty(device, 'location', 'Unknown');
            const zone = getDeviceProperty(device, 'zone', 'N/A');
            const signalStrength = Number(getDeviceProperty(device, 'signalStrength', 0));
            const tagsReadToday = Number(getDeviceProperty(device, 'tagsReadToday', 0));
            const uptime = getDeviceProperty(device, 'uptime', '0d 0h');
            const lastHeartbeat = getDeviceProperty(device, 'lastHeartbeat', new Date().toISOString());
            
            return (
              <div key={device.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`size-12 rounded-lg flex items-center justify-center ${
                      deviceStatus === 'online' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      <Activity className={`size-6 ${
                        deviceStatus === 'online' ? 'text-green-600' : 'text-red-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className="text-gray-900">{deviceName}</h3>
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
                    <button
                      onClick={() => handleEdit(device)}
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
                </div>
              </div>
            );
          })}
        </div>

        {devices.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No devices found. Click "Add Device" to register a new RFID reader.
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <DeviceModal
          device={editingDevice}
          onClose={() => setShowModal(false)}
          onSave={(device) => {
            if (editingDevice) {
              updateDevice(device);
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

// Device Modal Component - Updated to match actual data structure
const DeviceModal: React.FC<{
  device: Device | null;
  onClose: () => void;
  onSave: (device: Device) => void;
}> = ({ device, onClose, onSave }) => {
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
    
    // Ensure all required fields have values
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
          <h2 className="text-xl text-gray-900">
            {device ? 'Edit Device' : 'Add New Device'}
          </h2>
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
                required
                placeholder="e.g., RFID Reader 01"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Status *</label>
              <select
                value={formData.status || 'offline'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'online' | 'offline' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
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
                required
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
                required
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
                required
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
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Uptime</label>
              <input
                type="text"
                value={formData.uptime || '0d 0h'}
                onChange={(e) => setFormData({ ...formData, uptime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            />
          </div>

          <div className="flex gap-4 mt-6">
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
          </div>
        </form>
      </div>
    </div>
  );
};