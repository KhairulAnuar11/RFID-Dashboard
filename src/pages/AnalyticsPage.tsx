import React, { useState, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Calendar, TrendingUp, Activity, BarChart3, Zap, MapPin, Award, Signal, PercentIcon } from 'lucide-react';
import { apiService } from '../services/apiService';
import { analyticsService } from '../services/analyticsService';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { TooltipProps } from 'recharts';
import { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export const AnalyticsPage: React.FC = () => {
  // Chart data states
  const [hourlyPatterns, setHourlyPatterns] = useState<any[]>([]);
  const [dailyTrends, setDailyTrends] = useState<any[]>([]);
  useEffect(() => {
  analyticsService.getDailyTrends(30).then(setDailyTrends);
    }, []);
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

  const formatDailyDate = (dateStr: string) => {
  // dateStr = "YYYY-MM-DD"
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p>{`${label} : ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
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

  const handleExportLocationDistribution = (format: 'csv' | 'excel') => {
    // Calculate location distribution data for export
    const totalReadsAllLocations = assetsByLocation.reduce(
      (sum, loc) => sum + loc.total_reads,
      0
    );
    
    const locationDistributionData = assetsByLocation.map(loc => ({
      location: loc.location,
      percentage: totalReadsAllLocations
        ? Number(((loc.total_reads / totalReadsAllLocations) * 100).toFixed(2))
        : 0,
      total_reads: loc.total_reads
    }));
    
    const headers = ['location', 'percentage', 'total_reads'];
    const filename = `location_distribution_${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'csv') {
      analyticsService.exportGraphToCSV(locationDistributionData, `${filename}.csv`, headers);
    } else {
      analyticsService.exportGraphToExcel(locationDistributionData, filename);
    }
    
    toast.success(`Location distribution exported as ${format.toUpperCase()}`);
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

  // Calculate location distribution for pie chart
  const totalReadsAllLocations = assetsByLocation.reduce(
    (sum, loc) => sum + loc.total_reads,
    0
  );

  const locationDistribution = assetsByLocation.map(loc => ({
    location: loc.location,
    percentage: totalReadsAllLocations
      ? Number(((loc.total_reads / totalReadsAllLocations) * 100).toFixed(2))
      : 0,
    total_reads: loc.total_reads
  }));

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
                    {/* Updated to show correct format */}
                    <p className="text-sm text-gray-600">Historical + live data </p>
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
                    tickFormatter={formatDailyDate}
                    label={{ position: 'insideBottom', offset: -5 }}
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
                  <Tooltip
                    labelFormatter={(label) => formatDailyDate(String(label))}
                  />

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
                  <YAxis 
                    yAxisId="left"
                    label={{ value: 'Read Count', angle: -90, position: 'insideLeft' }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    label={{ value: 'Unique Tags', angle: 90, position: 'insideRight' }}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="read_count" fill="#8B5CF6" name="Read Count" />
                  <Bar yAxisId="right" dataKey="unique_tags" fill="#EC4899" name="Unique Tags" />
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
            {/* 3.1 Assets by Location — Bar Graph (Separate Section) */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <MapPin className="size-6 text-green-600" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Assets by Location - Reader Activity</h2>
                    <p className="text-sm text-gray-600">Total tag reads by location (entire database)</p>
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
              
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={assetsByLocation}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="location" 
                    label={{ value: 'Location', position: 'insideBottom', offset: -5 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    label={{ value: 'Total Tag Reads', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value) => [value, 'Total Reads']}
                    labelFormatter={(label) => `Location: ${label}`}
                  />
                  <Legend />
                  <Bar 
                    dataKey="total_reads" 
                    fill="#3B82F6" 
                    name="Reader"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 3.2 Percentage by Location — Pie Chart (Separate Section) */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <PercentIcon className="size-6 text-black-600" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Location Distribution - Percentage</h2>
                    <p className="text-sm text-gray-600">Read percentage by location (dynamically calculated)</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExportLocationDistribution('csv')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download className="size-4" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExportLocationDistribution('excel')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Download className="size-4" />
                    Excel
                  </button>
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={locationDistribution}
                    dataKey="percentage"
                    nameKey="location"
                    cx="50%"
                    cy="50%"
                    outerRadius={140}
                    label={({ location, percentage }) => `${location} – ${percentage}%`}
                    labelLine={true}
                  >
                    {locationDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    // 1. If you have a formatter, type it strictly:
                    formatter={(value: ValueType, name: "Percentage") => [value, name]}
                    
                    // 2. Type the content props to match the expected literal "Percentage"
                    content={(props: TooltipProps<ValueType, "Percentage">) => {
                      const { active, payload } = props;
                      
                      if (active && payload && payload.length) {
                        // Accessing the raw data object
                        const data = payload[0].payload; 
                        
                        return (
                          <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                            <p className="font-semibold text-gray-900">Location: {data.location}</p>
                            <p className="text-gray-700">Percentage: {data.percentage}%</p>
                            <p className="text-gray-700">Total Reads: {data.total_reads?.toLocaleString()}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    formatter={(value, entry, index) => (
                      <span className="text-gray-700">
                        {locationDistribution[index]?.location}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Display calculation formula */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Calculation:</span> Percentage = (total_reads_per_location / total_reads_all_locations) × 100
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="font-semibold">Total reads across all locations:</span> {totalReadsAllLocations.toLocaleString()}
                </p>
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
}