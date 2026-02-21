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

const DonutTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
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

export const DonutWidget = memo(function DonutWidget({ widget }) {
    const slices = widget?.slices || [];
    if (!slices.length) return null;

    return (
        <AnchorContainer>
            <div className="w-full h-[380px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={slices}
                            cx="50%"
                            cy="50%"
                            innerRadius="55%"
                            outerRadius="80%"
                            dataKey="value"
                            paddingAngle={2}
                            isAnimationActive={false}
                        >
                            {slices.map((slice, idx) => (
                                <Cell
                                    key={slice.name}
                                    fill={COLOR_PALETTE[idx % COLOR_PALETTE.length]}
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
