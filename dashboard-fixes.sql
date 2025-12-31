-- ============================================
-- RFID Dashboard - Dashboard Fixes SQL Script
-- Run this to add missing tables and fix data flow
-- ============================================

-- 1. Create system_alerts table for proper error tracking
CREATE TABLE IF NOT EXISTS system_alerts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  alert_type ENUM('MQTT_DISCONNECTED', 'DEVICE_OFFLINE', 'HIGH_RSSI_LOSS', 'DATA_SYNC_FAILED', 'CUSTOM') NOT NULL,
  severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  description TEXT,
  affected_resource_id VARCHAR(255),
  affected_resource_type VARCHAR(50),
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_resolved (is_resolved),
  INDEX idx_created (created_at),
  INDEX idx_type (alert_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Ensure rfid_tags table has proper indexes for dashboard queries
ALTER TABLE rfid_tags ADD INDEX IF NOT EXISTS idx_read_time (read_time);
ALTER TABLE rfid_tags ADD INDEX IF NOT EXISTS idx_reader_name (reader_name);
ALTER TABLE rfid_tags ADD INDEX IF NOT EXISTS idx_epc (epc);
ALTER TABLE rfid_tags ADD INDEX IF NOT EXISTS idx_date_read_time (read_time, reader_name);

-- 3. Ensure devices table has proper indexes
ALTER TABLE devices ADD INDEX IF NOT EXISTS idx_status (status);
ALTER TABLE devices ADD INDEX IF NOT EXISTS idx_last_heartbeat (last_heartbeat);

-- 4. Insert a test alert to ensure table is working
INSERT INTO system_alerts (alert_type, severity, description, is_resolved)
VALUES ('CUSTOM', 'LOW', 'System initialized - test alert', FALSE)
ON DUPLICATE KEY UPDATE id=id;

-- 5. Verify data structure
-- Check if tags are being saved
SELECT COUNT(*) as total_tags, 
       COUNT(DISTINCT DATE(read_time)) as unique_days,
       MIN(read_time) as earliest_tag,
       MAX(read_time) as latest_tag
FROM rfid_tags;

-- Check device status
SELECT status, COUNT(*) as count FROM devices GROUP BY status;

-- Check alerts
SELECT * FROM system_alerts ORDER BY created_at DESC LIMIT 5;

-- 6. Test dashboard queries

-- Test 1: Verify 24-hour activity data exists
SELECT 
  DATE_FORMAT(read_time, '%Y-%m-%d %H:00:00') as hour,
  COUNT(*) as count
FROM rfid_tags
WHERE read_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY DATE_FORMAT(read_time, '%Y-%m-%d %H:00:00')
ORDER BY hour DESC
LIMIT 10;

-- Test 2: Verify tags per device
SELECT 
  reader_name as device,
  COUNT(*) as count,
  COUNT(DISTINCT epc) as unique_tags
FROM rfid_tags
WHERE DATE(read_time) = CURDATE()
GROUP BY reader_name
ORDER BY count DESC;

-- Test 3: Verify dashboard stats calculation
SELECT 
  (SELECT COUNT(*) FROM rfid_tags WHERE DATE(read_time) = CURDATE()) as tags_today,
  (SELECT COUNT(*) FROM devices WHERE status = 'online') as active_readers,
  (SELECT COUNT(DISTINCT epc) FROM rfid_tags) as unique_tags,
  (SELECT COUNT(*) FROM system_alerts WHERE is_resolved = FALSE AND DATE(created_at) = CURDATE()) as error_count;

-- ============================================
-- Migration Notes
-- ============================================
-- 1. After running this script, restart the backend server
-- 2. Send a test MQTT message to verify tag saving
-- 3. Check backend console logs for "[DB] ✅ Tag saved successfully"
-- 4. Refresh dashboard to see graphs populate
-- 5. If graphs still empty, run diagnostic queries above
