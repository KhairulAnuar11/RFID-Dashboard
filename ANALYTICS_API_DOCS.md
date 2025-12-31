# Analytics API Documentation

## Base URL
```
http://localhost:3001/api
```

## Authentication
All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### 1. Weekly Trends
Get aggregated weekly activity statistics for the last 4 weeks.

**Endpoint:** `GET /analytics/weekly-trends`

**Query Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "week_start": "2024-01-08",
      "total_reads": 15234,
      "unique_tags": 342,
      "avg_rssi": -65.5
    },
    {
      "week_start": "2024-01-15",
      "total_reads": 18567,
      "unique_tags": 398,
      "avg_rssi": -63.2
    }
  ]
}
```

**Field Descriptions:**
- `week_start`: ISO date string of the Monday starting the week
- `total_reads`: Total number of RFID reads in that week
- `unique_tags`: Number of unique tag EPCs detected
- `avg_rssi`: Average signal strength (in dBm)

---

### 2. Antenna Statistics
Get antenna-level performance metrics for the last 7 days.

**Endpoint:** `GET /analytics/antenna-stats`

**Query Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "device": "Reader-01",
      "antenna": 1,
      "read_count": 8234,
      "unique_tags": 234,
      "avg_rssi": -62.3
    },
    {
      "device": "Reader-01",
      "antenna": 2,
      "read_count": 7891,
      "unique_tags": 221,
      "avg_rssi": -64.1
    }
  ]
}
```

**Field Descriptions:**
- `device`: Reader/device name
- `antenna`: Antenna port number (1-4 typically)
- `read_count`: Total reads from this antenna
- `unique_tags`: Number of unique tags detected
- `avg_rssi`: Average signal strength

---

### 3. Hourly Patterns
Get hourly aggregated activity patterns for the last 7 days.

**Endpoint:** `GET /analytics/hourly-patterns`

**Query Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2024-01-15",
      "hour": 14,
      "read_count": 1234,
      "unique_tags": 89,
      "device_count": 4,
      "avg_rssi": -63.5
    },
    {
      "date": "2024-01-15",
      "hour": 13,
      "read_count": 1156,
      "unique_tags": 82,
      "device_count": 4,
      "avg_rssi": -64.2
    }
  ]
}
```

**Field Descriptions:**
- `date`: ISO date
- `hour`: Hour of day (0-23)
- `read_count`: Total reads in that hour
- `unique_tags`: Number of unique tags detected
- `device_count`: Number of active devices in that hour
- `avg_rssi`: Average signal strength

---

### 4. Assets by Location
Get asset distribution across reader locations for the last 30 days.

**Endpoint:** `GET /analytics/assets-by-location`

**Query Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "location": "Warehouse-A",
      "total_reads": 45678,
      "unique_tags": 523,
      "days_active": 30,
      "last_activity": "2024-01-15T14:32:00Z",
      "avg_rssi": -62.3
    },
    {
      "location": "Warehouse-B",
      "total_reads": 34562,
      "unique_tags": 412,
      "days_active": 29,
      "last_activity": "2024-01-15T13:45:00Z",
      "avg_rssi": -65.8
    }
  ]
}
```

**Field Descriptions:**
- `location`: Reader/location name
- `total_reads`: Total reads at this location
- `unique_tags`: Number of unique tags detected
- `days_active`: Number of days with activity
- `last_activity`: ISO timestamp of most recent read
- `avg_rssi`: Average signal strength

---

### 5. Top Tags
Get the most frequently read tags.

**Endpoint:** `GET /analytics/top-tags`

**Query Parameters:**
- `days` (optional): Number of days to analyze. Default: 30
- `limit` (optional): Number of tags to return. Default: 10

**Examples:**
```
GET /analytics/top-tags
GET /analytics/top-tags?days=7
GET /analytics/top-tags?days=30&limit=20
GET /analytics/top-tags?limit=50
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "tag_id": "E28011606000000000000000A",
      "read_count": 2341,
      "readers": 4,
      "days_active": 28,
      "last_read": "2024-01-15T14:32:00Z",
      "avg_rssi": -68.2
    },
    {
      "tag_id": "E28011606000000000000000B",
      "read_count": 2156,
      "readers": 3,
      "days_active": 25,
      "last_read": "2024-01-15T14:15:00Z",
      "avg_rssi": -70.1
    }
  ]
}
```

**Field Descriptions:**
- `tag_id`: EPC (Electronic Product Code) of the tag
- `read_count`: Total number of times this tag was read
- `readers`: Number of different readers that detected this tag
- `days_active`: Number of unique days this tag was active
- `last_read`: ISO timestamp of most recent read
- `avg_rssi`: Average signal strength when reading this tag

---

### 6. Device Performance
Get comprehensive performance metrics for all devices over the last 30 days.

**Endpoint:** `GET /analytics/device-performance`

**Query Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "device": "Reader-01",
      "total_reads": 78945,
      "unique_tags": 1234,
      "avg_rssi": -62.3,
      "min_rssi": -85,
      "max_rssi": -45,
      "active_days": 30,
      "last_activity": "2024-01-15T14:32:00Z"
    },
    {
      "device": "Reader-02",
      "total_reads": 65234,
      "unique_tags": 987,
      "avg_rssi": -64.5,
      "min_rssi": -87,
      "max_rssi": -48,
      "active_days": 29,
      "last_activity": "2024-01-15T14:28:00Z"
    }
  ]
}
```

**Field Descriptions:**
- `device`: Device/reader name
- `total_reads`: Total reads from this device
- `unique_tags`: Number of unique tags detected
- `avg_rssi`: Average signal strength
- `min_rssi`: Minimum (weakest) signal recorded
- `max_rssi`: Maximum (strongest) signal recorded
- `active_days`: Number of days with activity
- `last_activity`: ISO timestamp of most recent read

---

### 7. Daily Trends
Get daily aggregated activity trends.

**Endpoint:** `GET /analytics/daily-trends`

**Query Parameters:**
- `days` (optional): Number of days to analyze. Default: 30

**Examples:**
```
GET /analytics/daily-trends
GET /analytics/daily-trends?days=7
GET /analytics/daily-trends?days=90
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2024-01-15",
      "total_reads": 15678,
      "unique_tags": 234,
      "active_devices": 4,
      "avg_rssi": -63.2
    },
    {
      "date": "2024-01-14",
      "total_reads": 14523,
      "unique_tags": 221,
      "active_devices": 4,
      "avg_rssi": -64.1
    }
  ]
}
```

**Field Descriptions:**
- `date`: ISO date
- `total_reads`: Total reads for that day
- `unique_tags`: Number of unique tags detected
- `active_devices`: Number of devices with activity
- `avg_rssi`: Average signal strength

---

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized: Invalid or missing token"
}
```

### 500 Server Error
```json
{
  "success": false,
  "error": "Failed to fetch [endpoint name]"
}
```

---

## Usage Examples

### JavaScript/Fetch

```javascript
const token = 'your-jwt-token';

// Get weekly trends
const response = await fetch('http://localhost:3001/api/analytics/weekly-trends', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data);
```

### Using apiService (Frontend)

```typescript
import { apiService } from '../services/apiService';

// Get weekly trends
const trends = await apiService.getWeeklyTrends();

// Get top 20 tags from last 7 days
const topTags = await apiService.getTopTags(7, 20);

// Get daily trends for 90 days
const dailyTrends = await apiService.getDailyTrends(90);
```

### cURL

```bash
curl -H "Authorization: Bearer your-jwt-token" \
  http://localhost:3001/api/analytics/weekly-trends
```

---

## Performance Tips

1. **Limit Query Parameters**: Use appropriate `days` and `limit` parameters to reduce response size
2. **Batch Requests**: The frontend already batches analytics requests for efficiency
3. **Caching**: Consider implementing client-side caching with a TTL of 5-10 minutes
4. **Database Indexes**: All queries use indexes on `read_time`, `reader_name`, and `epc`

---

## Data Freshness

- **Weekly Trends**: Updated as new data arrives
- **Antenna Stats**: Updated every read (last 7 days retained)
- **Hourly Patterns**: Updated every hour (last 7 days retained)
- **Assets by Location**: Updated as new data arrives (30-day window)
- **Top Tags**: Updated as new data arrives (configurable day window)
- **Device Performance**: Updated as new data arrives (30-day window)
- **Daily Trends**: Updated daily (configurable day window)

---

## Rate Limiting

Currently, there is no rate limiting on analytics endpoints. Consider implementing rate limiting in production based on your requirements.

Recommended: 100 requests per minute per user

---

## Database Schema

The analytics data is stored in the `rfid_tags` table:

```sql
CREATE TABLE rfid_tags (
  id INT PRIMARY KEY AUTO_INCREMENT,
  epc VARCHAR(255) NOT NULL,
  tid VARCHAR(255),
  rssi INT,
  antenna INT,
  reader_id VARCHAR(255),
  reader_name VARCHAR(255),
  read_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  raw_payload LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_read_time (read_time),
  INDEX idx_reader_name (reader_name),
  INDEX idx_epc (epc)
);
```

---

## Monitoring and Debugging

### Enable Debug Logging

Add this to your environment variables:
```
DEBUG_ANALYTICS=true
```

This will log all analytics queries and response times to the server console.

### Common Issues

1. **No data returned**: Check if rfid_tags table has data and date range is correct
2. **Slow responses**: Check database indexes and query execution plans
3. **Incorrect RSSI values**: RSSI is in dBm (negative values), typically -30 to -90
4. **Missing devices**: Ensure reader names are being captured correctly in MQTT data
