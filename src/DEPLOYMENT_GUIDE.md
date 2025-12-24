# RFID Tracking Dashboard - Deployment Guide

## Overview
This guide provides comprehensive instructions for deploying the RFID Tracking Dashboard system in production.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Frontend Deployment](#frontend-deployment)
3. [Backend Setup](#backend-setup)
4. [MQTT Broker Configuration](#mqtt-broker-configuration)
5. [Database Setup](#database-setup)
6. [Environment Variables](#environment-variables)
7. [Production Checklist](#production-checklist)

---

## Prerequisites

### System Requirements
- Node.js 18.x or higher
- MySQL 8.0 or higher
- MQTT Broker (EMQX, Mosquitto, or HiveMQ)
- npm or yarn package manager

### Development Tools
- Git
- Docker (optional, for containerized deployment)
- PM2 (for process management)

---

## Frontend Deployment

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root (you can copy from `.env.example`):

```bash
# Backend API URL
VITE_API_URL=http://localhost:3001/api

# For production:
# VITE_API_URL=https://your-api-domain.com/api
```

**Note:** The MQTT broker configuration is now managed through the Settings page UI. You don't need to set MQTT environment variables in the frontend.

### 3. Build for Production
```bash
npm run build
```

### 4. Deploy Built Files
The `dist/` directory contains production-ready files. Deploy to:
- **Vercel**: `vercel deploy`
- **Netlify**: `netlify deploy --prod`
- **AWS S3 + CloudFront**: Upload `dist/` folder
- **Nginx**: Copy to `/var/www/html/`

### Sample Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/html/rfid-dashboard;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy (optional)
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Backend Setup

### 1. Backend Stack
- **Runtime**: Node.js + Express
- **Database**: MySQL 8.0+
- **Real-time**: MQTT.js client
- **Authentication**: JWT (JSON Web Tokens)

### 2. Backend Project Structure
```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── mqtt.ts
│   │   └── jwt.ts
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── tagsController.ts
│   │   ├── devicesController.ts
│   │   ├── dashboardController.ts
│   │   └── usersController.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   └── validation.ts
│   ├── models/
│   │   ├── User.ts
│   │   ├── Device.ts
│   │   ├── RFIDTag.ts
│   │   └── SystemConfig.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── tags.ts
│   │   ├── devices.ts
│   │   ├── dashboard.ts
│   │   └── users.ts
│   ├── services/
│   │   ├── mqttService.ts
│   │   ├── databaseService.ts
│   │   └── analyticsService.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── helpers.ts
│   └── server.ts
├── .env
├── package.json
└── tsconfig.json
```

### 3. Install Backend Dependencies
```bash
cd backend
npm install express mysql2 mqtt jsonwebtoken bcryptjs cors dotenv helmet compression
npm install -D typescript @types/node @types/express @types/jsonwebtoken ts-node nodemon
```

### 4. Backend Environment Variables
Create `backend/.env`:
```bash
# Server Configuration
PORT=3001
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=rfid_tracking
DB_USER=rfid_user
DB_PASSWORD=your_secure_password

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your_refresh_token_secret

# MQTT Configuration
MQTT_BROKER=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_CLIENT_ID=rfid_backend_server

# CORS Configuration
ALLOWED_ORIGINS=https://your-frontend-domain.com,http://localhost:5173

# Data Retention
DATA_RETENTION_DAYS=30
CLEANUP_INTERVAL=86400000
```

### 5. Start Backend Server
```bash
# Development
npm run dev

# Production with PM2
pm2 start dist/server.js --name rfid-api
pm2 save
pm2 startup
```

---

## MQTT Broker Configuration

### Option 1: EMQX Cloud (Recommended for Production)
1. Sign up at [EMQX Cloud](https://www.emqx.com/en/cloud)
2. Create a deployment
3. Configure authentication
4. Note connection details (broker URL, port, credentials)

### Option 2: Self-Hosted EMQX
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
# Default: admin / public
```

### Option 3: Mosquitto
```bash
# Install Mosquitto
sudo apt-get install mosquitto mosquitto-clients

# Configure authentication
sudo nano /etc/mosquitto/mosquitto.conf

# Add:
allow_anonymous false
password_file /etc/mosquitto/passwd

# Create user
sudo mosquitto_passwd -c /etc/mosquitto/passwd rfid_user

# Restart
sudo systemctl restart mosquitto
```

### MQTT Topics Structure
```
rfid/readers/{reader_id}/tags     - Tag reads from specific reader
rfid/readers/{reader_id}/status   - Reader status updates
rfid/events                        - System events
rfid/alerts                        - Alert notifications
```

---

## Database Setup

### 1. Create Database
```sql
CREATE DATABASE rfid_tracking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'rfid_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON rfid_tracking.* TO 'rfid_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Database Schema
```sql
-- Users Table
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_username (username),
    INDEX idx_email (email)
);

-- Devices Table
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
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    tags_read_today INT DEFAULT 0,
    uptime VARCHAR(50),
    coordinates_x DECIMAL(10,2),
    coordinates_y DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_location (location)
);

-- RFID Tags Table
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
    INDEX idx_tag_id (tag_id),
    INDEX idx_epc (epc),
    INDEX idx_reader_id (reader_id),
    INDEX idx_timestamp (timestamp),
    FOREIGN KEY (reader_id) REFERENCES devices(id) ON DELETE SET NULL
);

-- System Configuration Table
CREATE TABLE system_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Session Table (for JWT refresh tokens)
CREATE TABLE sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert default admin user (password: admin123 - change in production!)
INSERT INTO users (id, username, email, password_hash, role) VALUES 
('admin-001', 'admin', 'admin@rfid-dashboard.com', '$2a$10$XqYZ...', 'admin');
```

### 3. Database Migrations
Consider using a migration tool like:
- **Knex.js**
- **Sequelize**
- **TypeORM**
- **Prisma**

---

## Environment Variables

### Frontend (.env)
```bash
VITE_API_URL=https://api.your-domain.com/api
VITE_MQTT_BROKER=mqtt.your-domain.com
VITE_MQTT_PORT=8083
VITE_MQTT_PROTOCOL=wss
VITE_APP_NAME=RFID Tracking Dashboard
VITE_APP_VERSION=1.0.0
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_EXPORT=true
VITE_ENABLE_REALTIME=true
VITE_DATA_RETENTION_DAYS=30
VITE_AUTO_REFRESH_INTERVAL=5000
```

### Backend (.env)
```bash
PORT=3001
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_NAME=rfid_tracking
DB_USER=rfid_user
DB_PASSWORD=secure_password
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h
MQTT_BROKER=mqtt://localhost:1883
MQTT_USERNAME=rfid_user
MQTT_PASSWORD=mqtt_password
```

---

## Production Checklist

### Security
- [ ] Change all default passwords
- [ ] Use HTTPS for frontend
- [ ] Enable CORS with specific origins
- [ ] Implement rate limiting
- [ ] Use environment variables for secrets
- [ ] Enable SQL injection protection
- [ ] Implement XSS protection
- [ ] Use secure WebSocket (WSS) for MQTT
- [ ] Enable JWT token expiration
- [ ] Implement password hashing (bcrypt)

### Performance
- [ ] Enable Gzip compression
- [ ] Implement database indexing
- [ ] Use connection pooling
- [ ] Enable caching (Redis)
- [ ] Optimize SQL queries
- [ ] Implement lazy loading
- [ ] Use CDN for static assets

### Monitoring
- [ ] Setup error logging (Winston, Morgan)
- [ ] Implement health check endpoints
- [ ] Monitor API response times
- [ ] Track MQTT connection status
- [ ] Setup alerts for failures
- [ ] Monitor database performance

### Backup
- [ ] Automated database backups
- [ ] Backup MQTT broker configuration
- [ ] Document recovery procedures
- [ ] Test restore procedures

### Documentation
- [ ] API documentation (Swagger/OpenAPI)
- [ ] User manual
- [ ] Admin guide
- [ ] Deployment runbook

---

## Docker Deployment (Optional)

### Dockerfile (Frontend)
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose
```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    environment:
      - VITE_API_URL=http://backend:3001/api

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - DB_HOST=mysql
      - MQTT_BROKER=mqtt://emqx:1883
    depends_on:
      - mysql
      - emqx

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=rootpass
      - MYSQL_DATABASE=rfid_tracking
      - MYSQL_USER=rfid_user
      - MYSQL_PASSWORD=rfidpass
    volumes:
      - mysql_data:/var/lib/mysql

  emqx:
    image: emqx/emqx:latest
    ports:
      - "1883:1883"
      - "8083:8083"
      - "18083:18083"

volumes:
  mysql_data:
```

---

## Support & Resources

- **GitHub Repository**: [Your repo URL]
- **Documentation**: [Your docs URL]
- **Issue Tracker**: [Your issues URL]
- **Email Support**: support@your-domain.com

---

**Last Updated**: December 2024
**Version**: 1.0.0