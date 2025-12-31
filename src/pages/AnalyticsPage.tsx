import React, { useEffect, useState, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, TrendingUp, Zap, MapPin, Tag } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { apiService } from '../services/apiService';
import { motion } from 'motion/react';
import { toast } from 'sonner';

interface AnalyticsData {
  weeklyTrends: any[];
  antennaStats: any[];
  hourlyPatterns: any[];
  assetsByLocation: any[];
  topTags: any[];
  devicePerformance: any[];
  dailyTrends: any[];
}

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData>({
    weeklyTrends: [],
    antennaStats: [],
    hourlyPatterns: [],
    assetsByLocation: [],
    topTags: [],
    devicePerformance: [],
    dailyTrends: []
  });
  const [loading, setLoading] = useState(true);
  
  // Chart refs for export functionality
  const dailyTrendsRef = useRef<HTMLDivElement>(null);
  const weeklyTrendsRef = useRef<HTMLDivElement>(null);
  const hourlyPatternsRef = useRef<HTMLDivElement>(null);
  const antennaStatsRef = useRef<HTMLDivElement>(null);
  const assetsByLocationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const [weeklyRes, antennaRes, hourlyRes, locRes, tagsRes, devRes, dailyRes] = await Promise.all([
        apiService.getWeeklyTrends(),
        apiService.getAntennaStats(),
        apiService.getHourlyPatterns(),
        apiService.getAssetsByLocation(),
        apiService.getTopTags(30, 10),
        apiService.getDevicePerformance(),
        apiService.getDailyTrends(30)
      ]);

      // Transform antenna stats to include composite label
      const transformedAntennaStats = antennaRes.data?.map((item: any) => ({
        ...item,
        label: `${item.device} - Ch${item.antenna}`
      })) || [];

      setData({
        weeklyTrends: weeklyRes.data || [],
        antennaStats: transformedAntennaStats,
        hourlyPatterns: hourlyRes.data || [],
        assetsByLocation: locRes.data || [],
        topTags: tagsRes.data || [],
        devicePerformance: devRes.data || [],
        dailyTrends: dailyRes.data || []
      });

      toast.success('Analytics data loaded');
    } catch (error) {
      console.error('[Analytics] Failed to load data:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const downloadChart = (chartRef: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!chartRef.current) {
      toast.error('Chart not found for export');
      return;
    }
    
    const svgElement = chartRef.current.querySelector('svg');
    if (svgElement) {
      // Convert SVG to image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const img = new Image();

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);

        // Download as PNG
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `${filename}.png`;
        link.click();

        // Also create SVG download
        const svgLink = document.createElement('a');
        svgLink.href = 'data:image/svg+xml;base64,' + btoa(svgData);
        svgLink.download = `${filename}.svg`;
        svgLink.click();
        
        toast.success('Chart exported successfully');
      };

      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-screen overflow-hidden">
      <Header title="Analytics & Insights">
        <button
          onClick={loadAnalyticsData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Refresh Data
        </button>
      </Header>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6">
        <div className="space-y-6">
          {/* Daily Trends */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            ref={dailyTrendsRef}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Daily Activity Trends (Last 30 Days)
              </h3>
              <button
                onClick={() => downloadChart(dailyTrendsRef as any, 'daily-trends')}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
            {data.dailyTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.dailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="total_reads" fill="#4F46E5" stroke="#4F46E5" name="Total Reads" />
                  <Area type="monotone" dataKey="unique_tags" fill="#10B981" stroke="#10B981" name="Unique Tags" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-12">No data available</p>
            )}
          </motion.div>

          {/* Weekly Trends */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            ref={weeklyTrendsRef}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Weekly Activity Trends
              </h3>
              <button
                onClick={() => downloadChart(weeklyTrendsRef as any, 'weekly-trends')}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-green-50 text-green-600 rounded hover:bg-green-100"
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
            {data.weeklyTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.weeklyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week_start" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total_reads" fill="#10B981" name="Total Reads" />
                  <Bar dataKey="unique_tags" fill="#4F46E5" name="Unique Tags" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-12">No data available</p>
            )}
          </motion.div>

          {/* Hourly Patterns - Average by Hour */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            ref={hourlyPatternsRef}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-600" />
                Hourly Activity Patterns
              </h3>
              <button
                onClick={() => downloadChart(hourlyPatternsRef as any, 'hourly-patterns')}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100"
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
            {data.hourlyPatterns.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.hourlyPatterns.slice(-48)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="read_count" stroke="#F59E0B" name="Reads per Hour" />
                  <Line type="monotone" dataKey="device_count" stroke="#8B5CF6" name="Active Devices" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-12">No data available</p>
            )}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Antenna Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              ref={antennaStatsRef}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-600" />
                  Antenna Read Count
                </h3>
                <button
                  onClick={() => downloadChart(antennaStatsRef as any, 'antenna-stats')}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-50 text-purple-600 rounded hover:bg-purple-100"
                >
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>
              {data.antennaStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart data={data.antennaStats} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="label" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tick={{ fontSize: 13 }}
                      interval={0}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any) => value}
                      labelFormatter={(label: any) => `${label}`}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb' }}
                    />
                    <Bar dataKey="read_count" fill="#8B5CF6" name="Read Count" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-12">No data available</p>
              )}
            </motion.div>

            {/* Assets by Location */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              ref={assetsByLocationRef}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Assets by Location
                </h3>
                <button
                  onClick={() => downloadChart(assetsByLocationRef as any, 'assets-by-location')}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                >
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>
              {data.assetsByLocation.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.assetsByLocation}
                      dataKey="total_reads"
                      nameKey="location"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ location, percent }) => `${location}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {data.assetsByLocation.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-12">No data available</p>
              )}
            </motion.div>
          </div>

          {/* Device Performance Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Performance (Last 30 Days)</h3>
            {data.devicePerformance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Device</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Total Reads</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Unique Tags</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Avg RSSI</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Active Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.devicePerformance.map((device, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">{device.device}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{device.total_reads}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{device.unique_tags}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{device.avg_rssi} dBm</td>
                        <td className="px-4 py-3 text-right text-gray-700">{device.active_days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No data available</p>
            )}
          </motion.div>

          {/* Top Tags Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-pink-600" />
              Top Tags (Last 30 Days)
            </h3>
            {data.topTags.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Tag ID</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Read Count</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Readers</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Days Active</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Avg RSSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topTags.map((tag, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-mono text-xs">{tag.tag_id}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{tag.read_count}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{tag.readers}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{tag.days_active}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{tag.avg_rssi} dBm</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No data available</p>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
