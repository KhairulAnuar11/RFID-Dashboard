"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const ConfigManager = __importStar(require("./config"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, helmet_1.default)());
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000'];
console.log('[Server] Allowed CORS origins:', allowedOrigins);
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 200
}));
app.use((0, compression_1.default)());
app.use(express_1.default.json());
// Database Connection Pool
const pool = promise_1.default.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || '0')
});
// In-memory cached dashboard settings with defaults
let dashboardSettings = {
    tag_dedupe_window_minutes: 5,
    device_offline_minutes: 5,
    auto_refresh_interval_seconds: 30
};
// MQTT Client - Backend only
let mqttClient = null;
let mqttStatus = 'disconnected';
let mqttConnecting = false;
// Ensure required tables exist for new features
async function ensureSchema() {
    try {
        // rfid_tags table for storing all tag reads
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS rfid_tags (
        id INT PRIMARY KEY AUTO_INCREMENT,
        epc VARCHAR(255) NOT NULL,
        tid VARCHAR(255),
        rssi INT,
        antenna INT,
        reader_id VARCHAR(255),
        reader_name VARCHAR(255),
        read_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        raw_payload LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_read_time (read_time),
        INDEX idx_reader_name (reader_name),
        INDEX idx_epc (epc)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
        // dashboard_settings table (single row expected)
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS dashboard_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tag_dedupe_window_minutes INT DEFAULT 5,
        device_offline_minutes INT DEFAULT 5,
        auto_refresh_interval_seconds INT DEFAULT 30,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
        // tag_read_dedupe table to deduplicate tags per reader within time window
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS tag_read_dedupe (
        epc VARCHAR(255) NOT NULL,
        reader_id VARCHAR(255) NOT NULL,
        last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (epc, reader_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    }
    catch (err) {
        console.error('[DB] ensureSchema error:', err);
    }
}
// Load dashboard settings into memory (first row) or write defaults if missing
async function loadDashboardSettingsFromDB() {
    try {
        const [rows] = await pool.execute('SELECT * FROM dashboard_settings LIMIT 1');
        if (rows && rows.length > 0) {
            const r = rows[0];
            dashboardSettings = {
                tag_dedupe_window_minutes: r.tag_dedupe_window_minutes || dashboardSettings.tag_dedupe_window_minutes,
                device_offline_minutes: r.device_offline_minutes || dashboardSettings.device_offline_minutes,
                auto_refresh_interval_seconds: r.auto_refresh_interval_seconds || dashboardSettings.auto_refresh_interval_seconds
            };
        }
        else {
            await pool.execute('INSERT INTO dashboard_settings (tag_dedupe_window_minutes, device_offline_minutes, auto_refresh_interval_seconds) VALUES (?, ?, ?)', [dashboardSettings.tag_dedupe_window_minutes, dashboardSettings.device_offline_minutes, dashboardSettings.auto_refresh_interval_seconds]);
        }
        console.log('[Settings] Loaded dashboard settings', dashboardSettings);
    }
    catch (err) {
        console.error('[Settings] loadDashboardSettingsFromDB error:', err);
    }
}
// Load MQTT configuration from database
async function loadMQTTConfigFromDB() {
    try {
        const [rows] = await pool.execute('SELECT * FROM mqtt_config WHERE enabled = 1 LIMIT 1');
        if (!rows || rows.length === 0)
            return null;
        const cfg = rows[0];
        let topics = [];
        if (Array.isArray(cfg.topics)) {
            topics = cfg.topics;
        }
        else if (typeof cfg.topics === 'string') {
            topics = JSON.parse(cfg.topics);
        }
        topics = topics.filter(Boolean);
        return {
            broker: cfg.broker,
            port: cfg.port,
            protocol: cfg.protocol,
            username: cfg.username,
            password: cfg.password,
            clientId: cfg.client_id,
            topics,
            qos: cfg.qos ?? 0,
            enabled: !!cfg.enabled
        };
    }
    catch (err) {
        console.error('[MQTT] Failed to load config from DB:', err);
        return null;
    }
}
function buildBrokerUrl(cfg) {
    if (!cfg)
        return null;
    const host = cfg.broker;
    const port = cfg.port ? `:${cfg.port}` : '';
    const protocol = cfg.protocol || 'mqtt';
    if (protocol === 'ws' || protocol === 'wss') {
        return `${protocol}://${host}${port}`;
    }
    if (protocol === 'mqtts')
        return `mqtts://${host}${port}`;
    return `mqtt://${host}${port}`;
}
async function connectMQTTWithConfig(cfg) {
    const sysConfig = await ConfigManager.loadSystemConfig(pool);
    try {
        if (!cfg || !cfg.enabled) {
            console.log('[MQTT] Config not provided or disabled');
            return;
        }
        if (mqttConnecting) {
            console.log('[MQTT] Connection already in progress');
            return;
        }
        mqttConnecting = true;
        await disconnectMQTT();
        const url = buildBrokerUrl(cfg);
        if (!url) {
            mqttConnecting = false;
            return;
        }
        console.log('[MQTT] Backend connecting with:', {
            url,
            clientId: cfg.clientId,
            username: cfg.username,
            hasPassword: !!cfg.password,
            protocol: cfg.protocol,
            topics: cfg.topics
        });
        const connectOptions = {
            clientId: cfg.clientId || `rfid-backend-${Date.now()}`,
            clean: cfg.clean_session ?? sysConfig.mqtt_clean_session, // ✅ FROM CONFIG
            reconnectPeriod: cfg.reconnect_period_ms ?? sysConfig.mqtt_reconnect_period_ms, // ✅
            connectTimeout: cfg.connect_timeout_ms ?? sysConfig.mqtt_connect_timeout_ms, // ✅
            keepalive: cfg.keepalive_sec ?? sysConfig.mqtt_keepalive_sec // ✅
        };
        if (cfg.username) {
            connectOptions.username = cfg.username;
        }
        if (cfg.password) {
            connectOptions.password = cfg.password;
        }
        mqttClient = mqtt_1.default.connect(url, connectOptions);
        mqttClient.on('connect', () => {
            mqttStatus = 'connected';
            mqttConnecting = false;
            console.log('[MQTT] ✅ Backend connected to broker', url);
            const topics = cfg.topics || [];
            if (topics.length > 0) {
                mqttClient?.subscribe(topics, { qos: cfg.qos || 0 }, (err, granted) => {
                    if (err) {
                        console.error('[MQTT] ❌ Subscribe error:', err);
                    }
                    else if (granted) {
                        console.log('[MQTT] ✅ Subscribed to topics:', granted.map((g) => g.topic).join(', '));
                    }
                });
            }
        });
        mqttClient.on('close', () => {
            mqttStatus = 'disconnected';
            console.log('[MQTT] Connection closed');
        });
        mqttClient.on('reconnect', () => {
            mqttStatus = 'reconnecting';
            console.log('[MQTT] Reconnecting...');
        });
        mqttClient.on('error', (err) => {
            mqttStatus = 'error';
            mqttConnecting = false;
            console.error('[MQTT] ❌ Backend client error:', {
                message: err.message,
                code: err.code
            });
            if (err.code === 5) {
                console.error('[MQTT] 🔐 Authentication Error - Check credentials in database');
            }
            else if (err.code === 4) {
                console.error('[MQTT] ⚠️  Bad username or password');
            }
        });
        mqttClient.on('message', async (topic, payload) => {
            const message = safeParseJSON(payload);
            if (!message)
                return;
            switch (message.code) {
                case 0:
                    await handleTagMessage(message.data);
                    break;
                case 30:
                    await handleHeartbeat(message.data);
                    break;
                default:
                    console.log('[MQTT] Ignored code:', message.code);
            }
        });
        function safeParseJSON(payload) {
            try {
                return JSON.parse(payload.toString());
            }
            catch {
                return null;
            }
        }
    }
    catch (err) {
        mqttConnecting = false;
        console.error('[MQTT] ❌ connectMQTTWithConfig failed:', err);
    }
}
async function handleTagMessage(data) {
    try {
        const tag = normalizeRFIDPayload(data);
        await saveTagData(tag);
        const device = extractDeviceFromPayload(data);
        await upsertReaderDevice(device);
    }
    catch (err) {
        console.error('[MQTT] handleTagMessage error:', err);
    }
}
async function handleHeartbeat(data) {
    try {
        const device = extractDeviceFromPayload(data);
        await upsertReaderDevice(device);
    }
    catch (err) {
        console.error('[MQTT] handleHeartbeat error:', err);
    }
}
async function disconnectMQTT() {
    try {
        if (mqttClient) {
            console.log('[MQTT] Disconnecting backend client');
            mqttClient.removeAllListeners();
            mqttClient.end(true);
            mqttClient = null;
            mqttStatus = 'disconnected';
        }
    }
    catch (err) {
        console.error('[MQTT] Disconnect error:', err);
    }
}
async function reconnectMQTT(cfg) {
    await disconnectMQTT();
    await connectMQTTWithConfig(cfg);
}
function normalizeRFIDPayload(data) {
    return {
        epc: data.EPC ?? null,
        tid: data.TID ?? null,
        rssi: data.RSSI ?? null,
        antenna: data.AntId ?? null,
        reader_id: data.Device ?? null,
        reader_name: data.Device ?? null,
        read_time: data.ReadTime
            ? new Date(data.ReadTime.replace(' ', 'T'))
            : new Date(),
        raw_payload: JSON.stringify(data)
    };
}
function extractDeviceFromPayload(data) {
    const now = new Date();
    return {
        id: data.Device ?? null,
        name: data.Device ?? null,
        type: 'reader',
        status: 'online',
        ip_address: data.IP ?? null,
        mac_address: data.MAC ?? null,
        signal_strength: typeof data.RSSI === 'number' ? data.RSSI : 100,
        last_heartbeat: now,
        discovered_by: 'mqtt',
        first_seen: now,
        tags_read_increment: 1
    };
}
async function upsertReaderDevice(device) {
    try {
        if (!device || !device.id)
            return;
        const sql = `
      INSERT INTO devices
        (id, name, type, status, ip_address, mac_address, signal_strength, last_heartbeat, tags_read_today, discovery_source, last_seen, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = 'online',
        last_seen = NOW(),
        discovery_source = 'auto',
        signal_strength = VALUES(signal_strength),
        last_heartbeat = VALUES(last_heartbeat),
        ip_address = COALESCE(VALUES(ip_address), ip_address),
        mac_address = COALESCE(VALUES(mac_address), mac_address),
        tags_read_today = tags_read_today + VALUES(tags_read_today)
    `;
        const params = [
            device.id, device.name, device.type, device.status, device.ip_address, device.mac_address,
            device.signal_strength, device.last_heartbeat, device.tags_read_increment || 1, device.discovered_by || 'mqtt', new Date(), new Date()
        ];
        await pool.execute(sql, params);
    }
    catch (err) {
        console.error('[Device] upsertReaderDevice error:', err);
    }
}
async function saveTagData(tag) {
    const sql = `
    INSERT INTO rfid_tags
    (epc, tid, rssi, antenna, reader_id, reader_name, read_time, raw_payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
    const values = [
        tag.epc,
        tag.tid,
        tag.rssi,
        tag.antenna,
        tag.reader_id,
        tag.reader_name,
        tag.read_time,
        tag.raw_payload
    ];
    await pool.execute(sql, values);
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
// MQTT Status Route
app.get('/api/settings/mqtt/status', authenticateToken, (req, res) => {
    res.json({ success: true, data: { status: mqttStatus } });
});
// Get MQTT Configuration (for frontend to display in UI)
app.get('/api/settings/mqtt', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM mqtt_config WHERE enabled = 1 LIMIT 1');
        if (!rows || rows.length === 0) {
            return res.json({
                success: true,
                data: null,
                message: 'No MQTT configuration found. Please configure in Settings.'
            });
        }
        const cfg = rows[0];
        let topics = [];
        if (Array.isArray(cfg.topics)) {
            topics = cfg.topics;
        }
        else if (typeof cfg.topics === 'string') {
            try {
                topics = JSON.parse(cfg.topics);
            }
            catch (e) {
                console.error('[MQTT] Failed to parse topics JSON:', e);
                topics = [];
            }
        }
        topics = topics.filter(Boolean);
        // Don't send password to frontend for security
        const safeCfg = {
            broker: cfg.broker,
            port: cfg.port,
            protocol: cfg.protocol || 'mqtt',
            username: cfg.username || '',
            clientId: cfg.client_id || '',
            topics: topics,
            qos: cfg.qos ?? 0,
            enabled: !!cfg.enabled,
            hasPassword: !!cfg.password
        };
        console.log('[MQTT] Fetched config from DB:', {
            ...safeCfg,
            hasPassword: !!cfg.password
        });
        res.json({ success: true, data: safeCfg });
    }
    catch (error) {
        console.error('[Settings] Get MQTT config error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch MQTT config' });
    }
});
// Debug endpoint to see what's actually in database (Admin only)
app.get('/api/settings/mqtt/debug', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const [allRows] = await pool.execute('SELECT * FROM mqtt_config');
        const debugData = allRows.map((row) => ({
            id: row.id,
            broker: row.broker,
            port: row.port,
            protocol: row.protocol,
            username: row.username,
            hasPassword: !!row.password,
            passwordLength: row.password ? row.password.length : 0,
            client_id: row.client_id,
            topics: row.topics,
            qos: row.qos,
            enabled: row.enabled,
            created_at: row.created_at,
            updated_at: row.updated_at
        }));
        res.json({
            success: true,
            data: {
                totalConfigs: allRows.length,
                configs: debugData
            }
        });
    }
    catch (error) {
        console.error('[Settings] Debug MQTT config error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch debug data' });
    }
});
// Save MQTT Configuration from UI
app.post('/api/settings/mqtt', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const { broker, port, protocol, username, password, client_id, topics, qos, enabled } = req.body;
        // Validate required fields
        if (!broker || !port) {
            return res.status(400).json({
                success: false,
                error: 'Broker and port are required'
            });
        }
        const topicsJson = JSON.stringify(topics || []);
        const clientIdValue = client_id ?? req.body.clientId ?? `rfid-backend-${Date.now()}`;
        console.log('[MQTT] Saving configuration from UI:', {
            broker,
            port,
            protocol,
            username,
            hasPassword: !!password,
            clientId: clientIdValue,
            topics,
            qos,
            enabled
        });
        // First, disable all existing configs
        await pool.execute('UPDATE mqtt_config SET enabled = 0');
        // Check if any config exists
        const [existingRows] = await pool.execute('SELECT id FROM mqtt_config LIMIT 1');
        if (existingRows.length > 0) {
            // Update existing config
            const updateSql = `
        UPDATE mqtt_config
        SET broker=?, port=?, protocol=?, username=?, password=?,
            client_id=?, topics=?, qos=?, enabled=?, updated_at=NOW()
        WHERE id=?
      `;
            await pool.execute(updateSql, [
                broker,
                port,
                protocol || 'mqtt',
                username || null,
                password || null,
                clientIdValue,
                topicsJson,
                qos || 0,
                enabled ? 1 : 0,
                existingRows[0].id
            ]);
            console.log('[MQTT] ✅ Updated existing config in database (ID:', existingRows[0].id, ')');
        }
        else {
            // Insert new config
            const insertSql = `
        INSERT INTO mqtt_config
        (broker, port, protocol, username, password, client_id, topics, qos, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
            await pool.execute(insertSql, [
                broker,
                port,
                protocol || 'mqtt',
                username || null,
                password || null,
                clientIdValue,
                topicsJson,
                qos || 0,
                enabled ? 1 : 0
            ]);
            console.log('[MQTT] ✅ Inserted new config into database');
        }
        // Verify the save by reading back
        const [verifyRows] = await pool.execute('SELECT * FROM mqtt_config WHERE enabled = 1 LIMIT 1');
        if (verifyRows && verifyRows.length > 0) {
            console.log('[MQTT] ✅ Verified saved config:', {
                broker: verifyRows[0].broker,
                port: verifyRows[0].port,
                username: verifyRows[0].username,
                hasPassword: !!verifyRows[0].password,
                enabled: verifyRows[0].enabled
            });
        }
        else {
            console.error('[MQTT] ❌ Failed to verify saved config!');
        }
        // Reconnect backend MQTT with new config
        if (enabled) {
            const newCfg = await loadMQTTConfigFromDB();
            if (newCfg) {
                console.log('[MQTT] Reconnecting backend with credentials:', {
                    broker: newCfg.broker,
                    port: newCfg.port,
                    username: newCfg.username,
                    hasPassword: !!newCfg.password
                });
                await reconnectMQTT(newCfg);
                console.log('[MQTT] ✅ Backend reconnected with new configuration');
            }
            else {
                console.error('[MQTT] ❌ Failed to load config after save!');
            }
        }
        else {
            await disconnectMQTT();
            console.log('[MQTT] ⚠️  MQTT disabled, backend disconnected');
        }
        // Return saved config to frontend (without password)
        res.json({
            success: true,
            message: 'MQTT configuration saved successfully',
            data: {
                broker,
                port,
                protocol: protocol || 'mqtt',
                username,
                clientId: clientIdValue,
                topics,
                qos: qos || 0,
                enabled: !!enabled,
                hasPassword: !!password
            }
        });
    }
    catch (error) {
        console.error('[Settings] Save MQTT config error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save MQTT config',
            details: error.message
        });
    }
});
// Test MQTT Connection (before saving)
app.post('/api/settings/mqtt/test', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const { broker, port, protocol, username, password, client_id } = req.body;
        console.log('[MQTT Test] Testing connection:', {
            broker,
            port,
            protocol,
            username,
            hasPassword: !!password,
            clientId: client_id
        });
        const host = broker;
        const portStr = port ? `:${port}` : '';
        const proto = protocol || 'mqtt';
        let url;
        if (proto === 'ws' || proto === 'wss') {
            url = `${proto}://${host}${portStr}`;
        }
        else if (proto === 'mqtts') {
            url = `mqtts://${host}${portStr}`;
        }
        else {
            url = `mqtt://${host}${portStr}`;
        }
        const testClient = mqtt_1.default.connect(url, {
            clientId: client_id || `test-${Date.now()}`,
            username: username || undefined,
            password: password || undefined,
            clean: true,
            connectTimeout: 10000,
            reconnectPeriod: 0
        });
        let responded = false;
        testClient.on('connect', () => {
            if (responded)
                return;
            responded = true;
            console.log('[MQTT Test] ✅ Connection successful');
            testClient.end();
            res.json({
                success: true,
                message: 'Connection successful',
                data: { status: 'connected' }
            });
        });
        testClient.on('error', (err) => {
            if (responded)
                return;
            responded = true;
            console.error('[MQTT Test] ❌ Connection failed:', err.message);
            testClient.end();
            let errorMessage = 'Connection failed';
            let suggestions = [];
            if (err.code === 5 || err.message.includes('Not authorized')) {
                errorMessage = 'Authentication failed - Not authorized';
                suggestions = [
                    'Verify username and password are correct in EMQX',
                    'Check if user exists in EMQX Dashboard > Authentication',
                    'Verify user has permission to connect',
                    'Check EMQX ACL/permissions for this user'
                ];
            }
            else if (err.code === 4) {
                errorMessage = 'Bad username or password';
                suggestions = [
                    'Double-check username and password',
                    'Verify credentials in EMQX Dashboard'
                ];
            }
            else if (err.code === 'ECONNREFUSED') {
                errorMessage = 'Connection refused - Broker not reachable';
                suggestions = [
                    'Verify EMQX is running',
                    'Check broker address and port',
                    'Verify firewall settings'
                ];
            }
            res.status(400).json({
                success: false,
                error: errorMessage,
                details: err.message,
                suggestions
            });
        });
        setTimeout(() => {
            if (!responded) {
                responded = true;
                testClient.end();
                res.status(408).json({
                    success: false,
                    error: 'Connection timeout',
                    suggestions: [
                        'Broker may be unreachable',
                        'Check network connectivity'
                    ]
                });
            }
        }, 12000);
    }
    catch (error) {
        console.error('[MQTT Test] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Test failed',
            details: error.message
        });
    }
});
// Dashboard Settings endpoints
app.get('/api/settings/dashboard', authenticateToken, async (req, res) => {
    try {
        res.json({ success: true, data: dashboardSettings });
    }
    catch (err) {
        console.error('[Settings] GET error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch settings' });
    }
});
app.put('/api/settings/dashboard', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin')
            return res.status(403).json({ success: false, error: 'Admin required' });
        const { tag_dedupe_window_minutes, device_offline_minutes, auto_refresh_interval_seconds } = req.body;
        const [rows] = await pool.execute('SELECT id FROM dashboard_settings LIMIT 1');
        if (rows && rows.length > 0) {
            await pool.execute(`UPDATE dashboard_settings SET tag_dedupe_window_minutes = ?, device_offline_minutes = ?, auto_refresh_interval_seconds = ?, updated_at = NOW() WHERE id = ?`, [tag_dedupe_window_minutes, device_offline_minutes, auto_refresh_interval_seconds, rows[0].id]);
        }
        else {
            await pool.execute(`INSERT INTO dashboard_settings (tag_dedupe_window_minutes, device_offline_minutes, auto_refresh_interval_seconds) VALUES (?, ?, ?)`, [tag_dedupe_window_minutes, device_offline_minutes, auto_refresh_interval_seconds]);
        }
        await loadDashboardSettingsFromDB();
        res.json({ success: true, data: dashboardSettings });
    }
    catch (err) {
        console.error('[Settings] PUT error:', err);
        res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
});
// Authentication
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [users] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        const sysConfig = await ConfigManager.loadSystemConfig(pool);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        const user = users[0];
        const validPassword = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        let expiresIn = '24h';
        if (sysConfig.jwt_expires_in) {
            expiresIn = typeof sysConfig.jwt_expires_in === 'number'
                ? sysConfig.jwt_expires_in
                : String(sysConfig.jwt_expires_in);
        }
        const secret = process.env.JWT_SECRET || 'your-secret-key';
        const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username, role: user.role }, secret, { expiresIn: '24h' });
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
        const sysConfig = await ConfigManager.loadSystemConfig(pool);
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
        const limitNum = parseInt(limit) || sysConfig.default_page_size; // ✅ FROM CONFIG
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
        const [rows] = await pool.execute('SELECT * FROM devices ORDER BY name');
        const devices = (rows || []).map((r) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            status: r.status,
            ipAddress: r.ip_address || null,
            macAddress: r.mac_address || null,
            location: r.location || null,
            zone: r.zone || null,
            signalStrength: typeof r.signal_strength === 'number' ? r.signal_strength : (r.signal_strength ? Number(r.signal_strength) : 0),
            lastHeartbeat: r.last_heartbeat ? new Date(r.last_heartbeat).toISOString() : null,
            lastSeen: r.last_seen ? new Date(r.last_seen).toISOString() : null,
            discoverySource: r.discovery_source || 'manual',
            coordinates: (r.coordinates_x !== null && r.coordinates_y !== null) ? { x: Number(r.coordinates_x), y: Number(r.coordinates_y) } : undefined,
            tagsReadToday: typeof r.tags_read_today === 'number' ? r.tags_read_today : (r.tags_read_today ? Number(r.tags_read_today) : 0),
            uptime: r.uptime || null,
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : null
        }));
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
// ============================================
// System Configuration Routes (Admin Only)
// ============================================
// Get system configuration
app.get('/api/settings/system', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const config = await ConfigManager.loadSystemConfig(pool);
        res.json({ success: true, data: config });
    }
    catch (error) {
        console.error('[Settings] Get system config error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch system configuration' });
    }
});
// Update system configuration
app.put('/api/settings/system', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const allowedFields = [
            'db_connection_limit',
            'db_queue_limit',
            'mqtt_reconnect_period_ms',
            'mqtt_connect_timeout_ms',
            'mqtt_keepalive_sec',
            'mqtt_clean_session',
            'jwt_expires_in',
            'data_retention_days',
            'cleanup_interval_hours',
            'default_page_size',
            'max_page_size',
            'device_offline_check_interval_sec'
        ];
        const updates = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }
        const config = await ConfigManager.updateSystemConfig(pool, updates);
        // If DB pool settings changed, log warning
        if (updates.db_connection_limit || updates.db_queue_limit) {
            console.log('[Settings] ⚠️  Database pool settings changed. Restart server for changes to take effect.');
        }
        res.json({
            success: true,
            data: config,
            message: 'System configuration updated successfully'
        });
    }
    catch (error) {
        console.error('[Settings] Update system config error:', error);
        res.status(500).json({ success: false, error: 'Failed to update system configuration' });
    }
});
// ============= SYSTEM CONFIGURATION API =============
// Get System Configuration (Admin Only)
app.get('/api/config', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const [rows] = await pool.execute(`SELECT config_key, config_value FROM system_config 
       WHERE config_key IN ('db_connection_limit', 'mqtt_reconnect_period_ms', 
       'mqtt_connect_timeout_ms', 'mqtt_keepalive_sec', 'jwt_expires_in', 
       'data_retention_days', 'default_page_size', 'device_offline_check_interval_sec')`);
        const config = {
            db_connection_limit: 10,
            mqtt_reconnect_period_ms: 5000,
            mqtt_connect_timeout_ms: 30000,
            mqtt_keepalive_sec: 60,
            jwt_expires_in: '24h',
            data_retention_days: 30,
            default_page_size: 20,
            device_offline_check_interval_sec: 300
        };
        // Override with database values if they exist
        rows.forEach((row) => {
            const value = row.config_value;
            if (value) {
                // Try to parse as number
                config[row.config_key] = isNaN(value) ? value : parseInt(value);
            }
        });
        res.json({ success: true, data: config });
    }
    catch (error) {
        console.error('[Config] GET error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch config' });
    }
});
// Update System Configuration (Admin Only)
app.put('/api/config', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const config = req.body;
        const allowedKeys = [
            'db_connection_limit',
            'mqtt_reconnect_period_ms',
            'mqtt_connect_timeout_ms',
            'mqtt_keepalive_sec',
            'jwt_expires_in',
            'data_retention_days',
            'default_page_size',
            'device_offline_check_interval_sec'
        ];
        // Update each config value
        for (const [key, value] of Object.entries(config)) {
            if (!allowedKeys.includes(key))
                continue;
            await pool.execute(`INSERT INTO system_config (config_key, config_value, updated_at)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE
         config_value = VALUES(config_value),
         updated_at = NOW()`, [key, String(value)]);
        }
        console.log('[Config] Updated system configuration:', config);
        res.json({
            success: true,
            message: 'System configuration updated successfully',
            data: config
        });
    }
    catch (error) {
        console.error('[Config] PUT error:', error);
        res.status(500).json({ success: false, error: 'Failed to update config' });
    }
});
// ============= USER PREFERENCES API =============
// Get User Preferences
app.get('/api/user/preferences', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const [rows] = await pool.execute(`SELECT * FROM user_preferences WHERE user_id = ?`, [userId]);
        if (rows.length === 0) {
            // Return defaults if not found
            return res.json({
                success: true,
                data: {
                    theme: 'light',
                    default_page_size: 20,
                    auto_refresh_enabled: true,
                    auto_refresh_interval_sec: 30,
                    default_map_zoom: 1,
                    desktop_notifications: true
                }
            });
        }
        const prefs = rows[0];
        res.json({
            success: true,
            data: {
                theme: prefs.theme || 'light',
                default_page_size: prefs.default_page_size || 20,
                auto_refresh_enabled: !!prefs.auto_refresh_enabled,
                auto_refresh_interval_sec: prefs.auto_refresh_interval_sec || 30,
                default_map_zoom: parseFloat(prefs.default_map_zoom) || 1,
                desktop_notifications: !!prefs.desktop_notifications
            }
        });
    }
    catch (error) {
        console.error('[Preferences] GET error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch preferences' });
    }
});
// Update User Preferences
app.put('/api/user/preferences', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { theme, default_page_size, auto_refresh_enabled, auto_refresh_interval_sec, default_map_zoom, desktop_notifications } = req.body;
        // Check if record exists
        const [existing] = await pool.execute(`SELECT id FROM user_preferences WHERE user_id = ?`, [userId]);
        if (existing.length > 0) {
            // Update existing
            await pool.execute(`UPDATE user_preferences
         SET theme = ?, default_page_size = ?, auto_refresh_enabled = ?,
             auto_refresh_interval_sec = ?, default_map_zoom = ?,
             desktop_notifications = ?, updated_at = NOW()
         WHERE user_id = ?`, [
                theme || 'light',
                default_page_size || 20,
                auto_refresh_enabled ? 1 : 0,
                auto_refresh_interval_sec || 30,
                default_map_zoom || 1,
                desktop_notifications ? 1 : 0,
                userId
            ]);
        }
        else {
            // Insert new
            await pool.execute(`INSERT INTO user_preferences 
         (user_id, theme, default_page_size, auto_refresh_enabled,
          auto_refresh_interval_sec, default_map_zoom, desktop_notifications)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                userId,
                theme || 'light',
                default_page_size || 20,
                auto_refresh_enabled ? 1 : 0,
                auto_refresh_interval_sec || 30,
                default_map_zoom || 1,
                desktop_notifications ? 1 : 0
            ]);
        }
        console.log('[Preferences] Updated for user:', userId);
        res.json({
            success: true,
            message: 'Preferences updated successfully',
            data: {
                theme,
                default_page_size,
                auto_refresh_enabled,
                auto_refresh_interval_sec,
                default_map_zoom,
                desktop_notifications
            }
        });
    }
    catch (error) {
        console.error('[Preferences] PUT error:', error);
        res.status(500).json({ success: false, error: 'Failed to update preferences' });
    }
});
