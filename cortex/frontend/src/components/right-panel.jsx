import { useState, useEffect, useRef, useCallback } from "react"
import { Card } from "@/components/ui/card"
import SlackIcon from "@/assets/slack.svg?react"

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

// ─── Slack storage keys ───────────────────────────────────────────────────────
const SLACK_TOKEN_KEY = "cortex_slack_token"
const SLACK_SIGNIN_TS = "cortex_slack_signin_ts"
const SLACK_MESSAGES_KEY = "cortex_slack_messages"
const API_BASE = "http://localhost:8000"

// ─── Review Explorer Card ─────────────────────────────────────────────────────
function ReviewExplorer() {
    const [issues, setIssues] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchIssues = useCallback(async () => {
        try {
            const token = localStorage.getItem("cortex_token")
            const headers = token ? { Authorization: `Bearer ${token}` } : {}
            const r = await fetch(`${API_BASE}/service/issues?limit=10`, { headers })
            if (r.ok) {
                const data = await r.json()
                setIssues(data)
            }
        } catch (_) {
            // silently fail — sidebar is non-critical
        } finally {
            setLoading(false)
        }
    }, [])

    // initial fetch + poll every 30s
    useEffect(() => {
        fetchIssues()
        const t = setInterval(fetchIssues, 30_000)
        return () => clearInterval(t)
    }, [fetchIssues])

    return (
        <Card className="bg-primary-custom border-subtle-custom flex-1 flex flex-col overflow-hidden fluid-rounded-lg soft-shadow">
            <div className="px-4 py-3 border-b border-subtle-custom">
                <h3 className="text-lg font-mono font-bold text-primary-custom uppercase">Review Explorer</h3>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4 custom-scrollbar">
                {loading && (
                    <p className="text-secondary-custom text-xs font-mono text-center py-2">Loading…</p>
                )}

                {!loading && issues.length === 0 && (
                    <p className="text-secondary-custom text-xs font-mono text-center py-2">
                        No issues filed yet.
                    </p>
                )}

                {issues.map((issue) => {
                    const meta = getPriorityMeta(issue.priority)
                    const header = issue.header || issue.subheader || "—"
                    const relDate = issue.date
                        ? new Date(issue.date).toLocaleDateString("en-GB", {
                            day: "2-digit", month: "short"
                        })
                        : "—"

                    return (
                        <div key={issue.issue_id} className="space-y-1.5">
                            <div className="flex items-center space-x-2">
                                {/* Priority dot with initial */}
                                <div
                                    className="w-6 h-6 fluid-rounded flex items-center justify-center flex-shrink-0"
                                    style={{
                                        background: meta.color,
                                        boxShadow: `0 0 8px ${meta.color}80`,
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
                                    {issue.priority?.toUpperCase() ?? "—"}
                                </span>

                                <span className="text-secondary-custom text-xs font-mono ml-auto">
                                    {relDate}
                                </span>
                            </div>

                            {/* Full issue header visible */}
                            <p className="text-primary-custom text-sm leading-snug break-words">
                                {header}
                            </p>
                        </div>
                    )
                })}
            </div>
        </Card>
    )
}

// ─── Slack Panel Card ─────────────────────────────────────────────────────────
const MAX_SLACK_MESSAGES = 10

function SlackPanel() {
    const [token, setToken] = useState(() => localStorage.getItem(SLACK_TOKEN_KEY) || null)
    const [messages, setMessages] = useState(() => {
        try { return JSON.parse(localStorage.getItem(SLACK_MESSAGES_KEY) || "[]") } catch { return [] }
    })
    const [connecting, setConnecting] = useState(false)
    const signinTs = useRef(parseFloat(localStorage.getItem(SLACK_SIGNIN_TS) || "0"))

    // ── Check URL for token handoff from OAuth callback ──────────────────────
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const t = params.get("slack_token")
        const err = params.get("slack_error")

        if (t) {
            const now = Date.now() / 1000
            localStorage.setItem(SLACK_TOKEN_KEY, t)
            localStorage.setItem(SLACK_SIGNIN_TS, String(now))
            signinTs.current = now
            setToken(t)

            // Clean the URL
            const url = new URL(window.location.href)
            url.searchParams.delete("slack_token")
            window.history.replaceState({}, "", url.toString())
        } else if (err) {
            const url = new URL(window.location.href)
            url.searchParams.delete("slack_error")
            window.history.replaceState({}, "", url.toString())
        }
    }, [])

    // ── Fetch new messages (since sign-in timestamp) ─────────────────────────
    const fetchMessages = useCallback(async (currentToken) => {
        if (!currentToken) return
        try {
            const oldest = signinTs.current || 0
            const r = await fetch(
                `${API_BASE}/service/slack/messages?token=${encodeURIComponent(currentToken)}&oldest=${oldest}&limit=${MAX_SLACK_MESSAGES}`
            )
            if (!r.ok) {
                if (r.status === 401) {
                    // Token expired / revoked
                    localStorage.removeItem(SLACK_TOKEN_KEY)
                    setToken(null)
                }
                return
            }
            const data = await r.json()
            setMessages(prev => {
                // Merge keeping FIFO order, de-duplicate by ts
                const existingTs = new Set(prev.map(m => m.ts))
                const incoming = data.filter(m => !existingTs.has(m.ts))
                const merged = [...prev, ...incoming]
                const capped = merged.slice(-MAX_SLACK_MESSAGES) // FIFO cap
                localStorage.setItem(SLACK_MESSAGES_KEY, JSON.stringify(capped))
                return capped
            })
        } catch (_) { /* non-critical */ }
    }, [])

    // Poll every 15s when authenticated
    useEffect(() => {
        if (!token) return
        fetchMessages(token)
        const t = setInterval(() => fetchMessages(token), 15_000)
        return () => clearInterval(t)
    }, [token, fetchMessages])

    const handleSignIn = () => {
        setConnecting(true)
        window.location.href = `${API_BASE}/service/slack/authorize`
    }

    const handleSignOut = () => {
        localStorage.removeItem(SLACK_TOKEN_KEY)
        localStorage.removeItem(SLACK_SIGNIN_TS)
        localStorage.removeItem(SLACK_MESSAGES_KEY)
        signinTs.current = 0
        setToken(null)
        setMessages([])
    }

    return (
        <Card className="bg-primary-custom border-subtle-custom flex-1 flex flex-col overflow-hidden fluid-rounded-lg soft-shadow">
            <div className="px-4 py-3 border-b border-subtle-custom flex items-center justify-between">
                <h3 className="text-lg font-mono font-bold text-primary-custom uppercase flex items-center gap-2">
                    <SlackIcon
                        className="text-secondary-custom"
                        style={{ width: 16, height: 16, fill: "currentColor" }}
                    />
                    Slack
                </h3>
                {token && (
                    <button
                        onClick={handleSignOut}
                        className="text-[10px] font-mono text-secondary-custom/50 hover:text-[var(--semantic-error)] transition-colors uppercase tracking-wider"
                    >
                        Disconnect
                    </button>
                )}
            </div>

            {/* ── Not signed in ── */}
            {!token && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">
                    {/* Icon container — frosted circle matching auth-flow icon style */}
                    <div className="w-16 h-16 frosted-glass border border-subtle-custom fluid-rounded-xl
                        flex items-center justify-center
                        shadow-[0_0_24px_rgba(0,191,255,0.08)]">
                        <SlackIcon
                            className="text-primary-custom"
                            style={{ width: 28, height: 28, fill: "currentColor" }}
                        />
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
                        disabled={connecting}
                        className="flex items-center gap-2.5 px-5 py-2.5
                            frosted-glass border border-subtle-custom fluid-rounded
                            text-primary-custom font-mono text-sm font-bold uppercase tracking-wider
                            hover:border-[var(--accent-blue-bright)] hover:text-[var(--accent-blue-bright)]
                            hover:shadow-[0_0_12px_rgba(0,191,255,0.15)]
                            transition-all duration-300 disabled:opacity-50"
                    >
                        <SlackIcon
                            className="flex-shrink-0"
                            style={{ width: 14, height: 14, fill: "currentColor" }}
                        />
                        {connecting ? "Connecting…" : "Sign in with Slack"}
                    </button>
                </div>
            )}

            {/* ── Signed in ── */}
            {token && (
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

// ─── Slack SVG Logo — monochrome hashmark, matches site icon language ─────────
function SlackLogo({ size = 20, className = "" }) {
    // Slack's modern hashmark logo — two horizontal + two vertical rounded-pill arms
    // Rendered as a single compound path, monochrome, inherits site text colour
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 127 127"
            fill="currentColor"
            className={className}
            xmlns="http://www.w3.org/2000/svg"
        >
            {/*
                The Slack logo is 4 rounded rectangles (pills) arranged in a # grid.
                Each arm is a rounded rect. The overlapping corners form the centre knot.
                Based on Slack's official brand SVG, simplified to monochrome paths.
            */}

            {/* Vertical left arm — top nub + body */}
            <path d="M27.2 80a13.6 13.6 0 1 1-27.2 0 13.6 13.6 0 0 1 27.2 0z" />
            <path d="M13.6 52.8h40.8a13.6 13.6 0 0 1 0 27.2H13.6a13.6 13.6 0 0 1 0-27.2z" />

            {/* Horizontal top arm — left nub + body */}
            <path d="M47.2 13.6a13.6 13.6 0 1 1 0 27.2 13.6 13.6 0 0 1 0-27.2z" />
            <path d="M47.2 27.2v40.8a13.6 13.6 0 0 1-27.2 0V27.2a13.6 13.6 0 0 1 27.2 0z" />

            {/* Vertical right arm — bottom nub + body */}
            <path d="M99.8 47.2A13.6 13.6 0 1 1 127 47.2a13.6 13.6 0 0 1-27.2 0z" />
            <path d="M113.4 74.4H72.6a13.6 13.6 0 0 1 0-27.2h40.8a13.6 13.6 0 0 1 0 27.2z" />

            {/* Horizontal bottom arm — right nub + body */}
            <path d="M79.8 113.4a13.6 13.6 0 1 1 0-27.2 13.6 13.6 0 0 1 0 27.2z" />
            <path d="M79.8 99.8V59a13.6 13.6 0 0 1 27.2 0v40.8a13.6 13.6 0 0 1-27.2 0z" />
        </svg>
    )
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
