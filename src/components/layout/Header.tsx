import React from 'react';
import { Bell, Search, Wifi, WifiOff } from 'lucide-react';
import { useRFID } from '../../context/RFIDContext';

interface HeaderProps {
  title: string;
  showSearch?: boolean;
  onSearch?: (query: string) => void;
  children?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, showSearch, onSearch, children }) => {
  const { isConnected, stats } = useRFID();

  return (
    <div className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500">
            Real-time RFID tracking and monitoring system
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Custom children (e.g., action buttons) */}
          {children}
          
          {/* Search */}
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                onChange={(e) => onSearch?.(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
              />
            </div>
          )}

          {/* Connection Status */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
            {isConnected ? (
              <>
                <Wifi className="size-4 text-green-500" />
                <span className="text-sm text-gray-700">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="size-4 text-red-500" />
                <span className="text-sm text-gray-700">Disconnected</span>
              </>
            )}
          </div>

          {/* Notifications */}
          <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="size-5 text-gray-600" />
            {stats.errorCount > 0 && (
              <span className="absolute top-1 right-1 size-2 bg-red-500 rounded-full" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};