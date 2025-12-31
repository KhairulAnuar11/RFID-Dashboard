# Analytics Module Fix - Complete Guide

## Problem Summary
The analytics module was unable to display data because:
1. **Missing Analytics API Endpoints**: The backend server had no `/analytics/*` endpoints that the frontend was trying to call
2. **Database Schema**: The backend was querying `rfid_tags` table which uses the correct column names (`read_time`, `epc`, `antenna`, `reader_name`)

## Solution Implemented

### 1. Added Analytics API Endpoints to Backend
Added 7 new analytics endpoints to `backend/src/server.ts`:

#### Endpoints Added:
- `GET /analytics/weekly-trends` - Weekly read trends
- `GET /analytics/antenna-stats` - Antenna performance statistics  
- `GET /analytics/hourly-patterns` - Hourly activity patterns
- `GET /analytics/assets-by-location` - Assets by reader location
- `GET /analytics/top-tags` - Top performing tags (with days and limit params)
- `GET /analytics/device-performance` - Device/reader performance metrics
- `GET /analytics/daily-trends` - Daily trend data (with days param)

### 2. Database Requirements
The `rfid_tags` table must have these columns:
```
- id (INT AUTO_INCREMENT PRIMARY KEY)
- epc (VARCHAR 255) - unique tag identifier
- tid (VARCHAR 255) - tag info
- rssi (INT) - signal strength
- antenna (INT) - antenna number
- reader_id (VARCHAR 100) - reader identifier
- reader_name (VARCHAR 255) - reader display name
- read_time (TIMESTAMP) - when tag was read *** CRITICAL ***
- raw_payload (TEXT) - raw MQTT data
- created_at (TIMESTAMP) - record created time
```

### 3. Required Database Indexes
Run `analytics-fixes.sql` to add indexes for performance:
```sql
CREATE INDEX idx_read_time ON rfid_tags(read_time);
CREATE INDEX idx_epc ON rfid_tags(epc);
CREATE INDEX idx_reader_name ON rfid_tags(reader_name);
CREATE INDEX idx_antenna ON rfid_tags(antenna);
```

## How Analytics Data Flows Now

```
RFID Reader
    ↓
MQTT Broker (rfid/readers/+/tags topic)
    ↓
Backend MQTT Listener
    ↓
saveTagData() - Inserts into rfid_tags table
    ↓
rfid_tags Database Table
    ↓
Frontend calls /analytics/* endpoints
    ↓
Backend queries rfid_tags table with GROUP BY/aggregation
    ↓
Analytics Page displays charts
```

## Setup Steps

### Step 1: Verify Backend Code
The backend has been updated with all analytics endpoints. The file `backend/src/server.ts` now includes:
- 7 new analytics endpoints
- All endpoints properly authenticate users
- All queries use correct column names

### Step 2: Run Database Fixes
Execute the SQL script to add indexes:
```bash
mysql -u root -p rfid_system_db < analytics-fixes.sql
```

Or run in MySQL client:
```sql
USE rfid_system_db;
-- Then paste contents of analytics-fixes.sql
```

### Step 3: Restart Backend Server
```bash
cd backend
npm run dev
```

You should see:
```
[Server] Running on port 3001
[MQTT] Connected to broker
```

### Step 4: Test Analytics Endpoints
Open dashboard at `http://localhost:5173` and navigate to Analytics page.

Expected results:
- Daily Activity Trends chart populates with data
- Weekly Activity Trends chart populates
- Hourly Activity Patterns chart populates
- Assets by Location chart populates
- Antenna Read Count chart populates

## Verification Queries

Run these in MySQL to verify data is being collected:

### Check total records
```sql
SELECT COUNT(*) as total_records FROM rfid_tags;
```

### Check records from last 24 hours
```sql
SELECT COUNT(*) as records_last_24h 
FROM rfid_tags 
WHERE read_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR);
```

### Check unique tags
```sql
SELECT COUNT(DISTINCT epc) as unique_tags FROM rfid_tags;
```

### Check unique readers
```sql
SELECT COUNT(DISTINCT reader_name) as unique_readers FROM rfid_tags;
```

### Check antenna distribution
```sql
SELECT antenna, COUNT(*) as count 
FROM rfid_tags 
GROUP BY antenna;
```

### Check hourly distribution
```sql
SELECT 
  DATE_FORMAT(read_time, '%H:00') as hour,
  COUNT(*) as count
FROM rfid_tags
WHERE read_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY DATE_FORMAT(read_time, '%H:00');
```

## Troubleshooting

### Issue: "Analytics data loaded" shows but charts say "No data available"
**Cause**: No data in `rfid_tags` table yet
**Solution**: 
1. Verify MQTT is connected (check backend logs for "[MQTT] Connected to broker")
2. Configure MQTT broker in Dashboard Settings
3. Ensure RFID readers are sending data to MQTT broker
4. Check backend logs for "[DB] ✅ Tag saved successfully" messages

### Issue: 404 error for /analytics endpoints
**Cause**: Backend not restarted after code update
**Solution**: Restart backend with `npm run dev`

### Issue: SQL errors in backend logs
**Cause**: Column name mismatch (already fixed in this update)
**Solution**: Verify backend has latest server.ts changes

### Issue: Charts show partial data
**Cause**: Missing indexes or slow queries
**Solution**: Run `analytics-fixes.sql` to add indexes

## Key Implementation Details

### Analytics Queries Architecture
All analytics queries:
1. Query only the `rfid_tags` table (source of truth)
2. Use GROUP BY for aggregation (no separate analytics tables required)
3. Use correct column names (`read_time`, `epc`, `antenna`, `reader_name`)
4. Support time-range filtering (last 7 days, 12 weeks, 30 days)
5. Return both raw counts and distinct counts

### Query Examples

**Weekly Trends Query**:
```sql
SELECT 
  WEEK(read_time) as week,
  COUNT(*) as reads,
  COUNT(DISTINCT epc) as unique_tags
FROM rfid_tags
WHERE read_time >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
GROUP BY YEAR(read_time), WEEK(read_time)
```

**Daily Trends Query**:
```sql
SELECT 
  DATE(read_time) as date,
  COUNT(*) as reads,
  COUNT(DISTINCT epc) as unique_tags
FROM rfid_tags
WHERE DATE(read_time) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY DATE(read_time)
```

## Performance Notes

For large datasets (>1M records in rfid_tags):
- Indexes on `read_time`, `epc`, `reader_name` are critical
- Queries use date filtering to limit result sets
- Consider archiving old data (older than 30-90 days)
- Use optional `analytics_daily` table for pre-aggregated daily summaries

## Testing Checklist

- [ ] Backend starts without errors
- [ ] MQTT connection shows in logs
- [ ] Analytics page loads without 404 errors
- [ ] At least one chart shows data
- [ ] All 7 analytics sections have content or "No data" message
- [ ] Backend logs show successful query execution

## Files Modified

1. **backend/src/server.ts** - Added 7 analytics endpoints
2. **analytics-fixes.sql** - Database schema verification and indexes (NEW)

## Next Steps After Implementation

1. **MQTT Configuration**: Ensure MQTT broker is properly configured in Settings
2. **Data Collection**: Verify RFID readers are active and sending data
3. **Data Persistence**: Monitor that `rfid_tags` table is growing
4. **Analytics Display**: Verify charts populate with aggregated data
5. **Performance**: If queries slow, review database indexes

---

**Note**: All analytics data is computed on-demand from the `rfid_tags` table. No separate analytics database schema is needed. The system queries the raw RFID tag data and aggregates it by date, hour, device, antenna, etc.

