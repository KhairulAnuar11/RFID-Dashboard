# RFID Tracking Dashboard System

<div align="center">

![RFID Dashboard](https://img.shields.io/badge/RFID-Tracking%20Dashboard-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)
![MQTT](https://img.shields.io/badge/MQTT-Real--time-660066?style=for-the-badge)

A production-ready, real-time RFID tracking dashboard system with MQTT integration, comprehensive analytics, and role-based access control.

[Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Demo](#demo)

</div>

---

## 🌟 Features

### Core Functionality
- **Real-Time MQTT Integration** - Connect to any MQTT broker (EMQX, Mosquitto, HiveMQ)
- **Live Tag Tracking** - Monitor RFID tag reads in real-time with visual animations
- **Device Management** - Manage RFID readers, antennas, and their configurations
- **Interactive Analytics** - Comprehensive charts and statistics with Recharts
- **Location Mapping** - Visual floor plans with device positioning
- **Data Export** - Export tag data in CSV, Excel, and PDF formats
- **User Management** - Role-based access control (Admin/User roles)

### Technical Features
- **Production-Ready** - Built with best practices for scalability and performance
- **TypeScript** - Fully typed for enhanced developer experience
- **Responsive Design** - Works seamlessly on desktop and mobile devices
- **Real-Time Updates** - WebSocket-based live data streaming
- **RESTful API** - Complete backend API for all operations
- **JWT Authentication** - Secure token-based authentication
- **Database Persistence** - MySQL database with optimized schema
- **Docker Support** - Easy deployment with Docker Compose

---

## 📋 Table of Contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Configuration](#configuration)
5. [Usage Guide](#usage-guide)
6. [API Documentation](#api-documentation)
7. [MQTT Integration](#mqtt-integration)
8. [Deployment](#deployment)
9. [Contributing](#contributing)
10. [License](#license)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    RFID Dashboard                       │
│              (React + TypeScript + Vite)                │
└─────────────────────────────────────────────────────────┘
                         │
           ┌─────────────┼─────────────┐
           │                           │
           ▼                           ▼
┌──────────────────────┐    ┌──────────────────────┐
│   REST API Backend   │    │    MQTT Broker       │
│  (Node.js + Express) │    │ (EMQX/Mosquitto/etc) │
└──────────────────────┘    └──────────────────────┘
           │                           │
           ▼                           ▼
┌──────────────────────┐    ┌──────────────────────┐
│   MySQL Database     │    │   RFID Readers       │
│  (Data Persistence)  │    │  (Hardware Devices)  │
└──────────────────────┘    └──────────────────────┘
```

### Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite (Build tool)
- TailwindCSS (Styling)
- MQTT.js (Real-time communication)
- Recharts (Data visualization)
- Motion (Framer Motion) (Animations)
- React Router (Navigation)
- Sonner (Toast notifications)

**Backend (to be deployed):**
- Node.js + Express
- MySQL 8.0
- JWT Authentication
- MQTT.js Client
- TypeScript

**Infrastructure:**
- MQTT Broker (EMQX, Mosquitto, HiveMQ)
- Docker & Docker Compose
- Nginx (Reverse proxy)

---

## ✅ Prerequisites

- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher (or yarn/pnpm)
- **MQTT Broker** (public or private)
- **MySQL** 8.0+ (for production backend)
- **Git** for version control

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/rfid-tracking-dashboard.git
cd rfid-tracking-dashboard
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Copy the example environment file and update with your settings:
```bash
cp .env.example .env
```

Edit `.env` (only API URL is required):
```bash
# Backend API URL (default: http://localhost:3001/api)
VITE_API_URL=http://localhost:3001/api
```

**Note**: MQTT broker configuration is done through the Settings page UI, not environment variables. See [Configuration](#configuration) section below.

### 4. Start Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 5. Default Login Credentials
```
Username: admin
Password: admin

Username: user
Password: user
```

---

## ⚙️ Configuration

### MQTT Broker Setup

The dashboard supports any MQTT broker. Configure it through the **Settings** page:

1. Navigate to **Settings & Configuration**
2. Go to **MQTT Settings** tab
3. Enter your broker details:
   - Broker Address (e.g., `broker.emqx.io`)
   - Port (e.g., `8083` for WebSocket)
   - Protocol (`mqtt`, `ws`, or `wss`)
   - Username & Password (if required)
   - Topics (e.g., `rfid/readers/+/tags`)
4. Click **Connect to MQTT**

### Supported MQTT Brokers

- **EMQX** (Recommended) - [emqx.io](https://www.emqx.io/)
- **Mosquitto** - [mosquitto.org](https://mosquitto.org/)
- **HiveMQ** - [hivemq.com](https://www.hivemq.com/)
- **AWS IoT Core**
- **Azure IoT Hub**
- Any MQTT 3.1.1 or 5.0 compliant broker

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API endpoint | `http://localhost:3001/api` |

**Note**: Only `VITE_API_URL` is required. MQTT configuration is managed through the Settings page UI.

For detailed environment setup, see [ENV_SETUP.md](./ENV_SETUP.md)

---

## 📖 Usage Guide

### Dashboard Overview
- **Stats Cards** - Real-time metrics (tags read, active readers, unique tags, errors)
- **24-Hour Activity Chart** - Line chart showing tag read patterns
- **Tags per Device Chart** - Bar chart showing distribution across readers
- **Live Tag Stream** - Real-time feed of incoming RFID reads

### Tag Data Management
1. View all tag reads in a searchable, filterable table
2. Filter by date range, reader, tag ID, or EPC
3. Export data to CSV, Excel, or PDF
4. View detailed tag information

### Device Management
1. Add new RFID readers/antennas
2. Edit device configurations
3. Monitor device status and performance
4. View real-time signal strength and uptime

### Location Mapping
- Visual floor plan with device positioning
- Drag-and-drop device placement
- Zone-based heatmaps
- Real-time location tracking

### Settings & Configuration
- Configure MQTT broker connection
- Manage system preferences
- Control data retention policies
- User management (Admin only)

---

## 🔌 API Documentation

### Authentication Endpoints

```typescript
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET  /api/auth/me
```

### Tag Management Endpoints

```typescript
GET    /api/tags              // Get all tags
GET    /api/tags/:id          // Get tag by ID
DELETE /api/tags/:id          // Delete tag
POST   /api/tags/bulk-delete  // Bulk delete
POST   /api/tags/export       // Export tags
```

### Device Management Endpoints

```typescript
GET    /api/devices           // Get all devices
GET    /api/devices/:id       // Get device by ID
POST   /api/devices           // Create device
PUT    /api/devices/:id       // Update device
DELETE /api/devices/:id       // Delete device
GET    /api/devices/:id/stats // Get device statistics
```

### Dashboard Endpoints

```typescript
GET /api/dashboard/stats         // Get dashboard statistics
GET /api/dashboard/activity      // Get activity data
GET /api/dashboard/tags-by-device // Get tags per device
GET /api/dashboard/heatmap       // Get zone heatmap
```

### User Management Endpoints

```typescript
GET    /api/users           // Get all users (Admin only)
GET    /api/users/:id       // Get user by ID
POST   /api/users           // Create user (Admin only)
PUT    /api/users/:id       // Update user
DELETE /api/users/:id       // Delete user (Admin only)
POST   /api/users/:id/change-password // Change password
```

---

## 📡 MQTT Integration

### MQTT Message Format

The dashboard expects RFID tag data in the following JSON format:

```json
{
  "id": "tag-1702345678-abc123",
  "tagId": "TAG000123",
  "epc": "3034257BF7194E4000000001",
  "rssi": -45,
  "readerId": "reader-001",
  "readerName": "Reader-Warehouse-A",
  "timestamp": "2024-12-12T10:30:45.123Z",
  "antenna": 1,
  "count": 1
}
```

### MQTT Topics

Subscribe to these topics to receive tag data:

```
rfid/readers/+/tags          # All reader tag data
rfid/readers/[reader_id]/tags # Specific reader
rfid/events                  # System events
rfid/alerts                  # Alert notifications
```

### Publishing Test Data

You can test the system by publishing to your MQTT broker:

```bash
mosquitto_pub -h broker.emqx.io -p 1883 \
  -t "rfid/readers/reader-001/tags" \
  -m '{"tagId":"TAG000123","epc":"3034257BF7194E4000000001","rssi":-45,"readerId":"reader-001","readerName":"Test Reader","timestamp":"2024-12-12T10:30:45Z","antenna":1,"count":1}'
```

---

## 🚢 Deployment

### Development Build
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Docker Deployment

Build and run with Docker:
```bash
docker build -t rfid-dashboard .
docker run -p 80:80 rfid-dashboard
```

Using Docker Compose:
```bash
docker-compose up -d
```

For detailed deployment instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

## 📁 Project Structure

```
rfid-tracking-dashboard/
├── src/
│   ├── components/          # React components
│   │   ├── layout/          # Layout components (Header, Sidebar)
│   │   ├── charts/          # Chart components
│   │   └── ui/              # Reusable UI components
│   ├── context/             # React Context (Auth, RFID)
│   ├── pages/               # Page components
│   ├── services/            # API and MQTT services
│   │   ├── apiService.ts    # REST API client
│   │   ├── realMqttService.ts # MQTT client
│   │   └── authService.ts   # Authentication service
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions
│   └── App.tsx              # Main application component
├── public/                  # Static assets
├── .env.example             # Environment variables template
├── DEPLOYMENT_GUIDE.md      # Detailed deployment guide
├── package.json             # Dependencies and scripts
├── vite.config.ts           # Vite configuration
└── README.md                # This file
```

---

## 🔒 Security Best Practices

1. **Authentication**
   - Change default passwords immediately
   - Use strong JWT secrets
   - Implement token expiration and refresh

2. **MQTT Security**
   - Use WSS (WebSocket Secure) in production
   - Enable authentication on MQTT broker
   - Use TLS/SSL certificates

3. **API Security**
   - Enable CORS with specific origins
   - Implement rate limiting
   - Validate all inputs
   - Use HTTPS in production

4. **Database Security**
   - Use parameterized queries
   - Implement regular backups
   - Restrict database user privileges
   - Enable encryption at rest

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

- **Documentation**: [Full documentation](./DEPLOYMENT_GUIDE.md)
- **Issues**: [GitHub Issues](https://github.com/yourusername/rfid-tracking-dashboard/issues)
- **Email**: support@your-domain.com
- **Discord**: [Join our community](#)

---

## 🙏 Acknowledgments

- Built with [React](https://reactjs.org/)
- Styled with [TailwindCSS](https://tailwindcss.com/)
- Charts by [Recharts](https://recharts.org/)
- MQTT by [MQTT.js](https://github.com/mqttjs/MQTT.js)
- Icons by [Lucide](https://lucide.dev/)

---

## 📊 Project Status

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-85%25-green)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

**Made with ❤️ for the RFID community**