'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface StressChartProps {
  logs: any[];
}

export default function StressChart({ logs }: StressChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={logs} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
        <XAxis 
          dataKey="created_at" 
          tickFormatter={(val: any) => (val ? new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '')} 
          stroke="#94a3b8" 
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis 
          stroke="#94a3b8" 
          fontSize={11} 
          domain={[0, 150]} 
          tickLine={false}
          axisLine={false}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.95)', 
            borderColor: '#f1f5f9', 
            borderRadius: '16px',
            boxShadow: '0 10px 25px -5px rgba(100, 116, 139, 0.12), 0 8px 10px -6px rgba(100, 116, 139, 0.08)',
            fontSize: '12px',
            padding: '10px 14px'
          }}
          labelStyle={{ fontWeight: 600, color: '#475569', marginBottom: '4px' }}
          labelFormatter={(val: any) => (val ? new Date(val).toLocaleTimeString() : '')}
        />
        <Line 
          type="monotone" 
          dataKey="stress_score" 
          stroke="#a855f7" 
          strokeWidth={3.5} 
          dot={{ r: 3, fill: '#a855f7', strokeWidth: 2, stroke: '#fff' }}
          activeDot={{ r: 6, fill: '#a855f7', stroke: '#fff', strokeWidth: 3 }}
          name="Điểm Quá Tải" 
        />
        <Line 
          type="monotone" 
          dataKey="bpm" 
          stroke="#fb7185" 
          strokeWidth={2.5} 
          dot={false}
          activeDot={{ r: 5, fill: '#fb7185', stroke: '#fff', strokeWidth: 2 }}
          name="Nhịp Tim (BPM)" 
        />
      </LineChart>
    </ResponsiveContainer>
  );
}