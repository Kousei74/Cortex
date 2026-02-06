import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { BaseChart } from './base-chart';

export function TemporalWidget({ widget }) {
    // Widget structure: { x_axis: [...], series: [{name, data: [...]}] }
    // Recharts needs: [{ timestamp: '...', value1: 10, value2: 20 }]
    // We need to transform the data structure.

    // Transformation Logic
    // Assumption: all series have same length as x_axis.
    const chartData = widget.x_axis.map((xVal, index) => {
        const row = { x: xVal };
        widget.series.forEach(s => {
            row[s.name] = s.data[index];
        });
        return row;
    });

    return (
        <BaseChart widget={widget} data={chartData}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {widget.series.map((s, i) => (
                    <Line
                        key={s.name}
                        type="monotone"
                        dataKey={s.name}
                        stroke={i === 0 ? "#8884d8" : "#82ca9d"} // Simple color cycle
                        strokeWidth={2}
                        activeDot={{ r: 8 }}
                    />
                ))}
            </LineChart>
        </BaseChart>
    );
}
