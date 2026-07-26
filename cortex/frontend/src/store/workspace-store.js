import { create } from 'zustand';

/**
 * Workspace Store (The Cockpit)
 * Manages the global state of the Resolution Workspace.
 */
export const useWorkspaceStore = create((set) => ({
    // State
    viewMode: 'CONSOLIDATED', // 'CONSOLIDATED' (Anchor) | 'DIVERGING' (Rows)
    selectedCluster: null, // ID of currently focused cluster
    resolutionStats: {
        totalItems: 0,
        resolvedItems: 0,
        conflicts: 0,
    },

    // Actions
    setViewMode: (mode) => set({ viewMode: mode }),
    setSelectedCluster: (clusterId) => set({ selectedCluster: clusterId }),

    // Updates stats (called by backend/optimistic logic)
    setResolutionStats: (stats) => set((state) => ({
        resolutionStats: { ...state.resolutionStats, ...stats }
    })),

    // Increment resolved count optimistically
    incrementResolved: (count) => set((state) => ({
        resolutionStats: {
            ...state.resolutionStats,
            resolvedItems: Math.min(
                state.resolutionStats.totalItems,
                state.resolutionStats.resolvedItems + count
            )
        }
    })),
}));
