import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { CortexLoader } from "./cortex-loader"
import { Card } from "@/components/ui/card"
import { ShieldCheck } from "lucide-react"
import slackLogo from "@/assets/slack.svg"

// ─── Priority config ──────────────────────────────────────────────────────────
const PRIORITY_META = {
    critical: { color: "#ff3b30", initial: "C" },
    high: { color: "#ff9500", initial: "H" },
    mid: { color: "#ffbf00", initial: "M" },
    low: { color: "#34c759", initial: "L" },
}

// Fallback for unknown/legacy priorities
function getPriorityMeta(priority) {
    return PRIORITY_META[priority?.toLowerCase()] ?? { color: "#888", initial: "?" }
}

// ─── Legacy Slack storage keys (cleanup only) ────────────────────────────────
const LEGACY_SLACK_TOKEN_KEY = "cortex_slack_token"
const LEGACY_SLACK_SIGNIN_TS = "cortex_slack_signin_ts"
const LEGACY_SLACK_MESSAGES_KEY = "cortex_slack_messages"

import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"
import { useNavigate } from "react-router-dom"
import { Copy } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

// ─── Review Explorer Card ─────────────────────────────────────────────────────
function ReviewExplorer() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [issues, setIssues] = useState([])
    const [loading, setLoading] = useState(true)

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

    const fetchIssues = useCallback(async () => {
        if (!user) return;
        try {
            const data = await api.getIssues("open", 10, user.dept_id, user.emp_id, user.user_role || user.role);
            setIssues(data);
        } catch (_) {
            // silently fail
        } finally {
            setLoading(false)
        }
    }, [user])

    // initial fetch + poll every 30s
    useEffect(() => {
        fetchIssues()
        const t = setInterval(fetchIssues, 30_000)
        
        // Immediate fetch on tab focus for fast feedback
        const handleFocus = () => fetchIssues()
        window.addEventListener("focus", handleFocus)

        return () => {
            clearInterval(t)
            window.removeEventListener("focus", handleFocus)
        }
    }, [fetchIssues])

    return (
        <Card className="bg-primary-custom border-subtle-custom flex-1 flex flex-col overflow-hidden fluid-rounded-lg soft-shadow">
            <div className="px-4 py-3 border-b border-subtle-custom">
                <h3 className="text-lg font-mono font-bold text-primary-custom uppercase">Review Explorer</h3>
            </div>

            <div className={`flex-1 overflow-auto custom-scrollbar ${!loading && issues.length === 0 ? "flex flex-col" : "p-4 space-y-4"}`}>
                {loading && (
                    <div className="flex items-center justify-center p-8">
                        <CortexLoader />
                    </div>
                )}

                {!loading && issues.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
                        <div className="w-12 h-12 frosted-glass border border-subtle-custom fluid-rounded-lg
                            flex items-center justify-center
                            shadow-[0_0_16px_rgba(52,199,89,0.06)]">
                            <ShieldCheck
                                className="text-[var(--semantic-success)]"
                                style={{ width: 20, height: 20 }}
                                strokeWidth={1.5}
                            />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-primary-custom text-[10px] font-mono font-bold uppercase tracking-widest">
                                Status: Clear
                            </p>
                            <p className="text-secondary-custom text-[10px] font-mono leading-relaxed">
                                No active issues<br />detected in stream.
                            </p>
                        </div>
                    </div>
                )}

                {issues.map((issue) => {
                    const meta = getPriorityMeta(issue.priority)
                    const header = issue.header || issue.subheader || "—"
                    const relDate = issue.date || issue.created_at
                        ? new Date(issue.date || issue.created_at).toLocaleDateString("en-GB", {
                            day: "2-digit", month: "short"
                        })
                        : "—"
                        
                    const deadlineDate = issue.deadline
                        ? new Date(issue.deadline).toLocaleDateString("en-GB", {
                            day: "2-digit", month: "short"
                        })
                        : null;

                    return (
                        <div
                            key={issue.issue_id}
                            onClick={() => navigate('/issue-tracker', { state: { selectedIssueId: issue.issue_id } })}
                            onContextMenu={(e) => handleContextMenu(e, issue.issue_id)}
                            className="flex flex-col cursor-pointer p-3 -mx-2 fluid-rounded-lg transition-all duration-300 border border-transparent 
                                hover:bg-white/5 hover:border-subtle-custom hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)] group"
                        >
                            {/* Line 1: Tag + ID (Left) | Creation Date (Right) */}
                            <div className="flex items-center justify-between w-full mb-1">
                                <div className="flex items-center space-x-2">
                                    <div
                                        className="w-5 h-5 fluid-rounded flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
                                        style={{
                                            background: meta.color,
                                            boxShadow: `0 0 10px ${meta.color}60`,
                                        }}
                                    >
                                        <span className="text-white text-[8px] font-bold font-mono">
                                            {meta.initial}
                                        </span>
                                    </div>
                                    <span
                                        className="font-mono text-xs font-bold uppercase tracking-wider"
                                        style={{ color: meta.color }}
                                    >
                                        {issue.issue_id}
                                    </span>
                                </div>
                                <span className="text-secondary-custom text-[10px] font-mono tracking-wide">
                                    {relDate}
                                </span>
                            </div>

                            {/* Line 2: Header (Left) | Deadline (Right) */}
                            <div className="flex items-center justify-between w-full gap-4">
                                <p className="text-primary-custom text-sm font-bold leading-tight truncate flex-1">
                                    {header}
                                </p>
                                {deadlineDate && (
                                    <span className="text-[#ff3b30] text-[10px] font-mono font-bold uppercase tracking-widest flex-shrink-0">
                                        {deadlineDate}
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                })}
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
        </Card>
    )
}

// ─── Slack Panel Card ─────────────────────────────────────────────────────────
const MAX_SLACK_MESSAGES = 10

function SlackPanel() {
    const { user } = useAuth()
    const [isConnected, setIsConnected] = useState(false)
    const [messages, setMessages] = useState([])
    const [connecting, setConnecting] = useState(false)
    const [statusLoading, setStatusLoading] = useState(true)
    const connectedAtRef = useRef(0)

    const resetSlackState = useCallback(() => {
        setIsConnected(false)
        setMessages([])
        setConnecting(false)
        connectedAtRef.current = 0
    }, [])

    const refreshSlackStatus = useCallback(async () => {
        if (!user) {
            resetSlackState()
            setStatusLoading(false)
            return
        }

        try {
            const status = await api.getSlackStatus()
            const connected = Boolean(status.connected)
            setIsConnected(connected)
            connectedAtRef.current = status.connected_at ? (Date.parse(status.connected_at) / 1000) : 0
            if (!connected) {
                setMessages([])
            }
        } catch (_) {
            resetSlackState()
        } finally {
            setStatusLoading(false)
            setConnecting(false)
        }
    }, [resetSlackState, user])

    useEffect(() => {
        localStorage.removeItem(LEGACY_SLACK_TOKEN_KEY)
        localStorage.removeItem(LEGACY_SLACK_SIGNIN_TS)
        localStorage.removeItem(LEGACY_SLACK_MESSAGES_KEY)
    }, [])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const slackStatus = params.get("slack")
        const slackError = params.get("slack_error")
        if (!slackStatus && !slackError) {
            return
        }

        if (slackStatus === "connected") {
            toast.success("Slack connected successfully.")
        } else if (slackError) {
            toast.error("Slack connection failed", {
                description: slackError.replace(/_/g, " "),
            })
        }

        const url = new URL(window.location.href)
        url.searchParams.delete("slack")
        url.searchParams.delete("slack_error")
        window.history.replaceState({}, "", url.toString())
    }, [])

    useEffect(() => {
        refreshSlackStatus()
    }, [refreshSlackStatus])

    const fetchMessages = useCallback(async () => {
        if (!isConnected) return
        try {
            const oldest = connectedAtRef.current || 0
            const data = await api.getSlackMessages(oldest, MAX_SLACK_MESSAGES)
            setMessages(data)
        } catch (error) {
            const detail = String(error?.message || "").toLowerCase()
            if (
                detail.includes("slack session expired") ||
                detail.includes("slack is not connected") ||
                detail.includes("failed to fetch slack messages")
            ) {
                resetSlackState()
            }
        }
    }, [isConnected, resetSlackState])

    useEffect(() => {
        if (!isConnected) return
        fetchMessages()
        const intervalId = setInterval(fetchMessages, 15_000)
        return () => clearInterval(intervalId)
    }, [isConnected, fetchMessages])

    const handleSignIn = async () => {
        try {
            setConnecting(true)
            const data = await api.getSlackAuthorizeUrl()
            window.location.href = data.authorize_url
        } catch (error) {
            setConnecting(false)
            toast.error("Slack connection failed", { description: error.message })
        }
    }

    const handleSignOut = async () => {
        try {
            await api.disconnectSlack()
        } catch (error) {
            toast.error("Slack disconnect failed", { description: error.message })
            return
        }
        resetSlackState()
    }

    return (
        <Card className="bg-primary-custom border-subtle-custom flex-1 flex flex-col overflow-hidden fluid-rounded-lg soft-shadow">
            <div className="px-4 py-3 border-b border-subtle-custom flex items-center justify-between">
                <h3 className="text-lg font-mono font-bold text-primary-custom uppercase flex items-center gap-2">
                    <SlackLogo size={20} className="text-secondary-custom" />
                    Slack
                </h3>
                {isConnected && (
                    <button
                        onClick={handleSignOut}
                        className="text-[10px] font-mono text-secondary-custom/50 hover:text-[var(--semantic-error)] transition-colors uppercase tracking-wider"
                    >
                        Disconnect
                    </button>
                )}
            </div>

            {/* ── Not signed in ── */}
            {!isConnected && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">
                    {/* Icon container — frosted circle matching auth-flow icon style */}
                    <div className="w-16 h-16 frosted-glass border border-subtle-custom fluid-rounded-xl
                        flex items-center justify-center
                        shadow-[0_0_24px_rgba(0,191,255,0.08)]">
                        <SlackLogo size={48} className="text-primary-custom" />
                    </div>

                    <div className="text-center space-y-1">
                        <p className="text-primary-custom text-sm font-mono font-bold uppercase tracking-widest">
                            Slack
                        </p>
                        <p className="text-secondary-custom text-xs font-mono leading-relaxed">
                            Connect to see live<br />channel notifications.
                        </p>
                    </div>

                    <button
                        onClick={handleSignIn}
                        disabled={connecting || statusLoading || !user}
                        className="flex items-center gap-2.5 px-5 py-2.5
                            frosted-glass border border-subtle-custom fluid-rounded
                            text-primary-custom font-mono text-sm font-bold uppercase tracking-wider
                            hover:border-[var(--accent-blue-bright)] hover:text-[var(--accent-blue-bright)]
                            hover:shadow-[0_0_12px_rgba(0,191,255,0.15)]
                            transition-all duration-300 disabled:opacity-50"
                    >
                        <SlackLogo size={18} className="flex-shrink-0" />
                        {statusLoading ? "Checking…" : connecting ? "Connecting…" : "Sign in with Slack"}
                    </button>
                </div>
            )}

            {/* ── Signed in ── */}
            {isConnected && (
                <div className="flex-1 overflow-auto p-4 space-y-3 custom-scrollbar">
                    {messages.length === 0 && (
                        <p className="text-secondary-custom text-xs font-mono text-center py-2">
                            Waiting for new messages…
                        </p>
                    )}

                    {messages.map((msg, i) => (
                        <div
                            key={`${msg.ts}-${i}`}
                            className="space-y-1 select-none pointer-events-none"
                        >
                            <div className="flex items-center gap-1.5">
                                <span className="text-[var(--accent-blue-bright)] font-mono text-xs">#</span>
                                <span className="text-secondary-custom text-xs font-mono">{msg.channel}</span>
                                <span className="ml-auto text-[10px] font-mono text-secondary-custom/40">
                                    {new Date(msg.ts * 1000).toLocaleTimeString("en-US", {
                                        hour: "2-digit", minute: "2-digit", hour12: false
                                    })}
                                </span>
                            </div>
                            <p className="text-primary-custom text-sm leading-snug break-words">
                                {msg.text}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    )
}

// ─── Slack Animated Logo — Lottie-based ─────────
function SlackLogo({ size = 20, className = "" }) {
    return (
        <img 
            src={slackLogo} 
            alt="Slack" 
            className={className}
            style={{ width: size, height: size, filter: "brightness(0) invert(1)" }}
        />
    );
}

// ─── Root Component ───────────────────────────────────────────────────────────
export default function RightPanel() {
    const [time, setTime] = useState(new Date())
    const [locationData, setLocationData] = useState({
        city: "LOCATING...", state: "", country: "", offset: ""
    })

    // Clock
    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(t)
    }, [])

    // Geolocation + Timezone
    useEffect(() => {
        const offsetMinutes = new Date().getTimezoneOffset()
        const sign = offsetMinutes > 0 ? "-" : "+"
        const absOff = Math.abs(offsetMinutes)
        const hrs = Math.floor(absOff / 60).toString().padStart(2, "0")
        const mins = (absOff % 60).toString().padStart(2, "0")
        setLocationData(prev => ({ ...prev, offset: `UTC${sign}${hrs}:${mins}` }))

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(async ({ coords }) => {
                try {
                    const r = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`
                    )
                    const d = await r.json()
                    setLocationData(prev => ({
                        ...prev,
                        city: d.locality || d.city || "UNKNOWN",
                        state: d.principalSubdivision || "",
                        country: d.countryName || "",
                    }))
                } catch {
                    setLocationData(prev => ({ ...prev, city: "UNAVAILABLE" }))
                }
            }, () => {
                setLocationData(prev => ({ ...prev, city: "PERMISSION DENIED" }))
            })
        } else {
            setLocationData(prev => ({ ...prev, city: "NOT SUPPORTED" }))
        }
    }, [])

    const formattedTime = time.toLocaleTimeString("en-US", {
        hour12: false, hour: "2-digit", minute: "2-digit"
    })

    return (
        <div className="h-full bg-surface-custom border-l border-subtle-custom flex flex-col">

            {/* CLOCK */}
            <div className="p-6 border-b border-subtle-custom flex flex-col items-center justify-center text-center">
                <div className="text-5xl font-mono font-bold text-primary-custom">{formattedTime}</div>
                <div className="text-secondary-custom text-sm font-mono mt-2 space-y-1">
                    <div>{locationData.offset}</div>
                    <div>
                        {locationData.city.toUpperCase()}
                        {locationData.state ? `, ${locationData.state.toUpperCase()}` : ""}
                    </div>
                    <div>{locationData.country.toUpperCase()}</div>
                </div>
            </div>

            {/* CARDS */}
            <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
                <ReviewExplorer />
                <SlackPanel />
            </div>
        </div>
    )
}
