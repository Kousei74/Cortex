import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ResolutionHeader({ context, onResolveAll }) {
    if (!context) return null;

    const { items_remaining, items_total, items_resolved } = context;
    const progress = items_total > 0 ? (items_resolved / items_total) * 100 : 0;

    return (
        <div className="sticky top-0 z-30 bg-primary-custom/95 backdrop-blur-sm border-b border-subtle-custom py-4 mb-6 -mx-8 px-8 flex justify-between items-center shadow-sm">
            <div>
                <h2 className="text-lg font-mono font-bold text-primary-custom flex items-center">
                    <span className="bg-[var(--accent-blue-bright)] text-white text-xs px-2 py-1 rounded mr-3">
                        {items_remaining} REMAINING
                    </span>
                    RESOLUTION WORKSPACE
                </h2>
            </div>

            <div className="flex items-center space-x-6 flex-1 justify-end max-w-xl">
                {/* Global Resolution Progress */}
                <div className="flex-1">
                    <div className="flex justify-between text-xs font-mono text-secondary-custom mb-1">
                        <span>PROGRESS</span>
                        <span>{Math.floor(progress)}% | {items_resolved}/{items_total}</span>
                    </div>
                    <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[var(--semantic-success)] transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Actions */}
                <Button
                    onClick={onResolveAll}
                    disabled={items_remaining === 0}
                    size="sm"
                    className="gradient-button text-white font-mono shadow-md"
                >
                    RESOLVE ALL
                </Button>
            </div>
        </div>
    );
}
