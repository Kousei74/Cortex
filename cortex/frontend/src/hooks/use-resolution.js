import { useState, useCallback } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { toast } from 'sonner'; // Assuming sonner is used for toasts

/**
 * useResolution Hook
 * Handles the business logic for resolving items:
 * - Optimistic Updates (immediate State change)
 * - Backend API Calls (background)
 * - Undo Stack (revert capability)
 */
export function useResolution() {
    const { incrementResolved, setResolutionStats } = useWorkspaceStore();
    const [undoStack, setUndoStack] = useState([]);

    // Temporary: Mock API Logic
    const resolveItems = useCallback(async (itemIds, action) => {
        const count = itemIds.length;
        if (count === 0) return;

        // 1. Optimistic Update
        incrementResolved(count);

        // 2. Add to Undo Stack
        const undoAction = {
            id: Date.now(),
            itemIds,
            action,
            timestamp: new Date()
        };
        setUndoStack(prev => [undoAction, ...prev].slice(0, 5)); // Keep last 5

        // 3. Show Toast with Undo
        toast.success(`${count} Items Resolved`, {
            description: `Action: ${action}`,
            action: {
                label: 'Undo',
                onClick: () => handleUndo(undoAction)
            },
        });

        // 4. Mock Backend Call (TODO: Replace with fetch)
        console.log(`[Resolution] Resolving ${count} items with action ${action}`);
        await new Promise(r => setTimeout(r, 500));

    }, [incrementResolved]);

    const handleUndo = useCallback((actionToUndo) => {
        // Revert Logic (Simplified for now)
        console.log(`[Undo] Reverting action ${actionToUndo.id}`);
        toast.info("Action Undone (Mock)");

        // In real impl: Decrement resolved count, restore items
    }, []);

    return {
        resolveItems,
        undoStack,
        handleUndo
    };
}
