import React, { memo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { AnchorContainer } from './anchor-container';

const COLOR_PALETTE = [
    "#00bfff", // --accent-blue-bright
    "#ff3b30", // --semantic-error
    "#34c759", // --semantic-success
    "#ffbf00", // --semantic-warning
    "#7c3aed", // violet
    "#0077b6", // --accent-blue-mid
    "#ff9f0a", // orange
    "#0e9f6e", // teal-green
];

const OTHERS_COLOR = "#e2e8f0"; // bright silver — visible on dark bg between saturated slices

// ── Tooltip ───────────────────────────────────────────────────────────────────
const DonutTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;

    // "Others" slice — show breakdown of all sub-items
    if (d.isOthers && d.children?.length) {
        return (
            <div className="bg-surface-primary/95 border border-white/10 p-3 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-xl min-w-[200px]">
                <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: OTHERS_COLOR }} />
                    <span className="text-white font-mono font-bold text-sm">Others</span>
                    <span className="ml-auto text-gray-400 font-mono text-xs">{d.percentage}%</span>
                </div>
                <div className="space-y-1.5">
                    {d.children.map((child, i) => (
                        <div key={i} className="flex items-center justify-between gap-4 text-xs font-mono">
                            <span className="text-gray-300">{child.name}</span>
                            <span className="text-gray-400 tabular-nums">{child.percentage}%</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Normal slice
    return (
        <div className="bg-surface-primary/95 border border-white/10 p-3 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-xl min-w-[160px]">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: payload[0].fill }} />
                <span className="text-white font-mono font-bold text-sm">{d.name}</span>
            </div>
            <div className="text-xs text-gray-400 font-mono space-y-1">
                <div>Count: <span className="text-gray-100 font-bold">{d.value.toLocaleString()}</span></div>
                <div>Share: <span className="text-gray-100 font-bold">{d.percentage}%</span></div>
            </div>
        </div>
    );
};

// ── Main ──────────────────────────────────────────────────────────────────────
export const DonutWidget = memo(function DonutWidget({ widget }) {
    const rawSlices = widget?.slices || [];
    if (!rawSlices.length) return null;

    // Compute total for percentage calculation
    const total = rawSlices.reduce((s, sl) => s + sl.value, 0);

    // Split into main slices (>1%) and "others" bucket (≤1%)
    const mainSlices = [];
    const othersChildren = [];

    rawSlices.forEach(sl => {
        const pct = total > 0 ? (sl.value / total) * 100 : 0;
        const rounded = Math.round(pct * 10) / 10; // 1 decimal
        if (pct > 1) {
            mainSlices.push({ ...sl, percentage: rounded });
        } else {
            othersChildren.push({ ...sl, percentage: rounded });
        }
    });

    // Build final data — append "Others" at the end if there are any
    const chartData = mainSlices;
    if (othersChildren.length > 0) {
        const othersValue = othersChildren.reduce((s, c) => s + c.value, 0);
        const othersPct = total > 0 ? Math.round((othersValue / total) * 100 * 10) / 10 : 0;
        chartData.push({
            name: 'Others',
            value: othersValue,
            percentage: othersPct,
            isOthers: true,
            children: othersChildren,
        });
    }

    return (
        <AnchorContainer>
            <div className="w-full h-[380px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius="55%"
                            outerRadius="80%"
                            dataKey="value"
                            paddingAngle={0.5}
                            isAnimationActive={false}
                        >
                            {chartData.map((slice, idx) => (
                                <Cell
                                    key={slice.name}
                                    fill={slice.isOthers ? OTHERS_COLOR : COLOR_PALETTE[idx % COLOR_PALETTE.length]}
                                    stroke="none"
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            content={<DonutTooltip />}
                            cursor={false}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </AnchorContainer>
    );
});
