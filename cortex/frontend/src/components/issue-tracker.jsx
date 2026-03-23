import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useLocation, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { api } from "@/lib/api"
import { FADE_IN } from "@/lib/animations"
import { toast } from "sonner"
import IssueFlowchart from "./issue-flowchart"
import { CortexLoader } from "./cortex-loader"
import { useAuth } from "@/context/AuthContext"
import { Copy } from "lucide-react"
import { cn } from "@/lib/utils"

export default function IssueTracker() {
    const { user } = useAuth()
    const [statusFilter, setStatusFilter] = useState("open") // "open" or "closed"
    const [issues, setIssues] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const location = useLocation()
    const [activeIssueId, setActiveIssueId] = useState(location.state?.selectedIssueId || null)

    // Context Menu State
    const [contextMenu, setContextMenu] = useState(null)

    const handleContextMenu = (e, issueId) => {
        e.preventDefault()
        setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, issueId })
    }

    const handleCopy = () => {
        if (contextMenu?.issueId) {
            navigator.clipboard.writeText(contextMenu.issueId)
            toast.success(`Copied to clipboard: ${contextMenu.issueId}`)
        }
        setContextMenu(null)
    }

    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null)
        document.addEventListener("click", handleClickOutside)
        return () => document.removeEventListener("click", handleClickOutside)
    }, [])

    // Clear state on load so refreshing the page doesn't keep you locked in
    useEffect(() => {
        if (location.state?.selectedIssueId) {
            setActiveIssueId(location.state.selectedIssueId)
            // Replace the browser history state to clear the selectedIssueId so refresh works naturally
            window.history.replaceState({}, document.title)
        }
    }, [location.state?.selectedIssueId])

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
                            className="relative px-6 py-2 text-xs font-mono font-bold uppercase tracking-widest fluid-rounded transition-all duration-300 text-secondary-custom hover:text-primary-custom group"
                        >
                            {statusFilter === "open" && (
                                <motion.div
                                    layoutId="activeStatusFilter"
                                    className="absolute inset-0 bg-[var(--accent-blue-bright)] shadow-[0_0_15px_rgba(0,191,255,0.3)] fluid-rounded"
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <span className={cn("relative z-10", statusFilter === "open" ? "text-primary-custom" : "text-secondary-custom group-hover:text-primary-custom")}>
                                Active
                            </span>
                        </button>
                        <button
                            onClick={() => setStatusFilter("closed")}
                            className="relative px-6 py-2 text-xs font-mono font-bold uppercase tracking-widest fluid-rounded transition-all duration-300 text-secondary-custom hover:text-primary-custom group"
                        >
                            {statusFilter === "closed" && (
                                <motion.div
                                    layoutId="activeStatusFilter"
                                    className="absolute inset-0 bg-[var(--accent-blue-bright)] shadow-[0_0_15px_rgba(0,191,255,0.3)] fluid-rounded"
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <span className={cn("relative z-10", statusFilter === "closed" ? "text-primary-custom" : "text-secondary-custom group-hover:text-primary-custom")}>
                                Closed
                            </span>
                        </button>
                    </div>
                </div>

                {/* List Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 flex flex-col">
                    <AnimatePresence mode="wait">
                        {isLoading ? (
                            <motion.div key="loader" {...FADE_IN} className="flex-1 flex items-center justify-center min-h-[50vh]">
                                <CortexLoader />
                            </motion.div>
                        ) : issues.length === 0 ? (
                            <motion.div key="empty" {...FADE_IN} className="flex-1 flex items-center justify-center text-secondary-custom font-mono text-sm min-h-[50vh]">
                                NO {statusFilter.toUpperCase()} ISSUES FOUND
                            </motion.div>
                        ) : (
                            <motion.div key="grid" {...FADE_IN} className="max-w-6xl w-full mx-auto grid grid-cols-1 xl:grid-cols-2 gap-6 pb-8">
                                {issues.map((issue) => (
                                    <motion.button
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        key={issue.issue_id}
                                        onClick={() => setActiveIssueId(issue.issue_id)}
                                        onContextMenu={(e) => handleContextMenu(e, issue.issue_id)}
                                        className="w-full text-left p-6 fluid-rounded border transition-all duration-300 relative overflow-hidden group bg-surface-custom/50 border-subtle-custom soft-glow-hover min-h-[160px]"
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
                                                    {issue.deadline && (
                                                        <span className="text-secondary-custom/40">{" "}-{" "}{formatDate(issue.deadline)}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-end justify-end mt-auto pt-2 pl-4">
                                                <span className="text-secondary-custom/80 uppercase tracking-widest text-[11px] font-mono text-right break-words max-w-[150px] line-clamp-1 truncate">
                                                    {issue.assigned_teams?.length > 0 ? issue.assigned_teams.join(", ") : "UNASSIGNED"}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {contextMenu && createPortal(
                    <AnimatePresence>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="fixed z-[100] bg-[#1a1a1a]/90 backdrop-blur-md border border-subtle-custom rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden min-w-[160px] p-1.5"
                            style={{ top: contextMenu.mouseY, left: contextMenu.mouseX }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={handleCopy}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-mono font-bold text-primary-custom hover:bg-white/10 transition-colors duration-200 group"
                            >
                                <Copy className="w-4 h-4 text-secondary-custom group-hover:text-primary-custom transition-colors" />
                                Copy ID
                            </button>
                        </motion.div>
                    </AnimatePresence>,
                    document.body
                )}
            </div>
        )
    }

    // DETAIL VIEW (Flowchart)
    return (
        <div className="absolute inset-0 z-10 overflow-hidden bg-[var(--bg-card)]">
            {/* Floating Back Button */}
            <button
                onClick={() => setActiveIssueId(null)}
                className="absolute top-6 left-6 z-50 flex items-center gap-2 bg-[var(--bg-panel)] border border-subtle-custom rounded-full px-5 py-2.5 text-secondary-custom hover:text-[var(--accent-blue-bright)] soft-glow-hover transition-all duration-300 font-mono text-xs font-bold uppercase tracking-widest group shadow-lg"
            >
                <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
            </button>

            {/* Flowchart Area */}
            <div className="absolute inset-0">
                <IssueFlowchart key={activeIssueId} issueId={activeIssueId} />
            </div>
        </div>
    )
}
