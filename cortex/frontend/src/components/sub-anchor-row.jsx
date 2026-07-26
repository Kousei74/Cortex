import React, { memo } from 'react';
import { DonutWidget } from './visualizers/donut-widget';
import { TreemapWidget } from './visualizers/treemap-widget';
import { TemporalWidget } from './visualizers/temporal-widget';

/**
 * SubAnchorRow
 * The horizontal row below the anchor, containing two visuals:
 *   - Visual 1: Donut chart (sentiment distribution, always)
 *   - Visual 2: Line chart (isTimestamp=true) or Treemap (isTimestamp=false)
 *
 * Layout: Flex row — donut is fixed width, secondary takes remaining space.
 */
export const SubAnchorRow = memo(function SubAnchorRow({ sub_anchor }) {
    if (!sub_anchor) return null;
    const { donut, secondary_type, secondary } = sub_anchor;
    if (!donut && !secondary) return null;

    return (
        <div className="w-full flex flex-row gap-4 mt-4">
            {/* Donut — 30% */}
            {donut && (
                <div className="w-[30%] flex-shrink-0">
                    <DonutWidget widget={donut} />
                </div>
            )}
            {/* Secondary — 70% */}
            {secondary && secondary_type === 'LINE' && (
                <div className="flex-1 min-w-0">
                    <TemporalWidget widget={secondary} />
                </div>
            )}
            {secondary && secondary_type === 'TREEMAP' && (
                <div className="flex-1 min-w-0">
                    <TreemapWidget widget={secondary} />
                </div>
            )}
        </div>
    );
});
