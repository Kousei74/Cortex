import { BaseChart } from './base-chart';

/**
 * Renders a simple KPI Card for "Degenerate" single-point data.
 */
export function KPICardWidget({ widget }) {
    // widget: { value, label, context }

    return (
        <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center p-8 bg-surface-custom/30 rounded-lg border border-subtle-custom">

            <div className="text-center animate-in fade-in zoom-in duration-500">
                <h3 className="text-sm font-mono text-gray-400 uppercase tracking-widest mb-4">
                    {widget.label}
                </h3>

                <div className="text-7xl font-bold text-primary-custom mb-4 font-mono">
                    {widget.value}
                </div>

                {widget.context && (
                    <div className="max-w-md mx-auto p-4 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-200 text-sm">
                        {widget.context}
                    </div>
                )}
            </div>

        </div>
    );
}
