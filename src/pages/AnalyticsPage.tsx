// src/pages/AnalyticsPage.tsx
// Complete merged version with all existing features + new fixes

import React, { useState, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Calendar, TrendingUp, Activity, BarChart3, Zap, MapPin, Award, Signal } from 'lucide-react';
import { apiService } from '../services/apiService';
import { analyticsService } from '../services/analyticsService';
import { toast } from 'sonner';
import { motion } from 'motion/react';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export const AnalyticsPage: React.FC = () => {
  // Chart data states
  const [hourlyPatterns, setHourlyPatterns] = useState<any[]>([]);
  const [dailyTrends, setDailyTrends] = useState<any[]>([]);
  const [weeklyTrends, setWeeklyTrends] = useState<any[]>([]);
  const [antennaStats, setAntennaStats] = useState<any[]>([]);
  const [assetsByLocation, setAssetsByLocation] = useState<any[]>([]);
  const [topTags, setTopTags] = useState<any[]>([]);
  const [devicePerformance, setDevicePerformance] = useState<any[]>([]);
  
  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState(30);
  const [topTagsLimit, setTopTagsLimit] = useState(10);
  const [activeTab, setActiveTab] = useState<'trends' | 'performance' | 'locations'>('trends');

  useEffect(() => {
    loadAnalyticsData();
    
    // Auto-refresh every 30 seconds for real-time data
    const interval = setInterval(() => {
      loadAnalyticsData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [selectedDays, topTagsLimit]);

  const loadAnalyticsData = async () => {
    try {
      setIsLoading(true);
      
      // Load all analytics data in parallel
      const [hourly, daily, weekly, antenna, assets, tags, devices] = await Promise.all([
        analyticsService.getHourlyPatterns(),
        analyticsService.getDailyTrends(selectedDays),
        analyticsService.getWeeklyTrends(),
        apiService.getAntennaStats(),
        apiService.getAssetsByLocation(),
        apiService.getTopTags(selectedDays, topTagsLimit),
        apiService.getDevicePerformance()
      ]);
      
      setHourlyPatterns(hourly);
      setDailyTrends(daily);
      setWeeklyTrends(weekly);
      
      if (antenna.success && antenna.data) setAntennaStats(antenna.data);
      if (assets.success && assets.data) setAssetsByLocation(assets.data);
      if (tags.success && tags.data) setTopTags(tags.data);
      if (devices.success && devices.data) setDevicePerformance(devices.data);
      
    } catch (error) {
      console.error('[Analytics] Failed to load data:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  // Export handlers for each graph
  const handleExportHourlyPatterns = (format: 'csv' | 'excel') => {
    const headers = ['hour', 'read_count', 'device_count'];
    const filename = `hourly_patterns_${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'csv') {
      analyticsService.exportGraphToCSV(hourlyPatterns, `${filename}.csv`, headers);
    } else {
      analyticsService.exportGraphToExcel(hourlyPatterns, filename);
    }
    
    toast.success(`Hourly patterns exported as ${format.toUpperCase()}`);
  };

  const handleExportDailyTrends = (format: 'csv' | 'excel') => {
    const headers = ['date', 'reads', 'unique_tags'];
    const filename = `daily_trends_${selectedDays}days_${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'csv') {
      analyticsService.exportGraphToCSV(dailyTrends, `${filename}.csv`, headers);
    } else {
      analyticsService.exportGraphToExcel(dailyTrends, filename);
    }
    
    toast.success(`Daily trends exported as ${format.toUpperCase()}`);
  };

  const handleExportWeeklyTrends = (format: 'csv' | 'excel') => {
    const formattedData = weeklyTrends.map(item => ({
      week_year: `Week ${item.week}, ${item.year}`,
      unique_tags: item.unique_tags
    }));
    
    const headers = ['week_year', 'unique_tags'];
    const filename = `weekly_trends_${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'csv') {
      analyticsService.exportGraphToCSV(formattedData, `${filename}.csv`, headers);
    } else {
      analyticsService.exportGraphToExcel(formattedData, filename);
    }
    
    toast.success(`Weekly trends exported as ${format.toUpperCase()}`);
  };

  const handleExportAntennaStats = (format: 'csv' | 'excel') => {
    const headers = ['device', 'antenna', 'read_count', 'unique_tags', 'avg_rssi'];
    const filename = `antenna_stats_${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'csv') {
      analyticsService.exportGraphToCSV(antennaStats, `${filename}.csv`, headers);
    } else {
      analyticsService.exportGraphToExcel(antennaStats, filename);
    }
    
    toast.success(`Antenna stats exported as ${format.toUpperCase()}`);
  };

  const handleExportAssetsByLocation = (format: 'csv' | 'excel') => {
    const headers = ['location', 'total_reads', 'unique_tags', 'avg_rssi'];
    const filename = `assets_by_location_${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'csv') {
      analyticsService.exportGraphToCSV(assetsByLocation, `${filename}.csv`, headers);
    } else {
      analyticsService.exportGraphToExcel(assetsByLocation, filename);
    }
    
    toast.success(`Assets by location exported as ${format.toUpperCase()}`);
  };

  const handleExportTopTags = (format: 'csv' | 'excel') => {
    const headers = ['tag_id', 'read_count', 'device_count', 'avg_rssi'];
    const filename = `top_tags_${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'csv') {
      analyticsService.exportGraphToCSV(topTags, `${filename}.csv`, headers);
    } else {
      analyticsService.exportGraphToExcel(topTags, filename);
    }
    
    toast.success(`Top tags exported as ${format.toUpperCase()}`);
  };

  const handleExportDevicePerformance = (format: 'csv' | 'excel') => {
    const headers = ['device', 'total_reads', 'unique_tags', 'active_days', 'avg_signal'];
    const filename = `device_performance_${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'csv') {
      analyticsService.exportGraphToCSV(devicePerformance, `${filename}.csv`, headers);
    } else {
      analyticsService.exportGraphToExcel(devicePerformance, filename);
    }
    
    toast.success(`Device performance exported as ${format.toUpperCase()}`);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col bg-gray-50">
        <Header title="Analytics Dashboard" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <Header title="Analytics Dashboard" />
      
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg border border-gray-200 p-2 mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('trends')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'trends' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <TrendingUp className="size-5" />
            <span className="font-medium">Activity Trends</span>
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'performance' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <BarChart3 className="size-5" />
            <span className="font-medium">Device Performance</span>
          </button>
          <button
            onClick={() => setActiveTab('locations')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'locations' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <MapPin className="size-5" />
            <span className="font-medium">Locations & Tags</span>
          </button>
        </div>

        {/* TRENDS TAB */}
        {activeTab === 'trends' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Hourly Activity Patterns */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Activity className="size-6 text-blue-600" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Hourly Activity Patterns</h2>
                    <p className="text-sm text-gray-600">Real-time reads per hour (Current Day - UTC)</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExportHourlyPatterns('csv')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download className="size-4" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExportHourlyPatterns('excel')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Download className="size-4" />
                    Excel
                  </button>
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={hourlyPatterns}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="hour" 
                    label={{ value: 'Hour (UTC)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    yAxisId="left"
                    label={{ value: 'Read Count', angle: -90, position: 'insideLeft' }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    label={{ value: 'Active Devices', angle: 90, position: 'insideRight' }}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="read_count" fill="#3B82F6" name="Reads" />
                  <Bar yAxisId="right" dataKey="device_count" fill="#10B981" name="Active Devices" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Activity Trends */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Calendar className="size-6 text-purple-600" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Daily Activity Trends</h2>
                    <p className="text-sm text-gray-600">Historical + live data (UTC dates)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={selectedDays}
                    onChange={(e) => setSelectedDays(Number(e.target.value))}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value={7}>Last 7 Days</option>
                    <option value={30}>Last 30 Days</option>
                    <option value={60}>Last 60 Days</option>
                    <option value={90}>Last 90 Days</option>
                  </select>
                  <button
                    onClick={() => handleExportDailyTrends('csv')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download className="size-4" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExportDailyTrends('excel')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Download className="size-4" />
                    Excel
                  </button>
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={dailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    label={{ value: 'Date (UTC)', position: 'insideBottom', offset: -5 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    yAxisId="left"
                    label={{ value: 'Total Reads', angle: -90, position: 'insideLeft' }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    label={{ value: 'Unique Tags', angle: 90, position: 'insideRight' }}
                  />
                  <Tooltip />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="reads" 
                    stroke="#8B5CF6" 
                    strokeWidth={2}
                    name="Total Reads"
                    dot={{ r: 3 }}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="unique_tags" 
                    stroke="#F59E0B" 
                    strokeWidth={2}
                    name="Unique Tags"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Weekly Activity Trends */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="size-6 text-orange-600" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Weekly Unique Tags Trend</h2>
                    <p className="text-sm text-gray-600">Unique tags per week (Last 12 weeks)</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExportWeeklyTrends('csv')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download className="size-4" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExportWeeklyTrends('excel')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Download className="size-4" />
                    Excel
                  </button>
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={weeklyTrends.map(item => ({
                  weekLabel: `W${item.week} ${item.year}`,
                  unique_tags: item.unique_tags
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="weekLabel" 
                    label={{ value: 'Week', position: 'insideBottom', offset: -5 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    label={{ value: 'Unique Tags', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="unique_tags" fill="#F97316" name="Unique Tags" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* PERFORMANCE TAB */}
        {activeTab === 'performance' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Device Performance */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Zap className="size-6 text-yellow-600" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Device Performance</h2>
                    <p className="text-sm text-gray-600">Last 30 days activity by device</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExportDevicePerformance('csv')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download className="size-4" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExportDevicePerformance('excel')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Download className="size-4" />
                    Excel
                  </button>
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={devicePerformance.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="device" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis 
                    yAxisId="left"
                    label={{ value: 'Total Reads', angle: -90, position: 'insideLeft' }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    label={{ value: 'Unique Tags', angle: 90, position: 'insideRight' }}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="total_reads" fill="#3B82F6" name="Total Reads" />
                  <Bar yAxisId="right" dataKey="unique_tags" fill="#10B981" name="Unique Tags" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Antenna Stats */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Signal className="size-6 text-indigo-600" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Antenna Performance</h2>
                    <p className="text-sm text-gray-600">Read statistics by antenna (Last 7 days)</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExportAntennaStats('csv')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download className="size-4" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExportAntennaStats('excel')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Download className="size-4" />
                    Excel
                  </button>
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={antennaStats.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey={(item) => `${item.device}-A${item.antenna}`}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="read_count" fill="#8B5CF6" name="Read Count" />
                  <Bar dataKey="unique_tags" fill="#EC4899" name="Unique Tags" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* LOCATIONS TAB */}
        {activeTab === 'locations' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Assets by Location */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <MapPin className="size-6 text-green-600" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Assets by Location</h2>
                    <p className="text-sm text-gray-600">Tag activity by reader location (Last 30 days)</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExportAssetsByLocation('csv')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download className="size-4" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExportAssetsByLocation('excel')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Download className="size-4" />
                    Excel
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={assetsByLocation.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="location" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total_reads" fill="#10B981" name="Total Reads" />
                  </BarChart>
                </ResponsiveContainer>
                
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={assetsByLocation.slice(0, 8)}
                      dataKey="unique_tags"
                      nameKey="location"
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      label={(entry) => entry.location}
                    >
                      {assetsByLocation.slice(0, 8).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Tags */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Award className="size-6 text-red-600" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Top Active Tags</h2>
                    <p className="text-sm text-gray-600">Most frequently read tags</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={topTagsLimit}
                    onChange={(e) => setTopTagsLimit(Number(e.target.value))}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value={10}>Top 10</option>
                    <option value={20}>Top 20</option>
                    <option value={50}>Top 50</option>
                  </select>
                  <button
                    onClick={() => handleExportTopTags('csv')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download className="size-4" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExportTopTags('excel')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Download className="size-4" />
                    Excel
                  </button>
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={topTags} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis 
                    dataKey="tag_id" 
                    type="category" 
                    width={150}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="read_count" fill="#EF4444" name="Read Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
        </div>
    </div>
  );
};
