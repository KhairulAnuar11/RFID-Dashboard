import React, { useState } from 'react';
import { MapPin, ZoomIn, ZoomOut } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useRFID } from '../context/RFIDContext';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export const LocationPage: React.FC = () => {
  const { devices, dashboardSettings } = useRFID();
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  // Calculate heatmap intensity for zones
  const zoneData = devices.reduce((acc, device) => {
    if (!device.zone) return acc;
    if (!acc[device.zone]) {
      acc[device.zone] = { count: 0, devices: [] };
    }
    acc[device.zone].count += device.tagsReadToday;
    acc[device.zone].devices.push(device);
    return acc;
  }, {} as Record<string, { count: number; devices: typeof devices }>);

  const maxZoneCount = Math.max(...Object.values(zoneData).map(z => z.count), 1);

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <Header title="Reader Location Map" />
      
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
          {/* Map Area */}
          <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-gray-900">Floor Plan</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ZoomOut className="size-4" />
                </button>
                <span className="text-sm text-gray-600 w-16 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ZoomIn className="size-4" />
                </button>
              </div>
            </div>

            {/* Map Container */}
            <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ height: '600px' }}>
              <div 
                className="absolute inset-0"
                style={{ 
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  transition: 'transform 0.2s'
                }}
              >
                {/* Grid background */}
                <svg className="absolute inset-0 w-full h-full">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E5E7EB" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>

                {/* Zone labels and areas */}
                {Object.entries(zoneData).map(([zone, data], index) => {
                  const intensity = data.count / maxZoneCount;
                  const color = `rgba(79, 70, 229, ${0.1 + intensity * 0.3})`;
                  const x = (index % 3) * 300 + 50;
                  const y = Math.floor(index / 3) * 250 + 50;

                  return (
                    <div
                      key={zone}
                      className="absolute border-2 border-indigo-300 rounded-lg p-4"
                      style={{
                        left: `${x}px`,
                        top: `${y}px`,
                        width: '250px',
                        height: '200px',
                        backgroundColor: color
                      }}
                    >
                      <div className="text-sm text-gray-700 mb-2">{zone}</div>
                      <div className="text-xs text-gray-600">{data.count} tags read</div>
                    </div>
                  );
                })}

                {/* Device markers */}
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="absolute cursor-pointer"
                    style={{
                      left: `${device.coordinates?.x || 0}px`,
                      top: `${device.coordinates?.y || 0}px`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    onClick={() => setSelectedDevice(device.id)}
                  >
                    {/* Device marker */}
                    <div className="relative">
                      <div
                        className={`size-8 rounded-full flex items-center justify-center shadow-lg transition-all ${
                          selectedDevice === device.id
                            ? 'size-12 ring-4 ring-indigo-300'
                            : 'hover:size-10'
                        } ${
                          device.status === 'online'
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}
                      >
                        <MapPin className="size-4 text-white" />
                      </div>

                      {/* Pulse animation for online devices */}
                      {device.status === 'online' && (
                        <div className="absolute inset-0 size-8 rounded-full bg-green-500 animate-ping opacity-75" />
                      )}

                      {/* Device label */}
                      <div className="absolute top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white px-2 py-1 rounded shadow-lg text-xs">
                        <div className="text-gray-900">{device.name}</div>
                        <div className="text-gray-500 flex items-center gap-2">
                          <span>{device.tagsReadToday} tags</span>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-xs text-gray-400 hover:text-gray-600 cursor-help">(?)</span>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6}>
                              Counts unique tag reads per {dashboardSettings?.tag_dedupe_window_minutes ?? 5} minute(s) window.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 mt-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="size-4 bg-green-500 rounded-full" />
                <span>Online</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-4 bg-red-500 rounded-full" />
                <span>Offline</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-4 bg-indigo-200 rounded" />
                <span>Low Activity</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-4 bg-indigo-500 rounded" />
                <span>High Activity</span>
              </div>
            </div>
          </div>

          {/* Device Info Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg text-gray-900 mb-4">Device Details</h3>
              
              {selectedDevice ? (
                <div className="space-y-4">
                  {devices
                    .filter(d => d.id === selectedDevice)
                    .map(device => (
                      <div key={device.id}>
                        <div className="mb-4 pb-4 border-b border-gray-200">
                          <h4 className="text-gray-900 mb-1">{device.name}</h4>
                          <span className={`text-xs uppercase px-2 py-1 rounded ${
                            device.status === 'online' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {device.status}
                          </span>
                        </div>

                        <div className="space-y-3 text-sm">
                          <div>
                            <div className="text-gray-600">Location</div>
                            <div className="text-gray-900">{device.location}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Zone</div>
                            <div className="text-gray-900">{device.zone || 'N/A'}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">IP Address</div>
                            <div className="text-gray-900 font-mono text-xs">{device.ipAddress}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Tags Read Today</div>
                            <div className="text-gray-900">{device.tagsReadToday}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Signal Strength</div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${
                                    device.signalStrength > 80 ? 'bg-green-500' :
                                    device.signalStrength > 50 ? 'bg-orange-500' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${device.signalStrength}%` }}
                                />
                              </div>
                              <span className="text-gray-900 text-xs">{device.signalStrength}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Click on a device marker to view details
                </div>
              )}
            </div>

            {/* Zone Statistics */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
              <h3 className="text-lg text-gray-900 mb-4">Zone Activity</h3>
              <div className="space-y-3">
                {Object.entries(zoneData)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .map(([zone, data]) => (
                    <div key={zone} className="flex items-center justify-between text-sm">
                      <div>
                        <div className="text-gray-900">{zone}</div>
                        <div className="text-xs text-gray-500">{data.devices.length} devices</div>
                      </div>
                      <div className="text-gray-900">{data.count}</div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
