import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Tag, 
  Radio, 
  Map, 
  Settings, 
  HelpCircle, 
  LogOut,
  Activity,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { logout, user } = useAuth();

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/tags', icon: Tag, label: 'Tag Data' },
    { path: '/devices', icon: Radio, label: 'Devices' },
    { path: '/location', icon: Map, label: 'Reader Map' },
    { path: '/settings', icon: Settings, label: 'Settings' },
    { path: '/help', icon: HelpCircle, label: 'Help' }
  ];

  return (
    <div className="h-screen w-64 bg-gradient-to-b from-indigo-900 to-indigo-800 text-white flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-indigo-700">
        <div className="flex items-center gap-3">
          <Activity className="size-8" />
          <div>
            <h1 className="text-xl">RFID Tracker</h1>
            <p className="text-sm text-indigo-300">Real-time Monitoring</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-indigo-700 text-white'
                  : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
              }`
            }
          >
            <item.icon className="size-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User info and logout */}
      <div className="p-4 border-t border-indigo-700">
        <div className="mb-3 px-4">
          <p className="text-sm text-indigo-300">Logged in as</p>
          <p className="truncate">{user?.username}</p>
          <p className="text-xs text-indigo-300 uppercase">{user?.role}</p>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-indigo-200 hover:bg-indigo-800 hover:text-white transition-colors"
        >
          <LogOut className="size-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};
