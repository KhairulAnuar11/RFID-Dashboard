// src/services/analyticsService.ts
// Updated analytics service with proper date handling and graph data formatting

import { apiService } from './apiService';

interface TagActivityData {
  time: string;
  count: number;
}

interface HourlyPattern {
  hour: string;
  read_count: number;
  device_count: number;
}

interface DailyTrend {
  date: string;
  reads: number;
  unique_tags: number;
}

interface WeeklyTrend {
  week: number;
  year: number;
  unique_tags: number;
}

interface AssetLocationData {
  location: string;
  total_reads: number;
  unique_tags: number;
  avg_rssi: number;
}

class AnalyticsService {
  /**
   * Get 24-hour activity data (real-time, resets daily)
   * Returns data for the current 24-hour period
   */
  async get24HourActivity(): Promise<TagActivityData[]> {
    const response = await apiService.getTagActivity('24h');
    
    if (response.success && response.data) {
      // Ensure all 24 hours are represented
      return this.normalize24HourData(response.data);
    }
    
    return this.getEmpty24HourData();
  }

  /**
   * Get hourly patterns (real-time data for current day)
   */
  async getHourlyPatterns(): Promise<HourlyPattern[]> {
    const response = await apiService.getHourlyPatterns();
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return this.getEmptyHourlyData();
  }

  /**
   * Get daily trends for last 30 days + current day
   * X-axis in UTC format, shows total reads AND unique tags
   */
  async getDailyTrends(days: number = 30): Promise<DailyTrend[]> {
    const response = await apiService.getDailyTrends(days);
    
    if (response.success && response.data) {
      return this.normalizeDailyTrends(response.data, days);
    }
    
    return [];
  }

  /**
   * Get weekly trends (unique tags only, no total reads)
   */
  async getWeeklyTrends(): Promise<WeeklyTrend[]> {
    const response = await apiService.getWeeklyTrends();
    
    if (response.success && response.data) {
      // Filter to only include unique_tags
      return response.data.map((item: any) => ({
        week: item.week,
        year: item.year,
        unique_tags: item.unique_tags
      }));
    }
    
    return [];
  }

  /**
   * Get assets count by location
   */
  async getAssetsByLocation(): Promise<AssetLocationData[]> {
    const response = await apiService.getAssetsByLocation();
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  }

  /**
   * Export graph data to CSV
   */
  exportGraphToCSV(data: any[], filename: string, headers: string[]) {
    const csvContent = this.convertToCSV(data, headers);
    this.downloadCSV(csvContent, filename);
  }

  /**
   * Export graph data to Excel format
   */
  exportGraphToExcel(data: any[], filename: string) {
    // For Excel export, we'll create a CSV that can be opened in Excel
    const headers = Object.keys(data[0] || {});
    const csvContent = this.convertToCSV(data, headers);
    this.downloadCSV(csvContent, `${filename}.csv`);
  }

  // ============= PRIVATE HELPER METHODS =============

  /**
   * Normalize 24-hour data to ensure all hours are present
   */
  private normalize24HourData(rawData: TagActivityData[]): TagActivityData[] {
    const fullDay = Array.from({ length: 24 }, (_, hour) => {
      const label = hour.toString().padStart(2, '0') + ':00';
      const found = rawData.find(d => d.time === label);
      
      return {
        time: label,
        count: found ? found.count : 0
      };
    });
    
    return fullDay;
  }

  /**
   * Get empty 24-hour data structure
   */
  private getEmpty24HourData(): TagActivityData[] {
    return Array.from({ length: 24 }, (_, hour) => ({
      time: hour.toString().padStart(2, '0') + ':00',
      count: 0
    }));
  }

  /**
   * Get empty hourly data structure
   */
  private getEmptyHourlyData(): HourlyPattern[] {
    return Array.from({ length: 24 }, (_, hour) => ({
      hour: hour.toString().padStart(2, '0') + ':00',
      read_count: 0,
      device_count: 0
    }));
  }


/**
 * Normalize daily trends to ensure all days in range are present
 * Format dates in UTC without timezone offset
 */
private normalizeDailyTrends(rawData: any[], days: number): DailyTrend[] {
  const now = new Date();
  const result: DailyTrend[] = [];

  // Normalize backend data into a lookup map (YYYY-MM-DD → record)
  const dataMap = new Map<string, any>();

rawData.forEach(d => {
  const raw =
    d.date?.split('T')[0] ??
    d.day?.split('T')[0];

  if (!raw) return;

  // Use the date string directly without timezone conversion
  // Backend sends YYYY-MM-DD which represents the local calendar date
  dataMap.set(raw, d);
});

  // Generate LOCAL dates (calendar-safe)
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - i
    );

    const dateStr = this.formatDateLocal(date);

    const found = dataMap.get(dateStr);

    result.push({
      date: dateStr,
      reads: found ? Number(found.reads || found.read_count || 0) : 0,
      unique_tags: found
        ? Number(found.unique_tags || found.unique_tag_count || 0)
        : 0
    });
  }

  return result;
}


/**
 * Format date to UTC string (YYYY-MM-DD)
 */
private formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


  /**
   * Convert data array to CSV string
   */
  private convertToCSV(data: any[], headers: string[]): string {
    if (data.length === 0) return '';
    
    // Header row
    const headerRow = headers.join(',');
    
    // Data rows
    const dataRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',');
    });
    
    return [headerRow, ...dataRows].join('\n');
  }

  /**
   * Trigger CSV download in browser
   */
  private downloadCSV(csvContent: string, filename: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }
}

export const analyticsService = new AnalyticsService();