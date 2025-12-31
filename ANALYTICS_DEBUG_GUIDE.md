# Analytics Debug & Verification Guide

## Complete Data Flow Diagram

```
┌─────────────────┐
│  RFID Readers   │ (Send tag reads)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ MQTT Broker     │ (rfid/readers/+/tags)
└────────┬────────┘
         │
         ↓
┌────────────────────────────────────────┐
│ Backend MQTT Listener (connectMQTT)    │
├────────────────────────────────────────┤
│ mqttClient.on('message', saveTagData)  │
└────────┬───────────────────────────────┘
         │
         ↓
┌────────────────────────────────────────┐
│ saveTagData() Function                 │
├────────────────────────────────────────┤
│ INSERT INTO rfid_tags                  │
│ (epc, tid, rssi, antenna,              │
│  reader_id, reader_name,               │
│  read_time, raw_payload, created_at)   │
└────────┬───────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│ MySQL rfid_tags Table               │
│ (stores all RFID reads)             │
└────────┬────────────────────────────┘
         │
         ├─→ GET /api/dashboard/stats
         ├─→ GET /api/dashboard/activity
         ├─→ GET /api/dashboard/tags-by-device
         │
         └─→ GET /analytics/* (7 endpoints)
                ├─→ /analytics/weekly-trends
                ├─→ /analytics/antenna-stats
                ├─→ /analytics/hourly-patterns
                ├─→ /analytics/assets-by-location
                ├─→ /analytics/top-tags
                ├─→ /analytics/device-performance
                └─→ /analytics/daily-trends
                         │
                         ↓
                ┌─────────────────────┐
                │ Aggregated Response │
                └────────┬────────────┘
                         │
                         ↓
                ┌─────────────────────┐
                │ Frontend Charts     │
                │ (Analytics Page)    │
                └─────────────────────┘
```

## Step-by-Step Verification

### Phase 1: Backend Setup (5 minutes)

#### 1.1 Check Backend Code
```bash
cd "c:\Users\Bing\Documents\Work_Khairul\Fixmount Project\RFID Dashboard\backend"
grep -n "/analytics/" src/server.ts
```

Expected output (7 lines):
```
420:app.get('/analytics/weekly-trends', authenticateToken, async (req, res) => {
443:app.get('/analytics/antenna-stats', authenticateToken, async (req, res) => {
466:app.get('/analytics/hourly-patterns', authenticateToken, async (req, res) => {
489:app.get('/analytics/assets-by-location', authenticateToken, async (req, res) => {
512:app.get('/analytics/top-tags', authenticateToken, async (req, res) => {
535:app.get('/analytics/device-performance', authenticateToken, async (req, res) => {
565:app.get('/analytics/daily-trends', authenticateToken, async (req, res) => {
```

#### 1.2 Start Backend
```bash
npm run dev
```

Expected console output:
```
[Server] Running on port 3001
[Server] Environment: development
[MQTT] Connected to broker
```

**ERROR CHECK**: If you don't see `[MQTT] Connected to broker`, MQTT is not configured. Skip to "MQTT Configuration" section.

### Phase 2: Database Verification (5 minutes)

#### 2.1 Check Database Exists
```bash
mysql -u root -p -e "USE rfid_system_db; SHOW TABLES LIKE 'rfid_tags';"
```

Expected: 
```
+------------------+
| Tables_in_rfid_system_db |
+------------------+
| rfid_tags        |
+------------------+
```

#### 2.2 Check Table Schema
```bash
mysql -u root -p -e "USE rfid_system_db; DESCRIBE rfid_tags;"
```

Expected columns (must include):
- `id` (INT PRIMARY KEY AUTO_INCREMENT)
- `epc` (VARCHAR)
- `tid` (VARCHAR)
- `rssi` (INT)
- `antenna` (INT)
- `reader_id` (VARCHAR)
- `reader_name` (VARCHAR)
- **`read_time` (TIMESTAMP)** ← CRITICAL
- `raw_payload` (TEXT or LONGTEXT)
- `created_at` (TIMESTAMP)

**ERROR CHECK**: If `read_time` column is missing or named differently, analytics won't work.

#### 2.3 Check if Data Exists
```bash
mysql -u root -p -e "USE rfid_system_db; SELECT COUNT(*) as total_records FROM rfid_tags;"
```

- **If count > 0**: Data exists, go to Phase 3
- **If count = 0**: No data yet (normal on first run), skip to Phase 4

### Phase 3: Analytics Query Testing (5 minutes)

#### 3.1 Test Daily Trends Query
```sql
SELECT 
  DATE(read_time) as date,
  COUNT(*) as reads,
  COUNT(DISTINCT epc) as unique_tags
FROM rfid_tags
WHERE DATE(read_time) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY DATE(read_time)
ORDER BY date ASC
LIMIT 5;
```

Expected: Rows with date, reads count, and unique_tags count

#### 3.2 Test Weekly Trends Query
```sql
SELECT 
  WEEK(read_time) as week,
  YEAR(read_time) as year,
  COUNT(*) as reads,
  COUNT(DISTINCT epc) as unique_tags
FROM rfid_tags
WHERE read_time >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
GROUP BY YEAR(read_time), WEEK(read_time)
ORDER BY year DESC, week DESC
LIMIT 5;
```

Expected: Rows with week, year, reads, and unique_tags

#### 3.3 Test Antenna Stats Query
```sql
SELECT 
  reader_name as device,
  antenna,
  COUNT(*) as read_count,
  COUNT(DISTINCT epc) as unique_tags
FROM rfid_tags
WHERE DATE(read_time) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY reader_name, antenna
LIMIT 5;
```

Expected: Antenna-level performance data

**ERROR CHECK**: Any SQL errors here indicate column name problems. Verify column names in table description above.

### Phase 4: Frontend Testing (5 minutes)

#### 4.1 Open Dashboard
Navigate to: `http://localhost:5173`

#### 4.2 Go to Analytics Page
Click: **Analytics & Insights** in sidebar

#### 4.3 Check Each Section

| Section | Expected | Error Handling |
|---------|----------|-----------------|
| Daily Activity Trends | Line chart with dates | Should show message if no data |
| Weekly Activity Trends | Weekly bars | Should show message if no data |
| Hourly Activity Patterns | Hourly bars | Should show message if no data |
| Antenna Read Count | Bar chart | Should show message if no data |
| Assets by Location | Chart | Should show message if no data |
| Device Performance | Table/Chart | Should show message if no data |
| Top Tags | List/Table | Should show message if no data |

**ERROR CHECK**: 
- 404 errors = Backend not running or endpoints missing
- "No data available" = No data in database yet (NORMAL first time)
- Partial data = Some data exists but not enough

### Phase 5: Troubleshooting Decision Tree

```
Issue: 404 error on analytics page
├─ Solution: Backend not running with latest code
├─ Action: cd backend && npm run dev
└─ Verify: Check console for "[Server] Running on port 3001"

Issue: "No data available" on all charts
├─ Check: Count records in rfid_tags table
│  └─ If count = 0: MQTT not receiving data
│     └─ Check: Backend console for "[DB] Tag saved successfully"
│     └─ Check: MQTT configuration in Settings
│     └─ Check: RFID readers are sending data
│  └─ If count > 0: Queries not returning data
│     └─ Verify: SQL queries execute successfully in MySQL
│     └─ Verify: Column names are correct
│     └─ Verify: Date ranges match data

Issue: SQL errors in backend console
├─ Cause: Column name mismatch
├─ Solution: Verify rfid_tags schema
├─ Action: Check column names match schema documentation
└─ Check: No use of old column names (timestamp, tag_id)

Issue: Slow queries / timeout errors
├─ Cause: Missing database indexes
├─ Action: Run analytics-fixes.sql
├─ Verify: Restart backend after indexes created
└─ Test: Queries run faster

Issue: Data appears in dashboard but not in analytics
├─ Cause: Different endpoints used
├─ Solution: Dashboard uses /api/dashboard/*, Analytics uses /analytics/*
├─ Check: Both endpoint groups implemented in backend
└─ Verify: No typos in endpoint paths
```

## Critical Configuration Checklist

- [ ] **Backend running on port 3001**
  ```bash
  ps aux | grep "npm run dev"
  ```
  
- [ ] **MQTT connected** 
  - Check backend console: `[MQTT] Connected to broker`
  
- [ ] **MySQL running**
  ```bash
  mysql -u root -p -e "SELECT 1"
  ```
  
- [ ] **rfid_tags table exists**
  ```bash
  mysql -u root -p rfid_system_db -e "SELECT COUNT(*) FROM rfid_tags"
  ```
  
- [ ] **All 7 analytics endpoints present in code**
  ```bash
  grep -c "/analytics/" backend/src/server.ts
  ```
  Should return: `7`
  
- [ ] **Database indexes created**
  ```bash
  mysql -u root -p rfid_system_db -e "SHOW INDEXES FROM rfid_tags"
  ```
  Should include: `idx_read_time`, `idx_epc`, `idx_reader_name`

## Live Testing Commands

### Monitor MQTT Messages (if using mosquitto)
```bash
mosquitto_sub -h localhost -p 1883 -t "rfid/readers/+/tags" -v
```

### Monitor Backend Logs
```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Watch for successful saves
# Look for: [DB] ✅ Tag saved successfully
# Or: [DB] Error saving tag data:
```

### Monitor Database Growth
```bash
# Run every 10 seconds to see data being added
watch -n 10 "mysql -u root -p rfid_system_db -e 'SELECT COUNT(*) as total_records, MAX(read_time) as newest_record FROM rfid_tags'"
```

## Expected Results Timeline

| Time | Expected State | What to Check |
|------|---|---|
| T=0 | Backend starts | Console shows port 3001 |
| T=5s | MQTT connects | Console shows `[MQTT] Connected to broker` |
| T=10s | First RFID read arrives | Check MQTT topic or backend logs |
| T=15s | Data saved to DB | `SELECT COUNT(*) FROM rfid_tags` > 0 |
| T=20s | Analytics queries run | Refresh analytics page |
| T=30s | Charts populate | Should see data in analytics sections |

## Common Errors and Fixes

### Error: `Cannot read property 'data' of undefined`
**Cause**: Backend endpoint not implemented
**Fix**: Verify all 7 `/analytics/*` endpoints exist in server.ts

### Error: `Unknown column 'read_time' in 'field list'`
**Cause**: Column name mismatch (should be fixed already)
**Fix**: Check rfid_tags schema, verify column name

### Error: `Too many connections to database`
**Cause**: Connection pool exhausted
**Fix**: Restart backend, check for hanging queries

### Error: CORS error when calling /analytics endpoints
**Cause**: CORS not configured for /analytics path
**Fix**: CORS middleware applies to all routes, check error details

### Error: 401 Unauthorized when calling analytics
**Cause**: JWT token invalid or missing
**Fix**: Login again, check token in localStorage

## Performance Testing

### Before Optimization
```sql
-- Check query execution time
SET @start = NOW(6);
SELECT DATE(read_time) as date, COUNT(*) as reads FROM rfid_tags GROUP BY DATE(read_time);
SELECT TIMEDIFF(NOW(6), @start) as execution_time;
```

### After Optimization (indexes applied)
- Queries should return in < 500ms
- If > 5s: Review indexes, may need data archiving

## MQTT Configuration

If analytics shows "no data" and MQTT not connected:

### Option 1: Using Built-in Settings
1. Go to Dashboard Settings (gear icon)
2. Find MQTT Configuration section
3. Enter:
   - **Broker Host**: Your MQTT broker IP
   - **Broker Port**: Usually 1883
   - **Username**: (if required)
   - **Password**: (if required)
   - **Topic**: `rfid/readers/+/tags`

### Option 2: Using Environment Variables
Add to `.env` file in backend directory:
```
MQTT_BROKER=mqtt://localhost:1883
MQTT_USERNAME=your_username
MQTT_PASSWORD=your_password
```
Then restart: `npm run dev`

### Option 3: Using Docker/Container (if applicable)
```bash
docker run -d --name mosquitto -p 1883:1883 eclipse-mosquitto
```

## Success Indicators

### Backend Console
```
✅ [Server] Running on port 3001
✅ [MQTT] Connected to broker
✅ [DB] ✅ Tag saved successfully (multiple times)
```

### MySQL
```sql
✅ SELECT COUNT(*) FROM rfid_tags;  -- Returns > 0
✅ SELECT * FROM rfid_tags LIMIT 1; -- Has recent read_time
```

### Frontend
```
✅ Analytics page loads without 404
✅ Charts render without "No data available"
✅ Multiple chart sections show data
```

---

**Use this guide sequentially to identify exactly where the issue is in the data flow.**

