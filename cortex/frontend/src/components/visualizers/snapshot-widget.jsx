import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { BaseChart } from './base-chart';

// Helper
const toTitleCase = (str) => {
    if (!str) return '';
    return String(str).toLowerCase().replace(/(?:^|\s|-)\S/g, match => match.toUpperCase());
};

/**
 * Handles ComboChartWidget and BarChartWidget
 */
export function SnapshotWidget({ widget }) {
    // Transform Data
    // Backend: x_axis (or categories), bar_series, line_series
    const xKey = widget.type === 'STACKED_BAR' ? 'categories' : 'x_axis';
    const xValues = widget[xKey] || [];

    const chartData = xValues.map((xVal, index) => {
        const row = { name: xVal };
        // Bars
        (widget.bar_series || widget.series || []).forEach(s => {
            row[s.name] = s.data[index];
        });
        // Lines
        (widget.line_series || []).forEach(s => {
            row[s.name] = s.data[index];
        });
        return row;
    });

    // Collect all keys
    const barKeys = (widget.bar_series || widget.series || []).map(s => s.name);
    const lineKeys = (widget.line_series || []).map(s => s.name);

    return (
        <BaseChart widget={widget} data={chartData}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.3} />
                <XAxis
                    dataKey="name"
                    tick={{ fill: '#9CA3AF', fontSize: 11 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    dx={-5}
                    dy={8}
                    height={60} // Reduced from 80 to pull chart down
                    tickFormatter={toTitleCase}
                />
                <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
                    itemStyle={{ color: '#d1d5db' }}
                    cursor={{ fill: 'transparent' }}
                    labelFormatter={toTitleCase}
                />
                {barKeys.map((key, i) => (
                    <Bar
                        key={key}
                        dataKey={key}
                        barSize={32}
                        fill="#3b82f6" // Primary Blue-ish
                        radius={[4, 4, 0, 0]}
                    />
                ))}
                {lineKeys.map((key, i) => (
                    <Line key={key} type="monotone" dataKey={key} stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                ))}
            </ComposedChart>
        </BaseChart>
    );
}
