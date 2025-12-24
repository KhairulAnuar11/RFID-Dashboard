# RFID Tracking Dashboard - Quick Start Guide

Welcome! This guide will help you get the RFID Tracking Dashboard up and running in minutes.

## 🎯 What You'll Need

1. **Frontend** (This project)
2. **Backend API** (Node.js server - setup below)
3. **MySQL Database**
4. **MQTT Broker** (Public or private)

## ⚡ 5-Minute Setup

### Step 1: Frontend Setup (2 minutes)

```bash
# Clone and install
git clone <your-repo>
cd rfid-tracking-dashboard
npm install

# Copy environment file and configure
cp .env.example .env
# Edit .env to set your backend API URL (default: http://localhost:3001/api)

# Start development server
npm run dev
```

Frontend runs at `http://localhost:5173`

**Environment Configuration:**
- The `.env` file contains the `VITE_API_URL` variable
- Default value: `http://localhost:3001/api`
- For production, update this to your production API URL

### Step 2: Quick Test with Mock Mode (Optional)

You can test the frontend immediately without a backend by using these login credentials:

```
Username: admin
Password: admin
```

**Note**: Without a real backend, data won't persist and MQTT won't work. Continue to Step 3 for full functionality.

### Step 3: Database Setup (3 minutes)

```sql
-- 1. Create database
CREATE DATABASE rfid_tracking;
USE rfid_tracking;

-- 2. Create tables (minimal schema)
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

-- 3. Create admin user (password: admin123)
INSERT INTO users (id, username, email, password_hash, role) VALUES 
('admin-001', 'admin', 'admin@example.com', 
 '$2a$10$9Qg0s.JdCILvZkT7Z2CqmeF8W4.X4.3k1vYOJzZnO9X6Uj6vZO5QK', 'admin');

-- 4. Add sample devices
INSERT INTO devices (id, name, status, ip_address, mac_address, location, zone, signal_strength, uptime) VALUES
('device-001', 'Reader-Warehouse-A', 'online', '192.168.1.100', '00:1B:44:11:3A:B7', 'Warehouse A - Gate 1', 'Zone A', 95, '5d 12h'),
('device-002', 'Reader-Warehouse-B', 'online', '192.168.1.101', '00:1B:44:11:3A:B8', 'Warehouse B - Gate 2', 'Zone B', 88, '3d 8h');
```

### Step 4: Backend Setup (5 minutes)

See `BACKEND_STARTER.md` for the complete minimal backend code.

Quick setup:
```bash
# Create backend folder
mkdir backend
cd backend

# Copy backend template from BACKEND_STARTER.md
# Or download from: [link]

# Install dependencies
npm install express mysql2 mqtt jsonwebtoken bcryptjs cors dotenv helmet compression
npm install -D typescript @types/node @types/express ts-node nodemon

# Create .env file
cat > .env << EOF
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_NAME=rfid_tracking
DB_USER=root
DB_PASSWORD=your_password
JWT_SECRET=change_this_secret_in_production
MQTT_BROKER=mqtt://localhost:1883
ALLOWED_ORIGINS=http://localhost:5173
EOF

# Start server
npm run dev
```

Backend runs at `http://localhost:3001`

### Step 5: MQTT Broker (Choose One)

#### Option A: Public Broker (Fastest - No Setup)
Use `broker.emqx.io` - Already configured in the dashboard!

1. Open dashboard at `http://localhost:5173`
2. Login with: `admin` / `admin123`
3. Go to **Settings** → **MQTT Settings**
4. Click **Connect to MQTT** (already configured for public broker)
5. Done! ✅

#### Option B: Local Mosquitto (Recommended for Production)
```bash
# Install
sudo apt-get install mosquitto mosquitto-clients

# Start
sudo systemctl start mosquitto
sudo systemctl enable mosquitto

# Test
mosquitto_pub -t "test/topic" -m "Hello MQTT"
```

#### Option C: Docker EMQX (Best for Development)
```bash
docker run -d --name emqx \
  -p 1883:1883 -p 8083:8083 -p 18083:18083 \
  emqx/emqx:latest

# Access dashboard: http://localhost:18083
# Default: admin / public
```

### Step 6: Configure MQTT Connection

1. Open dashboard at `http://localhost:5173`
2. Login as admin
3. Navigate to **Settings & Configuration**
4. Go to **MQTT Settings** tab
5. Enter your broker details:

**For Public Broker (broker.emqx.io):**
```
Broker Address: broker.emqx.io
Port: 8083
Protocol: WebSocket Secure (WSS)
Topics: rfid/readers/+/tags
```

**For Local Mosquitto:**
```
Broker Address: localhost
Port: 1883
Protocol: MQTT (TCP)
Topics: rfid/readers/+/tags
```

6. Click **Connect to MQTT** button
7. Check for "MQTT Connected" status

### Step 7: Test with Sample Data

Send a test RFID tag read:

```bash
# If using Mosquitto
mosquitto_pub -h localhost -t "rfid/readers/reader-001/tags" \
  -m '{"tagId":"TAG000123","epc":"3034257BF7194E4000000001","rssi":-45,"readerId":"reader-001","readerName":"Test Reader","timestamp":"2024-12-12T10:30:45Z","antenna":1,"count":1}'

# If using EMQX web interface
# Go to http://localhost:18083
# Navigate to: Tools → WebSocket
# Connect and publish the above message
```

## 🎉 You're Done!

Your dashboard should now:
- ✅ Show live RFID tag reads
- ✅ Display real-time statistics
- ✅ Update charts automatically
- ✅ Allow device management
- ✅ Support user management (admin)

## 📱 Access the Dashboard

1. **Login Page**: `http://localhost:5173/login`
2. **Dashboard**: `http://localhost:5173/dashboard`
3. **Credentials**: `admin` / `admin123`

## 🔧 Common Issues & Solutions

### Issue: "Cannot connect to API"
**Solution**: Make sure backend is running on port 3001
```bash
cd backend && npm run dev
```

### Issue: "MQTT connection failed"
**Solution**: 
- Check broker is running
- Verify firewall allows connection
- Try public broker first: `broker.emqx.io:8083` with `wss` protocol

### Issue: "Login failed"
**Solution**:
- Check database is running
- Verify user exists in database
- Default credentials: `admin` / `admin123`

### Issue: "No data showing"
**Solution**:
1. Check MQTT is connected (green indicator)
2. Publish test message (see Step 7)
3. Check browser console for errors

## 📚 Next Steps

### Production Deployment
See `DEPLOYMENT_GUIDE.md` for:
- Docker deployment
- Cloud hosting (AWS, Azure, GCP)
- SSL/TLS configuration
- Performance optimization
- Security hardening

### Advanced Configuration
- **API Documentation**: `API_COLLECTION.json` (Import to Postman)
- **Database Schema**: Full schema in `DEPLOYMENT_GUIDE.md`
- **MQTT Topics**: Configure custom topics in Settings
- **User Management**: Add users in Settings (Admin only)
- **Data Export**: Export tag data as CSV/Excel/PDF

### Development
```bash
# Frontend development
npm run dev

# Backend development
cd backend && npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🆘 Need Help?

1. **Documentation**: Check `README.md` and `DEPLOYMENT_GUIDE.md`
2. **API Reference**: Import `API_COLLECTION.json` to Postman
3. **Backend Template**: See `BACKEND_STARTER.md`
4. **Issues**: [GitHub Issues](https://github.com/yourusername/rfid-tracking-dashboard/issues)

## 🎯 Quick Commands Reference

```bash
# Frontend
npm install          # Install dependencies
npm run dev          # Start development
npm run build        # Build for production
npm run preview      # Preview production build

# Backend
cd backend
npm install          # Install dependencies
npm run dev          # Start development
npm run build        # Build TypeScript
npm start            # Start production

# Database
mysql -u root -p     # Connect to MySQL
source schema.sql    # Import schema

# MQTT Testing
mosquitto_pub -h localhost -t "rfid/readers/test/tags" -m '{"tagId":"TEST001",...}'
mosquitto_sub -h localhost -t "rfid/#"  # Subscribe to all RFID topics
```

## 🌟 Features Overview

| Feature | Status | Location |
|---------|--------|----------|
| Real-time Tag Tracking | ✅ Ready | Dashboard |
| Device Management | ✅ Ready | Devices Page |
| User Management | ✅ Ready | Settings (Admin) |
| MQTT Configuration | ✅ Ready | Settings |
| Data Export | ✅ Ready | Tags Page |
| Location Mapping | ✅ Ready | Location Page |
| Role-based Access | ✅ Ready | Authentication |
| Interactive Charts | ✅ Ready | Dashboard |
| Mobile Responsive | ✅ Ready | All Pages |

## 🔐 Default Credentials

```
Admin Account:
Username: admin
Password: admin123
Email: admin@example.com

⚠️ IMPORTANT: Change these credentials in production!
```

---

**Ready to go!** Start the frontend and backend, configure MQTT, and you'll see real-time RFID data flowing through your dashboard! 🚀

For detailed documentation, see:
- `README.md` - Complete project documentation
- `DEPLOYMENT_GUIDE.md` - Production deployment guide
- `BACKEND_STARTER.md` - Backend implementation template
- `API_COLLECTION.json` - API testing collection

Happy tracking! 📡