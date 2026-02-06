import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BaseChart } from './base-chart';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// Helper
const toTitleCase = (str) => {
    if (!str) return '';
    return String(str).toLowerCase().replace(/(?:^|\s|-)\S/g, match => match.toUpperCase());
};

export function PieWidget({ widget }) {
    // Transform Data
    // Backend: categories=['A', 'B'], series=[{data:[10, 20]}]
    const categories = widget.categories || [];
    const seriesData = (widget.series && widget.series[0]) ? widget.series[0].data : [];

    const data = categories.map((cat, i) => ({
        name: cat,
        value: seriesData[i] || 0
    }));

    return (
        <BaseChart widget={widget} data={data}>
            <div className="flex h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={100}
                            outerRadius={140}
                            fill="#8884d8"
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
                            itemStyle={{ color: '#d1d5db' }}
                            formatter={(value, name) => [`${value}`, toTitleCase(name)]}
                        />
                    </PieChart>
                </ResponsiveContainer>
                {/* 2. Right-Aligned Legend (HTML) */}
                <div className="w-48 pl-4 flex flex-col justify-center gap-2 border-l border-white/5">
                    {data.map((entry, index) => (
                        <div key={index} className="flex items-center space-x-2 text-sm">
                            <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="text-gray-300 truncate font-mono" title={toTitleCase(entry.name)}>
                                {toTitleCase(entry.name)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </BaseChart>
    );
}
