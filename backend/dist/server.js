"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const dotenv_1 = __importDefault(require("dotenv"));
const promise_1 = __importDefault(require("mysql2/promise"));
const mqtt_1 = __importDefault(require("mqtt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 200 // For legacy browser support
}));
app.use((0, compression_1.default)());
app.use(express_1.default.json());
// Database Connection Pool
const pool = promise_1.default.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    database: process.env.DB_NAME || 'rfid_system_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
// MQTT Client
let mqttClient = null;
function connectMQTT() {
    const brokerUrl = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
    mqttClient = mqtt_1.default.connect(brokerUrl, {
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        clientId: `rfid_backend_${Math.random().toString(16).substr(2, 8)}`
    });
    mqttClient.on('message', async (topic, payload) => {
        try {
            const message = JSON.parse(payload.toString());
            // 1. Validate success code
            if (message.code !== 0 || !message.data) {
                console.warn('[MQTT] Ignored message:', message);
                return;
            }
            // 2. Extract actual RFID data
            console.log('[MQTT DATA]', message.data);
            const tag = normalizeRFIDPayload(message.data);
            console.log('[NORMALIZED TAG]', tag);
            // 3. Save to DB
            await saveTagData(tag);
        }
        catch (error) {
            console.error('[MQTT] Message processing error:', error);
        }
    });
}
function normalizeRFIDPayload(data) {
    return {
        tag_id: data.TID || null,
        epc: data.EPC,
        rssi: data.RSSI,
        antenna: parseInt(data.AntId, 10),
        reader_id: data.Device,
        reader_name: data.Device,
        read_time: data.ReadTime
            ? new Date(data.ReadTime.replace(' ', 'T'))
            : new Date(),
        raw_payload: JSON.stringify(data)
    };
}
// Save tag data to database
async function saveTagData(tag) {
    const sql = `
    INSERT INTO rfid_tags
    (epc, tid, rssi, antenna, reader_id, reader_name, read_time, raw_payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
    console.log('[DB INSERT VALUES]', [
        tag.epc,
        tag.tag_id,
        tag.rssi,
        tag.antenna,
        tag.reader_id,
        tag.reader_name,
        tag.read_time,
        tag.raw_payload
    ]);
}
// Auth Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
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
    res.json({ status: 'healthy', read_time: new Date().toISOString() });
});
// Authentication
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('[Auth] Login attempt for:', username);
        console.log('[Auth] Request body:', req.body);
        const [users] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        console.log('[Auth] User lookup result:', users.length > 0 ? 'Found' : 'Not found');
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        const user = users[0];
        console.log('[Auth] User found:', { id: user.id, username: user.username, role: user.role });
        const validPassword = await bcryptjs_1.default.compare(password, user.password_hash);
        console.log('[Auth] Password valid:', validPassword);
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
        await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
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
    }
    catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});
// Get Tags
app.get('/api/tags', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 100, startDate, endDate, readerId } = req.query;
        let query = 'SELECT * FROM rfid_tags WHERE 1=1';
        const params = [];
        if (startDate) {
            query += ' AND read_time >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND read_time <= ?';
            params.push(endDate);
        }
        if (readerId) {
            query += ' AND reader_id = ?';
            params.push(readerId);
        }
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 100;
        const offset = (pageNum - 1) * limitNum;
        query += ` ORDER BY read_time DESC LIMIT ${limitNum} OFFSET ${offset}`;
        const [tags] = await pool.execute(query, params);
        const [[{ total }]] = await pool.execute('SELECT COUNT(*) as total FROM rfid_tags');
        res.json({
            success: true,
            data: {
                tags,
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    }
    catch (error) {
        console.error('[Tags] Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch tags' });
    }
});
// Get Dashboard Stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const [[tagsToday]] = await pool.execute('SELECT COUNT(*) as count FROM rfid_tags WHERE DATE(read_time) = CURDATE()');
        const [[activeReaders]] = await pool.execute('SELECT COUNT(*) as count FROM devices WHERE status = "online"');
        const [[uniqueTags]] = await pool.execute('SELECT COUNT(DISTINCT epc) as count FROM rfid_tags');
        const [[offlineDevices]] = await pool.execute('SELECT COUNT(*) as count FROM devices WHERE status = "offline"');
        res.json({
            success: true,
            data: {
                totalTagsToday: tagsToday.count,
                activeReaders: activeReaders.count,
                uniqueTags: uniqueTags.count,
                errorCount: offlineDevices.count
            }
        });
    }
    catch (error) {
        console.error('[Dashboard] Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});
// Get Activity Data (24 hours)
app.get('/api/dashboard/activity', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
      SELECT 
        DATE_FORMAT(read_time, '%H:00') as time,
        COUNT(*) as count
      FROM rfid_tags
      WHERE read_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY DATE_FORMAT(read_time, '%H:00')
      ORDER BY time
    `);
        res.json({ success: true, data: rows });
    }
    catch (error) {
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
      WHERE DATE(read_time) = CURDATE()
      GROUP BY reader_name
      ORDER BY count DESC
      LIMIT 10
    `);
        res.json({ success: true, data: rows });
    }
    catch (error) {
        console.error('[Dashboard] Tags by device error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch data' });
    }
});
// Get Devices
app.get('/api/devices', authenticateToken, async (req, res) => {
    try {
        const [devices] = await pool.execute('SELECT * FROM devices ORDER BY name');
        res.json({ success: true, data: devices });
    }
    catch (error) {
        console.error('[Devices] Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch devices' });
    }
});
// Create Device
app.post('/api/devices', authenticateToken, async (req, res) => {
    try {
        const device = req.body;
        const id = `device-${Date.now()}`;
        await pool.execute(`INSERT INTO devices (id, name, type, status, ip_address, mac_address, location, zone, signal_strength, uptime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, device.name, device.type, device.status, device.ipAddress, device.macAddress,
            device.location, device.zone, device.signalStrength, device.uptime]);
        res.json({ success: true, data: { id, ...device } });
    }
    catch (error) {
        console.error('[Devices] Create error:', error);
        res.status(500).json({ success: false, error: 'Failed to create device' });
    }
});
// Update Device
app.put('/api/devices/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const device = req.body;
        await pool.execute(`UPDATE devices SET name=?, status=?, ip_address=?, mac_address=?, location=?, zone=?, signal_strength=?
       WHERE id=?`, [device.name, device.status, device.ipAddress, device.macAddress, device.location,
            device.zone, device.signalStrength, id]);
        res.json({ success: true, data: device });
    }
    catch (error) {
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
    }
    catch (error) {
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
        const [users] = await pool.execute('SELECT id, username, email, role, created_at, last_login FROM users');
        res.json({ success: true, data: users });
    }
    catch (error) {
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
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        await pool.execute('INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)', [id, username, email, passwordHash, role]);
        res.json({
            success: true,
            data: { id, username, email, role }
        });
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('[Users] Delete error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
});
// Error Handler
app.use((err, req, res, next) => {
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
