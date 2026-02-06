import { useEffect, useRef } from 'react';
import { useAnalysisStore } from '@/store/analysisStore';

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
                    const response = await fetch(`http://localhost:8000/reports/jobs/${jobId}`);

                    if (response.status === 404) {
                        // Stale Job (Backend Restarted)
                        setError("Connection Lost: Job not found on server.");
                        throw new Error("Job 404");
                    }

                    if (!response.ok) throw new Error("Poll Failed");

                    const data = await response.json();

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
                    if (err.message === "Job 404") {
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
