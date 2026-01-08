import React, { useState, useRef, useEffect } from 'react';
import { MapPin, ZoomIn, ZoomOut, Upload, Save, GripVertical, Eye } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useRFID } from '../context/RFIDContext';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export const LocationPage: React.FC = () => {
  const { devices, dashboardSettings, updateDevice } = useRFID();
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempPositions, setTempPositions] = useState<Record<string, {x: number, y: number}>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({x: 0, y: 0});
  const dragStartOffset = useRef({x: 0, y: 0});

  // Check if user is admin (placeholder - you'll need to implement actual auth check)
  const isAdmin = true; // Replace with actual auth check

  // Handle floor plan image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setBackgroundImage(e.target?.result as string);
        // Save to localStorage
        localStorage.setItem('floorPlanImage', e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Load saved floor plan image on component mount
  useEffect(() => {
    const savedImage = localStorage.getItem('floorPlanImage');
    if (savedImage) {
      setBackgroundImage(savedImage);
    }
  }, []);

  // Handle drag start
  const handleDragStart = (deviceId: string, e: React.MouseEvent) => {
    if (!isEditMode || !isAdmin) return;
    
    e.preventDefault();
    setIsDragging(deviceId);
    
    const container = mapContainerRef.current;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const device = devices.find(d => d.id === deviceId);
    const currentPos = tempPositions[deviceId] || device?.coordinates || {x: 100, y: 100};
    
    // Store starting positions
    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY
    };
    
    dragStartOffset.current = {
      x: (currentPos.x * zoom) - (e.clientX - containerRect.left),
      y: (currentPos.y * zoom) - (e.clientY - containerRect.top)
    };
    
    // Attach event listeners
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const x = (moveEvent.clientX - containerRect.left + dragStartOffset.current.x) / zoom;
      const y = (moveEvent.clientY - containerRect.top + dragStartOffset.current.y) / zoom;
      
      // Update temporary position
      setTempPositions(prev => ({
        ...prev,
        [deviceId]: { x, y }
      }));
    };
    
    const handleMouseUp = () => {
      // Save final position
      const finalPos = tempPositions[deviceId];
      if (finalPos && device) {
        const updatedDevice = {
          ...device,
          coordinates: finalPos
        };
        updateDevice(updatedDevice);
      }
      
      // Clean up
      setIsDragging(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Calculate reader activity
  const readerActivity = devices
    .map(device => ({
      id: device.id,
      name: device.name,
      tagsReadToday: device.tagsReadToday || 0,
      status: device.status,
      location: device.location
    }))
    .sort((a, b) => b.tagsReadToday - a.tagsReadToday);

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <Header title="Reader Location Map" />
      
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
          {/* Map Area */}
          <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h3 className="text-lg text-gray-900">Floor Plan</h3>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditMode(!isEditMode)}
                      className={`px-3 py-1 rounded-lg text-sm flex items-center gap-2 ${
                        isEditMode
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {isEditMode ? (
                        <>
                          <Save className="size-3" />
                          Save Positions
                        </>
                      ) : (
                        <>
                          <GripVertical className="size-3" />
                          Edit Positions
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-200"
                    >
                      <Upload className="size-3" />
                      Import Floor Plan
                    </button>
                  </div>
                )}
              </div>
              
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

            {/* Hidden file input for image upload */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept=".jpg,.jpeg,.png,.gif"
              className="hidden"
            />

            {/* Map Container */}
            <div 
              className="relative bg-gray-100 rounded-lg overflow-hidden" 
              style={{ height: '600px' }}
              ref={mapContainerRef}
            >
              <div 
                className="absolute inset-0"
                style={{ 
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  transition: isDragging ? 'none' : 'transform 0.2s'
                }}
              >
                {/* Background image or grid */}
                {backgroundImage ? (
                  <div 
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${backgroundImage})` }}
                  />
                ) : (
                  <svg className="absolute inset-0 w-full h-full opacity-50">
                    <defs>
                      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E5E7EB" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </svg>
                )}

                {/* Device markers */}
                {devices.map((device) => {
                  const isSelected = selectedDevice === device.id;
                  const isBeingDragged = isDragging === device.id;
                  const tempPos = tempPositions[device.id];
                  const x = tempPos?.x || device.coordinates?.x || 100;
                  const y = tempPos?.y || device.coordinates?.y || 100;

                  return (
                    <div
                      key={device.id}
                      className={`absolute transition-all ${
                        isEditMode && isAdmin ? 'cursor-move' : 'cursor-pointer'
                      }`}
                      style={{
                        left: `${x}px`,
                        top: `${y}px`,
                        transform: `translate(-50%, -50%) scale(${isBeingDragged ? 1.1 : 1})`,
                        zIndex: isSelected ? 20 : 10,
                      }}
                      onClick={(e) => {
                        if (!isEditMode || !isAdmin) {
                          setSelectedDevice(device.id);
                        }
                      }}
                      onMouseDown={(e) => isEditMode && isAdmin && handleDragStart(device.id, e)}
                    >
                      {/* Device marker */}
                      <div className="relative">
                        <div
                          className={`flex items-center justify-center shadow-lg transition-all ${
                            isSelected
                              ? 'ring-4 ring-indigo-300'
                              : ''
                          } ${
                            device.status === 'online'
                              ? 'bg-green-500'
                              : 'bg-red-500'
                          } ${
                            isEditMode && isAdmin ? 'ring-2 ring-dashed ring-white' : ''
                          }`}
                          style={{
                            width: isSelected ? '3rem' : '2.5rem',
                            height: isSelected ? '3rem' : '2.5rem',
                            borderRadius: '50%'
                          }}
                        >
                          {isEditMode && isAdmin ? (
                            <GripVertical className="size-4 text-white" />
                          ) : (
                            <MapPin className="size-4 text-white" />
                          )}
                        </div>

                        {/* Pulse animation for online devices */}
                        {device.status === 'online' && !isBeingDragged && (
                          <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" 
                            style={{ width: '2.5rem', height: '2.5rem' }} />
                        )}

                        {/* Device label */}
                        <div className="absolute top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white px-3 py-2 rounded-lg shadow-lg text-sm border border-gray-200">
                          <div className="text-gray-900 font-medium">{device.name}</div>
                          <div className="text-gray-500 text-xs flex items-center gap-1">
                            <span>{device.tagsReadToday || 0} tags</span>
                            {isEditMode && isAdmin && (
                              <span className="text-xs text-blue-500">(Drag to move)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Drag instructions overlay */}
                {isEditMode && isAdmin && (
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg border border-gray-300">
                    <p className="text-sm text-gray-700 flex items-center gap-2">
                      <GripVertical className="size-4" />
                      Drag readers to reposition • Click to save
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 mt-4 text-sm text-gray-600 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="size-4 bg-green-500 rounded-full" />
                <span>Online Reader</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-4 bg-red-500 rounded-full" />
                <span>Offline Reader</span>
              </div>
              {isEditMode && isAdmin && (
                <div className="flex items-center gap-2">
                  <div className="size-4 border-2 border-dashed border-gray-400 rounded-full" />
                  <span>Drag to Reposition</span>
                </div>
              )}
              {!isAdmin && (
                <div className="flex items-center gap-2">
                  <Eye className="size-4 text-gray-500" />
                  <span className="text-gray-500">View Only Mode</span>
                </div>
              )}
            </div>

            {/* Instructions */}
            {!backgroundImage && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Tip:</strong> Upload a floor plan image for better visualization. Click "Import Floor Plan" to upload a JPG or PNG file.
                </p>
              </div>
            )}
          </div>

          {/* Device Info Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Device Details Panel */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg text-gray-900 mb-4">Reader Details</h3>
              
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
                            <div className="text-gray-600">IP Address</div>
                            <div className="text-gray-900 font-mono text-xs">{device.ipAddress}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Tags Read Today</div>
                            <div className="text-gray-900 flex items-center gap-2">
                              {device.tagsReadToday || 0}
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
                          <div>
                            <div className="text-gray-600">Signal Strength</div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${
                                    (device.signalStrength || 0) > 80 ? 'bg-green-500' :
                                    (device.signalStrength || 0) > 50 ? 'bg-orange-500' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${device.signalStrength || 0}%` }}
                                />
                              </div>
                              <span className="text-gray-900 text-xs">{device.signalStrength || 0}%</span>
                            </div>
                          </div>
                          {isAdmin && (tempPositions[device.id] || device.coordinates) && (
                            <div>
                              <div className="text-gray-600">Map Position</div>
                              <div className="text-gray-900 text-xs font-mono">
                                X: {Math.round((tempPositions[device.id]?.x || device.coordinates?.x || 100))}, 
                                Y: {Math.round((tempPositions[device.id]?.y || device.coordinates?.y || 100))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Click on a reader marker to view details
                  {isEditMode && isAdmin && (
                    <p className="mt-2 text-blue-600">Or drag readers to reposition them</p>
                  )}
                </div>
              )}
            </div>

            {/* Reader Activity Panel (Replaces Zone Activity) */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg text-gray-900">Reader Activity</h3>
                <span className="text-xs text-gray-500">
                  Total: {readerActivity.reduce((sum, device) => sum + device.tagsReadToday, 0)}
                </span>
              </div>
              
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {readerActivity.map((device) => (
                  <div 
                    key={device.id}
                    className={`flex items-center justify-between text-sm p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedDevice === device.id 
                        ? 'bg-indigo-50 border border-indigo-200' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedDevice(device.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`size-2 rounded-full ${
                          device.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <div className="text-gray-900 truncate">{device.name}</div>
                      </div>
                      <div className="text-xs text-gray-500 truncate">{device.location}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-gray-900 font-medium">{device.tagsReadToday}</div>
                        <div className="text-xs text-gray-500">tags</div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {readerActivity.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No reader activity to display
                  </div>
                )}
              </div>
            </div>

            {/* Admin Controls */}
            {isAdmin && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg text-gray-900 mb-4">Map Controls</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Edit Mode</span>
                    <button
                      onClick={() => setIsEditMode(!isEditMode)}
                      className={`px-3 py-1 rounded text-xs ${
                        isEditMode
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {isEditMode ? 'Editing' : 'Enable Edit'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Floor Plan</span>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded text-xs hover:bg-indigo-200"
                    >
                      Upload Image
                    </button>
                  </div>
                  {backgroundImage && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Current Image</span>
                      <button
                        onClick={() => {
                          setBackgroundImage(null);
                          localStorage.removeItem('floorPlanImage');
                        }}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};