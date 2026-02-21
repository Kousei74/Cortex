import React, { memo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { AnchorContainer } from './anchor-container';

const COLOR_PALETTE = [
    "#00bfff", // --accent-blue-bright
    "#ff3b30", // --semantic-error
    "#34c759", // --semantic-success
    "#ffbf00", // --semantic-warning
    "#7c3aed", // violet
    "#0077b6", // --accent-blue-mid
    "#ff9f0a", // orange
    "#34c759", // green
    "#e91e8c", // magenta
    "#636366", // neutral gray fallback
];

const TreemapTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    if (!d?.name) return null;
    return (
        <div className="bg-surface-primary/95 border border-white/10 p-3 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-xl min-w-[160px]">
            <p className="text-white font-mono font-bold text-sm mb-1">{d.name}</p>
            <p className="text-xs text-gray-400 font-mono">
                Count: <span className="text-gray-100 font-bold">{d.value?.toLocaleString()}</span>
            </p>
        </div>
    );
};

// Custom tile renderer — applies CORTEX palette and truncates long names
const CustomContent = (props) => {
    const { x, y, width, height, name, depth, index } = props;
    if (depth !== 1 || width < 20 || height < 20) return null;
    const color = COLOR_PALETTE[index % COLOR_PALETTE.length];
    const fontSize = Math.max(9, Math.min(13, width / 8));
    return (
        <g>
            <rect
                x={x + 1}
                y={y + 1}
                width={width - 2}
                height={height - 2}
                rx={4}
                ry={4}
                fill={color}
                fillOpacity={0.85}
                stroke="none"
            />
            {width > 40 && height > 24 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2}
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.9)"
                    fontSize={fontSize}
                    fontFamily="monospace"
                    fontWeight={600}
                >
                    {name?.length > 16 ? name.slice(0, 14) + '…' : name}
                </text>
            )}
        </g>
    );
};

export const TreemapWidget = memo(function TreemapWidget({ widget }) {
    const nodes = widget?.nodes || [];
    if (!nodes.length) return null;

    return (
        <AnchorContainer className="flex-1 min-w-0">
            <div className="w-full h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={nodes}
                        dataKey="value"
                        aspectRatio={4 / 3}
                        isAnimationActive={false}
                        content={<CustomContent />}
                    >
                        <Tooltip content={<TreemapTooltip />} />
                    </Treemap>
                </ResponsiveContainer>
            </div>
        </AnchorContainer>
    );
});
