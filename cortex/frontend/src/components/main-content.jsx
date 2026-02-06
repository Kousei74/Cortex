import { useState } from "react"
import { useAnalysisStore } from "@/store/analysisStore"
import { ZenoProgress } from "./zeno-progress"
import { ReportView } from "./report-view"
import { ResolutionView } from "./resolution/resolution-view" // Ensure this import path is correct
import { ResolutionHeader } from "./resolution/resolution-header"
import { AnchorSwitch } from "./resolution/anchor-switch"
import { KpiCardsRow } from "./kpi-cards"
import { useResolution } from "@/hooks/use-resolution" // Ensure import
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import SentimentChart from "@/components/sentiment-chart"

// Template Data (Keep for fallback)
const topicsData = [
    { topic: "UI/UX Feedback", count: 1245 },
    { topic: "Feature Requests", count: 987 },
    { topic: "Performance Issues", count: 654 },
]
const platformStatus = [
    { name: "Internal Database", status: "ONLINE" },
    { name: "Social Media API", status: "ONLINE" },
]

export default function MainContent() {
    const { jobId, status, progress, payload, error } = useAnalysisStore()
    const [viewMode, setViewMode] = useState('CONSOLIDATED')

    // Resolution Hook (conditional)
    const { context, resolveItems } = useResolution(jobId)

    // MODE SWITCH: Active Analysis vs Static Dashboard
    if (jobId) {
        return (
            <div className="p-6 space-y-6 custom-scrollbar h-full flex flex-col">
                <div className="mb-6">
                    <h1 className="text-3xl font-mono font-bold text-primary-custom tracking-wider">COMMAND CENTER</h1>
                    <p className="text-secondary-custom text-sm font-mono mt-1">ACTIVE NEURAL LINK LINKED: {jobId}</p>
                </div>

                {/* Zeno Progress ( temporarily disabled per user request )
                {(status === 'PROCESSING' || status === 'PENDING') && (
                    <div className="mb-6">
                        <ZenoProgress status={status} progress={progress} />
                        <div className="flex justify-between text-xs font-mono text-secondary-custom mt-2">
                            <span>STATUS: {status}</span>
                            <span>{Math.floor(progress)}%</span>
                        </div>
                    </div>
                )}
                */}

                <div className="flex-1 min-h-0 relative space-y-6">
                    {/* 1. Resolution Header (Disabled)
                    {context && viewMode === 'DIVERGING' && (
                        <ResolutionHeader
                            context={context}
                            onResolveAll={() => resolveItems(context.clusters?.['all'] || [])}
                        />
                    )}
                    */}

                    {/* 2. KPI Cards */}
                    {payload && payload.meta && (
                        <KpiCardsRow meta={payload.meta} />
                    )}

                    {/* 3. Anchor Switch (Disabled - Focus on Consolidated) 
                    <AnchorSwitch viewMode={viewMode} setViewMode={setViewMode} />
                    */}

                    {/* 4. Visualization Area (Forced Consolidated) */}
                    <ReportView
                        payload={payload}
                        status={status}
                        error={error}
                        onRetry={() => { }}
                    />
                </div>
            </div>
        )
    }

    // STATIC TEMPLATE (Default View)
    // STATIC TEMPLATE (Default View)
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
