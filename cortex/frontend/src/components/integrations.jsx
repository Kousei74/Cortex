import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { api } from "@/lib/api"
import { FADE_IN } from "@/lib/animations"
import { toast } from "sonner"
import IssueFlowchart from "./issue-flowchart"
import { useAuth } from "@/context/AuthContext"

export default function Integrations() {
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
            if (data.length > 0 && !activeIssueId) {
                // Auto-select first if none selected
                setActiveIssueId(data[0].issue_id)
            } else if (data.length === 0) {
                setActiveIssueId(null)
            }
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
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
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

    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* Left Sidebar - Issue List */}
            <div className="w-[400px] border-r border-subtle-custom bg-surface-custom/30 flex flex-col flex-shrink-0">
                {/* Header & Toggle */}
                <div className="p-6 border-b border-subtle-custom">
                    <h2 className="text-2xl font-mono font-bold text-primary-custom tracking-wider uppercase mb-6">
                        Execution Ledger
                    </h2>

                    <div className="flex p-1 bg-surface-custom border border-subtle-custom fluid-rounded gap-1">
                        <button
                            onClick={() => setStatusFilter("open")}
                            className={`flex-1 py-2 text-xs font-mono font-bold uppercase tracking-widest fluid-rounded transition-all duration-300 ${statusFilter === "open"
                                ? "bg-[var(--accent-blue-bright)] text-primary-custom shadow-[0_0_15px_rgba(0,191,255,0.3)]"
                                : "text-secondary-custom hover:text-primary-custom"
                                }`}
                        >
                            Active
                        </button>
                        <button
                            onClick={() => setStatusFilter("closed")}
                            className={`flex-1 py-2 text-xs font-mono font-bold uppercase tracking-widest fluid-rounded transition-all duration-300 ${statusFilter === "closed"
                                ? "bg-[var(--accent-blue-bright)] text-primary-custom shadow-[0_0_15px_rgba(0,191,255,0.3)]"
                                : "text-secondary-custom hover:text-primary-custom"
                                }`}
                        >
                            Closed
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                    <AnimatePresence mode="popLayout">
                        {isLoading ? (
                            <motion.div {...FADE_IN} className="flex justify-center p-8">
                                <div className="w-6 h-6 border-2 border-[var(--accent-blue-bright)] border-t-transparent rounded-full animate-spin" />
                            </motion.div>
                        ) : issues.length === 0 ? (
                            <motion.div {...FADE_IN} className="text-center p-8 text-secondary-custom font-mono text-sm">
                                NO {statusFilter.toUpperCase()} ISSUES FOUND
                            </motion.div>
                        ) : (
                            issues.map((issue) => {
                                const isActive = activeIssueId === issue.issue_id
                                return (
                                    <motion.button
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        key={issue.issue_id}
                                        onClick={() => setActiveIssueId(issue.issue_id)}
                                        className={`w-full text-left p-4 fluid-rounded border transition-all duration-300 relative overflow-hidden group ${isActive
                                            ? "bg-surface-custom border-[var(--accent-blue-bright)] shadow-[0_0_20px_rgba(0,191,255,0.15)]"
                                            : "bg-surface-custom/50 border-subtle-custom hover:border-secondary-custom/50 hover:bg-surface-custom"
                                            }`}
                                    >
                                        {isActive && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--accent-blue-bright)] shadow-[0_0_10px_rgba(0,191,255,0.8)]" />
                                        )}

                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-mono text-sm font-bold text-primary-custom truncate pr-4">
                                                {issue.header}
                                            </h3>
                                            <div className="flex-shrink-0 flex gap-2">
                                                <span
                                                    className="w-2 h-2 rounded-full mt-1.5"
                                                    style={{
                                                        background: getPriorityColor(issue.priority),
                                                        boxShadow: `0 0 6px ${getPriorityColor(issue.priority)}`
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center text-xs font-mono">
                                            <span className="text-[var(--accent-blue-bright)] font-bold tracking-wider">
                                                {issue.issue_id}
                                            </span>
                                            <span className="text-secondary-custom/80 uppercase tracking-widest text-[10px]">
                                                {issue.assigned_team || "UNASSIGNED"}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center mt-3 text-[10px] font-mono text-secondary-custom/60 uppercase tracking-widest">
                                            <span>{formatDate(issue.last_activity)}</span>
                                            {statusFilter === "closed" && (
                                                <span className="text-[var(--semantic-error)]">CLOSED</span>
                                            )}
                                        </div>
                                    </motion.button>
                                )
                            })
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Right Main Area - Flowchart Placeholder */}
            <div className="flex-1 bg-[var(--bg-card)] relative overflow-hidden flex flex-col">
                {activeIssueId ? (
                    <IssueFlowchart key={activeIssueId} issueId={activeIssueId} />
                ) : (
                    <div className="flex-1 flex items-center justify-center text-secondary-custom font-mono">
                        Select an issue from the execution ledger.
                    </div>
                )}
            </div>
        </div>
    )
}
