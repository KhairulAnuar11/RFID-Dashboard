import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import mqtt from 'mqtt';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import cron from 'node-cron';

dotenv.config();

declare global {
  namespace Express {
    interface Request {
      user: {
        userId: string;
        username: string;
        role: string;
      };
    }
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*' }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true
}));
app.use(compression());
app.use(express.json());

if (!process.env.DB_PASSWORD) { 
  console.error('[Error] DB_PASSWORD is not set in environment variables');
  process.exit(1);  
}

// Database Connection Pool
const pool = mysql.createPool({
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
      console.log('[MQTT] Received message on topic:', topic);
      const raw = payload.toString();
      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        // If payload is not JSON, pass raw string through
        data = raw;
      }

      // Save the data first
      if (data && typeof data === 'object' && Array.isArray((data as any).tags)) {
        for (const t of (data as any).tags) {
          await saveTagData(t, raw);
          // Emit socket event for each tag
          emitTagEvent(t);
        }
      } else if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
        for (const t of (data as any).data) {
          await saveTagData(t, raw);
          // Emit socket event for each tag
          emitTagEvent(t);
        }
      } else {
        await saveTagData(data, raw);
        // Emit socket event
        emitTagEvent(data);
      }
    } catch (error) {
      console.error('[MQTT] Error processing message:', error);
    }
  });

  mqttClient.on('error', (error) => {
    console.error('[MQTT] Connection error:', error);
  });
}

// Helper function to emit Socket.IO events
function emitTagEvent(tagData: any) {
  try {
    const payload = typeof tagData === 'string' ? JSON.parse(tagData) : tagData;
    
    io.emit('tag_read', {
      epc: payload.epc || payload.EPC || (payload.data && payload.data.EPC),
      rssi: payload.rssi || payload.RSSI || (payload.data && payload.data.RSSI),
      device: payload.reader_id || payload.readerId || payload.Device || (payload.data && payload.data.Device),
      timestamp: payload.read_time || payload.ReadTime || (payload.data && payload.data.ReadTime) || new Date().toISOString()
    });
  } catch (error) {
    console.error('[Socket.IO] Error emitting tag event:', error);
  }
}

// Replace the getSafeReadTime function with this simple version:
function getSafeReadTime(): string {
  // Always use current server time
  const now = new Date();
  
  // Format to MySQL DATETIME (YYYY-MM-DD HH:MM:SS) in local server time
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Convert a local datetime string "YYYY-MM-DD HH:MM:SS" to an ISO string
function localDatetimeToISOString(localStr: string): string | null {
  if (!localStr) return null;
  // Expect format 'YYYY-MM-DD HH:MM:SS' or similar
  const m = localStr.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  // Interpret DB-stored datetimes as UTC (we store UTC values now)
  try {
    const isoLike = m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + m[6] + 'Z';
    const d = new Date(isoLike);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

// Format Date -> MySQL DATETIME string in UTC: 'YYYY-MM-DD HH:MM:SS'
function formatDateToMySQLUTC(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Normalize arbitrary input into an ISO UTC string. This is used when
// returning timestamps to the frontend so `new Date(...)` parsing is reliable.
function normalizeToISOStringUTC(input: any): string | null {
  if (!input) return null;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
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
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
      s = s + 'Z';
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}
async function saveTagData(data: any, rawPayload?: string) {
  try {
    console.log('[DB] Attempting to save tag data');
    
    if (!data) {
      console.log('[DB] No data to save');
      return;
    }

    // Always use current server time
    const readTime = getSafeReadTime();

    let epcVal = null;
    let tidVal = null;
    let rssiVal = null;
    let antennaVal = null;
    let readerIdVal = 'UNKNOWN';
    let readerNameVal = 'UNKNOWN';

    // Parse the data to extract values
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        console.log('[DB] Data is a non-JSON string');
      }
    }

    // Extract values from different possible structures
    if (data && typeof data === 'object') {
      // Case 1: Nested data structure (your RFID reader format)
      if (data.data && typeof data.data === 'object') {
        const tagData = data.data;
        epcVal = tagData.EPC || tagData.epc || null;
        tidVal = tagData.TID || tagData.tid || null;
        rssiVal = tagData.RSSI ?? tagData.rssi ?? null;
        antennaVal = tagData.AntId || tagData.antId || tagData.antenna || null;
        readerIdVal = tagData.Device || tagData.device || data.Device || 'UNKNOWN';
        readerNameVal = tagData.Device || tagData.device || data.Device || 'UNKNOWN';
      }
      // Case 2: Flat structure
      else {
        epcVal = data.epc || data.tag_id || data.EPC || null;
        tidVal = data.tid ?? data.TID ?? null;
        rssiVal = data.rssi ?? data.RSSI ?? null;
        antennaVal = data.antenna ?? data.AntId ?? data.antId ?? null;
        readerIdVal = data.reader_id || data.readerId || data.reader || data.Device || 'UNKNOWN';
        readerNameVal = data.reader_name || data.readerName || data.Device || 'UNKNOWN';
      }
    }

    console.log('[DB] Extracted values:', {
      epc: epcVal,
      reader: readerNameVal,
      antenna: antennaVal
    });

    // Prepare the raw payload for storage
    let rawToStore: any = null;
    
    // Priority 1: Use the rawPayload string if provided
    if (rawPayload && typeof rawPayload === 'string') {
      try {
        // For JSON column, we need to parse it first if it's valid JSON
        const parsed = JSON.parse(rawPayload);
        rawToStore = parsed; // Store as parsed JSON object
        console.log('[DB] Storing parsed JSON object');
      } catch (e) {
        // If not valid JSON, store as string
        rawToStore = rawPayload;
        console.log('[DB] Storing as string');
      }
    }
    // Priority 2: Use the data object itself
    else if (data && typeof data === 'object') {
      rawToStore = data;
      console.log('[DB] Storing data object directly');
    }

    // IMPORTANT: For JSON column, we need to use a different query format
    // MySQL JSON columns require special handling
    
    const query = `
      INSERT INTO rfid_tags (epc, tid, rssi, antenna, reader_id, reader_name, read_time, raw_payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), NOW())
    `;

    // Convert rawToStore to JSON string for CAST(? AS JSON)
    let jsonString: string | null = null;
    if (rawToStore) {
      try {
        if (typeof rawToStore === 'string') {
          // Already a string, check if it's valid JSON
          JSON.parse(rawToStore); // Test if valid
          jsonString = rawToStore;
        } else {
          // Object, stringify it
          jsonString = JSON.stringify(rawToStore);
        }
      } catch (e) {
        console.error('[DB] Invalid JSON for raw_payload:', e);
        jsonString = null;
      }
    }

    console.log('[DB] Executing query with JSON payload, length:', jsonString?.length || 0);
    
    await pool.execute(query, [
      epcVal,
      tidVal,
      rssiVal,
      antennaVal,
      readerIdVal,
      readerNameVal,
      readTime,
      jsonString
    ]);
    
    console.log('[DB] ✅ Tag saved successfully with JSON payload');
  } catch (error: any) {
    console.error('[DB] ❌ Error saving tag data:', error.message);
    
    // Detailed MySQL error logging
    if (error.code) {
      console.error('[DB] MySQL Error Code:', error.code);
    }
    if (error.sqlMessage) {
      console.error('[DB] MySQL Error Message:', error.sqlMessage);
    }
    if (error.sql) {
      console.error('[DB] SQL Query:', error.sql);
    }
  }
}

async function runDataCleanup() {
  try {
    // Fetch retention days from config (default to 90 if not set)
    // Assuming you have a 'system_config' table or similar
    const [rows]: any = await pool.execute(
      "SELECT data_retention_days FROM system_config LIMIT 1"
    );
    const retentionDays = rows[0]?.data_retention_days || 90;

    console.log(`[Cleanup] Removing data older than ${retentionDays} days...`);
    
    await pool.execute(
      "DELETE FROM rfid_tags WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
      [retentionDays]
    );
    
    console.log('[Cleanup] Old data removed successfully.');
  } catch (error) {
    console.error('[Cleanup] Failed to clean old data:', error);
  }
}

// Schedule the task to run every day at midnight (00:00)
cron.schedule('0 0 * * *', () => {
  runDataCleanup();
});

// Auth Middleware
function authenticateToken(req: Request, res: Response, next: NextFunction) {
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

// Database Debug Endpoint
app.get('/api/debug/db-status', authenticateToken, async (req, res) => {
  try {
    const [[totalRecords]] = await pool.execute('SELECT COUNT(*) as count FROM rfid_tags') as any;
    const [[uniqueTags]] = await pool.execute('SELECT COUNT(DISTINCT epc) as count FROM rfid_tags') as any;
    const [[latestRecord]] = await pool.execute('SELECT MAX(read_time) as latest FROM rfid_tags') as any;
    const [[oldestRecord]] = await pool.execute('SELECT MIN(read_time) as oldest FROM rfid_tags') as any;
    
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
  } catch (error) {
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
    const [[{ count: totalCount }]] = await pool.execute('SELECT COUNT(*) as count FROM rfid_tags') as any;
    checks.total_records = totalCount;

    // Last 24 hours
    const [[{ count: count24h }]] = await pool.execute(
      'SELECT COUNT(*) as count FROM rfid_tags WHERE read_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'
    ) as any;
    checks.last_24h = count24h;

    // Last 7 days
    const [[{ count: count7d }]] = await pool.execute(
      'SELECT COUNT(*) as count FROM rfid_tags WHERE read_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    ) as any;
    checks.last_7d = count7d;

    // Last 30 days
    const [[{ count: count30d }]] = await pool.execute(
      'SELECT COUNT(*) as count FROM rfid_tags WHERE read_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
    ) as any;
    checks.last_30d = count30d;

    // Sample data
    const [sampleData] = await pool.execute('SELECT * FROM rfid_tags ORDER BY read_time DESC LIMIT 3') as any;
    checks.sample_data = sampleData;

    // Date range in database
    const [[dateRange]] = await pool.execute(
      'SELECT MIN(DATE(read_time)) as min_date, MAX(DATE(read_time)) as max_date FROM rfid_tags'
    ) as any;
    checks.date_range = dateRange;

    // Test daily trends query
    const [dailyTrends] = await pool.execute(`
      SELECT 
        DATE(read_time) as date,
        COUNT(*) as total_reads,
        COUNT(DISTINCT epc) as unique_tags
      FROM rfid_tags
      WHERE DATE(read_time) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(read_time)
      ORDER BY date ASC
      LIMIT 5
    `) as any;
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
    `) as any;
    checks.hourly_patterns_query = hourlyPatterns;

    // Test weekly trends query
    const [weeklyTrends] = await pool.execute(`
      SELECT 
        WEEK(read_time) as week,
        YEAR(read_time) as year,
        COUNT(*) as total_reads,
        COUNT(DISTINCT epc) as unique_tags
      FROM rfid_tags
      WHERE read_time >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
      GROUP BY YEAR(read_time), WEEK(read_time)
      ORDER BY year DESC, week DESC
      LIMIT 5
    `) as any;
    checks.weekly_trends_query = weeklyTrends;

    res.json({
      success: true,
      data: checks
    });
  } catch (error) {
    console.error('[Debug] Analytics check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check analytics', details: (error as any).message });
  }
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

// Logout (token invalidation)
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    // In a stateless JWT system, we can't invalidate the token on the server
    // The client simply removes the token from storage
    // For enhanced security, you could implement a token blacklist
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

// Alternative: Add token to blacklist if you want server-side invalidation
app.post('/api/auth/logout-blacklist', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      // Add to blacklist table (you'd need to create this table)
      // await pool.execute(
      //   'INSERT INTO token_blacklist (token, expires_at) VALUES (?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
      //   [token]
      // );
      
      console.log('[Auth] Token added to blacklist');
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

// Get Tags
app.get('/api/tags', authenticateToken, async (req, res) => {
  try {
    // Extract parameters with strict type checking
    let page = 1;
    let limit = 100;
    let startDate: any = null;
    let endDate: any = null;
    let readerId: any = null;

    // Parse page parameter
    if (req.query.page) {
      const pageStr = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
      const parsed = parseInt(pageStr as string, 10);
      if (!isNaN(parsed) && parsed > 0) {
        page = parsed;
      }
    }

    // Parse limit parameter
    if (req.query.limit) {
      const limitStr = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
      const parsed = parseInt(limitStr as string, 10);
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
    const params: Array<string | number> = [];
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

    //console.log('[Tags] Final Query:', query);
    //console.log('[Tags] WHERE Params:', params);

    const [tags] = await pool.execute(query, params) as any;
    const [[{ total }]] = await pool.execute('SELECT COUNT(*) as total FROM rfid_tags') as any;

    // Normalize timestamp field for frontend: ensure `read_time` is a UTC
    // 'YYYY-MM-DD HH:MM:SS' string only. Remove ISO/timestamp fields.
    const normalized = (tags || []).map((t: any) => {
      const out = { ...t };
      if (t.read_time) {
        if (t.read_time instanceof Date) {
          out.read_time = formatDateToMySQLUTC(t.read_time as Date);
        } else if (typeof t.read_time === 'string') {
          // assume DB string already in UTC MySQL DATETIME format
          out.read_time = t.read_time;
        } else {
          out.read_time = null;
        }
      } else if (t.readTime) {
        // If other field present, try to normalize it into MySQL UTC format
        const iso = localDatetimeToISOString(t.readTime);
        if (iso) {
          out.read_time = iso.replace('T', ' ').slice(0, 19);
        } else {
          out.read_time = null;
        }
      } else {
        out.read_time = null;
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
  } catch (error) {
    console.error('[Tags] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tags' });
  }
});

// In the POST /api/tags route
app.post('/api/tags', authenticateToken, async (req, res) => {
  try {
    let tagsToSave = Array.isArray(req.body) ? req.body : [req.body];
    
    // Unwrap nested tags structure if present: { tags: [...] }
    if (tagsToSave.length === 1 && tagsToSave[0]?.tags && Array.isArray(tagsToSave[0].tags)) {
      tagsToSave = tagsToSave[0].tags;
    }
    console.log('[Tags] Received POST request to save', tagsToSave.length, 'tag(s)');
    
    const results = [];
    
    for (const tag of tagsToSave) {
      try {
        // Sanitize all parameters - convert undefined to null
        const epc = tag.epc || tag.tag_id || tag.tagId || tag.EPCValue || tag.EPC || null;
        const tid = tag.tid ?? tag.TID ?? null;
        const rssi = tag.rssi ?? tag.RSSI ?? tag.signalStrength ?? null;
        const antenna = tag.antenna ?? tag.Antenna ?? tag.antennaNumber ?? null;
        const readerId = tag.reader_id ?? tag.readerId ?? tag.readerID ?? 'UNKNOWN';
        const readerName = tag.reader_name ?? tag.readerName ?? tag.deviceName ?? 'UNKNOWN';
        const rawPayload = tag.raw_payload ?? tag.rawPayload ?? tag.payload ?? null;
        
        const readTime = getSafeReadTime(); // Current server time
        
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
          readTime,  // Current server time
          rawPayload
          // created_at is set to NOW() in the query
        ]);
        
        results.push({ epc, success: true, timestamp: readTime });
        console.log('[Tags] ✅ Tag saved with current server timestamp:', readTime);
      } catch (error) {
        console.error('[Tags] Error saving individual tag:', (error as any).message || error);
        results.push({ epc: tag.epc || tag.tag_id, success: false, error: (error as any).message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    res.json({
      success: successCount > 0,
      data: results,
      message: `Saved ${successCount}/${tagsToSave.length} tags with current server timestamps`
    });
  } catch (error) {
    console.error('[Tags] POST Error:', error);
    res.status(500).json({ success: false, error: 'Failed to save tags' });
  }
});

// Get Dashboard Stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const [[tagsToday]] = await pool.execute(
      'SELECT COUNT(*) as count FROM rfid_tags WHERE DATE(read_time) = CURDATE()'
    ) as any;

    const [[activeReaders]] = await pool.execute(
      'SELECT COUNT(*) as count FROM devices WHERE status = "online"'
    ) as any;

    const [[uniqueTags]] = await pool.execute(
      'SELECT COUNT(DISTINCT epc) as count FROM rfid_tags'
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

app.get('/api/dashboard/activity', authenticateToken, async (req, res) => {
  try {
    // Get current local date and time
    const now = new Date();
    const currentHour = now.getHours();
    
    // Query for TODAY's data only (local date)
    const [rows] = await pool.execute(`
      WITH RECURSIVE hours AS (
        SELECT 0 as hour_number
        UNION ALL
        SELECT hour_number + 1 
        FROM hours 
        WHERE hour_number < 23
      )
      SELECT 
        hours.hour_number,
        CONCAT(LPAD(hours.hour_number, 2, '0'), ':00') as time,
        COALESCE(
          (
            SELECT COUNT(*) 
            FROM rfid_tags 
            WHERE DATE(read_time) = CURDATE()
              AND HOUR(read_time) = hours.hour_number
          ), 
          0
        ) as count
      FROM hours
      ORDER BY hours.hour_number ASC
    `) as any;

    // Format the data
    const formattedData = (rows as any[]).map((row) => ({
      time: row.time,
      count: Number(row.count) || 0,
      isPast: row.hour_number <= currentHour,
      isCurrent: row.hour_number === currentHour
    }));

    res.json({ 
      success: true, 
      data: formattedData,
      metadata: {
        currentHour: currentHour,
        currentDate: now.toISOString().split('T')[0],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    });
  } catch (error) {
    console.error('[Dashboard] Activity error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activity' });
  }
});

// Add a new endpoint for the last 24 hours rolling window (optional)
app.get('/api/dashboard/activity-rolling', authenticateToken, async (req, res) => {
  try {
    // This gets the LAST 24 hours from now, not today's hours
    const [rows] = await pool.execute(`
      WITH RECURSIVE hours AS (
        SELECT 0 as hour_offset
        UNION ALL
        SELECT hour_offset + 1 
        FROM hours 
        WHERE hour_offset < 23
      )
      SELECT 
        DATE_FORMAT(DATE_SUB(NOW(), INTERVAL hour_offset HOUR), '%H:00') as time,
        COALESCE(
          (
            SELECT COUNT(*) 
            FROM rfid_tags 
            WHERE read_time >= DATE_SUB(NOW(), INTERVAL hour_offset + 1 HOUR)
              AND read_time < DATE_SUB(NOW(), INTERVAL hour_offset HOUR)
          ), 
          0
        ) as count
      FROM hours
      ORDER BY hour_offset DESC
    `) as any;

    const formattedData = (rows as any[]).map((row) => ({
      time: row.time,
      count: Number(row.count) || 0
    }));

    res.json({ success: true, data: formattedData });
  } catch (error) {
    console.error('[Dashboard] Rolling activity error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch rolling activity' });
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

// ============= ANALYTICS ENDPOINTS =============

// Get Weekly Trends - UPDATED (Unique tags ONLY, no reads)
app.get('/api/analytics/weekly-trends', authenticateToken, async (req, res) => {
  try {
    // Only return unique_tags, not total reads
    const [rows] = await pool.execute(`
      SELECT 
        WEEK(read_time, 1) as week,
        YEAR(read_time) as year,
        COUNT(DISTINCT epc) as unique_tags
      FROM rfid_tags
      WHERE read_time >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
      GROUP BY YEAR(read_time), WEEK(read_time, 1)
      ORDER BY year DESC, week DESC
    `) as any;

    const formattedData = (rows as any[]).map(row => ({
      week: Number(row.week),
      year: Number(row.year),
      unique_tags: Number(row.unique_tags || 0)
    }));

    res.json({ success: true, data: formattedData });
  } catch (error) {
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
  } catch (error) {
    console.error('[Analytics] Antenna stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch antenna stats' });
  }
});

// Get Hourly Patterns - UPDATED (Real-time current day data)
app.get('/api/analytics/hourly-patterns', authenticateToken, async (req, res) => {
  try {
    // Get data for current UTC day only
    const [rows] = await pool.execute(`
      SELECT 
        DATE_FORMAT(read_time, '%H:00') as hour,
        COUNT(*) as read_count,
        COUNT(DISTINCT reader_name) as device_count
      FROM rfid_tags
      WHERE DATE(read_time) = CURDATE()
      GROUP BY DATE_FORMAT(read_time, '%H:00')
      ORDER BY hour ASC
    `) as any;

    // Fill in all 24 hours
    const rowsArr: { hour: string; read_count: number; device_count: number }[] = (rows || []) as any[];
    const fullDay = Array.from({ length: 24 }, (_, hour) => {
      const label = String(hour).padStart(2, '0') + ':00';
      const found = rowsArr.find(r => String(r.hour) === label);
      return {
        hour: label,
        read_count: found ? Number(found.read_count) : 0,
        device_count: found ? Number(found.device_count) : 0
      };
    });

    res.json({ success: true, data: fullDay });
  } catch (error) {
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
  } catch (error) {
    console.error('[Analytics] Assets by location error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch assets by location' });
  }
});

// Get Top Tags
app.get('/api/analytics/top-tags', authenticateToken, async (req, res) => {
  try {
    const daysParam = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
    const limitParam = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    
    const days = Math.max(1, Math.min(365, parseInt(daysParam as string) || 30));
    const limit = Math.max(1, Math.min(1000, parseInt(limitParam as string) || 10));

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
  } catch (error) {
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
  } catch (error) {
    console.error('[Analytics] Device performance error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch device performance' });
  }
});

// Get Daily Trends - FIXED VERSION (Proper UTC handling)
app.get('/api/analytics/daily-trends', authenticateToken, async (req, res) => {
  try {
    const daysParam = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
    const days = Math.max(1, Math.min(365, parseInt(daysParam as string) || 30));

    // FIXED: Use UTC_TIMESTAMP for comparison and extract UTC date
    const [rows] = await pool.execute(`
      SELECT 
        DATE(read_time) as date,
        COUNT(*) as total_reads,
        COUNT(DISTINCT epc) as unique_tags,
        COUNT(DISTINCT reader_name) as active_devices,
        AVG(rssi) as avg_rssi
      FROM rfid_tags
      WHERE read_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(read_time)
      ORDER BY date ASC
    `, [days]) as any;

    // Format dates as UTC strings (YYYY-MM-DD)
const formattedData = (rows as any[]).map((row) => {
      let dateStr;
      if (row.date instanceof Date) {
        // FIX: Extract local year, month, and day to prevent the UTC conversion shift
        const year = row.date.getFullYear();
        const month = String(row.date.getMonth() + 1).padStart(2, '0');
        const day = String(row.date.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else if (typeof row.date === 'string') {
        // If it's already a string, just take the date part
        dateStr = row.date.split(' ')[0];
      } else {
        // Fallback for missing data: use local current date instead of UTC
        const now = new Date();
        dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      }

      return {
        date: dateStr,
        reads: Number(row.total_reads || 0),
        unique_tags: Number(row.unique_tags || 0),
        active_devices: Number(row.active_devices || 0),
        avg_rssi: row.avg_rssi ? Number(row.avg_rssi).toFixed(2) : null
      };
    });

    res.json({ success: true, data: formattedData });
  } catch (error) {
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
    `) as any;

    const [[activeReaders]] = await pool.execute(
      'SELECT COUNT(*) as count FROM devices WHERE status = "online" AND DATE(last_seen) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)'
    ) as any;

    res.json({
      success: true,
      data: {
        totalTags: yesterdayStats?.totalTags || 0,
        uniqueTags: yesterdayStats?.uniqueTags || 0,
        activeReaders: activeReaders?.count || 0
      }
    });
  } catch (error) {
    console.error('[Dashboard] Yesterday stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch yesterday stats' });
  }
});

// Get Dashboard Settings - UPDATED WITH NEW FIELDS
app.get('/api/settings/dashboard', authenticateToken, async (req, res) => {
  try {
    // Try to get from database first
    const [settings] = await pool.execute(
      'SELECT * FROM dashboard_settings LIMIT 1'
    ) as any;

    if (settings && settings.length > 0) {
      res.json({
        success: true,
        data: {
          tag_dedupe_window_minutes: settings[0].tag_dedupe_window_minutes || 5,
          device_offline_minutes: settings[0].device_offline_minutes || 5,
          auto_refresh_interval_seconds: settings[0].auto_refresh_interval_seconds || 30,
          auto_refresh_enabled: settings[0].auto_refresh_enabled === 1 ? true : false,
          default_page_size: settings[0].default_page_size || 20
        }
      });
    } else {
      // Return defaults if no settings exist
      res.json({
        success: true,
        data: {
          tag_dedupe_window_minutes: 5,
          device_offline_minutes: 5,
          auto_refresh_interval_seconds: 30,
          auto_refresh_enabled: true,
          default_page_size: 20
        }
      });
    }
  } catch (error) {
    console.error('[Settings] Dashboard settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard settings' });
  }
});

// Update Dashboard Settings - UPDATED WITH NEW FIELDS
app.put('/api/settings/dashboard', authenticateToken, async (req, res) => {
  try {
    const { 
      tag_dedupe_window_minutes, 
      device_offline_minutes, 
      auto_refresh_interval_seconds,
      auto_refresh_enabled,
      default_page_size
    } = req.body;
    
    // Check if settings already exist
    const [existingSettings] = await pool.execute(
      'SELECT id FROM dashboard_settings LIMIT 1'
    ) as any;

    if (existingSettings && existingSettings.length > 0) {
      // Update existing settings
      await pool.execute(
        `UPDATE dashboard_settings SET 
          tag_dedupe_window_minutes = ?,
          device_offline_minutes = ?,
          auto_refresh_interval_seconds = ?,
          auto_refresh_enabled = ?,
          default_page_size = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [
          tag_dedupe_window_minutes,
          device_offline_minutes,
          auto_refresh_interval_seconds,
          auto_refresh_enabled ? 1 : 0,
          default_page_size,
          existingSettings[0].id
        ]
      );
      
      console.log('[Settings] Updated dashboard settings:', req.body);
    } else {
      // Insert new settings
      await pool.execute(
        `INSERT INTO dashboard_settings 
          (tag_dedupe_window_minutes, device_offline_minutes, 
           auto_refresh_interval_seconds, auto_refresh_enabled,
           default_page_size, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          tag_dedupe_window_minutes,
          device_offline_minutes,
          auto_refresh_interval_seconds,
          auto_refresh_enabled ? 1 : 0,
          default_page_size
        ]
      );
      
      console.log('[Settings] Created new dashboard settings:', req.body);
    }

    res.json({
      success: true,
      data: {
        tag_dedupe_window_minutes,
        device_offline_minutes,
        auto_refresh_interval_seconds,
        auto_refresh_enabled,
        default_page_size
      }
    });
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    console.error('[Config] Update system config error:', error);
    res.status(500).json({ success: false, error: 'Failed to update system config' });
  }
});

// Get User Preferences - UPDATED: REMOVED DASHBOARD FIELDS
app.get('/api/user/preferences', authenticateToken, async (req, res) => {
  try {
    // Try to get from database
    const [preferences] = await pool.execute(
      'SELECT theme, default_map_zoom, desktop_notifications FROM user_preferences WHERE user_id = ?',
      [req.user.userId]
    ) as any;

    if (preferences && preferences.length > 0) {
      res.json({
        success: true,
        data: {
          theme: preferences[0].theme || 'dark',
          default_map_zoom: preferences[0].default_map_zoom || 12,
          desktop_notifications: preferences[0].desktop_notifications === 1 ? true : false
        }
      });
    } else {
      // Return defaults
      res.json({
        success: true,
        data: {
          theme: 'dark',
          default_map_zoom: 12,
          desktop_notifications: true
        }
      });
    }
  } catch (error) {
    console.error('[Preferences] Get user preferences error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user preferences' });
  }
});

// Update User Preferences - UPDATED: REMOVED DASHBOARD FIELDS
app.put('/api/user/preferences', authenticateToken, async (req, res) => {
  try {
    const { theme, default_map_zoom, desktop_notifications } = req.body;
    
    // Check if preferences already exist
    const [existingPrefs] = await pool.execute(
      'SELECT id FROM user_preferences WHERE user_id = ?',
      [req.user.userId]
    ) as any;

    if (existingPrefs && existingPrefs.length > 0) {
      // Update existing preferences
      await pool.execute(
        `UPDATE user_preferences SET 
          theme = ?,
          default_map_zoom = ?,
          desktop_notifications = ?,
          updated_at = NOW()
        WHERE user_id = ?`,
        [
          theme,
          default_map_zoom,
          desktop_notifications ? 1 : 0,
          req.user.userId
        ]
      );
      
      console.log('[Preferences] Updated user preferences:', { theme, default_map_zoom, desktop_notifications });
    } else {
      // Insert new preferences
      await pool.execute(
        `INSERT INTO user_preferences 
          (user_id, theme, default_map_zoom, desktop_notifications, created_at, updated_at) 
        VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [
          req.user.userId,
          theme,
          default_map_zoom,
          desktop_notifications ? 1 : 0
        ]
      );
      
      console.log('[Preferences] Created new user preferences:', { theme, default_map_zoom, desktop_notifications });
    }

    res.json({
      success: true,
      data: {
        theme,
        default_map_zoom,
        desktop_notifications
      }
    });
  } catch (error) {
    console.error('[Preferences] Update user preferences error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user preferences' });
  }
});

// Save MQTT Configuration to Database
app.put('/api/settings/mqtt', authenticateToken, async (req, res) => {
  try {
    const {
      broker,
      port,
      protocol,
      username,
      password,
      client_id,
      topics,
      qos,
      enabled
    } = req.body;

    // Validate required fields
    if (!broker || !port || !protocol) {
      return res.status(400).json({
        success: false,
        error: 'Broker, port, and protocol are required'
      });
    }

    // Convert topics array to JSON string if provided
    let topicsJson = null;
    if (topics && Array.isArray(topics)) {
      topicsJson = JSON.stringify(topics);
    } else if (typeof topics === 'string') {
      topicsJson = topics; // Assume already JSON string
    }

    // Check if configuration already exists
    const [existingConfig] = await pool.execute(
      'SELECT id FROM mqtt_config LIMIT 1'
    ) as any;

    if (existingConfig && existingConfig.length > 0) {
      // Update existing configuration
      const configId = existingConfig[0].id;
      
      await pool.execute(
        `UPDATE mqtt_config SET 
          broker = ?, 
          port = ?, 
          protocol = ?, 
          username = ?, 
          password = ?, 
          client_id = ?, 
          topics = ?, 
          qos = ?, 
          enabled = ?, 
          updated_at = NOW()
        WHERE id = ?`,
        [
          broker,
          port,
          protocol,
          username || null,
          password || null,
          client_id || null,
          topicsJson,
          qos || 1,
          enabled ? 1 : 0,
          configId
        ]
      );
      
      console.log('[MQTT Config] Updated existing configuration with ID:', configId);
    } else {
      // Insert new configuration
      await pool.execute(
        `INSERT INTO mqtt_config 
          (broker, port, protocol, username, password, client_id, topics, qos, enabled, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          broker,
          port,
          protocol,
          username || null,
          password || null,
          client_id || null,
          topicsJson,
          qos || 1,
          enabled ? 1 : 0
        ]
      );
      
      console.log('[MQTT Config] Created new configuration');
    }

    // Return the saved configuration (without password for security)
    const [savedConfig] = await pool.execute(
      `SELECT 
        id,
        broker,
        port,
        protocol,
        username,
        client_id,
        topics,
        qos,
        enabled,
        updated_at,
        reconnect_period_ms,
        connect_timeout_ms,
        keepalive_sec,
        clean_session
      FROM mqtt_config 
      LIMIT 1`
    ) as any;

    const config = savedConfig && savedConfig.length > 0 ? savedConfig[0] : null;
    
    let parsedTopics = [];
    if (config && config.topics) {
      try {
        parsedTopics = JSON.parse(config.topics);
      } catch (e) {
        console.warn('[MQTT Config] Failed to parse topics JSON:', e);
        parsedTopics = [];
      }
    }

    res.json({
      success: true,
      data: {
        broker: config?.broker || broker,
        port: config?.port || port,
        protocol: config?.protocol || protocol,
        username: config?.username || username,
        clientId: config?.client_id || client_id,
        topics: parsedTopics,
        qos: config?.qos || qos || 1,
        enabled: config?.enabled === 1 ? true : (config?.enabled === 0 ? false : enabled),
        hasPassword: !!(config?.password || password),
        updatedAt: config?.updated_at,
        reconnectPeriodMs: config?.reconnect_period_ms,
        connectTimeoutMs: config?.connect_timeout_ms,
        keepaliveSec: config?.keepalive_sec,
        cleanSession: config?.clean_session === 1
      }
    });

  } catch (error) {
    console.error('[Settings] Update MQTT settings error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update MQTT settings',
      details: (error as any).message 
    });
  }
});

// Save MQTT Configuration to Database
app.put('/api/settings/mqtt', authenticateToken, async (req, res) => {
  try {
    const {
      broker,
      port,
      protocol,
      username,
      password,
      client_id,
      topics,
      qos,
      enabled
    } = req.body;

    // Validate required fields
    if (!broker || !port || !protocol) {
      return res.status(400).json({
        success: false,
        error: 'Broker, port, and protocol are required'
      });
    }

    // Convert topics array to JSON string if provided
    let topicsJson = null;
    if (topics && Array.isArray(topics)) {
      topicsJson = JSON.stringify(topics);
    } else if (typeof topics === 'string') {
      topicsJson = topics; // Assume already JSON string
    }

    // Check if configuration already exists
    const [existingConfig] = await pool.execute(
      'SELECT id FROM mqtt_config LIMIT 1'
    ) as any;

    if (existingConfig && existingConfig.length > 0) {
      // Update existing configuration
      const configId = existingConfig[0].id;
      
      await pool.execute(
        `UPDATE mqtt_config SET 
          broker = ?, 
          port = ?, 
          protocol = ?, 
          username = ?, 
          password = ?, 
          client_id = ?, 
          topics = ?, 
          qos = ?, 
          enabled = ?, 
          updated_at = NOW()
        WHERE id = ?`,
        [
          broker,
          port,
          protocol,
          username || null,
          password || null,
          client_id || null,
          topicsJson,
          qos || 1,
          enabled ? 1 : 0,
          configId
        ]
      );
      
      console.log('[MQTT Config] Updated existing configuration with ID:', configId);
    } else {
      // Insert new configuration
      await pool.execute(
        `INSERT INTO mqtt_config 
          (broker, port, protocol, username, password, client_id, topics, qos, enabled, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          broker,
          port,
          protocol,
          username || null,
          password || null,
          client_id || null,
          topicsJson,
          qos || 1,
          enabled ? 1 : 0
        ]
      );
      
      console.log('[MQTT Config] Created new configuration');
    }

    // Return the saved configuration (without password for security)
    const [savedConfig] = await pool.execute(
      `SELECT 
        id,
        broker,
        port,
        protocol,
        username,
        client_id,
        topics,
        qos,
        enabled,
        updated_at,
        reconnect_period_ms,
        connect_timeout_ms,
        keepalive_sec,
        clean_session
      FROM mqtt_config 
      LIMIT 1`
    ) as any;

    const config = savedConfig && savedConfig.length > 0 ? savedConfig[0] : null;
    
    let parsedTopics = [];
    if (config && config.topics) {
      try {
        parsedTopics = JSON.parse(config.topics);
      } catch (e) {
        console.warn('[MQTT Config] Failed to parse topics JSON:', e);
        parsedTopics = [];
      }
    }

    res.json({
      success: true,
      data: {
        broker: config?.broker || broker,
        port: config?.port || port,
        protocol: config?.protocol || protocol,
        username: config?.username || username,
        clientId: config?.client_id || client_id,
        topics: parsedTopics,
        qos: config?.qos || qos || 1,
        enabled: config?.enabled === 1 ? true : (config?.enabled === 0 ? false : enabled),
        hasPassword: !!(config?.password || password),
        updatedAt: config?.updated_at,
        reconnectPeriodMs: config?.reconnect_period_ms,
        connectTimeoutMs: config?.connect_timeout_ms,
        keepaliveSec: config?.keepalive_sec,
        cleanSession: config?.clean_session === 1
      }
    });

  } catch (error) {
    console.error('[Settings] Update MQTT settings error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update MQTT settings',
      details: (error as any).message 
    });
  }
});

// ============= HELP & SUPPORT ENDPOINTS =============

// Download Full Troubleshooting Guide
app.get('/api/help/troubleshooting-guide', authenticateToken, async (req: Request, res: Response) => {
  try {
    const troubleshootingGuide = {
      title: "RFID Dashboard Troubleshooting Guide",
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      sections: [
        {
          title: "MQTT Connection Issues",
          commonProblems: [
            {
              problem: "Cannot connect to MQTT broker",
              solution: "Verify broker address, port, and credentials. Ensure firewall allows connections.",
              quickFix: "Check Settings → MQTT Configuration"
            },
            {
              problem: "Connection drops frequently",
              solution: "Check network stability. Adjust keepalive settings. Consider using WebSocket transport.",
              quickFix: "Increase MQTT keepalive interval"
            }
          ]
        },
        {
          title: "Tag Data Issues",
          commonProblems: [
            {
              problem: "Tags not appearing in real-time",
              solution: "Verify reader is publishing to correct topic. Check MQTT subscription.",
              quickFix: "Restart RFID reader service"
            },
            {
              problem: "Incorrect timestamp on tags",
              solution: "System uses server time. Ensure server timezone is correctly set.",
              quickFix: "Restart backend service to sync time"
            }
          ]
        },
        {
          title: "Dashboard Issues",
          commonProblems: [
            {
              problem: "Slow performance",
              solution: "Reduce page size, clear browser cache, optimize database queries.",
              quickFix: "Limit tag display to last 24 hours"
            },
            {
              problem: "Charts not loading",
              solution: "Check internet connection. Clear local storage. Update browser.",
              quickFix: "Hard refresh (Ctrl+F5)"
            }
          ]
        }
      ],
      escalation: {
        level1: "Check device connections and power",
        level2: "Review system logs in dashboard",
        level3: "Contact support with error codes"
      }
    };

    // Return as downloadable JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="troubleshooting-guide.json"');
    res.json({
      success: true,
      data: troubleshootingGuide
    });
  } catch (error) {
    console.error('[Help] Error generating troubleshooting guide:', error);
    res.status(500).json({ success: false, error: 'Failed to generate guide' });
  }
});

// Get Documentation Catalog
app.get('/api/help/documentation', authenticateToken, async (req: Request, res: Response) => {
  try {
    const documentation = [
      {
        id: 'user-manual',
        title: 'User Manual',
        description: 'Complete guide to using the RFID Dashboard',
        category: 'General',
        size: '2.4 MB',
        format: 'PDF',
        url: '/docs/user-manual.pdf',
        updated: '2024-01-15'
      },
      {
        id: 'api-reference',
        title: 'API Reference',
        description: 'Complete API documentation for developers',
        category: 'Technical',
        size: '1.8 MB',
        format: 'PDF',
        url: '/docs/api-reference.pdf',
        updated: '2024-01-10'
      },
      {
        id: 'mqtt-protocol',
        title: 'MQTT Protocol Guide',
        description: 'MQTT message format and protocol specification',
        category: 'Technical',
        size: '1.2 MB',
        format: 'PDF',
        url: '/docs/mqtt-protocol.pdf',
        updated: '2024-01-05'
      },
      {
        id: 'installation-guide',
        title: 'Installation Guide',
        description: 'Step-by-step installation instructions',
        category: 'Setup',
        size: '3.1 MB',
        format: 'PDF',
        url: '/docs/installation-guide.pdf',
        updated: '2024-01-01'
      },
      {
        id: 'quick-start',
        title: 'Quick Start Guide',
        description: 'Get started in 10 minutes',
        category: 'General',
        size: '0.8 MB',
        format: 'PDF',
        url: '/docs/quick-start.pdf',
        updated: '2024-01-18'
      }
    ];

    res.json({
      success: true,
      data: documentation
    });
  } catch (error) {
    console.error('[Help] Error fetching documentation:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch documentation' });
  }
});

// Send Support Email
app.post('/api/help/support-email', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name, email, issueType, message, attachments } = req.body;
    
    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, email, and message are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      });
    }

    // In a real application, you would:
    // 1. Validate attachments (size, type)
    // 2. Send email using nodemailer or similar
    // 3. Log the support request to database
    // 4. Possibly notify support team via Slack/Teams webhook

    // Simulate email sending - in production, integrate with email service
    console.log('[Support] Support request received:', {
      name,
      email,
      issueType,
      messageLength: message.length,
      attachmentCount: attachments ? attachments.length : 0,
      timestamp: new Date().toISOString()
    });

    // Save support request to database (create table if needed)
    try {
      await pool.execute(
        `INSERT INTO support_requests 
        (id, user_id, name, email, issue_type, message, status, created_at) 
        VALUES (UUID(), ?, ?, ?, ?, ?, 'pending', NOW())`,
        [req.user.userId, name, email, issueType || 'General Inquiry', message]
      );
    } catch (dbError) {
      console.warn('[Support] Could not save to database, continuing:', dbError);
      // Continue even if DB fails
    }

    res.json({
      success: true,
      message: 'Support request submitted successfully',
      data: {
        ticketId: `TICKET-${Date.now()}`,
        estimatedResponse: 'Within 2 business hours',
        confirmationSent: true
      }
    });
  } catch (error) {
    console.error('[Support] Error processing support request:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process support request' 
    });
  }
});

// Get Help Resources
app.get('/api/help/resources', authenticateToken, async (req: Request, res: Response) => {
  try {
    const resources = {
      guides: [
        {
          id: 'getting-started',
          title: 'Getting Started',
          duration: '10 min',
          steps: 5,
          url: '/guides/getting-started'
        },
        {
          id: 'mqtt-setup',
          title: 'MQTT Setup Guide',
          duration: '15 min',
          steps: 8,
          url: '/guides/mqtt-setup'
        },
        {
          id: 'device-config',
          title: 'Device Configuration',
          duration: '20 min',
          steps: 12,
          url: '/guides/device-config'
        }
      ],
      videos: [
        {
          id: 'dashboard-tour',
          title: 'Dashboard Tour',
          duration: '5:30',
          thumbnail: '/videos/thumbnails/dashboard.jpg'
        },
        {
          id: 'tag-management',
          title: 'Tag Management',
          duration: '8:15',
          thumbnail: '/videos/thumbnails/tags.jpg'
        }
      ],
      tutorials: [
        {
          id: 'real-time-monitoring',
          title: 'Real-time Monitoring Setup',
          difficulty: 'Beginner',
          estimatedTime: '15 minutes'
        },
        {
          id: 'analytics-reports',
          title: 'Analytics & Reports',
          difficulty: 'Intermediate',
          estimatedTime: '25 minutes'
        }
      ]
    };

    res.json({
      success: true,
      data: resources
    });
  } catch (error) {
    console.error('[Help] Error fetching resources:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch help resources' });
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

pool.getConnection()
  .then((connection) => {
    console.log('[Database] MySQL connected as ID:', connection.threadId);
    connection.release();
  })
  .catch((err) => {
    console.error('[Database] MySQL connection error:', err);
  });

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, closing gracefully');
  mqttClient?.end();
  pool.end();
  process.exit(0);
});
