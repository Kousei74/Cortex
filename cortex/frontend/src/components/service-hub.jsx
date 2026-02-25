import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FADE_IN } from "@/lib/animations"
import { api } from "@/lib/api"
import { toast } from "sonner"

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
                    focus:shadow-[0_0_0_3px_rgba(0,191,255,0.2)] transition-all duration-300 resize-none"
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
                    hover:border-[var(--accent-blue-bright)] transition-all duration-300 group"
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

function NewIssueForm({ onSubmit, isLoading }) {
    const [form, setForm] = useState({
        issueHeader: "",
        deptId: "",
        empId: "",
        priority: "",
        description: "",
        createdBy: "",
    })
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
            dept_id: form.deptId.trim() || null,
            emp_id: form.empId.trim() || null,
            priority: form.priority,
            description: form.description.trim(),
            created_by: form.createdBy.trim() || null,
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

            {/* Date — read-only live */}
            <div>
                <FieldLabel>Date</FieldLabel>
                <LiveDateDisplay />
            </div>

            {/* DeptID + EmpID — side by side */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <FieldLabel>Dept ID</FieldLabel>
                    <StyledInput
                        type="text"
                        placeholder="e.g. ENG-01"
                        value={form.deptId}
                        onChange={set("deptId")}
                        icon={Icons.dept}
                    />
                </div>
                <div>
                    <FieldLabel optional>Emp ID</FieldLabel>
                    <StyledInput
                        type="text"
                        placeholder="e.g. EMP-042"
                        value={form.empId}
                        onChange={set("empId")}
                        icon={Icons.id}
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

            {/* Created By */}
            <div>
                <FieldLabel optional>Created By (Emp ID)</FieldLabel>
                <StyledInput
                    type="text"
                    placeholder="Your Employee ID"
                    value={form.createdBy}
                    onChange={set("createdBy")}
                    icon={Icons.user}
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

// ─── Existing Issue Form ───────────────────────────────────────────

function ExistingIssueForm({ onSubmit, isLoading }) {
    const [form, setForm] = useState({
        parentIssueId: "",
        issueSubHeader: "",
        deptId: "",
        priority: "",
        description: "",
        createdBy: "",
        parentPriority: "", // fetched / entered to derive child constraints
    })
    const [error, setError] = useState(null)

    const set = (k) => (e) => setForm(f => ({ ...f, [k]: typeof e === "string" ? e : e.target.value }))

    // When parent issue ID is blurred, the parent priority might be fetched in future.
    // For now, the user specifies parentPriority so we can derive child constraint.
    const childAllowed = form.parentPriority
        ? allowedChildPriorities(form.parentPriority)
        : null

    const validate = () => {
        if (!form.parentIssueId.trim()) return "Parent Issue ID is required."
        if (!form.issueSubHeader.trim()) return "Issue Sub-Header is required."
        if (!form.priority) return "Priority is required."
        if (!form.description.trim()) return "Issue Description is required."
        if (form.priority && childAllowed && !childAllowed.includes(form.priority))
            return `Priority must be ${childAllowed.map(p => p.toUpperCase()).join(" / ")} (inherited constraint).`
        return null
    }

    const handleSubmit = async () => {
        const err = validate()
        if (err) { setError(err); return }
        setError(null)

        const payload = {
            type: "existing",
            parent_issue_id: form.parentIssueId.trim(),
            issue_subheader: form.issueSubHeader.trim(),
            date: new Date().toISOString().split("T")[0],
            priority: form.priority,
            dept_id: form.deptId.trim() || null,
            description: form.description.trim(),
            created_by: form.createdBy.trim() || null,
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

            {/* Parent Issue ID */}
            <div>
                <FieldLabel>Parent Issue ID</FieldLabel>
                <StyledInput
                    type="text"
                    placeholder="e.g. ISS-2024-001"
                    value={form.parentIssueId}
                    onChange={set("parentIssueId")}
                    icon={Icons.link}
                />
            </div>

            {/* Parent Priority hint — to derive constraint */}
            <div>
                <FieldLabel optional>Parent Priority (for inheritance check)</FieldLabel>
                <PriorityDropdown
                    value={form.parentPriority}
                    onChange={(v) => setForm(f => ({ ...f, parentPriority: v, priority: "" }))}
                />
            </div>

            {/* Sub-header */}
            <div>
                <FieldLabel>Issue Sub-Header</FieldLabel>
                <StyledInput
                    type="text"
                    placeholder="Child issue headline"
                    value={form.issueSubHeader}
                    onChange={set("issueSubHeader")}
                    icon={Icons.header}
                    maxLength={120}
                />
            </div>

            {/* Date */}
            <div>
                <FieldLabel>Date</FieldLabel>
                <LiveDateDisplay />
            </div>

            {/* Priority — constrained */}
            <div>
                <FieldLabel>
                    Priority
                    {form.parentPriority && (
                        <span className="ml-2 text-[10px] text-[var(--semantic-warning)] font-mono uppercase">
                            ≥ {form.parentPriority}
                        </span>
                    )}
                </FieldLabel>
                <PriorityDropdown
                    value={form.priority}
                    onChange={(v) => setForm(f => ({ ...f, priority: v }))}
                    allowed={childAllowed}
                />
            </div>

            {/* DeptID */}
            <div>
                <FieldLabel>Dept ID</FieldLabel>
                <StyledInput
                    type="text"
                    placeholder="e.g. ENG-01"
                    value={form.deptId}
                    onChange={set("deptId")}
                    icon={Icons.dept}
                />
            </div>

            {/* Description */}
            <div>
                <FieldLabel>Issue Description</FieldLabel>
                <StyledTextarea
                    value={form.description}
                    onChange={set("description")}
                    placeholder="Describe the child issue… (max 500 characters)"
                    maxLength={500}
                />
            </div>

            {/* Created By */}
            <div>
                <FieldLabel optional>Created By (Emp ID)</FieldLabel>
                <StyledInput
                    type="text"
                    placeholder="Your Employee ID"
                    value={form.createdBy}
                    onChange={set("createdBy")}
                    icon={Icons.user}
                />
            </div>

            {/* Submit */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="w-full gradient-button text-white font-mono uppercase tracking-wider py-6 fluid-rounded soft-shadow text-base"
                >
                    {isLoading ? "LINKING ISSUE..." : "LINK CHILD ISSUE"}
                </Button>
            </motion.div>
        </motion.div>
    )
}

// ─── Root Component ────────────────────────────────────────────────

export default function ServiceHub() {
    const [activeTab, setActiveTab] = useState("new")
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (payload) => {
        setIsLoading(true)
        try {
            await api.createIssue(payload)
            toast.success(
                payload.type === "new"
                    ? "Issue filed successfully."
                    : "Child issue linked successfully.",
                { description: `ID will be returned by the server.` }
            )
        } catch (err) {
            toast.error("Failed to submit issue.", { description: err.message })
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
                    <h1 className="text-3xl font-mono font-bold text-primary-custom tracking-wider uppercase text-left">
                        Service Hub
                    </h1>
                    <p className="text-secondary-custom text-sm font-mono mt-2 text-left">
                        File a new issue or link a child to an existing one.
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
                    {/* Tab Switcher — mirrors auth-flow */}
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
                            New Issue
                        </TabsTrigger>
                        <TabsTrigger
                            value="existing"
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
                            Existing Issue
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="new" className="mt-0 focus-visible:ring-0 outline-none">
                        <NewIssueForm onSubmit={handleSubmit} isLoading={isLoading} />
                    </TabsContent>

                    <TabsContent value="existing" className="mt-0 focus-visible:ring-0 outline-none">
                        <ExistingIssueForm onSubmit={handleSubmit} isLoading={isLoading} />
                    </TabsContent>
                </Tabs>
            </motion.div>
        </div>
    )
}
