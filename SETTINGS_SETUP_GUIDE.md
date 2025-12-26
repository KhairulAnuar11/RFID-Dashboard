# RFID Dashboard - Settings Tabs Setup Guide

## Problem Summary
The backend was exiting immediately because the `app.listen()` call was missing. This has been fixed.

## ✅ What Has Been Done

1. **Added Server Startup Code** - Added `startServer()` function that:
   - Ensures database schema exists
   - Loads dashboard settings from database
   - Connects to MQTT if enabled
   - Starts HTTP server on port 3001

2. **Verified All API Endpoints Exist**:
   - ✅ `GET /api/config` - Get system configuration (Admin only)
   - ✅ `PUT /api/config` - Update system configuration (Admin only)
   - ✅ `GET /api/user/preferences` - Get user preferences
   - ✅ `PUT /api/user/preferences` - Update user preferences
   - ✅ `GET /api/settings/dashboard` - Get dashboard settings
   - ✅ `PUT /api/settings/dashboard` - Update dashboard settings (Admin only)

3. **Verified All API Service Methods Exist**:
   - ✅ `getSystemConfig()`
   - ✅ `updateSystemConfig()`
   - ✅ `getUserPreferences()`
   - ✅ `updateUserPreferences()`
   - ✅ `getDashboardSettings()`
   - ✅ `updateDashboardSettings()`

## 📋 Step-by-Step Setup Instructions

### Step 1: Create Database Tables

**Using MySQL Workbench or command line:**

```bash
# Connect to MySQL
mysql -h localhost -u root -p rfid_system_db < setup-database.sql
```

**Or run the SQL file manually:**
- Open MySQL Workbench
- Open the `setup-database.sql` file from the project root
- Execute the script

**Expected output:** No errors, tables created successfully

---

### Step 2: Verify Database Tables

Run these queries in MySQL:

```sql
-- Verify tables exist
SHOW TABLES LIKE '%config%';
SHOW TABLES LIKE '%preference%';
SHOW TABLES LIKE '%dashboard%';

-- Verify system config data
SELECT * FROM system_config;

-- Verify dashboard settings data
SELECT * FROM dashboard_settings;
```

Expected results:
- `system_config` table with 8 rows
- `user_preferences` table (empty, will be populated on first access)
- `dashboard_settings` table with 1 row

---

### Step 3: Start the Backend

```bash
cd backend
npm run dev
```

**Expected output:**
```
[nodemon] starting `ts-node src/server.ts`
[dotenv@17.2.3] injecting env (13) from .env
[Server] Allowed CORS origins: [ 'http://localhost:5173', 'http://localhost:3000' ]
[DB] Schema ensured
[Settings] Loaded dashboard settings { tag_dedupe_window_minutes: 5, device_offline_minutes: 5, auto_refresh_interval_seconds: 30 }
[Server] ✅ Server listening on port 3001
[Server] API available at http://localhost:3001
```

⚠️ **If you see "clean exit - waiting for changes":**
- Check the console for error messages
- Verify database credentials in `.env`
- Check that all required tables exist

---

### Step 4: Start the Frontend

In a new terminal:

```bash
npm run dev
```

**Expected output:**
```
VITE v5.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
```

---

### Step 5: Test the Settings Tabs

1. **Login** with your credentials
2. **Navigate to Settings** (Settings icon in sidebar)
3. **Test Each Tab:**

#### MQTT Settings Tab ✅
- Already tested and working
- Ensure backend is running before testing

#### Dashboard Settings Tab
- Should load current values (tag_dedupe_window_minutes, device_offline_minutes, etc.)
- Change a value and click "Save Changes"
- Check browser console - should see success message

#### System Config Tab (Admin Only)
- Only visible if you're logged in as admin
- Should load current values from database
- Change a value and click "Save Changes"
- Check browser console - should see success message

#### My Preferences Tab
- Should load your personal preferences
- If first time, shows defaults
- Change theme, page size, or zoom level
- Click "Save Changes"
- Refresh page - settings should persist

#### User Management Tab (Admin Only)
- Already tested and working

---

## 🧪 Manual API Testing (Using REST Client in VS Code)

Create a file `test-settings.http` in your project root:

```http
@baseUrl = http://localhost:3001
@token = YOUR_BEARER_TOKEN_HERE

### Test System Config GET
GET {{baseUrl}}/api/config
Authorization: Bearer {{token}}

### Test System Config UPDATE
PUT {{baseUrl}}/api/config
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "db_connection_limit": 20,
  "data_retention_days": 60,
  "mqtt_reconnect_period_ms": 8000
}

### Test User Preferences GET
GET {{baseUrl}}/api/user/preferences
Authorization: Bearer {{token}}

### Test User Preferences UPDATE
PUT {{baseUrl}}/api/user/preferences
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "theme": "dark",
  "auto_refresh_enabled": false,
  "auto_refresh_interval_sec": 60,
  "default_page_size": 50,
  "default_map_zoom": 1.5,
  "desktop_notifications": true
}

### Test Dashboard Settings GET
GET {{baseUrl}}/api/settings/dashboard
Authorization: Bearer {{token}}

### Test Dashboard Settings UPDATE
PUT {{baseUrl}}/api/settings/dashboard
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "tag_dedupe_window_minutes": 10,
  "device_offline_minutes": 10,
  "auto_refresh_interval_seconds": 60
}
```

**How to get your bearer token:**
1. Login to the dashboard
2. Open browser DevTools (F12)
3. Go to Application > Local Storage
4. Find `rfid_auth_token`
5. Copy the value and paste as `@token` above
6. Click "Send Request" above each endpoint

---

## ✅ Verification Checklist

After setup, verify each component:

- [ ] Backend starts without "clean exit" message
- [ ] Database tables created successfully
- [ ] Frontend loads login page
- [ ] Can login with valid credentials
- [ ] Settings page loads with all tabs
- [ ] Dashboard Settings tab loads values
- [ ] Dashboard Settings can save changes
- [ ] System Config tab loads (if admin)
- [ ] System Config can save changes (if admin)
- [ ] My Preferences tab loads
- [ ] My Preferences can save and persist
- [ ] User Management tab visible (if admin)
- [ ] User Management add/edit/delete works

---

## 🔧 Troubleshooting

### Backend: "clean exit - waiting for changes"
**Solution:**
1. Check terminal output for error messages
2. Verify `.env` database credentials
3. Test database connection: `mysql -u root -p -e "SELECT 1"`
4. Check that tables exist: `SHOW TABLES` in MySQL

### Frontend: "Failed to fetch" on login
**Solution:**
1. Verify backend is running: `http://localhost:3001/api/health`
2. Check browser console for CORS errors
3. Verify `ALLOWED_ORIGINS` in backend `.env`

### Settings not saving
**Solution:**
1. Check browser console for error messages
2. Check backend terminal for API errors
3. Verify database tables exist
4. Ensure user has correct role (admin for system config)

### "Cannot find module" errors
**Solution:**
1. Run `npm install` in project root
2. Run `npm install` in backend folder
3. Clear node_modules and reinstall if issues persist

---

## 📚 File Locations

| File | Purpose |
|------|---------|
| `backend/src/server.ts` | Backend API endpoints & startup code |
| `src/services/apiService.ts` | Frontend API client methods |
| `src/pages/SettingsPage.tsx` | Settings UI & state management |
| `src/context/RFIDContext.tsx` | Global state for dashboard settings |
| `setup-database.sql` | Database table creation script |
| `backend/.env` | Database credentials & configuration |

---

## 🚀 Next Steps

After verifying everything works:

1. **Test all settings combinations** to ensure data persists correctly
2. **Check database** after each save to verify data is stored
3. **Test after page refresh** to ensure settings load correctly
4. **Test with multiple users** to ensure preferences are user-specific
5. **Monitor console logs** for any warnings or errors

---

## 📞 Common Issues & Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| Port 3001 already in use | Kill process: `netstat -ano \| findstr :3001` (Windows) |
| Database connection refused | Verify MySQL is running & credentials in `.env` |
| 403 errors on admin endpoints | Ensure you're logged in as admin user |
| Settings don't persist | Check database tables for data insertion |
| API returns 500 errors | Check backend console for detailed error messages |

