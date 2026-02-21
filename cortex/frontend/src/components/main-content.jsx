import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAnalysisStore } from "@/store/analysisStore"
import { useWorkspaceStore } from "@/store/workspace-store"
import { CortexLoader } from "./cortex-loader"
import { ReportView } from "./report-view"
import { KpiCardsRow } from "./kpi-cards"
import { Card } from "@/components/ui/card"

export default function MainContent() {
    const { jobId, status, progress, payload, error } = useAnalysisStore()
    const { setResolutionStats, viewMode, setSelectedCluster } = useWorkspaceStore()

    // Sync Stats when Payload Arrives
    useEffect(() => {
        if (payload?.meta) {
            setResolutionStats({
                totalItems: payload.meta.kpis?.total_rows || 0,
                resolvedItems: 0,
                conflicts: 0
            })
        }
    }, [payload, setResolutionStats])

    const handleSelect = (cluster) => {
        console.log("Cluster Selected:", cluster);
        setSelectedCluster(cluster);
    };

    const isLoading = status === 'PROCESSING' || status === 'PENDING';
    const isError = status === 'FAILED' || status === 'TIMEOUT';

    // ── ACTIVE ANALYSIS MODE ────────────────────────────────────────────────
    if (jobId) {
        return (
            // Relative wrapper so absolute inset-0 loader fills this box exactly
            <div className="relative h-full">
                <AnimatePresence mode="wait">

                    {/* LOADING: orb only, perfectly centered both axes */}
                    {isLoading && (
                        <motion.div
                            key="cortex-loader"
                            className="h-full w-full flex items-center justify-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                        >
                            <CortexLoader status={status} />
                        </motion.div>
                    )}

                    {/* DONE: full dashboard fades in after loader has exited */}
                    {!isLoading && (
                        <motion.div
                            key="cortex-content"
                            className="p-6 h-full flex flex-col"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.55, ease: 'easeInOut' }}
                        >
                            {/* Header */}
                            <div className="flex items-end justify-between mb-2 flex-shrink-0">
                                <h1 className="text-3xl font-mono font-bold text-primary-custom tracking-wider">
                                    COMMAND CENTER
                                </h1>
                            </div>

                            {/* Error banner */}
                            {isError && (
                                <div
                                    className="mb-4 flex-shrink-0 px-4 py-3 rounded-xl font-mono text-xs"
                                    style={{
                                        border: '1px solid rgba(255,59,48,0.3)',
                                        color: '#ff3b30',
                                        background: 'rgba(255,59,48,0.05)'
                                    }}
                                >
                                    ANALYSIS FAILED — {status}
                                </div>
                            )}

                            {/* Scrollable Central Pane */}
                            <div
                                className="flex-1 min-h-0 overflow-y-auto space-y-6"
                                style={{ scrollbarWidth: 'none' }}
                            >
                                {payload?.meta && <KpiCardsRow meta={payload.meta} />}

                                <div className="relative">
                                    <ReportView
                                        payload={payload}
                                        status={status}
                                        error={error}
                                        onRetry={() => { }}
                                        onSelect={handleSelect}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>
        );
    }

    // ── STATIC TEMPLATE (no job active) ─────────────────────────────────────
    return (
        <div className="h-full flex flex-col items-center justify-center p-6 space-y-6 custom-scrollbar text-center">
            <div className="max-w-md space-y-4">
                <div className="p-4 rounded-full bg-surface-custom border border-subtle-custom w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-secondary-custom" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>

                <h1 className="text-3xl font-mono font-bold text-primary-custom tracking-wider">COMMAND CENTER</h1>
                <p className="text-secondary-custom font-mono text-sm leading-relaxed">
                    System Standby. Active Neural Link Required.
                </p>

                <Card className="bg-surface-custom border-subtle-custom p-6 fluid-rounded-lg soft-shadow mt-8">
                    <p className="text-secondary-custom font-mono text-sm">
                        Please proceed to <span className="text-primary-custom font-bold">DATA INGESTION</span> to upload fragments and initiate analysis.
                    </p>
                </Card>
            </div>
        </div>
    )
}
