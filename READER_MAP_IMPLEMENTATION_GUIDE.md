# Implementation Guide: Reader Map (Location Mapping) Module

## Overview

The Reader Map module allows users to upload custom facility maps/layout images and place RFID readers on them for visual monitoring. This guide provides complete implementation instructions.

---

## Phase 1: Database Setup

### Step 1: Create Required Tables

```sql
-- ============================================
-- Reader Map Tables
-- ============================================

-- 1. Maps/Layout Images Table
CREATE TABLE IF NOT EXISTS reader_maps (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  image_data LONGBLOB,
  image_filename VARCHAR(255),
  width INT DEFAULT 800,
  height INT DEFAULT 600,
  created_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_created_by (created_by),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Reader Positions on Maps Table
CREATE TABLE IF NOT EXISTS reader_positions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  map_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(36) NOT NULL,
  x_coordinate INT NOT NULL,
  y_coordinate INT NOT NULL,
  rotation_angle INT DEFAULT 0,
  zone_label VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (map_id) REFERENCES reader_maps(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  UNIQUE KEY unique_device_per_map (map_id, device_id),
  INDEX idx_map (map_id),
  INDEX idx_device (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create indexes for better query performance
CREATE INDEX idx_map_created ON reader_maps(created_at DESC);
CREATE INDEX idx_position_device ON reader_positions(device_id, map_id);

-- ============================================
-- Verification
-- ============================================
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('reader_maps', 'reader_positions');
```

### Step 2: Verify Schema

```bash
# In MySQL
mysql> USE rfid_dashboard;
mysql> SHOW TABLES LIKE 'reader_%';
mysql> DESCRIBE reader_maps;
mysql> DESCRIBE reader_positions;
```

---

## Phase 2: Backend API Implementation

### File: `backend/src/server.ts`

Add the following endpoints before the server startup section (before `startServer()` function):

#### Endpoint 1: POST /api/maps - Create Map

```typescript
// Create a new map/layout
app.post('/api/maps', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { name, description, image, width, height, imageFilename } = req.body;

    // Validation
    if (!name || !image) {
      return res.status(400).json({ 
        success: false, 
        error: 'Map name and image are required' 
      });
    }

    if (!image.startsWith('data:')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Image must be base64 encoded' 
      });
    }

    // Extract base64 data
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate image size (max 10MB)
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(413).json({ 
        success: false, 
        error: 'Image size exceeds 10MB limit' 
      });
    }

    const mapId = `map-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await pool.execute(
      `INSERT INTO reader_maps (id, name, description, image_data, image_filename, width, height, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [mapId, name, description || null, buffer, imageFilename || 'map.png', width || 800, height || 600, req.user.userId]
    );

    console.log('[Maps] ✅ Map created:', { mapId, name, size: buffer.length });

    res.json({
      success: true,
      data: {
        id: mapId,
        name,
        description,
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Maps] Create error:', error);
    res.status(500).json({ success: false, error: 'Failed to create map' });
  }
});
```

#### Endpoint 2: GET /api/maps - List All Maps

```typescript
// Get all maps
app.get('/api/maps', authenticateToken, async (req, res) => {
  try {
    const [rows]: any = await pool.execute(
      `SELECT m.id, m.name, m.description, m.width, m.height, m.created_by, 
              u.username as created_by_name, m.created_at,
              COUNT(rp.id) as device_count
       FROM reader_maps m
       LEFT JOIN users u ON m.created_by = u.id
       LEFT JOIN reader_positions rp ON m.id = rp.map_id
       GROUP BY m.id
       ORDER BY m.created_at DESC`
    );

    const maps = (rows || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      width: r.width,
      height: r.height,
      device_count: r.device_count,
      created_by: r.created_by_name,
      created_at: new Date(r.created_at).toISOString()
    }));

    res.json({ success: true, data: maps });
  } catch (error) {
    console.error('[Maps] List error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch maps' });
  }
});
```

#### Endpoint 3: GET /api/maps/:mapId - Get Map with Positions

```typescript
// Get specific map with all reader positions
app.get('/api/maps/:mapId', authenticateToken, async (req, res) => {
  try {
    const { mapId } = req.params;

    // Get map data
    const [mapRows]: any = await pool.execute(
      `SELECT id, name, description, width, height, created_at
       FROM reader_maps WHERE id = ?`,
      [mapId]
    );

    if (!mapRows || mapRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Map not found' });
    }

    const map = mapRows[0];

    // Get reader positions with device info
    const [positions]: any = await pool.execute(
      `SELECT rp.id, rp.device_id, d.name as device_name, d.status,
              rp.x_coordinate, rp.y_coordinate, rp.rotation_angle, rp.zone_label,
              d.tags_read_today
       FROM reader_positions rp
       JOIN devices d ON rp.device_id = d.id
       WHERE rp.map_id = ?
       ORDER BY d.name`,
      [mapId]
    );

    const readers = (positions || []).map((p: any) => ({
      id: p.id,
      device_id: p.device_id,
      device_name: p.device_name,
      status: p.status,
      x: p.x_coordinate,
      y: p.y_coordinate,
      rotation: p.rotation_angle,
      zone: p.zone_label,
      tags_read_today: p.tags_read_today || 0
    }));

    res.json({
      success: true,
      data: {
        map: {
          id: map.id,
          name: map.name,
          description: map.description,
          width: map.width,
          height: map.height,
          created_at: new Date(map.created_at).toISOString()
        },
        readers
      }
    });
  } catch (error) {
    console.error('[Maps] Get error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch map' });
  }
});
```

#### Endpoint 4: GET /api/maps/:mapId/image - Get Map Image

```typescript
// Get map image as base64
app.get('/api/maps/:mapId/image', authenticateToken, async (req, res) => {
  try {
    const { mapId } = req.params;

    const [rows]: any = await pool.execute(
      `SELECT image_data FROM reader_maps WHERE id = ?`,
      [mapId]
    );

    if (!rows || rows.length === 0 || !rows[0].image_data) {
      return res.status(404).json({ success: false, error: 'Map image not found' });
    }

    const imageData = rows[0].image_data;
    const base64 = imageData.toString('base64');

    res.json({
      success: true,
      data: {
        image: `data:image/png;base64,${base64}`
      }
    });
  } catch (error) {
    console.error('[Maps] Image fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch image' });
  }
});
```

#### Endpoint 5: POST /api/maps/:mapId/readers/:deviceId/position - Add Reader to Map

```typescript
// Add reader position to map
app.post('/api/maps/:mapId/readers/:deviceId/position', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { mapId, deviceId } = req.params;
    const { x, y, rotation = 0, zone } = req.body;

    // Validation
    if (typeof x !== 'number' || typeof y !== 'number') {
      return res.status(400).json({ success: false, error: 'Invalid coordinates' });
    }

    // Verify map exists
    const [mapRows]: any = await pool.execute(
      'SELECT id FROM reader_maps WHERE id = ?',
      [mapId]
    );

    if (!mapRows || mapRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Map not found' });
    }

    // Verify device exists
    const [deviceRows]: any = await pool.execute(
      'SELECT id FROM devices WHERE id = ?',
      [deviceId]
    );

    if (!deviceRows || deviceRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    const positionId = `pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await pool.execute(
      `INSERT INTO reader_positions (id, map_id, device_id, x_coordinate, y_coordinate, rotation_angle, zone_label)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       x_coordinate = ?, y_coordinate = ?, rotation_angle = ?, zone_label = ?, updated_at = NOW()`,
      [positionId, mapId, deviceId, x, y, rotation, zone, x, y, rotation, zone]
    );

    console.log('[Maps] ✅ Reader position saved:', { mapId, deviceId, x, y });

    res.json({
      success: true,
      data: {
        id: positionId,
        device_id: deviceId,
        x,
        y,
        rotation,
        zone
      }
    });
  } catch (error) {
    console.error('[Maps] Position save error:', error);
    res.status(500).json({ success: false, error: 'Failed to save position' });
  }
});
```

#### Endpoint 6: DELETE /api/maps/:mapId/readers/:deviceId - Remove Reader from Map

```typescript
// Remove reader from map
app.delete('/api/maps/:mapId/readers/:deviceId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { mapId, deviceId } = req.params;

    await pool.execute(
      'DELETE FROM reader_positions WHERE map_id = ? AND device_id = ?',
      [mapId, deviceId]
    );

    res.json({ success: true, message: 'Reader removed from map' });
  } catch (error) {
    console.error('[Maps] Delete position error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove reader' });
  }
});
```

#### Endpoint 7: DELETE /api/maps/:mapId - Delete Map

```typescript
// Delete entire map
app.delete('/api/maps/:mapId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { mapId } = req.params;

    await pool.execute('DELETE FROM reader_maps WHERE id = ?', [mapId]);

    res.json({ success: true, message: 'Map deleted successfully' });
  } catch (error) {
    console.error('[Maps] Delete map error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete map' });
  }
});
```

---

## Phase 3: Frontend API Service Updates

### File: `src/services/apiService.ts`

Add these methods to the APIService class:

```typescript
// ==================== Reader Maps API ====================

async getMaps(): Promise<APIResponse<{
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  device_count: number;
  created_by: string;
  created_at: string;
}[]>> {
  return this.get('/maps');
}

async createMap(data: {
  name: string;
  description?: string;
  image: string; // base64 encoded
  width: number;
  height: number;
  imageFilename?: string;
}): Promise<APIResponse<{ id: string; name: string; created_at: string }>> {
  return this.post('/maps', data);
}

async getMapWithReaders(mapId: string): Promise<APIResponse<{
  map: {
    id: string;
    name: string;
    description?: string;
    width: number;
    height: number;
    created_at: string;
  };
  readers: Array<{
    id: string;
    device_id: string;
    device_name: string;
    status: 'online' | 'offline';
    x: number;
    y: number;
    rotation: number;
    zone?: string;
    tags_read_today: number;
  }>;
}>> {
  return this.get(`/maps/${mapId}`);
}

async getMapImage(mapId: string): Promise<APIResponse<{ image: string }>> {
  return this.get(`/maps/${mapId}/image`);
}

async addReaderToMap(mapId: string, deviceId: string, data: {
  x: number;
  y: number;
  rotation?: number;
  zone?: string;
}): Promise<APIResponse<{
  id: string;
  device_id: string;
  x: number;
  y: number;
  rotation: number;
  zone?: string;
}>> {
  return this.post(`/maps/${mapId}/readers/${deviceId}/position`, data);
}

async removeReaderFromMap(mapId: string, deviceId: string): Promise<APIResponse<any>> {
  return this.delete(`/maps/${mapId}/readers/${deviceId}`);
}

async deleteMap(mapId: string): Promise<APIResponse<any>> {
  return this.delete(`/maps/${mapId}`);
}
```

---

## Phase 4: Frontend Component Updates

### Update: `src/pages/LocationPage.tsx`

Replace with improved version that uses backend:

```typescript
import React, { useEffect, useState } from 'react';
import { MapPin, ZoomIn, ZoomOut, Upload, Plus, Trash2, Loader } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useRFID } from '../context/RFIDContext';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { toast } from 'sonner';

interface MapData {
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  device_count: number;
  created_by: string;
  created_at: string;
}

interface Reader {
  id: string;
  device_id: string;
  device_name: string;
  status: 'online' | 'offline';
  x: number;
  y: number;
  rotation: number;
  zone?: string;
  tags_read_today: number;
}

export const LocationPage: React.FC = () => {
  const { devices } = useRFID();
  const { isAdmin } = useAuth();
  
  const [maps, setMaps] = useState<MapData[]>([]);
  const [selectedMap, setSelectedMap] = useState<string | null>(null);
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [readers, setReaders] = useState<Reader[]>([]);
  const [selectedReader, setSelectedReader] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedReader, setDraggedReader] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Load maps on mount
  useEffect(() => {
    loadMaps();
  }, []);

  // Load map details when selected
  useEffect(() => {
    if (selectedMap) {
      loadMapDetails(selectedMap);
    }
  }, [selectedMap]);

  const loadMaps = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getMaps();
      if (response.success && response.data) {
        setMaps(response.data);
        if (response.data.length > 0) {
          setSelectedMap(response.data[0].id);
        }
      }
    } catch (error) {
      console.error('[Location] Failed to load maps:', error);
      toast.error('Failed to load maps');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMapDetails = async (mapId: string) => {
    try {
      const [mapResponse, imageResponse] = await Promise.all([
        apiService.getMapWithReaders(mapId),
        apiService.getMapImage(mapId)
      ]);

      if (mapResponse.success && mapResponse.data) {
        setReaders(mapResponse.data.readers);
      }

      if (imageResponse.success && imageResponse.data) {
        setMapImage(imageResponse.data.image);
      }
    } catch (error) {
      console.error('[Location] Failed to load map details:', error);
      toast.error('Failed to load map details');
    }
  };

  const handleUploadMap = async (file: File, name: string, description: string) => {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target?.result as string;
        
        const response = await apiService.createMap({
          name,
          description,
          image: base64Image,
          width: 800,
          height: 600
        });

        if (response.success) {
          toast.success('Map uploaded successfully');
          await loadMaps();
          setShowUploadModal(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('[Location] Upload error:', error);
      toast.error('Failed to upload map');
    }
  };

  const handleAddReader = async (reader: Reader, x: number, y: number) => {
    try {
      const response = await apiService.addReaderToMap(selectedMap!, reader.device_id, {
        x,
        y,
        rotation: 0
      });

      if (response.success) {
        await loadMapDetails(selectedMap!);
        toast.success(`Reader ${reader.device_name} added to map`);
      }
    } catch (error) {
      console.error('[Location] Add reader error:', error);
      toast.error('Failed to add reader to map');
    }
  };

  const handleRemoveReader = async (deviceId: string) => {
    try {
      const response = await apiService.removeReaderFromMap(selectedMap!, deviceId);
      
      if (response.success) {
        await loadMapDetails(selectedMap!);
        toast.success('Reader removed from map');
      }
    } catch (error) {
      console.error('[Location] Remove reader error:', error);
      toast.error('Failed to remove reader');
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <Header title="Reader Location Map">
        {isAdmin() && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Upload className="size-4" />
            Upload Map
          </button>
        )}
      </Header>

      <div className="flex-1 p-8 overflow-y-auto">
        {maps.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No maps available</p>
            {isAdmin() && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Your First Map
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
            {/* Map Selector */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-lg font-semibold mb-4">Maps</h3>
                <div className="space-y-2">
                  {maps.map(map => (
                    <button
                      key={map.id}
                      onClick={() => setSelectedMap(map.id)}
                      className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                        selectedMap === map.id
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium">{map.name}</div>
                      <div className="text-xs text-gray-500">{map.device_count} readers</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Map Display */}
            {selectedMap && (
              <>
                <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Floor Plan</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                        className="p-2 hover:bg-gray-100 rounded"
                      >
                        <ZoomOut className="size-4" />
                      </button>
                      <span className="text-sm text-gray-600 w-16 text-center">
                        {Math.round(zoom * 100)}%
                      </span>
                      <button
                        onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                        className="p-2 hover:bg-gray-100 rounded"
                      >
                        <ZoomIn className="size-4" />
                      </button>
                    </div>
                  </div>

                  {/* Map Canvas */}
                  {mapImage && (
                    <div
                      className="relative bg-gray-100 rounded-lg overflow-auto"
                      style={{ height: '600px' }}
                      onMouseMove={(e) => {
                        // Handle drag positioning
                      }}
                    >
                      <div
                        style={{
                          transform: `scale(${zoom})`,
                          transformOrigin: 'top left',
                          transition: isDragging ? 'none' : 'transform 0.2s'
                        }}
                      >
                        <img
                          src={mapImage}
                          alt="Map"
                          className="w-full"
                        />

                        {/* Reader Markers */}
                        {readers.map(reader => (
                          <div
                            key={reader.id}
                            className="absolute cursor-move"
                            style={{
                              left: `${reader.x}px`,
                              top: `${reader.y}px`,
                              transform: 'translate(-50%, -50%)'
                            }}
                            onClick={() => setSelectedReader(reader.id)}
                          >
                            <div
                              className={`size-8 rounded-full flex items-center justify-center shadow-lg ${
                                reader.status === 'online'
                                  ? 'bg-green-500'
                                  : 'bg-red-500'
                              } ${
                                selectedReader === reader.id
                                  ? 'ring-4 ring-blue-300'
                                  : ''
                              }`}
                            >
                              <MapPin className="size-4 text-white" />
                            </div>
                            <div className="text-xs bg-white px-2 py-1 rounded shadow mt-1 whitespace-nowrap">
                              {reader.device_name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Reader Details Panel */}
                <div className="lg:col-span-1 space-y-4">
                  {selectedReader ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      {readers
                        .filter(r => r.id === selectedReader)
                        .map(reader => (
                          <div key={reader.id}>
                            <h4 className="font-semibold mb-3">{reader.device_name}</h4>
                            <div className="space-y-2 text-sm mb-4">
                              <div>
                                <div className="text-gray-600">Status</div>
                                <div className={`font-medium ${reader.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                                  {reader.status.toUpperCase()}
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-600">Position</div>
                                <div className="font-mono text-xs">({reader.x}, {reader.y})</div>
                              </div>
                              <div>
                                <div className="text-gray-600">Tags Today</div>
                                <div className="font-medium">{reader.tags_read_today}</div>
                              </div>
                            </div>
                            {isAdmin() && (
                              <button
                                onClick={() => handleRemoveReader(reader.device_id)}
                                className="w-full px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                              >
                                <Trash2 className="size-3 inline mr-2" />
                                Remove from Map
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <p className="text-sm text-gray-500 mb-4">Click a reader marker to view details</p>

                      {isAdmin() && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold">Add Readers</p>
                          {devices
                            .filter(d => !readers.some(r => r.device_id === d.id))
                            .map(device => (
                              <button
                                key={device.id}
                                onClick={() => {
                                  // In real implementation, show position picker modal
                                  const x = Math.random() * 600 + 100;
                                  const y = Math.random() * 500 + 100;
                                  handleAddReader({ ...device, id: `pos-${device.id}`, tags_read_today: device.tagsReadToday } as any, x, y);
                                }}
                                className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded flex items-center gap-2"
                              >
                                <Plus className="size-3" />
                                {device.name}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <MapUploadModal
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUploadMap}
        />
      )}
    </div>
  );
};

// Upload Modal Component
const MapUploadModal: React.FC<{
  onClose: () => void;
  onUpload: (file: File, name: string, description: string) => void;
}> = ({ onClose, onUpload }) => {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">Upload Map</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Map Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Warehouse Floor 1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add notes about this map..."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (file && name) {
                  onUpload(file, name, description);
                }
              }}
              disabled={!file || !name}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## Phase 5: Deployment & Testing

### Step 1: Database Setup
```bash
mysql -h localhost -u root -p rfid_dashboard < reader_maps_setup.sql
```

### Step 2: Update Backend
- Copy the endpoint code into `backend/src/server.ts`
- Restart backend server: `npm start`

### Step 3: Update Frontend
- Update `src/pages/LocationPage.tsx`
- Update `src/services/apiService.ts`
- Rebuild frontend: `npm run build`

### Step 4: Test Workflow
1. **Create Map:**
   - Go to Devices page, map icon in header
   - Click "Upload Map"
   - Select image and name
   - Submit

2. **Add Readers to Map:**
   - Select map from list
   - Click "Add Readers"
   - Click position on map to place reader
   - Verify position appears

3. **View Real-time Data:**
   - Marker colors change based on device status
   - Tag count updates every 30 seconds
   - Hover shows device details

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Image upload fails | Check file size (< 10MB), format (PNG/JPG) |
| Readers not appearing | Verify devices exist in devices table |
| Map loads slowly | Implement image compression |
| Positions not saving | Check database connection |

---

**Status:** Ready for Implementation  
**Effort:** 2-3 days  
**Complexity:** Medium
