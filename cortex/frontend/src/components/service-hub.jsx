import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FADE_IN } from "@/lib/animations"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext"
import DatePicker from "@/components/ui/date-picker"
import { TeamMultiSelect } from "@/components/ui/team-multi-select"

// ─── Priority config ───────────────────────────────────────────────
const PRIORITIES = [
    { value: "critical", label: "CRITICAL", color: "#ff3b30" },
    { value: "high", label: "HIGH", color: "#ff9500" },
    { value: "mid", label: "MID", color: "#ffbf00" },
    { value: "low", label: "LOW", color: "#34c759" },
]

const PRIORITY_ORDER = ["critical", "high", "mid", "low"]

// Returns priorities that are >= (same urgency or more urgent) than the parent
function allowedChildPriorities(parentPriority) {
    const parentIdx = PRIORITY_ORDER.indexOf(parentPriority)
    return PRIORITY_ORDER.slice(0, parentIdx + 1)
}

// ─── Shared Field Components ───────────────────────────────────────

function FieldLabel({ children, optional }) {
    return (
        <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-secondary-custom">
                {children}
            </span>
            {optional && (
                <span className="text-[10px] font-mono text-secondary-custom/40 uppercase tracking-wider">
                    optional
                </span>
            )}
        </div>
    )
}

function StyledInput({ icon, ...props }) {
    return (
        <div className="relative group">
            {icon && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-custom group-focus-within:text-[var(--accent-blue-bright)] transition-colors pointer-events-none">
                    {icon}
                </div>
            )}
            <Input
                {...props}
                className={`bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom/40
                    fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus
                    transition-all duration-300 h-11 font-mono text-sm
                    ${icon ? "pl-9" : "pl-4"}`}
            />
        </div>
    )
}

function StyledTextarea({ maxLength, value, onChange, placeholder }) {
    return (
        <div className="relative">
            <textarea
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                maxLength={maxLength}
                rows={4}
                className="w-full bg-surface-custom border border-subtle-custom text-primary-custom
                    placeholder:text-secondary-custom/40 fluid-rounded px-4 pt-3 pb-8 font-mono text-sm
                    focus:border-[var(--accent-blue-bright)] focus:outline-none
                    focus:shadow-[0_0_0_3px_rgba(0,191,255,0.2)] soft-glow-hover transition-all duration-300 resize-none"
            />
            <span
                className="absolute bottom-4 right-4 px-1.5 py-0.5
                    backdrop-blur-md bg-surface-custom/80 border border-subtle-custom
                    rounded text-[10px] font-mono text-secondary-custom/70
                    pointer-events-none select-none leading-none"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }}
            >
                {value.length}/{maxLength}
            </span>
        </div>
    )
}

function PriorityDropdown({ value, onChange, allowed = null }) {
    const [open, setOpen] = useState(false)
    const ref = useRef()

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    const options = allowed
        ? PRIORITIES.filter(p => allowed.includes(p.value))
        : PRIORITIES

    const selected = PRIORITIES.find(p => p.value === value)

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full h-11 px-4 bg-surface-custom border border-subtle-custom fluid-rounded
                    flex items-center justify-between font-mono text-sm
                    soft-glow-hover transition-all duration-300 group"
            >
                <div className="flex items-center gap-2">
                    {selected ? (
                        <>
                            <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: selected.color, boxShadow: `0 0 6px ${selected.color}` }}
                            />
                            <span className="text-primary-custom uppercase tracking-wider">{selected.label}</span>
                        </>
                    ) : (
                        <span className="text-secondary-custom/40">SELECT PRIORITY</span>
                    )}
                </div>
                <svg
                    className={`w-4 h-4 text-secondary-custom transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute top-[calc(100%+6px)] left-0 right-0 z-50
                            frosted-glass border border-subtle-custom fluid-rounded overflow-hidden soft-shadow-lg"
                    >
                        {options.map(p => (
                            <button
                                key={p.value}
                                type="button"
                                onClick={() => { onChange(p.value); setOpen(false) }}
                                className={`w-full px-4 py-3 flex items-center gap-3 font-mono text-sm
                                    hover:bg-[var(--accent-blue-bright)]/10 transition-colors duration-150
                                    ${value === p.value ? "bg-[var(--accent-blue-bright)]/5" : ""}`}
                            >
                                <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }}
                                />
                                <span className="uppercase tracking-wider text-primary-custom">{p.label}</span>
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Date Display (read-only, live) ───────────────────────────────

function LiveDateDisplay() {
    const [now, setNow] = useState(new Date())

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30000) // refresh every 30s
        return () => clearInterval(t)
    }, [])

    const formatted = now.toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric"
    }).toUpperCase()

    return (
        <div className="h-11 px-4 bg-surface-custom/60 border border-dashed border-subtle-custom
            fluid-rounded flex items-center gap-2 font-mono text-sm">
            <svg className="w-4 h-4 text-secondary-custom/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-secondary-custom">{formatted}</span>
            <span className="ml-auto text-[10px] text-secondary-custom/40 uppercase tracking-wider">auto</span>
        </div>
    )
}

// ─── Icons ─────────────────────────────────────────────────────────

const Icons = {
    header: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h6" /></svg>,
    id: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V4a2 2 0 114 0v2m-4 0a2 2 0 104 0" /></svg>,
    dept: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    user: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    link: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
}

// ─── New Issue Form ────────────────────────────────────────────────

function NewIssueForm({ onSubmit, isLoading, user }) {
    const [form, setForm] = useState({
        issueHeader: "",
        assignedTeams: user?.dept_id ? [user.dept_id] : [],
        priority: "",
        description: "",
        parentTicket: "",
        chainedTo: "",
        deadline: null,
    })

    useEffect(() => {
        if (user?.dept_id && !form.assignedTeams.includes(user.dept_id)) {
            setForm(f => ({
                ...f,
                assignedTeams: Array.from(new Set([...f.assignedTeams, user.dept_id]))
            }))
        }
    }, [user?.dept_id])
    const [error, setError] = useState(null)

    const set = (k) => (e) => setForm(f => ({ ...f, [k]: typeof e === "string" ? e : e.target.value }))

    const validate = () => {
        if (!form.issueHeader.trim()) return "Issue Header is required."
        if (!form.priority) return "Priority is required."
        if (!form.description.trim()) return "Issue Description is required."
        return null
    }

    const handleSubmit = async () => {
        const err = validate()
        if (err) { setError(err); return }
        setError(null)

        const payload = {
            type: "new",
            issue_header: form.issueHeader.trim(),
            date: new Date().toISOString().split("T")[0],
            assigned_teams: form.assignedTeams,
            priority: form.priority,
            description: form.description.trim(),
            created_by: user?.full_name || "System",
            emp_id: user?.emp_id || "unknown",
            dept_id: user?.dept_id || null,
            parent_ticket: form.parentTicket.trim() || null,
            chained_to: form.chainedTo.trim() || null,
            deadline: form.deadline ? form.deadline.toISOString().split("T")[0] : null,
        }
        await onSubmit(payload)
    }

    return (
        <motion.div {...FADE_IN} className="space-y-5">

            {/* Error Banner */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-3 bg-[var(--semantic-error)]/10 border border-[var(--semantic-error)]
                            rounded-xl text-[var(--semantic-error)] text-sm text-center font-mono
                            shadow-[0_0_10px_rgba(255,59,48,0.2)]">
                            {error}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Issue Header */}
            <div>
                <FieldLabel>Issue Header</FieldLabel>
                <StyledInput
                    type="text"
                    placeholder="Brief title of the issue"
                    value={form.issueHeader}
                    onChange={set("issueHeader")}
                    icon={Icons.header}
                    maxLength={120}
                />
            </div>

            {/* Date & Deadline */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <FieldLabel>Date</FieldLabel>
                    <LiveDateDisplay />
                </div>
                <div>
                    <FieldLabel optional>Deadline</FieldLabel>
                    <DatePicker
                        value={form.deadline}
                        onChange={(d) => setForm(f => ({ ...f, deadline: d }))}
                    />
                </div>
            </div>

            {/* Assigned Team */}
            <div>
                <FieldLabel optional>Additional Teams</FieldLabel>
                <TeamMultiSelect
                    selected={form.assignedTeams}
                    onChange={(val) => setForm(f => ({ ...f, assignedTeams: val }))}
                    immutableValues={user?.dept_id ? [user.dept_id] : []}
                    excludeValues={user?.dept_id ? [user.dept_id] : []}
                />
            </div>

            {/* Parent Ticket & Chained To */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <FieldLabel optional>Parent Ticket</FieldLabel>
                    <StyledInput
                        type="text"
                        placeholder="e.g. ISS-XXXX"
                        value={form.parentTicket}
                        onChange={set("parentTicket")}
                        icon={Icons.link}
                    />
                </div>
                <div>
                    <FieldLabel optional>Chained To</FieldLabel>
                    <StyledInput
                        type="text"
                        placeholder="e.g. ISS-YYYY"
                        value={form.chainedTo}
                        onChange={set("chainedTo")}
                        icon={Icons.link}
                    />
                </div>
            </div>

            {/* Priority */}
            <div>
                <FieldLabel>Priority</FieldLabel>
                <PriorityDropdown value={form.priority} onChange={(v) => setForm(f => ({ ...f, priority: v }))} />
            </div>

            {/* Description */}
            <div>
                <FieldLabel>Issue Description</FieldLabel>
                <StyledTextarea
                    value={form.description}
                    onChange={set("description")}
                    placeholder="Describe the issue in detail… (max 500 characters)"
                    maxLength={500}
                />
            </div>

            {/* Submit */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="w-full gradient-button text-white font-mono uppercase tracking-wider py-6 fluid-rounded soft-shadow text-base"
                >
                    {isLoading ? "FILING ISSUE..." : "FILE ISSUE"}
                </Button>
            </motion.div>
        </motion.div>
    )
}

// ─── Update Issue Form ─────────────────────────────────────────────

function UpdateIssueForm({ onSubmit, isLoading, user }) {
    const [issueId, setIssueId] = useState("")
    const [fetchedIssue, setFetchedIssue] = useState(null)
    const [isFetching, setIsFetching] = useState(false)
    
    // Form fields
    const [form, setForm] = useState({
        priority: "",
        assignedTeams: [],
        deadline: null,
    })
    const [error, setError] = useState(null)

    const handleFetch = async () => {
        if (!issueId.trim().startsWith("ISS-")) {
            setError("Must provide a valid root Issue ID (e.g. ISS-1234).")
            return
        }
        setIsFetching(true)
        setError(null)
        try {
            const data = await api.getIssue(issueId.trim())
            setFetchedIssue(data)
            setForm({
                priority: data.priority || "",
                assignedTeams: data.assigned_dept_ids || [],
                deadline: data.deadline ? new Date(data.deadline) : null
            })
        } catch (err) {
            setError("Issue not found or unauthorized.")
            setFetchedIssue(null)
        } finally {
            setIsFetching(false)
        }
    }

    const validate = () => {
        if (!form.priority) return "Priority is required."
        return null
    }

    const handleSubmit = async () => {
        const err = validate()
        if (err) { setError(err); return }
        setError(null)

        const payload = {
            priority: form.priority,
            assigned_dept_ids: form.assignedTeams,
            deadline: form.deadline ? form.deadline.toISOString().split("T")[0] : null,
        }
        await onSubmit(issueId.trim(), payload)
    }

    return (
        <motion.div {...FADE_IN} className="space-y-5">
            {/* Error Banner */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-3 bg-[var(--semantic-error)]/10 border border-[var(--semantic-error)]
                            rounded-xl text-[var(--semantic-error)] text-sm text-center font-mono
                            shadow-[0_0_10px_rgba(255,59,48,0.2)] mb-4">
                            {error}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Fetch controls */}
            <div className="flex gap-3 items-end">
                <div className="flex-1">
                    <FieldLabel>Root Issue ID</FieldLabel>
                    <StyledInput
                        type="text"
                        placeholder="e.g. ISS-XXXX"
                        value={issueId}
                        onChange={(e) => setIssueId(e.target.value)}
                        icon={Icons.link}
                    />
                </div>
                <Button 
                    onClick={handleFetch}
                    disabled={isFetching || !issueId.trim()}
                    variant="outline"
                    className="h-11 font-mono uppercase tracking-wider px-6 border border-subtle-custom text-secondary-custom hover:text-primary-custom hover:border-[var(--accent-blue-bright)] transition-colors bg-transparent"
                >
                    {isFetching ? "..." : "LOAD"}
                </Button>
            </div>

            {fetchedIssue && (
                <motion.div {...FADE_IN} className="space-y-5 mt-6 pt-6 border-t border-subtle-custom">
                    {/* Read Only Context */}
                    <div className="bg-surface-custom/50 p-4 fluid-rounded border border-subtle-custom">
                        <div className="font-mono text-[10px] text-secondary-custom/60 uppercase tracking-widest mb-2">Current Context (Immutable)</div>
                        <div className="font-mono text-primary-custom font-bold text-lg uppercase tracking-wide">{fetchedIssue.header}</div>
                        <div className="font-mono text-secondary-custom text-sm mt-3 line-clamp-3 leading-relaxed break-words">{fetchedIssue.description}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <FieldLabel>Priority</FieldLabel>
                            <PriorityDropdown value={form.priority} onChange={(v) => setForm(f => ({ ...f, priority: v }))} />
                        </div>
                        <div>
                            <FieldLabel optional>Deadline</FieldLabel>
                            <DatePicker
                                value={form.deadline}
                                onChange={(d) => setForm(f => ({ ...f, deadline: d }))}
                            />
                        </div>
                    </div>

                    <div>
                        <FieldLabel optional>Assigned Teams</FieldLabel>
                        <TeamMultiSelect
                            selected={form.assignedTeams}
                            onChange={(val) => setForm(f => ({ ...f, assignedTeams: val }))}
                        />
                    </div>

                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-2">
                        <Button
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="w-full gradient-button text-white font-mono uppercase tracking-wider py-6 fluid-rounded soft-shadow text-base"
                        >
                            {isLoading ? "UPDATING METADATA..." : "UPDATE ISSUE METADATA"}
                        </Button>
                    </motion.div>
                </motion.div>
            )}
        </motion.div>
    )
}

// ─── Root Component ────────────────────────────────────────────────

export default function ServiceHub() {
    const { user } = useAuth()
    const isSenior = user?.role === "senior"
    const [activeTab, setActiveTab] = useState("new")
    const [isLoading, setIsLoading] = useState(false)

    // Option 3 is exclusively for Seniors.
    if (!isSenior) {
        return (
            <div className="flex items-center justify-center w-full h-full p-8 text-center bg-[var(--bg-card)]">
                <div className="space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--semantic-error)]/10 text-[var(--semantic-error)] mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-mono font-bold text-[var(--semantic-error)] tracking-widest uppercase">Access Restricted</h2>
                    <p className="font-mono text-sm text-secondary-custom max-w-sm mx-auto">
                        Option 3 Governance interface is strictly reserved for Senior roles. Standard members must propose branches through Option 4 (Execution Ledger).
                    </p>
                </div>
            </div>
        )
    }

    const handleCreate = async (payload) => {
        setIsLoading(true)
        try {
            await api.createIssue(payload)
            toast.success("Issue filed successfully.", { description: `ID will be returned by the server.` })
            // Reset state could go here
        } catch (err) {
            toast.error("Failed to submit issue.", { description: err.message })
        } finally {
            setIsLoading(false)
        }
    }

    const handleUpdate = async (issueId, payload) => {
        setIsLoading(true)
        try {
            await api.updateNodeInfo(issueId, payload)
            toast.success("Metadata updated successfully.")
        } catch (err) {
            toast.error("Failed to update issue.", { description: err.message })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="p-8 h-full flex flex-col overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="mb-8 flex items-end justify-between flex-shrink-0">
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                    <h1 className="text-3xl font-mono font-bold text-primary-custom tracking-wider uppercase text-left">SERVICE HUB</h1>
                    <p className="text-secondary-custom text-sm font-mono mt-2 text-left">
                        Define root truth and govern issue assignments.
                    </p>
                </motion.div>
            </div>

            {/* Card */}
            <motion.div
                layout
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                className="w-full max-w-xl mx-auto frosted-glass soft-shadow-lg border border-subtle-custom fluid-rounded-xl p-8 overflow-hidden"
            >
                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-full"
                >
                    <TabsList className="flex w-full bg-transparent p-0 mb-8 border-b border-subtle-custom/20 gap-8 h-auto">
                        <TabsTrigger
                            value="new"
                            className="
                                    flex-1 pb-4 rounded-none bg-transparent shadow-none border-b-2 border-transparent
                                    font-mono text-base font-bold uppercase tracking-widest
                                    text-secondary-custom transition-all duration-300
                                    data-[state=active]:bg-transparent data-[state=active]:shadow-none
                                    data-[state=active]:text-[var(--accent-blue-bright)]
                                    data-[state=active]:border-[var(--accent-blue-bright)]
                                    data-[state=active]:[text-shadow:0_0_10px_rgba(0,191,255,0.5)]
                                    hover:text-primary-custom
                                "
                        >
                            Create Issue
                        </TabsTrigger>
                        <TabsTrigger
                            value="update"
                            className="
                                    flex-1 pb-4 rounded-none bg-transparent shadow-none border-b-2 border-transparent
                                    font-mono text-base font-bold uppercase tracking-widest
                                    text-secondary-custom transition-all duration-300
                                    data-[state=active]:bg-transparent data-[state=active]:shadow-none
                                    data-[state=active]:text-[var(--accent-blue-bright)]
                                    data-[state=active]:border-[var(--accent-blue-bright)]
                                    data-[state=active]:[text-shadow:0_0_10px_rgba(0,191,255,0.5)]
                                    hover:text-primary-custom
                                "
                        >
                            Update Metadata
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="new" className="mt-0 focus-visible:ring-0 outline-none">
                        <NewIssueForm onSubmit={handleCreate} isLoading={isLoading} user={user} />
                    </TabsContent>

                    <TabsContent value="update" className="mt-0 focus-visible:ring-0 outline-none">
                        <UpdateIssueForm onSubmit={handleUpdate} isLoading={isLoading} user={user} />
                    </TabsContent>
                </Tabs>
            </motion.div>
        </div>
    )
}
