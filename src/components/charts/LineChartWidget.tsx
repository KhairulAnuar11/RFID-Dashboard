import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface LineChartWidgetProps {
  data: any[];
  dataKey: string;
  xAxisKey: string;
  title: string;
  description?: string;
  color?: string;
  height?: number;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export const LineChartWidget: React.FC<LineChartWidgetProps> = ({
  data,
  dataKey,
  xAxisKey,
  title,
  description,
  color = '#4F46E5',
  height = 300,
  xAxisLabel,
  yAxisLabel
}) => {
  const ticks = Array.isArray(data) ? data.map(d => (d && d[xAxisKey] != null ? String(d[xAxisKey]) : '')) : undefined;
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey={xAxisKey}
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
            type="category"
            ticks={ticks}
            interval={0}
            label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -15, style: { fontSize: '12px', fill: '#6B7280' } } : undefined}
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
            label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '12px', fill: '#6B7280' } } : undefined}
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
