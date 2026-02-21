import { create } from 'zustand'

// --- Defensive Validation Helpers ---

const createFallbackKPI = (reason) => ({
    id: "fallback_kpi",
    type: "KPI_CARD", // Corrected Type String
    title: "Insufficient Data",
    label: "Items",
    value: "N/A",
    context: reason || "Data validation failed for this visualization."
});

const sanitizeWidget = (widget) => {
    if (!widget) return widget;

    // 1. Data Length Check
    const points = widget.x_axis?.length || widget.categories?.length || widget.bins?.length || 0;

    // Histogram Specific: Empty bins
    if (widget.type === 'HISTOGRAM' && points === 0) {
        return createFallbackKPI("No histogram bins generated.");
    }

    // Temporal/Bar Specific: Degenerate (<= 1 point)
    // Note: KPI widgets are exempt.
    if ((widget.type === 'STACKED_BAR' || widget.type === 'COMBO_CHART') && points <= 1) {
        return createFallbackKPI("Insufficient data points for chart (<= 1).");
    }

    // 2. Colors Check (Cluster Bar)
    if (widget.type === 'STACKED_BAR' && widget.series?.[0]?.colors) {
        const dataLen = widget.series[0].data?.length || 0;
        const colorsLen = widget.series[0].colors.length;
        if (dataLen !== colorsLen) {
            console.warn(`[AnalysisStore] Color mismatch: Data ${dataLen} vs Colors ${colorsLen}. Removing custom colors.`);
            // Deep copy series to safely mutate
            const newSeries = widget.series.map(s => ({ ...s }));
            newSeries[0].colors = undefined; // Fallback to default
            return { ...widget, series: newSeries };
        }
    }

    return widget;
};

const sanitizePayload = (payload) => {
    if (!payload || !payload.meta) return payload;

    // Shallow copy to avoid mutating original immediately
    const safe = { ...payload };

    try {
        if (safe.layout_strategy === 'TEMPORAL_SUPREME') {
            safe.anchor_visual = sanitizeWidget(safe.anchor_visual);
        } else if (safe.layout_strategy === 'SNAPSHOT_PIVOT') {
            safe.anchor_options = safe.anchor_options.map(sanitizeWidget);
        }
    } catch (e) {
        console.error("[AnalysisStore] Sanitization Failed:", e);
        // If sanitization fails, do we return original or null? 
        // Return original and hope for best, or fail safe?
        // Let's return original to avoid total blackout, but log error.
    }

    return safe;
};

// --- Store ---

export const useAnalysisStore = create((set) => ({
    jobId: null,
    status: 'IDLE', // IDLE, PENDING, PROCESSING, COMPLETED, FAILED, TIMEOUT
    progress: 0,
    payload: null,
    error: null,

    // Actions
    setJobId: (id) => set({ jobId: id, status: 'PENDING', progress: 0, error: null }),
    updateStatus: (status, progress) => set({ status, progress }),

    // INJECTED VALIDATION HERE
    setPayload: (payload) => {
        const safePayload = sanitizePayload(payload);
        set({ payload: safePayload, status: 'COMPLETED', progress: 100 });
    },

    setError: (error) => set({ error, status: 'FAILED' }),
    reset: () => set({ jobId: null, status: 'IDLE', progress: 0, payload: null, error: null })
}))
