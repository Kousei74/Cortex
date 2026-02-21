import React from 'react';
import { useWorkspaceStore } from '../../store/workspace-store';
import { useResolution } from '../../hooks/use-resolution';
import { CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

export function ResolutionHeader() {
    const { resolutionStats } = useWorkspaceStore();
    const { totalItems, resolvedItems, conflicts } = resolutionStats;
    const [isVisible, setIsVisible] = React.useState(true);

    React.useEffect(() => {
        const timer = setTimeout(() => setIsVisible(false), 5000);
        return () => clearTimeout(timer);
    }, []);

    if (!isVisible) return null;

    const percentage = totalItems > 0 ? Math.round((resolvedItems / totalItems) * 100) : 0;

    return (
        <div className={`w-full bg-surface-primary border-b border-border-subtle p-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md bg-opacity-90 transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>

            {/* Left: Progress Section */}
            <div className="flex-1 max-w-xl">
                <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                    <span>RESOLUTION PROGRESS</span>
                    <span className="text-accent-blue-bright">{percentage}%</span>
                </div>
                <div className="h-2 w-full bg-surface-secondary rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-accent-blue-mid to-accent-blue-bright transition-all duration-500 ease-out"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>

            {/* Right: Stats & Actions */}
            <div className="flex items-center gap-6 ml-8">

                <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Layers className="w-4 h-4 text-gray-500" />
                    <span className="font-mono">{totalItems - resolvedItems}</span>
                    <span className="text-gray-500 text-xs uppercase">Remaining</span>
                </div>

                {conflicts > 0 && (
                    <div className="flex items-center gap-2 text-sm text-yellow-500">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-mono">{conflicts}</span>
                        <span className="text-xs uppercase">Conflicts</span>
                    </div>
                )}

                {resolvedItems > 0 && (
                    <div className="flex items-center gap-2 text-sm text-green-500">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="font-mono">{resolvedItems}</span>
                        <span className="text-xs uppercase">Resolved</span>
                    </div>
                )}

            </div>
        </div>
    );
}
