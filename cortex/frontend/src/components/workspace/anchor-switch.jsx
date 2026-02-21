import React from 'react';
import { useWorkspaceStore } from '../../store/workspace-store';
import { Layers, List } from 'lucide-react';

export function AnchorSwitch() {
    const { viewMode, setViewMode } = useWorkspaceStore();

    return (
        <div className="flex items-center bg-surface-primary/50 border border-border-subtle rounded-lg p-1">
            <button
                onClick={() => setViewMode('CONSOLIDATED')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'CONSOLIDATED'
                        ? 'bg-accent-blue-mid/20 text-accent-blue-bright shadow-sm'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
            >
                <Layers className="w-4 h-4" />
                <span>Consolidated</span>
            </button>
            <button
                onClick={() => setViewMode('DIVERGING')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'DIVERGING'
                        ? 'bg-accent-blue-mid/20 text-accent-blue-bright shadow-sm'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
            >
                <List className="w-4 h-4" />
                <span>Diverging</span>
            </button>
        </div>
    );
}
