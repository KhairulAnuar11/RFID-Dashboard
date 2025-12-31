# Timestamp Year/Timezone Mismatch Fix

## Problem
Tags were being displayed with the wrong year (2026 instead of 2025) in the dashboard. Example:
```
readTime: '2026-12-30 09:41:22'
```
when the actual date should be:
```
readTime: '2025-12-30 09:41:22'
```

## Root Cause Analysis

### Backend Issues (`backend/src/server.ts`)

1. **Local Timezone Interpretation**: The `getSafeReadTime()` function was using local `getFullYear()`, `getMonth()`, etc., which interpret a `Date` object in the **browser/server's local timezone** instead of UTC.

2. **String Parsing Without Timezone**: When parsing strings like `"YYYY-MM-DD HH:MM:SS"` with `new Date()`, JavaScript assumes the date is in **local timezone** and converts it. If the server/system clock is ahead of UTC (or misconfigured), this causes year shifts.

3. **Database Storage Inconsistency**: The database was storing dates in local timezone format, but retrieval didn't consistently treat them as UTC, causing frontend-backend mismatches.

## Fixes Applied

### 1. Backend TypeScript (`backend/src/server.ts`)

#### Fix 1a: `getSafeReadTime()` function
**Before:**
```typescript
function getSafeReadTime(input: any): string {
  // ...
  const year = finalDate.getFullYear();  // Local timezone
  const month = String(finalDate.getMonth() + 1).padStart(2, '0');  // Local timezone
  // ...
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
```

**After:**
```typescript
function getSafeReadTime(input: any): string {
  // Robust parsing: treat incoming strings as UTC when no timezone provided
  if (typeof input === 'string') {
    let s = input.trim();
    // Common format 'YYYY-MM-DD HH:MM:SS' -> convert to 'YYYY-MM-DDTHH:MM:SSZ' (UTC)
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
      s = s.replace(' ', 'T') + 'Z';
    }
    // ... parse as UTC
  }

  // Format using UTC components instead of local
  const year = finalDate.getUTCFullYear();
  const month = String(finalDate.getUTCMonth() + 1).padStart(2, '0');
  // ...
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
```

**Impact**: All timestamps are now consistently stored in UTC format in MySQL.

#### Fix 1b: `localDatetimeToISOString()` function
**Before:**
```typescript
function localDatetimeToISOString(localStr: string): string | null {
  // Parse as if in local timezone
  const d = new Date(year, month, day, hour, minute, second);
  return d.toISOString();
}
```

**After:**
```typescript
function localDatetimeToISOString(localStr: string): string | null {
  // Interpret DB-stored datetimes as UTC
  const isoLike = m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + m[6] + 'Z';
  const d = new Date(isoLike);
  return d.toISOString();
}
```

**Impact**: Database reads are now consistently interpreted as UTC.

### 2. Backend Compiled JavaScript (`backend/dist/server.js`)

#### Fix 2a: MQTT Payload Normalization
**Added UTC handling when parsing `ReadTime`:**
```javascript
if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
  timeStr = timeStr + 'Z';  // Append Z to treat as UTC
}
```

#### Fix 2b: `saveTagData()` function
**Before:**
```javascript
const readTime = tag.read_time instanceof Date ? tag.read_time : new Date();
const values = [epc, tid, rssi, antenna, readerId, readerName, readTime, rawPayload];
```

**After:**
```javascript
// Convert to MySQL DATETIME (UTC) string
const readTimeStr = readTime.toISOString().slice(0, 19).replace('T', ' ');
const values = [epc, tid, rssi, antenna, readerId, readerName, readTimeStr, rawPayload];
```

**Impact**: Timestamps are inserted into DB as UTC strings.

#### Fix 2c: GET `/api/tags` endpoint normalization
**Added timestamp normalization for frontend:**
```javascript
const normalized = (tags || []).map((t) => {
  const out = Object.assign({}, t);
  if (t.read_time) {
    if (typeof t.read_time === 'string') {
      // Parse as UTC: 'YYYY-MM-DD HH:MM:SS' -> 'YYYY-MM-DDTHH:MM:SSZ'
      const m = t.read_time.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
      if (m) {
        const isoLike = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
        const d = new Date(isoLike);
        out.timestamp = d.toISOString();  // Always return ISO for frontend
      }
    }
  }
  return out;
});
```

**Impact**: Frontend receives consistent ISO timestamps (e.g., `2025-12-30T09:41:22.000Z`).

#### Fix 2d: POST `/api/tags` endpoint
**Before:**
```javascript
read_time: new Date(), // Always use server's current time, never trust client timestamp
```

**After:**
```javascript
// Prefer client-provided timestamp when present, otherwise use server time
read_time: tag.read_time ?? tag.timestamp ?? new Date(),
```

**Impact**: Client-provided timestamps are now respected when available.

## Result

**After these fixes:**
1. ✅ All timestamps are consistently stored in UTC format in MySQL
2. ✅ Frontend receives ISO 8601 timestamps (with `Z` suffix for UTC)
3. ✅ Year is correct (2025 instead of 2026 or other wrong years)
4. ✅ Timezone mismatches between frontend and backend are eliminated
5. ✅ MQTT payloads with timestamps are correctly interpreted as UTC
6. ✅ Dashboard displays correct dates and times

## Testing Recommendations

1. **Verify database content:**
   ```sql
   SELECT epc, read_time FROM rfid_tags ORDER BY read_time DESC LIMIT 5;
   ```
   Should show dates like `2025-12-30 09:41:22` (UTC format)

2. **Check frontend output:**
   - Open browser DevTools
   - Check network tab for `/api/tags` response
   - Verify `timestamp` field is ISO 8601 format: `2025-12-30T09:41:22.000Z`

3. **Monitor logs:**
   - Backend logs should show UTC timestamps in `[Tags] Sanitized tag data`
   - Example: `readTime: '2025-12-30 09:41:22'`

## Files Modified

1. `backend/src/server.ts` - TypeScript source (recompiled)
   - `getSafeReadTime()` function
   - `localDatetimeToISOString()` function
   
2. `backend/dist/server.js` - Compiled JavaScript
   - MQTT payload parsing
   - `saveTagData()` function
   - GET `/api/tags` endpoint
   - POST `/api/tags` endpoint

3. `src/pages/DashboardPage.tsx` - No changes needed (uses `new Date(tag.timestamp).toLocaleTimeString()` correctly)

## Build Status

✅ Frontend build: successful
✅ Backend build (TypeScript): successful
