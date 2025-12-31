-- ============================================
-- Analytics Module Fix - Database Schema Verification
-- Run this to ensure rfid_tags table has all required columns
-- ============================================

-- 1. Verify rfid_tags table structure and ensure correct columns exist
-- The rfid_tags table MUST have these columns:
-- id (auto-increment), epc, tid, rssi, antenna, reader_id, reader_name, read_time, raw_payload, created_at

-- Check current table structure
-- DESCRIBE rfid_tags;

-- 2. Add missing indexes for analytics queries performance
ALTER TABLE rfid_tags ADD INDEX IF NOT EXISTS idx_read_time (read_time);
ALTER TABLE rfid_tags ADD INDEX IF NOT EXISTS idx_epc (epc);
ALTER TABLE rfid_tags ADD INDEX IF NOT EXISTS idx_reader_name (reader_name);
ALTER TABLE rfid_tags ADD INDEX IF NOT EXISTS idx_antenna (antenna);
ALTER TABLE rfid_tags ADD INDEX IF NOT EXISTS idx_read_time_date (DATE(read_time));
ALTER TABLE rfid_tags ADD INDEX IF NOT EXISTS idx_reader_antenna (reader_name, antenna);

-- 3. Analytics aggregation tables (optional, for performance optimization)
-- These can be used for pre-aggregated data if the raw rfid_tags table gets too large

CREATE TABLE IF NOT EXISTS analytics_daily (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_reads INT DEFAULT 0,
  unique_tags INT DEFAULT 0,
  unique_devices INT DEFAULT 0,
  avg_rssi FLOAT,
  peak_hour INT,
  peak_hour_reads INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS antenna_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reader_name VARCHAR(255) NOT NULL,
  antenna_number INT NOT NULL,
  date DATE NOT NULL,
  read_count INT DEFAULT 0,
  unique_tags INT DEFAULT 0,
  avg_rssi FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_antenna_day (reader_name, antenna_number, date),
  INDEX idx_reader_date (reader_name, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hourly_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  hour INT NOT NULL,
  read_count INT DEFAULT 0,
  unique_tags INT DEFAULT 0,
  device_count INT DEFAULT 0,
  avg_rssi FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_hour (date, hour),
  INDEX idx_date_hour (date, hour)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS location_analytics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  location_name VARCHAR(255) NOT NULL,
  location_zone VARCHAR(100),
  date DATE NOT NULL,
  total_tags INT DEFAULT 0,
  unique_tags INT DEFAULT 0,
  total_reads INT DEFAULT 0,
  primary_reader_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_location_day (location_name, date),
  INDEX idx_location_date (location_name, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS weekly_summary (
  id INT AUTO_INCREMENT PRIMARY KEY,
  year INT NOT NULL,
  week INT NOT NULL,
  total_reads INT DEFAULT 0,
  unique_tags INT DEFAULT 0,
  avg_daily_reads INT DEFAULT 0,
  peak_day VARCHAR(20),
  peak_day_reads INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_year_week (year, week),
  INDEX idx_year_week (year, week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Verify column data types match requirements
-- RFID_TAGS columns should be:
-- id: INT AUTO_INCREMENT
-- epc: VARCHAR(255) - unique identifier for tag
-- tid: VARCHAR(255) - tag information
-- rssi: INT - signal strength (-100 to 0)
-- antenna: INT - antenna number (1-4)
-- reader_id: VARCHAR(100) - reader/device identifier
-- reader_name: VARCHAR(255) - human readable reader name
-- read_time: TIMESTAMP - when tag was read
-- raw_payload: TEXT - raw MQTT payload
-- created_at: TIMESTAMP - record creation time

-- 5. Test analytics queries to ensure they work
-- Uncomment below to test:

-- Test 1: Weekly Trends
-- SELECT 
--   WEEK(read_time) as week,
--   YEAR(read_time) as year,
--   COUNT(*) as reads,
--   COUNT(DISTINCT epc) as unique_tags,
--   AVG(rssi) as avg_rssi
-- FROM rfid_tags
-- WHERE read_time >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
-- GROUP BY YEAR(read_time), WEEK(read_time)
-- ORDER BY year DESC, week DESC;

-- Test 2: Antenna Stats
-- SELECT 
--   reader_name as device,
--   antenna as antenna,
--   COUNT(*) as read_count,
--   COUNT(DISTINCT epc) as unique_tags,
--   AVG(rssi) as avg_rssi,
--   MAX(read_time) as last_read
-- FROM rfid_tags
-- WHERE DATE(read_time) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
-- GROUP BY reader_name, antenna
-- ORDER BY reader_name, antenna;

-- Test 3: Hourly Patterns
-- SELECT 
--   HOUR(read_time) as hour,
--   COUNT(*) as count,
--   COUNT(DISTINCT epc) as unique_tags,
--   AVG(rssi) as avg_rssi
-- FROM rfid_tags
-- WHERE DATE(read_time) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
-- GROUP BY HOUR(read_time)
-- ORDER BY hour ASC;

-- Test 4: Daily Trends
-- SELECT 
--   DATE(read_time) as date,
--   COUNT(*) as reads,
--   COUNT(DISTINCT epc) as unique_tags,
--   COUNT(DISTINCT reader_name) as active_devices,
--   AVG(rssi) as avg_rssi
-- FROM rfid_tags
-- WHERE DATE(read_time) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
-- GROUP BY DATE(read_time)
-- ORDER BY date ASC;

-- 6. Data validation
-- Check for any NULL or invalid data that might break analytics:
SELECT 
  'epc' as column_name,
  COUNT(*) as total_records,
  COUNT(epc) as non_null_records,
  SUM(CASE WHEN epc IS NULL OR epc = '' THEN 1 ELSE 0 END) as null_or_empty
FROM rfid_tags

UNION ALL

SELECT 
  'read_time' as column_name,
  COUNT(*) as total_records,
  COUNT(read_time) as non_null_records,
  SUM(CASE WHEN read_time IS NULL THEN 1 ELSE 0 END) as null_or_empty
FROM rfid_tags

UNION ALL

SELECT 
  'reader_name' as column_name,
  COUNT(*) as total_records,
  COUNT(reader_name) as non_null_records,
  SUM(CASE WHEN reader_name IS NULL OR reader_name = '' THEN 1 ELSE 0 END) as null_or_empty
FROM rfid_tags

UNION ALL

SELECT 
  'antenna' as column_name,
  COUNT(*) as total_records,
  COUNT(antenna) as non_null_records,
  SUM(CASE WHEN antenna IS NULL THEN 1 ELSE 0 END) as null_or_empty
FROM rfid_tags;

-- 7. Sample data summary for verification
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT epc) as unique_tags,
  COUNT(DISTINCT reader_name) as unique_readers,
  MIN(read_time) as oldest_record,
  MAX(read_time) as newest_record,
  AVG(rssi) as avg_signal_strength,
  COUNT(*) - COUNT(DATE(read_time) >= DATE_SUB(CURDATE(), INTERVAL 24 HOUR)) as records_last_24h
FROM rfid_tags;

