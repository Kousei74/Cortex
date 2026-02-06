import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = "http://localhost:8000";

export function useResolution(jobId) {
    const [context, setContext] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Initial Fetch
    const fetchContext = useCallback(async () => {
        if (!jobId) return;
        try {
            const token = localStorage.getItem("cortex_token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const res = await fetch(`${API_BASE_URL}/resolution/jobs/${jobId}/resolution-context`, { headers });
            if (!res.ok) throw new Error("Failed to load resolution context");

            const data = await res.json();
            setContext(data);
        } catch (err) {
            console.error(err);
            setError(err.message);
        }
    }, [jobId]);

    // Re-fetch on mount
    useEffect(() => {
        fetchContext();
    }, [fetchContext]);

    // Apply Action
    const resolveItems = async (itemIds) => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem("cortex_token");
            const headers = {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            };

            const res = await fetch(`${API_BASE_URL}/resolution/bulk`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    job_id: jobId,
                    item_ids: itemIds,
                    action: "RESOLVE"
                })
            });

            if (!res.ok) throw new Error("Failed to apply resolution");

            const newContext = await res.json();
            setContext(newContext); // Update local state with result
        } catch (err) {
            console.error(err);
            // Optimistic rollback not implemented for V1
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchClusterRows = async (clusterId) => {
        try {
            const token = localStorage.getItem("cortex_token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const url = `${API_BASE_URL}/resolution/jobs/${jobId}/cluster/${clusterId}?t=${Date.now()}`;
            console.log(`[useResolution] Fetching: ${url}`);

            const res = await fetch(url, { headers });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Fetch Failed (${res.status}): ${text}`);
            }
            return await res.json();
        } catch (err) {
            console.error("[useResolution] Cluster Fetch Error:", err);
            // toast.error(`Data synced failed: ${err.message}`); // Optional: Don't spam toasts?
            // Actually, for debugging, let's spam ONE toast.
            return { error: err.message };
        }
    }

    return {
        context,
        isLoading,
        error,
        resolveItems,
        fetchClusterRows,
        refreshContext: fetchContext
    };
}
