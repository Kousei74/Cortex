import { useState } from 'react';
import { TemporalWidget } from './visualizers/temporal-widget';
import { SnapshotWidget } from './visualizers/snapshot-widget';
import { ScatterWidget } from './visualizers/scatter-widget';
import { PieWidget } from './visualizers/pie-widget';
import { AlertCircle } from 'lucide-react';

/**
 * ReportView (The Switchboard)
 * Renders the correct view based on Layout Strategy.
 */
export function ReportView({ payload, status, error, onRetry }) {
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

    // 3. Temporal Supreme
    if (payload?.layout_strategy === 'TEMPORAL_SUPREME') {
        return (
            <div className="relative w-full fluid-rounded-lg border-2 border-dashed border-subtle-custom bg-surface-custom/30 overflow-hidden pt-6 px-6 pb-2">
                <TemporalWidget widget={payload.anchor_visual} />
            </div>
        );
    }

    // 4. Snapshot Pivot
    if (payload?.layout_strategy === 'SNAPSHOT_PIVOT') {
        const options = payload.anchor_options || [];
        const activeWidget = options[selectedSnapshotIndex];

        return (
            <div className="relative w-full fluid-rounded-lg border-2 border-dashed border-subtle-custom bg-surface-custom/30 overflow-hidden pt-6 px-6 pb-2">
                {/* Tabs for Options */}
                <div className="flex space-x-2 border-b border-gray-700 mb-6 overflow-x-auto pb-2">
                    {options.map((opt, idx) => (
                        <button
                            key={opt.id}
                            onClick={() => setSelectedSnapshotIndex(idx)}
                            className={`px-3 py-1 text-sm font-mono font-medium whitespace-nowrap rounded-t-md transition-all duration-300 ${idx === selectedSnapshotIndex
                                ? 'border-b-2 border-primary-custom text-primary-custom bg-transparent'
                                : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'
                                }`}
                        >
                            {opt.title}
                        </button>
                    ))}
                </div>

                {/* Active Widget Render */}
                {activeWidget && (
                    <div className="animate-in fade-in duration-300">
                        {activeWidget.type === 'STACKED_BAR' || activeWidget.type === 'COMBO_CHART' ? (
                            <SnapshotWidget widget={activeWidget} />
                        ) : activeWidget.type === 'SCATTER_PLOT' ? (
                            <ScatterWidget widget={activeWidget} />
                        ) : activeWidget.type === 'PIE_CHART' ? (
                            <PieWidget widget={activeWidget} />
                        ) : (
                            <div className="text-gray-400 p-4">Unknown Widget Type: {activeWidget.type}</div>
                        )}
                    </div>
                )}
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
