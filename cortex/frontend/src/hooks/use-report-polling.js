import { useRef, useCallback, useEffect } from 'react';
import { useAnalysisStore } from '@/store/analysisStore';
import { api } from '@/lib/api';
import { useTabLockStore } from '@/store/tabLockStore';

const REPORT_POLL_DELAYS_MS = [1000, 2000, 3000, 5000, 10000, 30000];

/**
 * Hook for Zeno Polling Logic.
 * Wraps the global store to provide polling mechanics.
 */
export function useReportPolling() {
    const {
        jobId, status, progress, payload, error,
        setJobId, updateStatus, setPayload, setError
    } = useAnalysisStore();
    const isTabLocked = useTabLockStore(state => state.isLocked);

    const timeoutIdRef = useRef(null);
    const attemptRef = useRef(0);

    const stopPolling = useCallback(() => {
        if (timeoutIdRef.current) {
            clearTimeout(timeoutIdRef.current);
            timeoutIdRef.current = null;
        }
    }, []);

    const startPolling = useCallback((newJobId) => {
        if (!newJobId || useTabLockStore.getState().isLocked) return;

        setJobId(newJobId);
        stopPolling();
        attemptRef.current = 0;

        const poll = async () => {
            if (!useAnalysisStore.getState().jobId || useTabLockStore.getState().isLocked) return;

            try {
                const data = await api.getReportJob(newJobId);
                const normalizedStatus = (data.status || 'PENDING').toUpperCase();

                updateStatus(normalizedStatus, data.progress);

                if (normalizedStatus === 'COMPLETED') {
                    stopPolling();
                    setPayload(data.payload);
                    return;
                }

                if (normalizedStatus === 'FAILED') {
                    stopPolling();
                    setError(data.error || 'Job Failed');
                    return;
                }
            } catch (err) {
                console.error("Polling Error:", err);
                if (String(err?.message || "").includes("Job not found")) {
                    stopPolling();
                    setError("Connection Lost: Job not found on server.");
                    return;
                }
            }

            if (attemptRef.current >= REPORT_POLL_DELAYS_MS.length) {
                return;
            }

            const nextDelay = REPORT_POLL_DELAYS_MS[attemptRef.current];
            attemptRef.current += 1;
            timeoutIdRef.current = setTimeout(poll, nextDelay);
        };

        const initialDelay = REPORT_POLL_DELAYS_MS[attemptRef.current];
        attemptRef.current += 1;
        timeoutIdRef.current = setTimeout(poll, initialDelay);

    }, [stopPolling, setJobId, updateStatus, setPayload, setError]);

    useEffect(() => {
        if (isTabLocked) {
            stopPolling();
        }
    }, [isTabLocked, stopPolling]);

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
