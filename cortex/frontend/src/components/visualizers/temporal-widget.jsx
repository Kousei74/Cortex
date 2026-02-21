import React, { memo, useState, useMemo } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AnchorContainer } from './anchor-container';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        // Date formatting based on label roughly? 
        return (
            <div className="bg-surface-primary/95 border border-border-subtle p-3 rounded-lg shadow-xl backdrop-blur-md z-50">
                <p className="text-gray-400 text-xs mb-2 font-mono">{label}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.stroke || entry.fill }} />
                        <span className="text-sm text-gray-200 font-medium">{entry.name}:</span>
                        <span className="text-sm text-white font-bold ml-auto">
                            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export const TemporalWidget = memo(function TemporalWidget({ widget }) {
    // State for Resolution (Y, Q, M)
    const [resolution, setResolution] = useState(widget.default_resolution || 'M');

    // Get Data for current resolution
    // Widget struct: { resolutions: { 'M': { x_axis: [], series: [] } } }
    const currentRes = widget.resolutions?.[resolution];

    // Safety check - if backend didn't send resolutions (legacy payload?), fallback or return null
    if (!currentRes) {
        return <div className="text-red-500 text-xs">No data for resolution {resolution}</div>;
    }

    // Transform logic
    const chartData = useMemo(() => {
        const xValues = currentRes.x_axis || [];
        // Map series
        return xValues.map((xVal, index) => {
            const row = { x: xVal };
            currentRes.series.forEach(s => {
                row[s.name] = s.data[index];
            });
            return row;
        });
    }, [currentRes]);

    return (
        <AnchorContainer>
            {/* Floating Resolution Switcher (Top Right, inside container) */}
            <div className="absolute top-2 right-4 z-10 flex gap-1 bg-black/40 p-1 rounded-md backdrop-blur-sm border border-white/5">
                {['Y', 'Q', 'M'].map(res => (
                    <button
                        key={res}
                        onClick={() => setResolution(res)}
                        className={`
                            px-3 py-1 text-xs font-bold rounded transition-colors
                            ${resolution === res
                                ? 'bg-primary-custom text-white shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-white/10'}
                        `}
                    >
                        {res === 'Y' ? 'Yearly' : res === 'Q' ? 'Quarterly' : 'Monthly'}
                    </button>
                ))}
            </div>

            {/* The Chart (Full Size, No Header) */}
            <div className="w-full h-[320px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00bfff" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#00bfff" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.1} vertical={false} />
                        <XAxis
                            dataKey="x"
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={30}
                            dy={10}
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={false}
                            width={35}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#4b5563', strokeDasharray: '4 4' }} />
                        <Legend iconType="circle" wrapperStyle={{ bottom: -10, fontSize: '11px', color: '#9ca3af' }} />

                        {currentRes.series.map((s) => {
                            if (s.type === 'area') {
                                return (
                                    <Area
                                        key={s.name}
                                        type="monotone"
                                        dataKey={s.name}
                                        stroke={s.color || "#00bfff"}
                                        fill="url(#colorVolume)"
                                        strokeWidth={1.5}
                                    />
                                );
                            }
                            return (
                                <Line
                                    key={s.name}
                                    type="monotone"
                                    dataKey={s.name}
                                    stroke={s.color || "#34c759"}
                                    strokeWidth={1.5}
                                    dot={false}
                                    activeDot={{ r: 4, strokeWidth: 0, fill: '#00bfff' }}
                                />
                            );
                        })}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </AnchorContainer>
    );
});
