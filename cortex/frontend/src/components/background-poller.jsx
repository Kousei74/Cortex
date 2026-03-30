import { useEffect, useRef } from 'react';
import { useAnalysisStore } from '@/store/analysisStore';
import { api } from '@/lib/api';
import { useTabLockStore } from '@/store/tabLockStore';

const REPORT_POLL_DELAYS_MS = [1000, 2000, 3000, 5000, 10000, 30000];

export function BackgroundPoller() {
    const {
        jobId, status,
        updateStatus, setPayload, setError
    } = useAnalysisStore();
    const isTabLocked = useTabLockStore(state => state.isLocked);

    const timeoutRef = useRef(null);
    const attemptRef = useRef(0);

    useEffect(() => {
        const clearPollTimer = () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };

        const isActive = Boolean(jobId) && (status === 'PENDING' || status === 'PROCESSING') && !isTabLocked;

        if (!isActive) {
            clearPollTimer();
            return undefined;
        }

        attemptRef.current = 0;
        let cancelled = false;

        const scheduleNextPoll = () => {
            if (attemptRef.current >= REPORT_POLL_DELAYS_MS.length) {
                console.warn("[BackgroundPoller] Poll window exhausted. Waiting for manual revisit.");
                return;
            }

            const nextDelay = REPORT_POLL_DELAYS_MS[attemptRef.current];
            attemptRef.current += 1;
            timeoutRef.current = setTimeout(runPoll, nextDelay);
        };

        const runPoll = async () => {
            if (cancelled) {
                return;
            }

            try {
                const data = await api.getReportJob(jobId);
                const normalizedStatus = (data.status || 'PENDING').toUpperCase();

                updateStatus(normalizedStatus, data.progress);

                if (normalizedStatus === 'COMPLETED') {
                    setPayload(data.payload);
                    return;
                }

                if (normalizedStatus === 'FAILED') {
                    setError(data.error || 'Job Failed');
                    return;
                }
            } catch (err) {
                console.error("Poll Error:", err);
                if (String(err?.message || "").includes("Job not found")) {
                    setError("Connection Lost: Job not found on server.");
                    return;
                }
            }

            scheduleNextPoll();
        };

        scheduleNextPoll();

        return () => {
            cancelled = true;
            clearPollTimer();
        };
    }, [jobId, isTabLocked, setError, setPayload, status, updateStatus]);

    return null; // Invisible Component
}
