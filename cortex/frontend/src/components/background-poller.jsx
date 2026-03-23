import { useEffect, useRef } from 'react';
import { useAnalysisStore } from '@/store/analysisStore';
import { api } from '@/lib/api';

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 60000;

export function BackgroundPoller() {
    const {
        jobId, status,
        updateStatus, setPayload, setError
    } = useAnalysisStore();

    const intervalRef = useRef(null);
    const timeoutRef = useRef(null);

    useEffect(() => {
        // Only poll if we have a Job ID and it's active
        const isActive = jobId && (status === 'PENDING' || status === 'PROCESSING');

        if (isActive) {
            console.log("[BackgroundPoller] Starting poll for:", jobId);

            // Timeout Safety
            timeoutRef.current = setTimeout(() => {
                setError('Operation timed out.');
            }, TIMEOUT_MS);

            intervalRef.current = setInterval(async () => {
                try {
                    const data = await api.getReportJob(jobId);

                    // Normalize Status to Uppercase for Frontend Consistency
                    const normalizedStatus = (data.status || 'PENDING').toUpperCase();

                    updateStatus(normalizedStatus, data.progress);

                    if (normalizedStatus === 'COMPLETED') {
                        setPayload(data.payload);
                    } else if (normalizedStatus === 'FAILED') {
                        setError(data.error || 'Job Failed');
                    }
                } catch (err) {
                    console.error("Poll Error:", err);
                    if (err.message.includes("Job not found")) {
                        setError("Connection Lost: Job not found on server.");
                        // Optional: Auto-clear job ID?
                        // setJobId(null); 
                    }
                }
            }, POLL_INTERVAL_MS);
        } else {
            // Cleanup if not active
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [jobId, status, updateStatus, setPayload, setError]);

    return null; // Invisible Component
}
