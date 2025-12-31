# Implementation Guide: Dashboard Module Fixes

## What Was Fixed

### 1. ✅ Enhanced saveTagData Function
**File:** `backend/src/server.ts`

**Changes:**
- Added validation for EPC field (prevent NULL EPC saves)
- Added try-catch error handling
- Added detailed logging for debugging
- Sanitized all input values
- Returns boolean to indicate success/failure

**Result:** Tags are now validated before saving, with detailed error messages in console.

### 2. ✅ Improved normalizeRFIDPayload Function
**File:** `backend/src/server.ts`

**Changes:**
- Better timestamp parsing with fallback
- Type checking for all fields
- Proper string trimming
- Error logging for malformed payloads
- Better null handling

**Result:** MQTT payloads are now properly normalized even if some fields are missing.

### 3. ✅ Updated handleTagMessage Function
**File:** `backend/src/server.ts`

**Changes:**
- Checks return value from saveTagData
- Validates EPC before processing
- Better error logging
- Only updates device if tag save succeeded

**Result:** Failed tag saves don't cause cascading errors.

### 4. ✅ Fixed Dashboard Stats Endpoint
**File:** `backend/src/server.ts`

**Changes:**
- Changed errorCount from "offline devices" to "unresolved system alerts"
- Uses new system_alerts table
- Includes heartbeat timeout check for active readers
- Only counts unique tags from today

**Result:** Dashboard widgets now show correct metrics.

### 5. ✅ Fixed 24-Hour Activity Graph
**File:** `backend/src/server.ts`

**Changes:**
- Now returns all 24 hours (00:00-23:00)
- Missing hours get count of 0
- Proper formatting

**Result:** Graphs show continuous line even with data gaps.

### 6. ✅ Fixed Tags-by-Device Graph
**File:** `backend/src/server.ts`

**Changes:**
- Uses COUNT(DISTINCT epc) for deduplication
- Returns both count and total_reads
- No limit, shows all devices with data

**Result:** More accurate per-device statistics.

---

## How to Deploy These Fixes

### Step 1: Stop the Backend Server
```bash
# Press Ctrl+C in the backend terminal
# or kill the node process
```

### Step 2: Update the Database Schema
```bash
# Open MySQL client
mysql -h localhost -u root -p

# Select your database
USE rfid_dashboard;

# Run the dashboard-fixes.sql script
source dashboard-fixes.sql;

# Or manually paste the SQL content
```

### Step 3: Restart the Backend
```bash
cd backend
npm start
```

### Step 4: Verify the Fixes

#### Check Backend Logs
Look for these messages in the backend console:
```
[DB] ✅ Tag saved successfully: { epc: '...' }
[MQTT] ✅ Tag processed and saved: { epc: '...' }
[Dashboard] Stats calculated: { tagsToday: X, activeReaders: Y, ... }
[Dashboard] Activity data fetched: [...]
[Dashboard] Tags by device fetched: [...]
```

#### Check Dashboard in Browser
1. Navigate to Dashboard page
2. Scroll down to graphs
3. You should see:
   - **24-Hour Activity**: Line chart with 24 hours
   - **Tags per Device**: Bar chart with devices
   - Graphs should NOT be empty (if MQTT data is flowing)

#### Test Data Insertion
If graphs are still empty, test MQTT connection:

1. Go to Settings → MQTT Configuration
2. Click "Test Connection"
3. If successful, the dashboard should have data within 30 seconds

---

## Troubleshooting

### Symptom: Graphs Still Show No Data

**Diagnostic Steps:**

1. **Check if tags exist in database:**
   ```sql
   SELECT COUNT(*) FROM rfid_tags;
   SELECT * FROM rfid_tags ORDER BY created_at DESC LIMIT 5;
   ```
   
   - If COUNT is 0: MQTT is not receiving data
   - If COUNT > 0: Graph query has issue

2. **Check MQTT connection status:**
   - Backend console should show: `[MQTT] ✅ Backend connected to broker`
   - If it says "error", check MQTT credentials in Settings

3. **Check for saveTagData errors:**
   - Look in backend console for: `[DB] ❌ Failed to save tag data`
   - If present, check the error message
   - Common issues:
     - EPC is NULL/empty
     - Database connection issue
     - Table doesn't exist

4. **Run diagnostic query:**
   ```sql
   -- Check data from last 24 hours
   SELECT 
     DATE_FORMAT(read_time, '%H:00') as hour,
     COUNT(*) as count
   FROM rfid_tags
   WHERE read_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
   GROUP BY DATE_FORMAT(read_time, '%H:00')
   ORDER BY hour;
   ```

### Symptom: Tags Not Appearing in Real-time

**Possible Causes:**
1. MQTT topic mismatch
2. RFID reader not publishing to correct topic
3. Payload format issue

**Solution:**
1. Check MQTT broker logs for published messages
2. Verify reader is sending to configured topics
3. Check `[MQTT] Normalized payload` logs in backend

### Symptom: Dashboard Widgets Show Wrong Numbers

**Common Issues:**

| Widget | Issue | Solution |
|--------|-------|----------|
| Tags Read Today | Shows 0 | Check if tags from today exist in DB |
| Active Readers | Shows incorrect count | Check device status and last_heartbeat |
| Unique Tags | Shows all-time count | Query now filters to today only |
| Error Count | Shows offline devices | Now uses system_alerts table |

---

## Performance Considerations

### Query Optimization
The following indexes were added for better performance:
```sql
ALTER TABLE rfid_tags ADD INDEX idx_read_time (read_time);
ALTER TABLE rfid_tags ADD INDEX idx_reader_name (reader_name);
ALTER TABLE rfid_tags ADD INDEX idx_epc (epc);
ALTER TABLE rfid_tags ADD INDEX idx_date_read_time (read_time, reader_name);
ALTER TABLE devices ADD INDEX idx_status (status);
ALTER TABLE devices ADD INDEX idx_last_heartbeat (last_heartbeat);
```

### Expected Performance
- Dashboard stats query: < 100ms
- Activity graph query: < 200ms
- Tags by device query: < 150ms

If queries are slow:
1. Add more indexes
2. Archive old data (older than 30 days)
3. Implement caching with Redis

---

## Next Steps After Deployment

1. **Monitor Logs**: Watch backend console for errors
2. **Test with Real Data**: Ensure MQTT is sending real RFID reads
3. **Verify Metrics**: Compare dashboard numbers with database queries
4. **Optimize**: If performance issues arise, implement caching

---

## Files Modified

1. `backend/src/server.ts`
   - saveTagData function (enhanced with validation)
   - normalizeRFIDPayload function (improved parsing)
   - handleTagMessage function (error checking)
   - /api/dashboard/stats endpoint (uses system_alerts)
   - /api/dashboard/activity endpoint (returns all 24 hours)
   - /api/dashboard/tags-by-device endpoint (with deduplication)

2. `dashboard-fixes.sql` (NEW)
   - Creates system_alerts table
   - Adds necessary indexes
   - Diagnostic queries

---

## Rollback Plan

If issues occur:

1. **Restore Previous Code:**
   ```bash
   git checkout backend/src/server.ts
   ```

2. **Keep Database Changes:**
   - The SQL changes are additive (new table + indexes)
   - Safe to keep even if rolling back code

3. **Restart Backend:**
   ```bash
   npm start
   ```

---

## Success Criteria

After deployment, verify:
- ✅ Backend logs show successful tag saves
- ✅ Dashboard graphs show data from last 24 hours
- ✅ Widget metrics match database queries
- ✅ No errors in console when MQTT messages arrive
- ✅ Charts update every 30 seconds automatically

---

**Last Updated:** December 29, 2025  
**Status:** Ready for Production  
**Risk Level:** Low (mostly query improvements and validation)
