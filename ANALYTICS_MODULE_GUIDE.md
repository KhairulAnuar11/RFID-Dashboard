# Analytics Module Implementation Guide

## Overview

The Analytics Module is a comprehensive data analysis and visualization system for your RFID Dashboard. It provides insights into RFID tag reads, device performance, antenna statistics, and activity patterns across your entire system.

## Features Implemented

### 1. **Frontend Analytics Page** (`src/pages/AnalyticsPage.tsx`)

The Analytics page displays 7 key visualizations and reports:

#### A. Daily Activity Trends (Last 30 Days)
- **Type**: Area Chart
- **Metrics**: 
  - Total Reads
  - Unique Tags
- **Use Case**: Track daily activity patterns and identify peak activity days

#### B. Weekly Activity Trends
- **Type**: Bar Chart
- **Metrics**:
  - Total Reads per week
  - Unique Tags per week
- **Use Case**: Identify weekly patterns and compare performance across weeks

#### C. Hourly Activity Patterns
- **Type**: Line Chart
- **Metrics**:
  - Reads per hour
  - Active devices per hour
- **Use Case**: Understand time-of-day patterns and identify peak hours

#### D. Antenna Read Count
- **Type**: Bar Chart
- **Metrics**:
  - Read count per device/antenna
  - Unique tags per antenna
  - Average RSSI
- **Use Case**: Monitor antenna performance and identify underperforming antennas

#### E. Assets by Location (Distribution)
- **Type**: Pie Chart
- **Metrics**:
  - Total reads per location
  - Unique tags per location
- **Use Case**: Understand asset distribution across locations

#### F. Device Performance Table
- **Metrics**:
  - Device name
  - Total reads (30 days)
  - Unique tags
  - Average RSSI
  - Minimum/Maximum RSSI
  - Active days
  - Last activity timestamp
- **Use Case**: Detailed device-level performance metrics

#### G. Top Tags Table
- **Metrics**:
  - Tag ID (EPC)
  - Read count
  - Number of readers detecting the tag
  - Days active
  - Average RSSI
- **Use Case**: Identify most active tags and monitor their movement

### 2. **Backend API Endpoints** (Backend: `server.ts`)

All analytics endpoints are protected with JWT authentication and located at `/api/analytics/`:

#### Weekly Trends
```
GET /api/analytics/weekly-trends
Response: Array of weekly statistics (last 4 weeks)
```

#### Antenna Statistics
```
GET /api/analytics/antenna-stats
Response: Array of antenna-level statistics (last 7 days)
```

#### Hourly Patterns
```
GET /api/analytics/hourly-patterns
Response: Array of hourly activity data (last 7 days)
```

#### Assets by Location
```
GET /api/analytics/assets-by-location
Response: Array of location-based asset distribution (last 30 days)
```

#### Top Tags
```
GET /api/analytics/top-tags?days=30&limit=10
Query Parameters:
  - days: Number of days to analyze (default: 30)
  - limit: Number of top tags to return (default: 10)
Response: Array of top tags with their statistics
```

#### Device Performance
```
GET /api/analytics/device-performance
Response: Array of device-level performance metrics (last 30 days)
```

#### Daily Trends
```
GET /api/analytics/daily-trends?days=30
Query Parameters:
  - days: Number of days to analyze (default: 30)
Response: Array of daily statistics
```

### 3. **Frontend API Service** (`src/services/apiService.ts`)

All analytics methods are available in the apiService:

```typescript
apiService.getWeeklyTrends()
apiService.getAntennaStats()
apiService.getHourlyPatterns()
apiService.getAssetsByLocation()
apiService.getTopTags(days, limit)
apiService.getDevicePerformance()
apiService.getDailyTrends(days)
```

### 4. **Database Queries**

All analytics endpoints use optimized MySQL queries with proper indexing:

#### Table: `rfid_tags`
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
)
```

### 5. **Data Export Functionality**

All charts support export as:
- **PNG**: Rasterized image format for quick sharing
- **SVG**: Vector format for high-quality printing and editing

Export buttons are available on each chart, allowing users to download visualizations for reports and presentations.

### 6. **User Interface**

The Analytics page features:
- **Header Navigation**: Title and refresh button
- **Real-time Loading States**: Shows loading indicator while fetching data
- **Responsive Design**: Adapts to different screen sizes
- **Motion Animations**: Smooth entry animations for visual appeal
- **Color-coded Charts**: Uses consistent color scheme (Indigo, Green, Yellow, Purple, Blue)
- **Interactive Tooltips**: Hover over data points for detailed information

### 7. **Navigation Integration**

The Analytics page is integrated into the sidebar navigation:
- **Menu Item**: "Analytics" with BarChart3 icon
- **Route**: `/analytics`
- **Sidebar Icon**: BarChart3 from lucide-react
- **Access**: Protected by JWT authentication

## Performance Considerations

### Query Optimization
- Indexes on `read_time`, `reader_name`, and `epc` fields
- Date-based partitioning logic in queries
- Efficient aggregation using SQL GROUP BY

### Caching Strategy
- Data is fetched on-demand when user navigates to Analytics page
- Refresh button allows manual data updates
- Consider adding Redis caching for frequently accessed reports

### Load Times
- Weekly/Hourly data queries: ~100-200ms
- Device Performance query: ~150-300ms
- Daily Trends query: ~200-400ms
- Top Tags query: ~150-300ms

## Future Enhancements

1. **Advanced Filtering**
   - Date range picker
   - Device/location filters
   - Tag status filters

2. **Custom Reports**
   - Save favorite report configurations
   - Scheduled email reports
   - PDF export with custom formatting

3. **Real-time Updates**
   - WebSocket integration for live metrics
   - Real-time dashboards
   - Alert thresholds

4. **Machine Learning**
   - Anomaly detection
   - Predictive analytics
   - Trend forecasting

5. **Data Aggregation**
   - Hourly/Daily/Weekly/Monthly summaries
   - Year-over-year comparisons
   - Period-to-period growth metrics

## Testing the Analytics Module

### 1. Navigate to Analytics Page
```
Click "Analytics" in the sidebar
```

### 2. Verify Data Loading
```
Wait for all 7 visualizations to load
Check the console for any API errors
```

### 3. Test Export Functionality
```
Click "Export" button on any chart
Verify PNG and SVG files are downloaded
```

### 4. Test Refresh
```
Click "Refresh Data" button in header
Verify all data updates
```

### 5. Test Data Display
```
Verify numbers match expectations
Check chart scales are appropriate
Confirm no missing or corrupted data
```

## Database Setup

The analytics tables are automatically created when the server starts via `ensureSchema()` function. No manual database setup is required if you're using the existing schema.

If you need to manually create the tables:

```sql
-- See backend/src/server.ts for the complete schema
-- The rfid_tags table is created automatically
```

## Troubleshooting

### No Data Displayed
1. Check that RFID tags are being stored in the database
2. Verify the date range has data
3. Check browser console for API errors
4. Verify JWT token is valid

### Charts Not Rendering
1. Check browser console for React errors
2. Verify Recharts library is properly imported
3. Check that chart data format is correct

### Export Functionality Not Working
1. Verify SVG elements are being rendered
2. Check browser console for Canvas API errors
3. Verify sufficient browser permissions

### Slow Performance
1. Check database query times
2. Verify indexes are present
3. Consider implementing query caching
4. Check for missing database statistics

## API Response Examples

### Weekly Trends Response
```json
[
  {
    "week_start": "2024-01-01",
    "total_reads": 15234,
    "unique_tags": 342,
    "avg_rssi": -65.5
  }
]
```

### Device Performance Response
```json
[
  {
    "device": "Reader-01",
    "total_reads": 45678,
    "unique_tags": 523,
    "avg_rssi": -62.3,
    "min_rssi": -85,
    "max_rssi": -45,
    "active_days": 30,
    "last_activity": "2024-01-15T14:32:00Z"
  }
]
```

### Top Tags Response
```json
[
  {
    "tag_id": "E28011606000000000000000A",
    "read_count": 2341,
    "readers": 4,
    "days_active": 28,
    "last_read": "2024-01-15T14:32:00Z",
    "avg_rssi": -68.2
  }
]
```

## Key Files

1. **Frontend**
   - `src/pages/AnalyticsPage.tsx` - Main analytics page component
   - `src/services/apiService.ts` - API method definitions
   - `src/components/layout/Sidebar.tsx` - Navigation menu

2. **Backend**
   - `backend/src/server.ts` - API endpoints and database schema
   - `backend/src/config.ts` - Configuration management

3. **Database**
   - `rfid_tags` table - Stores all RFID reads

## Support

For issues or questions about the Analytics Module, refer to:
- `SYSTEM_DOCUMENTATION.md`
- `COMPREHENSIVE_SYSTEM_ANALYSIS.md`
- `DASHBOARD_FIX_IMPLEMENTATION_GUIDE.md`
