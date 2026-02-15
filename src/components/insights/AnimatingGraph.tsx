import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';

interface AnimatingGraphProps {
  /** Number of data points */
  points?: number;
  /** Min Y value */
  min?: number;
  /** Max Y value */
  max?: number;
  /** Height in px */
  height?: number;
  /** Line color */
  color?: string;
  /** Refresh interval ms */
  interval?: number;
}

const generateData = (points: number, min: number, max: number) => {
  const data = [];
  let value = min + Math.random() * (max - min);
  for (let i = 0; i < points; i++) {
    value += (Math.random() - 0.5) * (max - min) * 0.3;
    value = Math.max(min, Math.min(max, value));
    data.push({ x: i, y: Math.round(value * 10) / 10 });
  }
  return data;
};

const AnimatingGraph = ({
  points = 14,
  min = 1,
  max = 5,
  height = 140,
  color = '#22c55e',
  interval = 2500,
}: AnimatingGraphProps) => {
  const [data, setData] = useState(() => generateData(points, min, max));

  useEffect(() => {
    const timer = setInterval(() => {
      setData(generateData(points, min, max));
    }, interval);
    return () => clearInterval(timer);
  }, [points, min, max, interval]);

  return (
    <div style={{ height }} className="w-full opacity-70">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="x" hide />
          <YAxis domain={[min, max]} hide />
          <Line
            type="monotone"
            dataKey="y"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive
            animationDuration={1800}
            animationEasing="ease-in-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AnimatingGraph;
