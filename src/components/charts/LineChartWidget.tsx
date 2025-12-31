import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface LineChartWidgetProps {
  data: any[];
  dataKey: string;
  xAxisKey: string;
  title: string;
  color?: string;
  height?: number;
}

export const LineChartWidget: React.FC<LineChartWidgetProps> = ({
  data,
  dataKey,
  xAxisKey,
  title,
  color = '#4F46E5',
  height = 300
}) => {
  const ticks = Array.isArray(data) ? data.map(d => (d && d[xAxisKey] != null ? String(d[xAxisKey]) : '')) : undefined;
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg text-gray-900 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey={xAxisKey}
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
            type="category"
            ticks={ticks}
            interval={0}
            tickFormatter={(value: any) => {
              try {
                if (typeof value === 'string') {
                  const s = value.trim();
                  // If simple HH:MM label, return as-is
                  if (/^\d{1,2}:\d{2}$/.test(s)) return s;
                  // MySQL DATETIME 'YYYY-MM-DD HH:MM:SS' or ISO 'YYYY-MM-DDTHH:MM:SS(.sss)Z'
                  if (/^\d{4}-\d{2}-\d{2}[ T]/.test(s)) {
                    let iso = s;
                    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
                      iso = s.replace(' ', 'T') + 'Z';
                    }
                    const d = new Date(iso);
                    if (!isNaN(d.getTime())) {
                      const hh = String(d.getUTCHours()).padStart(2, '0');
                      const min = String(d.getUTCMinutes()).padStart(2, '0');
                      return `${hh}:${min}`;
                    }
                  }
                }
              } catch (e) {
                // fallthrough
              }
              return String(value);
            }}
          />
          <YAxis 
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #E5E7EB',
              borderRadius: '8px'
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={2}
            dot={{ fill: color, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
