// backend/src/config.ts
// New file: Configuration management module

import mysql from 'mysql2/promise';

interface SystemConfig {
  db_connection_limit: number;
  db_queue_limit: number;
  mqtt_reconnect_period_ms: number;
  mqtt_connect_timeout_ms: number;
  mqtt_keepalive_sec: number;
  mqtt_clean_session: boolean;
  jwt_expires_in: string;
  session_timeout_minutes: number;
  data_retention_days: number;
  cleanup_interval_hours: number;
  default_page_size: number;
  max_page_size: number;
  device_offline_check_interval_sec: number;
  stats_cache_duration_sec: number;
  log_level: string;
}

interface UserPreferences {
  theme: string;
  language: string;
  timezone: string;
  default_page_size: number;
  auto_refresh_enabled: boolean;
  auto_refresh_interval_sec: number;
  default_map_zoom: number;
  desktop_notifications: boolean;
}

interface FrontendConfig {
  api_base_url: string;
  websocket_url: string | null;
  app_name: string;
  app_version: string;
  company_name: string;
  support_email: string;
  enable_location_map: boolean;
  enable_analytics: boolean;
  enable_export: boolean;
  primary_color: string;
}

// In-memory cache for system config
let systemConfigCache: SystemConfig | null = null;
let frontendConfigCache: FrontendConfig | null = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 60000; // 60 seconds

export async function loadSystemConfig(pool: mysql.Pool): Promise<SystemConfig> {
  const now = Date.now();
  
  // Return cached config if still fresh
  if (systemConfigCache && (now - lastCacheUpdate) < CACHE_TTL) {
    return systemConfigCache;
  }

  const [rows]: any = await pool.execute('SELECT * FROM system_config WHERE id = 1');
  
  if (!rows || rows.length === 0) {
    throw new Error('System configuration not found. Run migration script first.');
  }

  systemConfigCache = rows[0];
  lastCacheUpdate = now;
  
  return systemConfigCache!;
}

export async function updateSystemConfig(
  pool: mysql.Pool,
  updates: Partial<SystemConfig>
): Promise<SystemConfig> {
  const fields = Object.keys(updates);
  const values = Object.values(updates);
  
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  
  await pool.execute(
    `UPDATE system_config SET ${setClause}, updated_at = NOW() WHERE id = 1`,
    values
  );

  // Invalidate cache
  systemConfigCache = null;
  
  return loadSystemConfig(pool);
}

export async function loadFrontendConfig(pool: mysql.Pool): Promise<FrontendConfig> {
  const now = Date.now();
  
  if (frontendConfigCache && (now - lastCacheUpdate) < CACHE_TTL) {
    return frontendConfigCache;
  }

  const [rows]: any = await pool.execute('SELECT * FROM frontend_config WHERE id = 1');
  
  if (!rows || rows.length === 0) {
    throw new Error('Frontend configuration not found.');
  }

  frontendConfigCache = rows[0];
  return frontendConfigCache!;
}

export async function loadUserPreferences(
  pool: mysql.Pool,
  userId: string
): Promise<UserPreferences> {
  const [rows]: any = await pool.execute(
    'SELECT * FROM user_preferences WHERE user_id = ?',
    [userId]
  );

  if (!rows || rows.length === 0) {
    // Create default preferences for user
    await pool.execute(
      'INSERT INTO user_preferences (user_id) VALUES (?)',
      [userId]
    );
    
    // Fetch newly created preferences
    const [newRows]: any = await pool.execute(
      'SELECT * FROM user_preferences WHERE user_id = ?',
      [userId]
    );
    return newRows[0];
  }

  return rows[0];
}

export async function updateUserPreferences(
  pool: mysql.Pool,
  userId: string,
  updates: Partial<UserPreferences>
): Promise<UserPreferences> {
  const fields = Object.keys(updates);
  const values = [...Object.values(updates), userId];
  
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  
  await pool.execute(
    `UPDATE user_preferences SET ${setClause}, updated_at = NOW() WHERE user_id = ?`,
    values
  );

  return loadUserPreferences(pool, userId);
}

// Clear all caches (call after system config changes)
export function clearConfigCache(): void {
  systemConfigCache = null;
  frontendConfigCache = null;
  lastCacheUpdate = 0;
}

