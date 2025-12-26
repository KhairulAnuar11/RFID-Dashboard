-- ============================================
-- RFID Dashboard - Database Setup SQL
-- Run this in your MySQL database
-- ============================================

-- System Configuration Table
CREATE TABLE IF NOT EXISTS system_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(36) NOT NULL,
  theme VARCHAR(20) DEFAULT 'light',
  default_page_size INT DEFAULT 20,
  auto_refresh_enabled BOOLEAN DEFAULT TRUE,
  auto_refresh_interval_sec INT DEFAULT 30,
  default_map_zoom DECIMAL(3,2) DEFAULT 1.0,
  desktop_notifications BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user (user_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dashboard Settings Table
CREATE TABLE IF NOT EXISTS dashboard_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tag_dedupe_window_minutes INT DEFAULT 5,
  device_offline_minutes INT DEFAULT 5,
  auto_refresh_interval_seconds INT DEFAULT 30,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Insert Default Data
-- ============================================

-- System Config Initial Values
INSERT INTO system_config (config_key, config_value) VALUES
('db_connection_limit', '10'),
('mqtt_reconnect_period_ms', '5000'),
('mqtt_connect_timeout_ms', '30000'),
('mqtt_keepalive_sec', '60'),
('jwt_expires_in', '24h'),
('data_retention_days', '30'),
('default_page_size', '20'),
('device_offline_check_interval_sec', '300')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);

-- Dashboard Settings Initial Values
INSERT INTO dashboard_settings (tag_dedupe_window_minutes, device_offline_minutes, auto_refresh_interval_seconds)
SELECT 5, 5, 30 WHERE NOT EXISTS (SELECT 1 FROM dashboard_settings LIMIT 1);

-- ============================================
-- Verification Queries (Run these to verify)
-- ============================================

-- Check tables exist
-- SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'your_database_name' AND TABLE_NAME IN ('system_config', 'user_preferences', 'dashboard_settings');

-- Check system config data
-- SELECT * FROM system_config;

-- Check dashboard settings data
-- SELECT * FROM dashboard_settings;
