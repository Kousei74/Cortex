import { useState } from 'react';
import { TemporalWidget } from './visualizers/temporal-widget';
import { SnapshotWidget } from './visualizers/snapshot-widget';
import { ScatterWidget } from './visualizers/scatter-widget';
import { KPICardWidget } from './visualizers/kpi-card-widget';
import { SubAnchorRow } from './sub-anchor-row';
import { AlertCircle } from 'lucide-react';

/**
 * ReportView (The Switchboard)
 * Renders the correct view based on Layout Strategy.
 */
export function ReportView({ payload, status, error, onRetry, onSelect }) {
    const [selectedSnapshotIndex, setSelectedSnapshotIndex] = useState(
        payload?.default_option_index || 0
    );

    // 1. Terminal Failure (Execution Error)
    if (status === 'FAILED' || status === 'TIMEOUT') {
        return (
            <div className="flex flex-col items-center justify-center h-64 border border-red-200 bg-red-50 rounded-lg p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-red-700 mb-2">Analysis Failed</h3>
                <p className="text-red-600 mb-6">{error || "An unexpected error occurred."}</p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium"
                    >
                        Retry Job
                    </button>
                )}
            </div>
        );
    }

    // 2. Unsupported Data (Logic Failure)
    if (payload?.layout_strategy === 'UNSUPPORTED_DATASET') {
        return (
            <div className="flex flex-col items-center justify-center h-64 border border-orange-200 bg-orange-50 rounded-lg p-6">
                <h3 className="text-xl font-bold text-orange-800 mb-2">Data Unsupported</h3>
                <p className="text-orange-700 mb-4">
                    Your data does not meet the requirements for automated analysis.
                </p>
                {payload.reason_code && (
                    <div className="text-sm font-mono bg-white p-2 rounded border border-orange-200 text-orange-600 mb-4">
                        Code: {payload.reason_code}
                    </div>
                )}
                {payload.missing_requirements && payload.missing_requirements.length > 0 && (
                    <ul className="text-left list-disc pl-5 text-sm text-orange-800">
                        {payload.missing_requirements.map((req, i) => (
                            <li key={i}>{req}</li>
                        ))}
                    </ul>
                )}
            </div>
        );
    }

    // 3. Temporal Supreme (Anchor = Bar Chart, Sub-anchor = Bar + Line secondary)
    if (payload?.layout_strategy === 'TEMPORAL_SUPREME') {
        return (
            <div className="w-full mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Anchor is always the stacked bar chart */}
                {payload.anchor_visual?.type === 'STACKED_BAR' ? (
                    <SnapshotWidget widget={payload.anchor_visual} onSelect={onSelect} />
                ) : payload.anchor_visual?.type === 'KPI_CARD' ? (
                    <div className="relative w-full flex justify-center">
                        <KPICardWidget widget={payload.anchor_visual} />
                    </div>
                ) : null}
                {/* Sub-anchor row: donut + line chart */}
                <SubAnchorRow sub_anchor={payload.sub_anchor} />
            </div>
        );
    }

    // 4. Snapshot Pivot (Anchor = Bar Chart, Sub-anchor = Donut + Treemap)
    if (payload?.layout_strategy === 'SNAPSHOT_PIVOT') {
        const options = payload.anchor_options || [];
        const activeWidget = options[selectedSnapshotIndex];

        return (
            <div className="w-full mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeWidget && (
                    <div className="w-full">
                        {activeWidget.type === 'STACKED_BAR' ? (
                            <SnapshotWidget
                                widget={activeWidget}
                                onSelect={onSelect}
                            />
                        ) : activeWidget.type === 'KPI_CARD' ? (
                            <div className="relative w-full flex justify-center">
                                <KPICardWidget widget={activeWidget} />
                            </div>
                        ) : (
                            <div className="text-gray-400 p-4 border border-dashed border-gray-700 rounded text-center">
                                Widget Type {activeWidget.type} not yet implemented in V2 Anchor
                            </div>
                        )}
                    </div>
                )}
                {/* Sub-anchor row: donut + treemap */}
                <SubAnchorRow sub_anchor={payload.sub_anchor} />
            </div>
        );
    }

    // 5. Stale State (Completed but no payload)
    if (!payload && status === 'COMPLETED') {
        return (
            <div className="flex flex-col items-center justify-center h-64 border border-yellow-200 bg-yellow-50 rounded-lg p-6 text-center">
                <AlertCircle className="w-12 h-12 text-yellow-600 mb-4" />
                <h3 className="text-xl font-bold text-yellow-800 mb-2">Visuals Missing</h3>
                <p className="text-yellow-700 mb-6 max-w-md">
                    Analysis is marked as complete, but the visual payload is missing. This usually happens if the server restarted while you were away.
                </p>
                <div className="p-4 bg-white/50 rounded border border-yellow-200">
                    <p className="text-sm font-mono text-yellow-800">Please go to <strong>Data Ingestion</strong> and re-upload your file.</p>
                </div>
            </div>
        )
    }

    // 6. Fallback (Debug)
    return (
        <div className="p-4 border border-dashed border-gray-300 rounded text-xs font-mono text-gray-500">
            <p>DEBUG: ReportView Fallthrough</p>
            <p>Status: {status}</p>
            <p>Payload: {JSON.stringify(payload)}</p>
        </div>
    );
}
