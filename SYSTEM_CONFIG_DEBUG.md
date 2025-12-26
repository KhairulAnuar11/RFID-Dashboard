# System Config Tab - Troubleshooting Guide

## What Changed

I've updated the SettingsPage.tsx to:

1. ✅ Added loading states for System Config and User Preferences
2. ✅ Added detailed console logging to track data loading
3. ✅ Added error messages if data fails to load
4. ✅ Improved error handling in `loadConfigurations()`

## How to Debug the System Config Tab

### Step 1: Verify You're an Admin
- Check the bottom left of the dashboard
- Should say "Logged in as admin" with "ADMIN" badge
- If you see "USER", System Config tab won't appear

### Step 2: Check Browser Console (F12)
Open DevTools and go to **Console** tab. You should see:

```
[Settings] System config response: {success: true, data: {db_connection_limit: 10, mqtt_reconnect_period_ms: 5000, ...}}
[Settings] System config loaded: {db_connection_limit: 10, mqtt_reconnect_period_ms: 5000, ...}
```

**If you see errors instead:**
```
[Settings] System config error: Admin access required
```
→ You're not logged in as admin

```
[Settings] System config error: Failed to fetch config
```
→ Backend API endpoint is failing

### Step 3: Test the API Directly

Use REST Client extension in VS Code:

1. Open `test-settings-api.http` file
2. Replace `@token = YOUR_BEARER_TOKEN_HERE` with actual token (from localStorage)
3. Click "Send Request" on "Test System Config GET"
4. Check the response

**Expected success response:**
```json
{
  "success": true,
  "data": {
    "db_connection_limit": 10,
    "mqtt_reconnect_period_ms": 5000,
    "mqtt_connect_timeout_ms": 30000,
    "mqtt_keepalive_sec": 60,
    "jwt_expires_in": "24h",
    "data_retention_days": 30,
    "default_page_size": 20,
    "device_offline_check_interval_sec": 300
  }
}
```

### Step 4: Check Backend Logs

In backend terminal, you should see:

```
[Config] GET error: ...
```

If you see this, the backend API is failing. Check:
- MySQL is running
- Database tables exist: `SHOW TABLES LIKE 'system_config';`
- Data in table: `SELECT * FROM system_config;`

### Step 5: Verify Database Tables

Run in MySQL:

```sql
-- Check if system_config table exists and has data
SELECT * FROM system_config;

-- Should return 8 rows:
-- db_connection_limit: 10
-- mqtt_reconnect_period_ms: 5000
-- mqtt_connect_timeout_ms: 30000
-- mqtt_keepalive_sec: 60
-- jwt_expires_in: 24h
-- data_retention_days: 30
-- default_page_size: 20
-- device_offline_check_interval_sec: 300
```

If table is empty or missing, run:

```sql
CREATE TABLE IF NOT EXISTS system_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO system_config (config_key, config_value) VALUES
('db_connection_limit', '10'),
('mqtt_reconnect_period_ms', '5000'),
('mqtt_connect_timeout_ms', '30000'),
('mqtt_keepalive_sec', '60'),
('jwt_expires_in', '24h'),
('data_retention_days', '30'),
('default_page_size', '20'),
('device_offline_check_interval_sec', '300');
```

## Step-by-Step Testing

### Test 1: Load System Config
1. Go to Settings page
2. Click on "System Config" tab
3. **Expected:** See loading spinner briefly, then form fields appear
4. **Check Console:** Look for success messages

### Test 2: Save Changes
1. Change a value (e.g., db_connection_limit to 20)
2. Click "Save Changes"
3. **Expected:** Toast notification "System configuration saved successfully!"
4. **Check Console:** No errors

### Test 3: Verify Database
1. Check MySQL: `SELECT * FROM system_config WHERE config_key = 'db_connection_limit';`
2. **Expected:** Value should be 20 now

### Test 4: Refresh Page
1. Refresh the browser (F5)
2. Go to Settings > System Config
3. **Expected:** db_connection_limit should still show 20

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Loading system configuration..." never finishes | Backend API not responding. Check if port 3001 is listening. |
| "Failed to load system configuration" error | Database tables missing or API endpoint failing. Check MySQL. |
| Form appears but fields are blank | Data not loading from API. Check browser console for errors. |
| Can't see System Config tab | Not logged in as admin. Check user role in database. |
| Changes don't save | Check backend logs for API errors. Verify database permissions. |
| Changes save but don't persist after refresh | Data not being saved to database. Check MySQL for insert errors. |

## File Changes

- `src/pages/SettingsPage.tsx` - Added loading states and improved error handling

## Testing Checklist

- [ ] Logged in as admin user
- [ ] System Config tab is visible
- [ ] Console shows successful config load
- [ ] Form fields display with default values
- [ ] Can change a value
- [ ] Click Save Changes shows success message
- [ ] Database updated with new value
- [ ] Refresh page shows persisted value

## Next Steps

1. Verify database tables exist (run setup-database.sql)
2. Restart backend server
3. Login as admin
4. Check browser console for loading messages
5. Test API with REST Client
6. Report any errors found in console or backend logs
