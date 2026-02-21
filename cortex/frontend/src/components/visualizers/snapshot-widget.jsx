import React, { memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AnchorContainer } from './anchor-container';

// CORTEX System Palette — matches --accent-blue-bright, --semantic-error, --semantic-success in index.css
const COLOR_PALETTE = [
    "#00bfff", // --accent-blue-bright  — Positive (bottom)
    "#ff3b30", // --semantic-error      — Negative (middle)
    "#34c759", // --semantic-success    — Mixed/Neutral (top)
    "#ffbf00", // --semantic-warning
    "#7c3aed", // violet
    "#0077b6", // --accent-blue-mid
];

const R = 5; // outer corner radius

// ── Tooltip (existing hover behaviour, untouched) ─────────────────────────────
const StackedTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((s, e) => s + e.value, 0);

    return (
        <div className="bg-surface-primary/95 border border-white/10 p-4 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-xl z-50 text-left min-w-[200px]">
            <div className="mb-3 border-b border-white/5 pb-2">
                <p className="text-white font-mono font-bold text-sm tracking-wide">{label}</p>
                <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider mt-1">
                    Total: <span className="text-gray-100 font-bold">{total}</span>
                </p>
            </div>
            <div className="space-y-2">
                {payload.map((entry, i) => {
                    if (entry.value === 0) return null;
                    const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                    return (
                        <div key={i} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                            <span className="text-xs text-gray-300 flex-grow">{entry.name}</span>
                            <span className="text-xs text-white font-mono font-bold">{entry.value}</span>
                            <span className="text-[9px] text-gray-500 font-mono w-10 text-right">({pct}%)</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ── Main ──────────────────────────────────────────────────────────────────────
export const SnapshotWidget = memo(function SnapshotWidget({ widget, onSelect }) {
    const categories = widget.categories || [];
    const seriesList = widget.series || [];

    const chartData = categories.map((cat, i) => {
        const row = { category: cat };
        seriesList.forEach(s => { row[s.name] = s.data[i]; });
        return row;
    });

    return (
        <AnchorContainer>
            <div className="w-full h-[320px] pt-4 px-2 pb-2">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                        stackOffset="expand"
                        barSize={28}
                        barGap={4}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.05)"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="category"
                            tick={{ fontSize: 11, fill: '#8a8a8e', fontFamily: 'monospace', fontWeight: 500 }}
                            tickLine={false}
                            axisLine={false}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={55}
                            dy={10}
                        />
                        <YAxis
                            tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                            tick={{ fontSize: 10, fill: '#6b7280', fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                            width={35}
                        />
                        <Tooltip
                            content={<StackedTooltip />}
                            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                        />

                        {seriesList.map((s, idx) => {
                            const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];
                            const isFirst = idx === 0;
                            const isLast = idx === seriesList.length - 1;

                            // KEY LEARNING FROM TEMPLATE:
                            // Only round the TRUE outer edges of the entire stack.
                            // Internal divisions stay flat — Recharts makes them flush automatically.
                            // Rounding all 4 corners creates micro-gaps; minimal rounding = clean tube.
                            const radius =
                                isFirst && isLast ? [R, R, R, R]   // single series — full pill
                                    : isFirst ? [0, 0, R, R]   // bottom bar — round base only
                                        : isLast ? [R, R, 0, 0]   // top bar — round cap only
                                            : [0, 0, 0, 0];  // middle — perfectly flat

                            return (
                                <Bar
                                    key={s.name}
                                    dataKey={s.name}
                                    stackId="a"
                                    fill={color}
                                    radius={radius}
                                    isAnimationActive={false}
                                    className="cursor-pointer"
                                    onClick={(data, index) => onSelect?.(chartData[index]?.category)}
                                />
                            );
                        })}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </AnchorContainer>
    );
});
