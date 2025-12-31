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
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true
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
    mqttClient.on('connect', () => {
        console.log('[MQTT] Connected to broker');
        mqttClient?.subscribe('rfid/readers/+/tags', { qos: 1 });
    });
    mqttClient.on('message', async (topic, payload) => {
        try {
            console.log('[MQTT] Received message on topic:', topic);
            console.log('[MQTT] Raw payload:', payload.toString());
            const data = JSON.parse(payload.toString());
            console.log('[MQTT] Parsed data:', JSON.stringify(data, null, 2));
            await saveTagData(data);
        }
        catch (error) {
            console.error('[MQTT] Error processing message:', error);
        }
    });
    mqttClient.on('error', (error) => {
        console.error('[MQTT] Connection error:', error);
    });
}
function getSafeReadTime(input) {
    let parsedDate = null;
    // Robust parsing: accept ISO, space-separated local datetimes and treat
    // incoming strings as UTC when no timezone is provided. This makes server
    // behaviour deterministic regardless of host local timezone/clock.
    if (typeof input === 'string') {
        let s = input.trim();
        // Common format 'YYYY-MM-DD HH:MM:SS' -> convert to 'YYYY-MM-DDTHH:MM:SSZ' (UTC)
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
            s = s.replace(' ', 'T') + 'Z';
        }
        else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
            // If string has no timezone, assume UTC
            s = s + 'Z';
        }
        parsedDate = new Date(s);
        if (isNaN(parsedDate.getTime()))
            parsedDate = null;
    }
    else if (input instanceof Date) {
        if (!isNaN(input.getTime()))
            parsedDate = input;
    }
    const now = new Date();
    const finalDate = parsedDate || now;
    // Guard: if incoming date is obviously in the future (more than 1 day ahead)
    // or has a year far from current, treat as server 'now' to avoid reader clock errors
    const maxFutureMs = 24 * 60 * 60 * 1000; // 1 day
    if (finalDate.getTime() - now.getTime() > maxFutureMs) {
        // use server UTC now
        parsedDate = now;
    }
    else if (finalDate.getUTCFullYear() > now.getUTCFullYear() + 1) {
        parsedDate = now;
    }
    const useDate = parsedDate || now;
    // Format to MySQL DATETIME (YYYY-MM-DD HH:MM:SS) using UTC components
    const year = useDate.getUTCFullYear();
    const month = String(useDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(useDate.getUTCDate()).padStart(2, '0');
    const hours = String(useDate.getUTCHours()).padStart(2, '0');
    const minutes = String(useDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(useDate.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
// Convert a local datetime string "YYYY-MM-DD HH:MM:SS" to an ISO string
function localDatetimeToISOString(localStr) {
    if (!localStr)
        return null;
    // Expect format 'YYYY-MM-DD HH:MM:SS' or similar
    const m = localStr.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m)
        return null;
    // Interpret DB-stored datetimes as UTC (we store UTC values now)
    try {
        const isoLike = m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + m[6] + 'Z';
        const d = new Date(isoLike);
        if (isNaN(d.getTime()))
            return null;
        return d.toISOString();
    }
    catch {
        return null;
    }
}
// Normalize arbitrary input into an ISO UTC string. This is used when
// returning timestamps to the frontend so `new Date(...)` parsing is reliable.
function normalizeToISOStringUTC(input) {
    if (!input)
        return null;
    if (input instanceof Date) {
        if (isNaN(input.getTime()))
            return null;
        return input.toISOString();
    }
    if (typeof input === 'number') {
        const d = new Date(input);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (typeof input === 'string') {
        let s = input.trim();
        // 'YYYY-MM-DD HH:MM:SS' -> 'YYYY-MM-DDTHH:MM:SSZ'
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
            s = s.replace(' ', 'T') + 'Z';
        }
        else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
            s = s + 'Z';
        }
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }
    return null;
}
// Save tag data to database
async function saveTagData(data) {
    try {
        console.log('[DB] Attempting to save tag:', data.epc || data.tag_id);
        // Prefer RFID timestamp fields from MQTT payload
        const readTimeRaw = data.timestamp ?? data.read_time ?? data.readTime ?? new Date();
        const readTime = getSafeReadTime(readTimeRaw);
        const query = `
      INSERT INTO rfid_tags (epc, tid, rssi, antenna, reader_id, reader_name, read_time, raw_payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
        await pool.execute(query, [
            data.epc || data.tag_id,
            data.tid || null,
            data.rssi || null,
            data.antenna || null,
            data.reader_id || 'UNKNOWN',
            data.reader_name || 'UNKNOWN',
            readTime,
            data.raw_payload || null
        ]);
        console.log('[DB] ✅ Tag saved successfully:', data.epc || data.tag_id);
    }
    catch (error) {
        console.error('[DB] Error saving tag data:', error);
    }
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
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});
// Database Debug Endpoint
app.get('/api/debug/db-status', authenticateToken, async (req, res) => {
    try {
        const [[totalRecords]] = await pool.execute('SELECT COUNT(*) as count FROM rfid_tags');
        const [[uniqueTags]] = await pool.execute('SELECT COUNT(DISTINCT epc) as count FROM rfid_tags');
        const [[latestRecord]] = await pool.execute('SELECT MAX(read_time) as latest FROM rfid_tags');
        const [[oldestRecord]] = await pool.execute('SELECT MIN(read_time) as oldest FROM rfid_tags');
        res.json({
            success: true,
            data: {
                totalRecords: totalRecords?.count || 0,
                uniqueTags: uniqueTags?.count || 0,
                latestRead: latestRecord?.latest,
                oldestRead: oldestRecord?.oldest,
                mqtt_status: mqttClient?.connected ? 'Connected' : 'Disconnected'
            }
        });
    }
    catch (error) {
        console.error('[Debug] DB status error:', error);
        res.status(500).json({ success: false, error: 'Failed to get DB status' });
    }
});
// Analytics Debug Endpoint - Check if data exists for different date ranges
app.get('/api/debug/analytics-check', authenticateToken, async (req, res) => {
    try {
        const checks = {
            total_records: 0,
            last_24h: 0,
            last_7d: 0,
            last_30d: 0,
            all_time: 0,
            sample_data: null,
            date_range: {},
            daily_trends_query: null,
            hourly_patterns_query: null,
            weekly_trends_query: null
        };
        // Total records
        const [[{ count: totalCount }]] = await pool.execute('SELECT COUNT(*) as count FROM rfid_tags');
        checks.total_records = totalCount;
        // Last 24 hours
        const [[{ count: count24h }]] = await pool.execute('SELECT COUNT(*) as count FROM rfid_tags WHERE read_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)');
        checks.last_24h = count24h;
        // Last 7 days
        const [[{ count: count7d }]] = await pool.execute('SELECT COUNT(*) as count FROM rfid_tags WHERE read_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
        checks.last_7d = count7d;
        // Last 30 days
        const [[{ count: count30d }]] = await pool.execute('SELECT COUNT(*) as count FROM rfid_tags WHERE read_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
        checks.last_30d = count30d;
        // Sample data
        const [sampleData] = await pool.execute('SELECT * FROM rfid_tags ORDER BY read_time DESC LIMIT 3');
        checks.sample_data = sampleData;
        // Date range in database
        const [[dateRange]] = await pool.execute('SELECT MIN(DATE(read_time)) as min_date, MAX(DATE(read_time)) as max_date FROM rfid_tags');
        checks.date_range = dateRange;
        // Test daily trends query
        const [dailyTrends] = await pool.execute(`
      SELECT 
        DATE(read_time) as date,
        COUNT(*) as reads,
        COUNT(DISTINCT epc) as unique_tags
      FROM rfid_tags
      WHERE DATE(read_time) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(read_time)
      ORDER BY date ASC
      LIMIT 5
    `);
        checks.daily_trends_query = dailyTrends;
        // Test hourly patterns query
        const [hourlyPatterns] = await pool.execute(`
      SELECT 
        HOUR(read_time) as hour,
        COUNT(*) as count,
        COUNT(DISTINCT epc) as unique_tags
      FROM rfid_tags
      WHERE DATE(read_time) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY HOUR(read_time)
      ORDER BY hour ASC
      LIMIT 5
    `);
        checks.hourly_patterns_query = hourlyPatterns;
        // Test weekly trends query
        const [weeklyTrends] = await pool.execute(`
      SELECT 
        WEEK(read_time) as week,
        YEAR(read_time) as year,
        COUNT(*) as reads,
        COUNT(DISTINCT epc) as unique_tags
      FROM rfid_tags
      WHERE read_time >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
      GROUP BY YEAR(read_time), WEEK(read_time)
      ORDER BY year DESC, week DESC
      LIMIT 5
    `);
        checks.weekly_trends_query = weeklyTrends;
        res.json({
            success: true,
            data: checks
        });
    }
    catch (error) {
        console.error('[Debug] Analytics check error:', error);
        res.status(500).json({ success: false, error: 'Failed to check analytics', details: error.message });
    }
});
// Authentication
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [users] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        const user = users[0];
        const validPassword = await bcryptjs_1.default.compare(password, user.password_hash);
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
        // Extract parameters with strict type checking
        let page = 1;
        let limit = 100;
        let startDate = null;
        let endDate = null;
        let readerId = null;
        // Parse page parameter
        if (req.query.page) {
            const pageStr = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
            const parsed = parseInt(pageStr, 10);
            if (!isNaN(parsed) && parsed > 0) {
                page = parsed;
            }
        }
        // Parse limit parameter
        if (req.query.limit) {
            const limitStr = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
            const parsed = parseInt(limitStr, 10);
            if (!isNaN(parsed) && parsed > 0) {
                limit = Math.min(parsed, 1000); // Cap at 1000
            }
        }
        // Parse optional filters
        if (req.query.startDate) {
            startDate = Array.isArray(req.query.startDate) ? req.query.startDate[0] : req.query.startDate;
        }
        if (req.query.endDate) {
            endDate = Array.isArray(req.query.endDate) ? req.query.endDate[0] : req.query.endDate;
        }
        if (req.query.readerId) {
            readerId = Array.isArray(req.query.readerId) ? req.query.readerId[0] : req.query.readerId;
        }
        // Build where clause and params array
        const params = [];
        let whereClause = 'WHERE 1=1';
        if (startDate) {
            whereClause += ' AND read_time >= ?';
            params.push(startDate);
        }
        if (endDate) {
            whereClause += ' AND read_time <= ?';
            params.push(endDate);
        }
        if (readerId) {
            whereClause += ' AND reader_id = ?';
            params.push(readerId);
        }
        // Calculate offset
        const offset = (page - 1) * limit;
        // Build query with embedded LIMIT/OFFSET (not placeholders)
        const query = `SELECT * FROM rfid_tags ${whereClause} ORDER BY read_time DESC LIMIT ${limit} OFFSET ${offset}`;
        console.log('[Tags] Final Query:', query);
        console.log('[Tags] WHERE Params:', params);
        const [tags] = await pool.execute(query, params);
        const [[{ total }]] = await pool.execute('SELECT COUNT(*) as total FROM rfid_tags');
        // Normalize timestamp field for frontend: convert DB local datetime to ISO
        const normalized = (tags || []).map((t) => {
            const out = { ...t };
            if (t.read_time) {
                // MySQL driver may return Date objects or strings
                if (t.read_time instanceof Date) {
                    out.timestamp = t.read_time.toISOString();
                }
                else if (typeof t.read_time === 'string') {
                    const iso = localDatetimeToISOString(t.read_time);
                    out.timestamp = iso || null;
                }
                else {
                    out.timestamp = null;
                }
            }
            else if (t.readTime) {
                try {
                    out.timestamp = new Date(t.readTime).toISOString();
                }
                catch {
                    out.timestamp = null;
                }
            }
            else {
                out.timestamp = null;
            }
            return out;
        });
        res.json({
            success: true,
            data: {
                tags: normalized,
                total,
                page,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('[Tags] Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch tags' });
    }
});
// Save Tags (POST)
app.post('/api/tags', authenticateToken, async (req, res) => {
    try {
        let tagsToSave = Array.isArray(req.body) ? req.body : [req.body];
        // Unwrap nested tags structure if present: { tags: [...] }
        if (tagsToSave.length === 1 && tagsToSave[0]?.tags && Array.isArray(tagsToSave[0].tags)) {
            console.log('[Tags] Detected nested tags structure, unwrapping...');
            tagsToSave = tagsToSave[0].tags;
        }
        console.log('[Tags] Received POST request to save', tagsToSave.length, 'tag(s)');
        console.log('[Tags] Raw request body:', JSON.stringify(tagsToSave, null, 2));
        const results = [];
        for (const tag of tagsToSave) {
            try {
                // Log raw incoming tag
                console.log('[Tags] Raw incoming tag:', JSON.stringify(tag, null, 2));
                // Sanitize all parameters - convert undefined to null
                const epc = tag.epc || tag.tag_id || tag.tagId || tag.EPCValue || tag.EPC || null;
                const tid = tag.tid ?? tag.TID ?? null;
                const rssi = tag.rssi ?? tag.RSSI ?? tag.signalStrength ?? null;
                const antenna = tag.antenna ?? tag.Antenna ?? tag.antennaNumber ?? null;
                const readerId = tag.reader_id ?? tag.readerId ?? tag.readerID ?? 'UNKNOWN';
                const readerName = tag.reader_name ?? tag.readerName ?? tag.deviceName ?? 'UNKNOWN';
                const rawPayload = tag.raw_payload ?? tag.rawPayload ?? tag.payload ?? null;
                // Format datetime for MySQL - convert ISO format to MySQL datetime format
                //const readTimeRaw = tag.read_time ?? tag.readTime ?? tag.timestamp ?? new Date();
                //const readTime = formatDateTimeForMySQL(readTimeRaw);
                // Prefer the RFID-provided `timestamp` when present (frontend/reader),
                // fall back to other fields or server time. Produce both a UTC ISO
                // timestamp for the frontend and a UTC MySQL DATETIME string for DB.
                const readTimeRaw = tag.timestamp ?? tag.read_time ?? tag.readTime ?? new Date();
                const timestampISO = normalizeToISOStringUTC(readTimeRaw) || new Date().toISOString();
                const readTime = getSafeReadTime(readTimeRaw); // MySQL DATETIME (UTC)
                console.log('[Tags] Sanitized tag data:', { epc, tid, rssi, antenna, readerId, readerName, readTime, timestampISO });
                // Skip if epc is still null - this is required
                if (!epc) {
                    console.warn('[Tags] ⚠️  Skipping tag with null epc. Full tag data:', tag);
                    results.push({ epc: null, success: false, error: 'EPC/Tag ID is required' });
                    continue;
                }
                const query = `
          INSERT INTO rfid_tags (epc, tid, rssi, antenna, reader_id, reader_name, read_time, raw_payload, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
                await pool.execute(query, [
                    epc,
                    tid,
                    rssi,
                    antenna,
                    readerId,
                    readerName,
                    readTime,
                    rawPayload
                ]);
                results.push({ epc, success: true });
                console.log('[Tags] ✅ Tag saved:', epc);
            }
            catch (error) {
                console.error('[Tags] Error saving individual tag:', error);
                results.push({ epc: tag.epc || tag.tag_id, success: false, error: error.message });
            }
        }
        const successCount = results.filter(r => r.success).length;
        res.json({
            success: successCount > 0,
            data: results,
            message: `Saved ${successCount}/${tagsToSave.length} tags`
        });
    }
    catch (error) {
        console.error('[Tags] POST Error:', error);
        res.status(500).json({ success: false, error: 'Failed to save tags' });
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
      WHERE read_time >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)
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
// ============= ANALYTICS ENDPOINTS =============
// Get Weekly Trends
app.get('/api/analytics/weekly-trends', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
      SELECT 
        WEEK(read_time) as week,
        YEAR(read_time) as year,
        COUNT(*) as \`reads\`,
        COUNT(DISTINCT epc) as unique_tags,
        AVG(rssi) as avg_rssi
      FROM rfid_tags
      WHERE read_time >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
      GROUP BY YEAR(read_time), WEEK(read_time)
      ORDER BY year DESC, week DESC
    `);
        res.json({ success: true, data: rows });
    }
    catch (error) {
        console.error('[Analytics] Weekly trends error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch weekly trends' });
    }
});
// Get Antenna Stats
app.get('/api/analytics/antenna-stats', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
      SELECT 
        reader_name as device,
        antenna as antenna,
        COUNT(*) as read_count,
        COUNT(DISTINCT epc) as unique_tags,
        AVG(rssi) as avg_rssi,
        MAX(read_time) as last_read
      FROM rfid_tags
      WHERE DATE(read_time) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY reader_name, antenna
      ORDER BY reader_name, antenna
    `);
        res.json({ success: true, data: rows });
    }
    catch (error) {
        console.error('[Analytics] Antenna stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch antenna stats' });
    }
});
// Get Hourly Patterns
app.get('/api/analytics/hourly-patterns', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
      SELECT 
        HOUR(read_time) as hour,
        COUNT(*) as count,
        COUNT(DISTINCT epc) as unique_tags,
        AVG(rssi) as avg_rssi
      FROM rfid_tags
      WHERE DATE(read_time) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY HOUR(read_time)
      ORDER BY hour ASC
    `);
        res.json({ success: true, data: rows });
    }
    catch (error) {
        console.error('[Analytics] Hourly patterns error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch hourly patterns' });
    }
});
// Get Assets by Location
app.get('/api/analytics/assets-by-location', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
      SELECT 
        reader_name as location,
        COUNT(*) as total_reads,
        COUNT(DISTINCT epc) as unique_tags,
        AVG(rssi) as avg_rssi,
        MAX(read_time) as last_read
      FROM rfid_tags
      WHERE DATE(read_time) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY reader_name
      ORDER BY total_reads DESC
    `);
        res.json({ success: true, data: rows });
    }
    catch (error) {
        console.error('[Analytics] Assets by location error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch assets by location' });
    }
});
// Get Top Tags
app.get('/api/analytics/top-tags', authenticateToken, async (req, res) => {
    try {
        const daysParam = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
        const limitParam = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
        const days = Math.max(1, Math.min(365, parseInt(daysParam) || 30));
        const limit = Math.max(1, Math.min(1000, parseInt(limitParam) || 10));
        const [rows] = await pool.execute(`
      SELECT 
        epc as tag_id,
        COUNT(*) as read_count,
        COUNT(DISTINCT reader_name) as device_count,
        AVG(rssi) as avg_rssi,
        MAX(read_time) as last_seen
      FROM rfid_tags
      WHERE DATE(read_time) >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
      GROUP BY epc
      ORDER BY read_count DESC
      LIMIT ${limit}
    `);
        res.json({ success: true, data: rows });
    }
    catch (error) {
        console.error('[Analytics] Top tags error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch top tags' });
    }
});
// Get Device Performance
app.get('/api/analytics/device-performance', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
      SELECT 
        reader_name as device,
        reader_id as device_id,
        COUNT(*) as total_reads,
        COUNT(DISTINCT epc) as unique_tags,
        COUNT(DISTINCT DATE(read_time)) as active_days,
        AVG(rssi) as avg_signal,
        MAX(rssi) as best_signal,
        MIN(rssi) as worst_signal,
        MAX(read_time) as last_active
      FROM rfid_tags
      WHERE DATE(read_time) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY reader_id, reader_name
      ORDER BY total_reads DESC
    `);
        res.json({ success: true, data: rows });
    }
    catch (error) {
        console.error('[Analytics] Device performance error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch device performance' });
    }
});
// Get Daily Trends
app.get('/api/analytics/daily-trends', authenticateToken, async (req, res) => {
    try {
        const daysParam = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
        const days = Math.max(1, Math.min(365, parseInt(daysParam) || 30));
        const [rows] = await pool.execute(`
      SELECT 
        DATE(read_time) as date,
        COUNT(*) as \`reads\`,
        COUNT(DISTINCT epc) as unique_tags,
        COUNT(DISTINCT reader_name) as active_devices,
        AVG(rssi) as avg_rssi
      FROM rfid_tags
      WHERE DATE(read_time) >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
      GROUP BY DATE(read_time)
      ORDER BY date ASC
    `);
        res.json({ success: true, data: rows });
    }
    catch (error) {
        console.error('[Analytics] Daily trends error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch daily trends' });
    }
});
// ============= SETTINGS & CONFIG ENDPOINTS =============
// Get Yesterday's Statistics
app.get('/api/dashboard/stats-yesterday', authenticateToken, async (req, res) => {
    try {
        const [[yesterdayStats]] = await pool.execute(`
      SELECT 
        COUNT(*) as totalTags,
        COUNT(DISTINCT epc) as uniqueTags
      FROM rfid_tags
      WHERE DATE(read_time) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    `);
        const [[activeReaders]] = await pool.execute('SELECT COUNT(*) as count FROM devices WHERE status = "online" AND DATE(last_seen) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)');
        res.json({
            success: true,
            data: {
                totalTags: yesterdayStats?.totalTags || 0,
                uniqueTags: yesterdayStats?.uniqueTags || 0,
                activeReaders: activeReaders?.count || 0
            }
        });
    }
    catch (error) {
        console.error('[Dashboard] Yesterday stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch yesterday stats' });
    }
});
// Get Dashboard Settings
app.get('/api/settings/dashboard', authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                tag_dedupe_window_minutes: 5,
                device_offline_minutes: 5,
                auto_refresh_interval_seconds: 30
            }
        });
    }
    catch (error) {
        console.error('[Settings] Dashboard settings error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch dashboard settings' });
    }
});
// Update Dashboard Settings
app.put('/api/settings/dashboard', authenticateToken, async (req, res) => {
    try {
        const { tag_dedupe_window_minutes, device_offline_minutes, auto_refresh_interval_seconds } = req.body;
        // In a real app, you'd save these to a settings table
        console.log('[Settings] Updating dashboard settings:', {
            tag_dedupe_window_minutes,
            device_offline_minutes,
            auto_refresh_interval_seconds
        });
        res.json({
            success: true,
            data: {
                tag_dedupe_window_minutes,
                device_offline_minutes,
                auto_refresh_interval_seconds
            }
        });
    }
    catch (error) {
        console.error('[Settings] Update dashboard settings error:', error);
        res.status(500).json({ success: false, error: 'Failed to update dashboard settings' });
    }
});
// Get System Configuration (Admin only)
app.get('/api/config', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        res.json({
            success: true,
            data: {
                db_connection_limit: 10,
                db_queue_limit: 0,
                mqtt_reconnect_period_ms: 1000,
                mqtt_connect_timeout_ms: 30000,
                mqtt_keepalive_sec: 60,
                mqtt_clean_session: true,
                jwt_expires_in: '24h',
                session_timeout_minutes: 1440,
                data_retention_days: 90,
                cleanup_interval_hours: 24,
                default_page_size: 100,
                max_page_size: 1000,
                device_offline_check_interval_sec: 300,
                stats_cache_duration_sec: 60,
                log_level: 'info'
            }
        });
    }
    catch (error) {
        console.error('[Config] Get system config error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch system config' });
    }
});
// Update System Configuration (Admin only)
app.put('/api/config', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const config = req.body;
        // In a real app, you'd save these to a config table or environment
        console.log('[Config] Updating system config:', config);
        res.json({
            success: true,
            data: config
        });
    }
    catch (error) {
        console.error('[Config] Update system config error:', error);
        res.status(500).json({ success: false, error: 'Failed to update system config' });
    }
});
// Get User Preferences
app.get('/api/user/preferences', authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                theme: 'dark',
                default_page_size: 100,
                auto_refresh_enabled: true,
                auto_refresh_interval_sec: 30,
                default_map_zoom: 12,
                desktop_notifications: true
            }
        });
    }
    catch (error) {
        console.error('[Preferences] Get user preferences error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch user preferences' });
    }
});
// Update User Preferences
app.put('/api/user/preferences', authenticateToken, async (req, res) => {
    try {
        const preferences = req.body;
        // In a real app, you'd save these to a user_preferences table
        console.log('[Preferences] Updating user preferences:', preferences);
        res.json({
            success: true,
            data: preferences
        });
    }
    catch (error) {
        console.error('[Preferences] Update user preferences error:', error);
        res.status(500).json({ success: false, error: 'Failed to update user preferences' });
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
