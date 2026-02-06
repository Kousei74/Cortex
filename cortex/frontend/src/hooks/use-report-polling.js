import { useRef, useCallback, useEffect } from 'react';
import { useAnalysisStore } from '@/store/analysisStore';

// Constants
const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 45000;

/**
 * Hook for Zeno Polling Logic.
 * Wraps the global store to provide polling mechanics.
 */
export function useReportPolling() {
    const {
        jobId, status, progress, payload, error,
        setJobId, updateStatus, setPayload, setError
    } = useAnalysisStore();

    // Ref for timeout tracking to survive re-renders
    const startTimeRef = useRef(null);
    const timeoutIdRef = useRef(null);
    const pollIntervalIdRef = useRef(null);

    const stopPolling = useCallback(() => {
        if (pollIntervalIdRef.current) {
            clearInterval(pollIntervalIdRef.current);
            pollIntervalIdRef.current = null;
        }
        if (timeoutIdRef.current) {
            clearTimeout(timeoutIdRef.current);
            timeoutIdRef.current = null;
        }
    }, []);

    const startPolling = useCallback((newJobId) => {
        if (!newJobId) return;

        // Reset State via Store
        setJobId(newJobId);
        startTimeRef.current = Date.now();

        // Clear any existing polling
        stopPolling();

        // Timeout Safety
        timeoutIdRef.current = setTimeout(() => {
            stopPolling();
            setError('Operation timed out. Please retry.');
        }, TIMEOUT_MS);

        // Polling Loop
        const poll = async () => {
            if (!useAnalysisStore.getState().jobId) return; // Guard if reset happened

            try {
                const response = await fetch(`http://localhost:8000/reports/jobs/${newJobId}`);

                if (!response.ok) {
                    throw new Error(`Polling failed: ${response.status}`);
                }

                const data = await response.json();

                // Update Store
                updateStatus(data.status, data.progress);

                // Terminal Checks
                if (data.status === 'COMPLETED') {
                    stopPolling();
                    setPayload(data.payload);
                } else if (data.status === 'FAILED') {
                    stopPolling();
                    setError(data.error || 'Job Failed');
                }

            } catch (err) {
                console.error("Polling Error:", err);
            }
        };

        // Immediate first call
        poll();
        // Interval
        pollIntervalIdRef.current = setInterval(poll, POLL_INTERVAL_MS);

    }, [stopPolling, setJobId, updateStatus, setPayload, setError]);

    // Cleanup on unmount (Optional: Do we want to stop polling if user leaves page? 
    // YES, for V1. But if we move to global store, maybe we want it to continue?
    // User wants "Dashboard" to show results. So if I navigate away, polling stops?
    // FIX: Don't stop polling on unmount if we want background persistence.
    // BUT we need a way to re-attach. 
    // FOR NOW: Stick to existing logic, let's keep it simple. Dashboard will re-mount hook? 
    // Actually, if Dashboard mounts the hook, it needs to know IF it should poll.
    // Let's rely on the store state. If status is PENDING/PROCESSING, Dashboard should pick it up?
    // We need a "Global Poller" or just let StagingArea start it.
    // If I leave StagingArea, unmount kills polling.
    // ACTION: Move Polling Logic to a transparent component or Context? 
    // EASIER: Just let `run_cortex` architecture handle it? 
    // Let's allow `startPolling` to be called, but `useEffect` cleanup should ONLY stop if component acts as "Controller".
    // Actually, if we redirect to Dashboard, StagingArea unmounts -> Polling stops.
    // WE NEED GLOBAL POLLING. 
    // QUICK FIX: Don't cleanup on unmount. Let the interval run. (It's a React anti-pattern but works for single-page persistence if ref survives? No, ref dies with component).
    // BETTER: Put polling inside `MainLayout` or `App`. 
    // OR: Just navigate to Dashboard and let Dashboard START polling if ID exists?
    // Let's Try: Dashboard simply READS from store. Who POLLS?
    // I will trigger `startPolling` in StagingArea. 
    // If StagingArea unmounts, polling DIES.
    // SO: I must NOT redirect? OR I must move polling up.
    // Let's move polling up to `MainLayout`. 
    // WAIT. User wants "Upload -> Dashboard".
    // I will make `useReportPolling` logic RESILIENT.
    // Actually, I can just mount a <BackgroundPoller /> in App.jsx.
    // Let's do that.
    return {
        jobId,
        status,
        progress,
        payload,
        error,
        startPolling,
        stopPolling
    };
}
