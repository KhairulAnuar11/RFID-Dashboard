# RFID Dashboard Backend - Quick Start Template

This document provides a minimal working backend implementation to get you started quickly.

## Quick Setup

### 1. Create Backend Directory
```bash
mkdir backend
cd backend
npm init -y
```

### 2. Install Dependencies
```bash
npm install express mysql2 mqtt jsonwebtoken bcryptjs cors dotenv helmet compression
npm install -D typescript @types/node @types/express @types/jsonwebtoken @types/cors ts-node nodemon
```

### 3. TypeScript Configuration

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### 4. Package.json Scripts

Update `package.json`:
```json
{
  "scripts": {
    "dev": "nodemon src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

## Minimal Backend Implementation

### File: `src/server.ts`

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import mqtt from 'mqtt';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true
}));
app.use(compression());
app.use(express.json());

// Database Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME || 'rfid_tracking',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// MQTT Client
let mqttClient: mqtt.MqttClient | null = null;

function connectMQTT() {
  const brokerUrl = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
  mqttClient = mqtt.connect(brokerUrl, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clientId: `rfid_backend_${Math.random().toString(16).substr(2, 8)}`
  });

  mqttClient.on('connect', () => {
    console.log('[MQTT] Connected to broker');
    mqttClient?.subscribe('rfid/readers/+/tags', { qos: 1 });
  });

  mqttClient.on('message', async (topic, payload) => {
    try {
      const data = JSON.parse(payload.toString());
      await saveTagData(data);
    } catch (error) {
      console.error('[MQTT] Error processing message:', error);
    }
  });

  mqttClient.on('error', (error) => {
    console.error('[MQTT] Connection error:', error);
  });
}

// Save tag data to database
async function saveTagData(data: any) {
  try {
    const query = `
      INSERT INTO rfid_tags (id, tag_id, epc, rssi, reader_id, reader_name, timestamp, antenna, read_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await pool.execute(query, [
      data.id || `tag-${Date.now()}`,
      data.tagId,
      data.epc,
      data.rssi,
      data.readerId,
      data.readerName,
      data.timestamp || new Date().toISOString(),
      data.antenna,
      data.count || 1
    ]);
  } catch (error) {
    console.error('[DB] Error saving tag data:', error);
  }
}

// Auth Middleware
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// ============= ROUTES =============

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Authentication
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const [users]: any = await pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    await pool.execute(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Get Tags
app.get('/api/tags', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 100, startDate, endDate, readerId } = req.query;
    
    let query = 'SELECT * FROM rfid_tags WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      query += ' AND timestamp >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND timestamp <= ?';
      params.push(endDate);
    }
    if (readerId) {
      query += ' AND reader_id = ?';
      params.push(readerId);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string));
    params.push((parseInt(page as string) - 1) * parseInt(limit as string));

    const [tags] = await pool.execute(query, params);
    const [[{ total }]] = await pool.execute('SELECT COUNT(*) as total FROM rfid_tags') as any;

    res.json({
      success: true,
      data: {
        tags,
        total,
        page: parseInt(page as string),
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('[Tags] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tags' });
  }
});

// Get Dashboard Stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const [[tagsToday]] = await pool.execute(
      'SELECT COUNT(*) as count FROM rfid_tags WHERE DATE(timestamp) = CURDATE()'
    ) as any;

    const [[activeReaders]] = await pool.execute(
      'SELECT COUNT(*) as count FROM devices WHERE status = "online"'
    ) as any;

    const [[uniqueTags]] = await pool.execute(
      'SELECT COUNT(DISTINCT tag_id) as count FROM rfid_tags'
    ) as any;

    const [[offlineDevices]] = await pool.execute(
      'SELECT COUNT(*) as count FROM devices WHERE status = "offline"'
    ) as any;

    res.json({
      success: true,
      data: {
        totalTagsToday: tagsToday.count,
        activeReaders: activeReaders.count,
        uniqueTags: uniqueTags.count,
        errorCount: offlineDevices.count
      }
    });
  } catch (error) {
    console.error('[Dashboard] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// Get Activity Data (24 hours)
app.get('/api/dashboard/activity', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        DATE_FORMAT(timestamp, '%H:00') as time,
        COUNT(*) as count
      FROM rfid_tags
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY DATE_FORMAT(timestamp, '%H:00')
      ORDER BY time
    `);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[Dashboard] Activity error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activity' });
  }
});

// Get Tags by Device
app.get('/api/dashboard/tags-by-device', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        reader_name as device,
        COUNT(*) as count
      FROM rfid_tags
      WHERE DATE(timestamp) = CURDATE()
      GROUP BY reader_name
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[Dashboard] Tags by device error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch data' });
  }
});

// Get Devices
app.get('/api/devices', authenticateToken, async (req, res) => {
  try {
    const [devices] = await pool.execute('SELECT * FROM devices ORDER BY name');
    res.json({ success: true, data: devices });
  } catch (error) {
    console.error('[Devices] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch devices' });
  }
});

// Create Device
app.post('/api/devices', authenticateToken, async (req, res) => {
  try {
    const device = req.body;
    const id = `device-${Date.now()}`;

    await pool.execute(
      `INSERT INTO devices (id, name, type, status, ip_address, mac_address, location, zone, signal_strength, uptime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, device.name, device.type, device.status, device.ipAddress, device.macAddress, 
       device.location, device.zone, device.signalStrength, device.uptime]
    );

    res.json({ success: true, data: { id, ...device } });
  } catch (error) {
    console.error('[Devices] Create error:', error);
    res.status(500).json({ success: false, error: 'Failed to create device' });
  }
});

// Update Device
app.put('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const device = req.body;

    await pool.execute(
      `UPDATE devices SET name=?, status=?, ip_address=?, mac_address=?, location=?, zone=?, signal_strength=?
       WHERE id=?`,
      [device.name, device.status, device.ipAddress, device.macAddress, device.location, 
       device.zone, device.signalStrength, id]
    );

    res.json({ success: true, data: device });
  } catch (error) {
    console.error('[Devices] Update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update device' });
  }
});

// Delete Device
app.delete('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM devices WHERE id = ?', [id]);
    res.json({ success: true, message: 'Device deleted' });
  } catch (error) {
    console.error('[Devices] Delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete device' });
  }
});

// Get Users (Admin only)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const [users] = await pool.execute(
      'SELECT id, username, email, role, created_at, last_login FROM users'
    );

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('[Users] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// Create User (Admin only)
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { username, email, password, role } = req.body;
    const id = `user-${Date.now()}`;
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.execute(
      'INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [id, username, email, passwordHash, role]
    );

    res.json({
      success: true,
      data: { id, username, email, role }
    });
  } catch (error) {
    console.error('[Users] Create error:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

// Delete User (Admin only)
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { id } = req.params;
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('[Users] Delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

// Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[Server] Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  connectMQTT();
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, closing gracefully');
  mqttClient?.end();
  pool.end();
  process.exit(0);
});
```

### 5. Environment Variables

Create `backend/.env`:
```bash
PORT=3001
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=rfid_tracking
DB_USER=rfid_user
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# MQTT
MQTT_BROKER=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

### 6. Database Setup

```sql
-- See DEPLOYMENT_GUIDE.md for complete schema
-- Quick minimal schema:

CREATE DATABASE rfid_tracking;
USE rfid_tracking;

CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

CREATE TABLE devices (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type ENUM('reader', 'antenna') DEFAULT 'reader',
    status ENUM('online', 'offline') DEFAULT 'offline',
    ip_address VARCHAR(45),
    mac_address VARCHAR(17),
    location VARCHAR(200),
    zone VARCHAR(100),
    signal_strength INT DEFAULT 100,
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tags_read_today INT DEFAULT 0,
    uptime VARCHAR(50),
    coordinates_x DECIMAL(10,2),
    coordinates_y DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rfid_tags (
    id VARCHAR(36) PRIMARY KEY,
    tag_id VARCHAR(50) NOT NULL,
    epc VARCHAR(100) NOT NULL,
    rssi INT,
    reader_id VARCHAR(36),
    reader_name VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    antenna INT,
    read_count INT DEFAULT 1,
    INDEX idx_timestamp (timestamp),
    INDEX idx_tag_id (tag_id)
);

-- Create default admin user (password: admin123)
INSERT INTO users (id, username, email, password_hash, role) VALUES 
('admin-001', 'admin', 'admin@example.com', '$2a$10$9Qg0s.JdCILvZkT7Z2CqmeF8W4.X4.3k1vYOJzZnO9X6Uj6vZO5QK', 'admin');
```

### 7. Run Backend

```bash
npm run dev
```

Backend will be available at `http://localhost:3001`

---

## Testing the Backend

### 1. Health Check
```bash
curl http://localhost:3001/api/health
```

### 2. Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 3. Get Tags (with token)
```bash
curl http://localhost:3001/api/tags \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Next Steps

1. ✅ Backend is running
2. ✅ Database is configured
3. ✅ MQTT is connected
4. Update frontend `.env` to point to your backend
5. Start the frontend: `npm run dev`
6. Configure MQTT broker in Settings
7. Start receiving RFID tag data!

---

## Production Considerations

For production deployment:

1. Use proper password hashing (bcrypt with salt rounds 10+)
2. Enable HTTPS
3. Use environment-specific JWT secrets
4. Implement rate limiting
5. Add request validation
6. Setup monitoring and logging
7. Use PM2 for process management
8. Setup automated backups

See `DEPLOYMENT_GUIDE.md` for complete production setup.
