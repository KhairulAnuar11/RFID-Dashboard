# RFID Tracking Dashboard - Complete System Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [File Structure](#file-structure)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [MQTT Integration](#mqtt-integration)
8. [Data Flow](#data-flow)
9. [Features](#features)
10. [Setup Instructions](#setup-instructions)

---

## System Overview

The RFID Tracking Dashboard is a real-time monitoring system that receives RFID tag data from multiple readers via MQTT (EMQX broker) and displays it through an intuitive web interface.

**Key Capabilities:**
- Real-time tag tracking and visualization
- Multi-device management
- Location-based reader mapping
- Advanced filtering and search
- Data export (CSV, Excel, PDF)
- Role-based access control
- Real-time analytics and charts

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        RFID READERS                             │
│  (Multiple readers with RFID antennas at different locations)  │
└─────────────────┬───────────────────────────────────────────────┘
                  │ RFID Tag Events
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MQTT BROKER (EMQX)                           │
│              Topics: rfid/readers/+/tags                        │
│                      rfid/events                                │
└─────────────────┬───────────────────────────────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
┌──────────────┐   ┌──────────────────┐
│   Backend    │   │    Frontend      │
│  (Node.js)   │   │   (React App)    │
│              │   │                  │
│ - Subscribe  │   │ - MQTT.js for    │
│   to MQTT    │   │   real-time      │
│ - Process    │   │ - REST API calls │
│   data       │   │ - Visualization  │
│ - Store in   │   │                  │
│   MySQL      │   │                  │
└──────┬───────┘   └────────┬─────────┘
       │                    │
       ▼                    │
┌──────────────┐            │
│    MySQL     │◄───────────┘
│   Database   │   REST API
└──────────────┘
```

### Component Responsibilities

**RFID Readers:**
- Read RFID tags
- Publish tag data to MQTT broker
- Send heartbeat signals

**MQTT Broker (EMQX):**
- Receive tag events from readers
- Distribute messages to subscribers
- Handle connection management

**Backend Service (Node.js + TypeScript):**
- Subscribe to MQTT topics
- Parse and validate tag data
- Store events in MySQL database
- Provide REST API for frontend
- Handle authentication (JWT)

**Frontend (React + TypeScript):**
- Connect to MQTT for real-time updates
- Query REST API for historical data
- Render dashboards and visualizations
- Handle user interactions

**Database (MySQL):**
- Store tag events
- Store device configurations
- Store user accounts
- Maintain system configuration

---

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **React Router v6** for navigation
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **MQTT.js** for MQTT client
- **Lucide React** for icons

### Backend (Production Implementation)
- **Node.js 18+** with TypeScript
- **Express.js** for REST API
- **MQTT.js** for MQTT client
- **MySQL2/promise** for database
- **jsonwebtoken** for authentication
- **bcrypt** for password hashing

### Database
- **MySQL 8.0+**
- Relational schema with indexes
- Transaction support

### MQTT Broker
- **EMQX** (or any MQTT 3.1.1/5.0 broker)
- WebSocket support for browser clients

---

## File Structure

```
/
├── App.tsx                      # Main application component
├── styles/
│   └── globals.css              # Global styles and Tailwind config
│
├── types/
│   └── index.ts                 # TypeScript type definitions
│
├── context/
│   ├── AuthContext.tsx          # Authentication state management
│   └── RFIDContext.tsx          # RFID data state management
│
├── services/
│   ├── authService.ts           # Authentication API calls
│   └── mqttService.ts           # MQTT client implementation
│
├── utils/
│   ├── mockData.ts              # Mock data generators
│   └── exportUtils.ts           # CSV/Excel/PDF export functions
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx          # Navigation sidebar
│   │   └── Header.tsx           # Page header with search
│   │
│   ├── ui/
│   │   ├── StatCard.tsx         # Statistics display card
│   │   ├── DataTable.tsx        # Reusable data table with pagination
│   │   └── ExportButton.tsx     # Export dropdown button
│   │
│   └── charts/
│       ├── LineChartWidget.tsx  # Line chart component
│       └── BarChartWidget.tsx   # Bar chart component
│
└── pages/
    ├── LoginPage.tsx            # Login/authentication page
    ├── DashboardPage.tsx        # Main dashboard overview
    ├── TagsPage.tsx             # Tag data management
    ├── DevicesPage.tsx          # Device/reader management
    ├── LocationPage.tsx         # Reader location map
    ├── SettingsPage.tsx         # System configuration
    └── HelpPage.tsx             # Documentation and support
```

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_username (username),
  INDEX idx_email (email)
);
```

### Devices Table
```sql
CREATE TABLE devices (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type ENUM('reader', 'antenna') DEFAULT 'reader',
  status ENUM('online', 'offline') DEFAULT 'offline',
  ip_address VARCHAR(45),
  mac_address VARCHAR(17),
  location VARCHAR(255),
  zone VARCHAR(100),
  coordinates_x INT,
  coordinates_y INT,
  signal_strength INT DEFAULT 100,
  last_heartbeat TIMESTAMP NULL,
  tags_read_today INT DEFAULT 0,
  uptime VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_location (location),
  INDEX idx_zone (zone)
);
```

### RFID Events Table
```sql
CREATE TABLE rfid_events (
  id VARCHAR(36) PRIMARY KEY,
  tag_id VARCHAR(50) NOT NULL,
  epc VARCHAR(100) NOT NULL,
  rssi INT,
  reader_id VARCHAR(36) NOT NULL,
  antenna INT,
  read_count INT DEFAULT 1,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reader_id) REFERENCES devices(id) ON DELETE CASCADE,
  INDEX idx_tag_id (tag_id),
  INDEX idx_epc (epc),
  INDEX idx_reader_id (reader_id),
  INDEX idx_timestamp (timestamp),
  INDEX idx_created_at (created_at)
);
```

### System Configuration Table
```sql
CREATE TABLE system_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT,
  description VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_config_key (config_key)
);
```

### Entity Relationship Diagram (ERD)

```
┌──────────────────┐
│     users        │
├──────────────────┤
│ id (PK)          │
│ username         │
│ email            │
│ password_hash    │
│ role             │
│ created_at       │
│ last_login       │
│ is_active        │
└──────────────────┘

┌──────────────────┐         ┌──────────────────┐
│    devices       │         │  rfid_events     │
├──────────────────┤         ├──────────────────┤
│ id (PK)          │◄────┐   │ id (PK)          │
│ name             │     │   │ tag_id           │
│ type             │     │   │ epc              │
│ status           │     │   │ rssi             │
│ ip_address       │     └───│ reader_id (FK)   │
│ mac_address      │         │ antenna          │
│ location         │         │ read_count       │
│ zone             │         │ timestamp        │
│ coordinates_x    │         │ created_at       │
│ coordinates_y    │         └──────────────────┘
│ signal_strength  │
│ last_heartbeat   │
│ tags_read_today  │
│ uptime           │
│ created_at       │
│ updated_at       │
└──────────────────┘

┌──────────────────┐
│ system_config    │
├──────────────────┤
│ id (PK)          │
│ config_key       │
│ config_value     │
│ description      │
│ updated_at       │
└──────────────────┘
```

---

## API Endpoints

### Authentication
```
POST   /api/auth/login
  Body: { username, password }
  Response: { success, user, token }

POST   /api/auth/logout
  Headers: { Authorization: Bearer <token> }
  Response: { success }

POST   /api/auth/refresh
  Body: { token }
  Response: { token }
```

### RFID Events
```
GET    /api/tags
  Query: ?page=1&limit=20&readerId=xxx&startDate=xxx&endDate=xxx
  Response: { tags: [], total, page, limit }

GET    /api/tags/:id
  Response: { tag }

GET    /api/tags/stats
  Response: { totalToday, uniqueTags, totalReads }

GET    /api/tags/export
  Query: ?format=csv|excel|pdf&filters=xxx
  Response: File download
```

### Devices
```
GET    /api/devices
  Response: { devices: [] }

GET    /api/devices/:id
  Response: { device }

POST   /api/devices
  Body: { name, type, ipAddress, macAddress, location, zone }
  Response: { device }

PUT    /api/devices/:id
  Body: { ...updates }
  Response: { device }

DELETE /api/devices/:id
  Response: { success }

GET    /api/devices/:id/stats
  Response: { tagsToday, uptime, signalStrength }
```

### System Configuration
```
GET    /api/config
  Response: { config }

PUT    /api/config
  Body: { mqttConfig, dataRetentionDays, ... }
  Response: { config }
```

### Users (Admin only)
```
GET    /api/users
  Response: { users: [] }

POST   /api/users
  Body: { username, email, password, role }
  Response: { user }

PUT    /api/users/:id
  Body: { ...updates }
  Response: { user }

DELETE /api/users/:id
  Response: { success }
```

---

## MQTT Integration

### Topics Structure
```
rfid/readers/+/tags      # Tag read events from all readers
rfid/readers/:id/tags    # Tag read events from specific reader
rfid/readers/+/heartbeat # Heartbeat signals from readers
rfid/events              # General system events
rfid/config              # Configuration updates
```

### Message Formats

**Tag Read Event:**
```json
{
  "type": "tag_read",
  "readerId": "reader-001",
  "timestamp": "2025-12-11T10:30:45.123Z",
  "tag": {
    "id": "TAG001234",
    "epc": "E200341012345678ABCD0001",
    "rssi": -45,
    "antenna": 1,
    "count": 5
  }
}
```

**Heartbeat:**
```json
{
  "type": "heartbeat",
  "readerId": "reader-001",
  "timestamp": "2025-12-11T10:30:45.123Z",
  "status": "online",
  "signalStrength": 95,
  "tagsReadToday": 1234
}
```

### Backend MQTT Subscriber (Node.js)

```typescript
import mqtt from 'mqtt';
import mysql from 'mysql2/promise';

const client = mqtt.connect('mqtt://broker.emqx.io:1883', {
  clientId: 'rfid-backend-' + Math.random().toString(16).substr(2, 8),
  username: 'your-username',
  password: 'your-password'
});

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  client.subscribe('rfid/readers/+/tags');
  client.subscribe('rfid/readers/+/heartbeat');
});

client.on('message', async (topic, payload) => {
  const message = JSON.parse(payload.toString());
  
  if (topic.includes('/tags')) {
    await handleTagRead(message);
  } else if (topic.includes('/heartbeat')) {
    await handleHeartbeat(message);
  }
});

async function handleTagRead(message: any) {
  const pool = await getDbPool();
  await pool.query(
    `INSERT INTO rfid_events 
     (id, tag_id, epc, rssi, reader_id, antenna, read_count, timestamp)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.tag.id,
      message.tag.epc,
      message.tag.rssi,
      message.readerId,
      message.tag.antenna,
      message.tag.count,
      message.timestamp
    ]
  );
}

async function handleHeartbeat(message: any) {
  const pool = await getDbPool();
  await pool.query(
    `UPDATE devices 
     SET status = ?, signal_strength = ?, last_heartbeat = ?
     WHERE id = ?`,
    [message.status, message.signalStrength, message.timestamp, message.readerId]
  );
}
```

---

## Data Flow

### Tag Read Flow
```
1. RFID Reader detects tag
   ↓
2. Reader publishes to MQTT: rfid/readers/{id}/tags
   ↓
3. Backend MQTT client receives message
   ↓
4. Backend validates and parses data
   ↓
5. Backend stores event in MySQL (rfid_events table)
   ↓
6. Frontend MQTT client receives same message (real-time)
   ↓
7. Frontend updates UI immediately
   ↓
8. Frontend can also query REST API for historical data
```

### Device Status Flow
```
1. RFID Reader sends heartbeat every 30 seconds
   ↓
2. Published to: rfid/readers/{id}/heartbeat
   ↓
3. Backend updates device status in MySQL
   ↓
4. Frontend polls REST API or receives via MQTT
   ↓
5. UI shows online/offline status
```

---

## Features

### 1. Login Page
- Username/password authentication
- JWT token generation
- Role-based access (admin/user)
- Demo credentials provided

### 2. Dashboard Overview
- Real-time statistics cards
- 24-hour tag activity chart
- Tags per device bar chart
- Live tag activity stream
- Connection status indicator

### 3. Tag Data Module
- Searchable tag table
- Multi-column filtering
- Date range picker
- Pagination
- Export to CSV/Excel/PDF
- RSSI signal strength indicators

### 4. Devices Module
- Device grid view
- Add/Edit/Delete devices
- Online/offline status
- Signal strength monitoring
- Network information
- Tags read statistics

### 5. Reader Location Map
- Interactive floor plan
- Device markers with status
- Zone-based heatmap
- Click for device details
- Zoom controls
- Zone activity statistics

### 6. Settings & Configuration
- MQTT broker configuration
- Data retention settings
- Auto-refresh interval
- API key management
- User management (admin only)

### 7. Help & Documentation
- User guide
- FAQ with expandable sections
- Troubleshooting steps
- Contact support form

---

## Setup Instructions

### Frontend Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Backend Setup (Production)
```bash
# Install dependencies
npm install

# Create .env file
cat > .env << EOF
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=rfid_user
DB_PASSWORD=your_password
DB_NAME=rfid_tracking
JWT_SECRET=your_jwt_secret
MQTT_BROKER=mqtt://broker.emqx.io:1883
MQTT_USERNAME=
MQTT_PASSWORD=
EOF

# Run migrations
npm run migrate

# Start server
npm run start
```

### Database Setup
```bash
# Create database
mysql -u root -p
CREATE DATABASE rfid_tracking;
CREATE USER 'rfid_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON rfid_tracking.* TO 'rfid_user'@'localhost';

# Run schema
mysql -u rfid_user -p rfid_tracking < schema.sql
```

### MQTT Broker Setup (EMQX)
```bash
# Using Docker
docker run -d --name emqx \
  -p 1883:1883 \
  -p 8083:8083 \
  -p 8084:8084 \
  -p 8883:8883 \
  -p 18083:18083 \
  emqx/emqx:latest

# Access dashboard at http://localhost:18083
# Default credentials: admin/public
```

---

## Demo Credentials

- **Admin User:** username: `admin` / password: `admin`
- **Regular User:** username: `user` / password: `user`

---

## Future Enhancements

1. **Advanced Analytics**
   - Dwell time analysis
   - Tag movement patterns
   - Predictive analytics

2. **Alerts & Notifications**
   - Email/SMS alerts
   - Webhook integrations
   - Custom alert rules

3. **Reporting**
   - Scheduled reports
   - Custom report builder
   - Dashboard snapshots

4. **Mobile App**
   - React Native mobile application
   - Push notifications
   - Offline support

5. **Integration**
   - REST API webhooks
   - Third-party system integration
   - SSO authentication

---

## Support

For questions or issues, refer to the Help page in the application or contact support@rfidtracker.com.
