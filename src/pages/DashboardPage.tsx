import React, { useEffect, useState } from 'react';
import { Tag, Radio, Hash, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { StatCard } from '../components/ui/StatCard';
import { LineChartWidget } from '../components/charts/LineChartWidget';
import { BarChartWidget } from '../components/charts/BarChartWidget';
import { useRFID } from '../context/RFIDContext';
import { apiService } from '../services/apiService';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export const DashboardPage: React.FC = () => {
  const { stats, tags, isConnected, connectionStatus, refreshData, clearTags } = useRFID();
  const [activityData, setActivityData] = useState<{ time: string; count: number }[]>([]);
  const [deviceData, setDeviceData] = useState<{ device: string; count: number }[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load chart data
  useEffect(() => {
    loadChartData();
  }, []);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadChartData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadChartData = async () => {
    try {
      const [activityResponse, deviceResponse] = await Promise.all([
        apiService.getTagActivity('24h'),
        apiService.getTagsByDevice()
      ]);

      if (activityResponse.success && activityResponse.data) {
        setActivityData(activityResponse.data);
      }

      if (deviceResponse.success && deviceResponse.data) {
        setDeviceData(deviceResponse.data);
      }
    } catch (error) {
      console.error('[Dashboard] Failed to load chart data:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
      await loadChartData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearTags = () => {
    if (confirm('Are you sure you want to clear all tag history from memory?')) {
      clearTags();
    }
  };

  // Live tag stream (last 10 tags)
  const recentTags = tags.slice(0, 10);

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <Header title="Dashboard Overview">
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm $\{
            connectionStatus === 'connected' ? 'bg-green-100 text-green-700' :
            connectionStatus === 'reconnecting' ? 'bg-orange-100 text-orange-700' :
            connectionStatus === 'error' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            <div className={`size-2 rounded-full $\{isConnected ? 'bg-green-600 animate-pulse' : 'bg-gray-400'}`} />
            {connectionStatus === 'connected' ? 'MQTT Connected' :
             connectionStatus === 'reconnecting' ? 'Reconnecting...' :
             connectionStatus === 'error' ? 'Connection Error' :
             'MQTT Disconnected'}
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`size-4 $\{isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleClearTags}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Trash2 className="size-4" />
            Clear History
          </button>
        </div>
      </Header>
      
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <StatCard
              title="Tags Read Today"
              value={stats.totalTagsToday}
              icon={Tag}
              color="blue"
              trend={{ value: 12.5, isPositive: true }}
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <StatCard
              title="Active Readers"
              value={stats.activeReaders}
              icon={Radio}
              color="green"
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <StatCard
              title="Unique Tags"
              value={stats.uniqueTags}
              icon={Hash}
              color="purple"
              trend={{ value: 5.2, isPositive: true }}
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <StatCard
              title="Errors/Alerts"
              value={stats.errorCount}
              icon={AlertTriangle}
              color="red"
            />
          </motion.div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <LineChartWidget
              data={activityData}
              dataKey="count"
              xAxisKey="time"
              title="24-Hour Tag Activity"
              color="#4F46E5"
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <BarChartWidget
              data={deviceData}
              dataKey="count"
              xAxisKey="device"
              title="Tags per Device"
              color="#10B981"
            />
          </motion.div>
        </div>

        {/* Live Tag Stream */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-lg border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg text-gray-900">Live Tag Activity Stream</h3>
            <div className="flex items-center gap-2">
              <span className="size-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-gray-600">Live</span>
              <span className="text-sm text-gray-400">({tags.length} total)</span>
            </div>
          </div>

          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {recentTags.map((tag) => (
                <motion.div
                  key={tag.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  layout
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="size-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <Tag className="size-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-900">{tag.tagId}</p>
                      <p className="text-xs text-gray-500 font-mono">{tag.epc}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-700">{tag.readerName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(tag.timestamp).toLocaleTimeString()} | RSSI: {tag.rssi}dBm | Ant: {tag.antenna}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {recentTags.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Tag className="size-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-600">No recent tag activity</p>
              <p className="text-sm text-gray-400 mt-1">
                {!isConnected ? 'Connect to MQTT broker in Settings to start receiving tag data' : 'Waiting for RFID tag reads...'}
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};