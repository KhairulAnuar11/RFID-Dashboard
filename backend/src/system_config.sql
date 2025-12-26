-- migration_001_remove_hardcoded_values.sql
-- Purpose: Create tables for all configurable system settings
-- Run this before deploying new backend code

USE rfid_system_db;

-- ============================================
-- 1. System Configuration Table
-- ============================================
CREATE TABLE IF NOT EXISTS system_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- Database Pool Settings
  db_connection_limit INT DEFAULT 10 COMMENT 'Max concurrent DB connections',
  db_queue_limit INT DEFAULT 0 COMMENT '0 = unlimited queue',
  
  -- MQTT Connection Tuning (Global Defaults)
  mqtt_reconnect_period_ms INT DEFAULT 5000 COMMENT 'Time between reconnect attempts',
  mqtt_connect_timeout_ms INT DEFAULT 30000 COMMENT 'Connection timeout',
  mqtt_keepalive_sec INT DEFAULT 60 COMMENT 'MQTT keepalive interval',
  mqtt_clean_session BOOLEAN DEFAULT TRUE COMMENT 'Clean session on connect',
  
  -- Authentication & Sessions
  jwt_expires_in VARCHAR(10) DEFAULT '24h' COMMENT 'JWT token expiration (e.g., 24h, 7d)',
  session_timeout_minutes INT DEFAULT 1440 COMMENT 'Auto-logout after inactivity',
  max_login_attempts INT DEFAULT 5 COMMENT 'Lock account after N failed attempts',
  login_lockout_duration_minutes INT DEFAULT 30 COMMENT 'Account lockout duration',
  
  -- Data Management
  data_retention_days INT DEFAULT 30 COMMENT 'Auto-archive data older than N days',
  cleanup_interval_hours INT DEFAULT 24 COMMENT 'How often to run cleanup job',
  auto_archive_enabled BOOLEAN DEFAULT TRUE COMMENT 'Enable automatic archiving',
  
  -- API & Performance
  default_page_size INT DEFAULT 100 COMMENT 'Default records per page',
  max_page_size INT DEFAULT 1000 COMMENT 'Maximum allowed page size',
  api_rate_limit_per_hour INT DEFAULT 1000 COMMENT 'Max API calls per user per hour',
  
  -- Background Jobs
  device_offline_check_interval_sec INT DEFAULT 30 COMMENT 'Check device status every N seconds',
  stats_cache_duration_sec INT DEFAULT 60 COMMENT 'Cache dashboard stats for N seconds',
  
  -- Logging
  log_level VARCHAR(20) DEFAULT 'info' COMMENT 'debug, info, warn, error',
  enable_query_logging BOOLEAN DEFAULT FALSE COMMENT 'Log all SQL queries',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Global system configuration';

-- Insert default configuration (only if table is empty)
INSERT INTO system_config (id) 
SELECT 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE id = 1);

-- ============================================
-- 2. Enhanced MQTT Configuration
-- ============================================
-- Add advanced MQTT tuning parameters to existing mqtt_config table
ALTER TABLE mqtt_config 
  ADD COLUMN reconnect_period_ms INT DEFAULT 5000 COMMENT 'Reconnect interval',
  ADD COLUMN connect_timeout_ms INT DEFAULT 30000 COMMENT 'Connection timeout',
  ADD COLUMN keepalive_sec INT DEFAULT 60 COMMENT 'Keepalive interval',
  ADD COLUMN clean_session BOOLEAN DEFAULT TRUE COMMENT 'Clean session flag';

-- ============================================
-- 3. User Preferences Table
-- ============================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(36) NOT NULL, -- This uses the table's default collation now
  -- UI Display Preferences
  theme VARCHAR(20) DEFAULT 'light' COMMENT 'light, dark, auto',
  language VARCHAR(10) DEFAULT 'en' COMMENT 'en, zh, ms, etc.',
  timezone VARCHAR(50) DEFAULT 'UTC' COMMENT 'User timezone',
  -- Table & Pagination
  default_page_size INT DEFAULT 20 COMMENT 'Rows per page in tables',
  compact_view BOOLEAN DEFAULT FALSE COMMENT 'Use compact table layout',
  -- Charts & Visualization
  chart_color_scheme VARCHAR(50) DEFAULT 'default' COMMENT 'default, colorblind, monochrome',
  show_animations BOOLEAN DEFAULT TRUE COMMENT 'Enable UI animations',
  -- Dashboard
  auto_refresh_enabled BOOLEAN DEFAULT TRUE COMMENT 'Auto-refresh dashboard',
  auto_refresh_interval_sec INT DEFAULT 30 COMMENT 'Refresh interval',
  default_date_range VARCHAR(20) DEFAULT '24h' COMMENT '24h, 7d, 30d, custom',
  -- Location Map
  default_map_zoom DECIMAL(3,1) DEFAULT 1.0 COMMENT 'Default map zoom level',
  show_device_labels BOOLEAN DEFAULT TRUE COMMENT 'Show device names on map',
  -- Notifications
  desktop_notifications BOOLEAN DEFAULT TRUE COMMENT 'Browser notifications',
  email_notifications BOOLEAN DEFAULT FALSE COMMENT 'Email alerts',
  notification_sound BOOLEAN DEFAULT TRUE COMMENT 'Play sound for alerts',
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_prefs (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Per-user UI preferences';

-- Create default preferences for existing users
INSERT INTO user_preferences (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM user_preferences);

-- ============================================
-- 4. Frontend Configuration Table
-- ============================================
CREATE TABLE IF NOT EXISTS frontend_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- API Endpoints (for dynamic frontend config)
  api_base_url VARCHAR(255) DEFAULT '/api' COMMENT 'Backend API base URL',
  websocket_url VARCHAR(255) DEFAULT NULL COMMENT 'WebSocket server URL',
  
  -- Application Info
  app_name VARCHAR(100) DEFAULT 'RFID Tracking System',
  app_version VARCHAR(20) DEFAULT '1.0.0',
  company_name VARCHAR(100) DEFAULT 'Your Company',
  support_email VARCHAR(100) DEFAULT 'support@example.com',
  
  -- Feature Flags
  enable_location_map BOOLEAN DEFAULT TRUE COMMENT 'Show location tracking',
  enable_analytics BOOLEAN DEFAULT TRUE COMMENT 'Show analytics dashboard',
  enable_export BOOLEAN DEFAULT TRUE COMMENT 'Allow data export',
  enable_user_registration BOOLEAN DEFAULT FALSE COMMENT 'Allow self-registration',
  
  -- Branding
  logo_url VARCHAR(255) DEFAULT NULL COMMENT 'Custom logo URL',
  primary_color VARCHAR(7) DEFAULT '#4F46E5' COMMENT 'Primary brand color (hex)',
  favicon_url VARCHAR(255) DEFAULT NULL COMMENT 'Custom favicon',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Frontend application configuration';

-- Insert default frontend config
INSERT INTO frontend_config (id)
SELECT 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM frontend_config WHERE id = 1);

-- ============================================
-- 5. Indexes for Performance
-- ============================================
CREATE INDEX idx_user_prefs_user ON user_preferences(user_id);

-- ============================================
-- 6. Verification Queries
-- ============================================
-- Run these to verify tables were created successfully

SELECT 'system_config table created' AS status, COUNT(*) AS total_rows FROM system_config;
SELECT 'user_preferences table created' AS status, COUNT(*) AS total_rows FROM user_preferences;
SELECT 'frontend_config table created' AS status, COUNT(*) AS total_rows FROM frontend_config;
SELECT 'mqtt_config columns added' AS status, COUNT(*) AS columns 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'mqtt_config' AND COLUMN_NAME IN ('reconnect_period_ms', 'connect_timeout_ms', 'keepalive_sec', 'clean_session');

-- Show all system configuration
SELECT * FROM system_config;
SELECT * FROM frontend_config;