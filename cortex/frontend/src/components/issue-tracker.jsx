import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { api } from "@/lib/api"
import { FADE_IN } from "@/lib/animations"
import { toast } from "sonner"
import IssueFlowchart from "./issue-flowchart"
import { CortexLoader } from "./cortex-loader"
import { useAuth } from "@/context/AuthContext"

export default function IssueTracker() {
    const { user } = useAuth()
    const [statusFilter, setStatusFilter] = useState("open") // "open" or "closed"
    const [issues, setIssues] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeIssueId, setActiveIssueId] = useState(null)

    useEffect(() => {
        fetchIssues()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter])

    const fetchIssues = async () => {
        setIsLoading(true)
        try {
            const data = await api.getIssues(
                statusFilter,
                50,
                user?.dept_id || "",
                user?.emp_id || "",
                user?.role || "team_member"
            )
            setIssues(data)
            setIssues(data)
            // Removed auto-selection logic here so it stays on the List View by default
        } catch (err) {
            toast.error("Failed to load issues", { description: err.message })
        } finally {
            setIsLoading(false)
        }
    }

    // Format date nicely
    const formatDate = (isoString) => {
        if (!isoString) return "UNKNOWN DATE"
        return new Date(isoString).toLocaleDateString("en-GB", {
            day: "2-digit", month: "long", year: "numeric"
        }).toUpperCase()
    }

    const getPriorityColor = (p) => {
        switch (p) {
            case "critical": return "#ff3b30"
            case "high": return "#ff9500"
            case "mid": return "#ffbf00"
            case "low": return "#34c759"
            default: return "#8e8e93"
        }
    }

    // LIST VIEW
    if (!activeIssueId) {
        return (
            <div className="flex flex-col h-full w-full overflow-hidden bg-surface-custom/30">
                {/* Header & Toggle */}
                <div className="p-8 border-b border-subtle-custom flex justify-between items-end flex-shrink-0">
                    <div>
                        <h2 className="text-3xl font-mono font-bold text-primary-custom tracking-wider uppercase mb-2">
                            Execution Ledger
                        </h2>
                        <p className="text-secondary-custom text-sm font-mono">
                            Select an issue to view its execution graph.
                        </p>
                    </div>

                    <div className="flex p-1 bg-surface-custom border border-subtle-custom fluid-rounded gap-1">
                        <button
                            onClick={() => setStatusFilter("open")}
                            className={`px-6 py-2 text-xs font-mono font-bold uppercase tracking-widest fluid-rounded transition-all duration-300 ${statusFilter === "open"
                                ? "bg-[var(--accent-blue-bright)] text-primary-custom shadow-[0_0_15px_rgba(0,191,255,0.3)]"
                                : "text-secondary-custom hover:text-primary-custom"
                                }`}
                        >
                            Active
                        </button>
                        <button
                            onClick={() => setStatusFilter("closed")}
                            className={`px-6 py-2 text-xs font-mono font-bold uppercase tracking-widest fluid-rounded transition-all duration-300 ${statusFilter === "closed"
                                ? "bg-[var(--accent-blue-bright)] text-primary-custom shadow-[0_0_15px_rgba(0,191,255,0.3)]"
                                : "text-secondary-custom hover:text-primary-custom"
                                }`}
                        >
                            Closed
                        </button>
                    </div>
                </div>

                {/* List Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    <div className="max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <AnimatePresence mode="popLayout">
                            {isLoading ? (
                                <motion.div {...FADE_IN} className="flex justify-center p-12 col-span-full">
                                    <CortexLoader />
                                </motion.div>
                            ) : issues.length === 0 ? (
                                <motion.div {...FADE_IN} className="text-center p-8 text-secondary-custom font-mono text-sm col-span-full">
                                    NO {statusFilter.toUpperCase()} ISSUES FOUND
                                </motion.div>
                            ) : (
                                issues.map((issue) => (
                                    <motion.button
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        key={issue.issue_id}
                                        onClick={() => setActiveIssueId(issue.issue_id)}
                                        className="w-full text-left p-6 fluid-rounded border transition-all duration-300 relative overflow-hidden group bg-surface-custom/50 border-subtle-custom hover:border-[var(--accent-blue-bright)] hover:bg-surface-custom hover:shadow-[0_0_15px_rgba(0,191,255,0.1)] min-h-[160px]"
                                    >
                                        <div className="grid grid-cols-[1fr_auto] grid-rows-[auto_1fr_auto] gap-x-4 h-full">
                                            {/* Header Row */}
                                            <div className="mb-2 min-w-0">
                                                <h3 className="font-mono text-lg font-bold text-primary-custom uppercase tracking-wide truncate">
                                                    {issue.header}
                                                </h3>
                                            </div>
                                            <div className="flex justify-end items-start mb-2 pt-1">
                                                <span
                                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                                    style={{
                                                        background: getPriorityColor(issue.priority),
                                                        boxShadow: `0 0 8px ${getPriorityColor(issue.priority)}`
                                                    }}
                                                />
                                            </div>

                                            {/* Body Row */}
                                            <div className="mb-4 min-w-0">
                                                <p className="font-mono text-sm text-secondary-custom line-clamp-2 leading-relaxed break-words">
                                                    {issue.description}
                                                </p>
                                            </div>
                                            <div className="flex justify-end items-center mb-4 pl-4 whitespace-nowrap">
                                                <span className="text-[var(--accent-blue-bright)] font-bold tracking-wider text-sm font-mono text-right">
                                                    {issue.issue_id}
                                                </span>
                                            </div>

                                            {/* Footer Row */}
                                            <div className="flex items-end min-w-0 mt-auto pt-2">
                                                <div className="font-mono text-xs text-secondary-custom/60 uppercase tracking-widest italic truncate">
                                                    {formatDate(issue.last_activity || issue.created_at)}
                                                </div>
                                            </div>
                                            <div className="flex items-end justify-end mt-auto pt-2 pl-4">
                                                <span className="text-secondary-custom/80 uppercase tracking-widest text-[11px] font-mono text-right break-words max-w-[150px] line-clamp-1">
                                                    {issue.assigned_team || "UNASSIGNED"}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.button>
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        )
    }

    // DETAIL VIEW (Flowchart)
    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-[var(--bg-card)]">
            {/* Nav Header */}
            <div className="flex-shrink-0 p-4 border-b border-subtle-custom bg-surface-custom/80 backdrop-blur z-10 flex items-center shadow-sm">
                <button
                    onClick={() => setActiveIssueId(null)}
                    className="flex items-center gap-2 text-secondary-custom hover:text-[var(--accent-blue-bright)] transition-colors font-mono text-sm uppercase tracking-widest group px-2 py-1"
                >
                    <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Ledger
                </button>
            </div>

            {/* Flowchart Area */}
            <div className="flex-1 relative">
                <IssueFlowchart key={activeIssueId} issueId={activeIssueId} />
            </div>
        </div>
    )
}
