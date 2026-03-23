import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useLocation, Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

const menuItems = [
    {
        id: "staging",
        path: "/",
        label: "DATA INGESTION",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
        ),
    },
    {
        id: "dashboard",
        path: "/dashboard",
        label: "COMMAND CENTER",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
            </svg>
        ),
    },
    {
        id: "service",
        path: "/service",
        label: "SERVICE HUB",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
            </svg>
        ),
    },
    {
        id: "issue-tracker",
        path: "/issue-tracker",
        label: "ISSUE TRACKER",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
            </svg>
        ),
    },
]

const DEPARTMENTS = [
    { value: "D01", label: "Dev1 (D01)" },
    { value: "D02", label: "Dev2 (D02)" },
    { value: "D03", label: "Dev3 (D03)" },
    { value: "D04", label: "CS1 (D04)" },
    { value: "D05", label: "CS2 (D05)" },
    { value: "D06", label: "Analyst (D06)" },
    { value: "D07", label: "Risk (D07)" },
]

function DepartmentDropdown({ value, onChange }) {
    const [open, setOpen] = useState(false)
    const ref = useRef()

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    const selected = DEPARTMENTS.find(d => d.value === value)

    return (
        <div ref={ref} className="relative w-full">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full h-11 px-4 bg-surface-custom border border-subtle-custom fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300 group flex items-center justify-between font-mono text-sm"
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {selected ? (
                        <span className="text-primary-custom whitespace-nowrap overflow-hidden text-ellipsis">{selected.label}</span>
                    ) : (
                        <span className="text-secondary-custom/40">Select Department</span>
                    )}
                </div>
                <svg
                    className={`w-4 h-4 text-secondary-custom transition-transform duration-200 flex-shrink-0 ${open ? "rotate-180" : ""}`}
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
                            bg-[#1a1c20]/95 backdrop-blur-md border border-subtle-custom fluid-rounded overflow-hidden soft-shadow-lg"
                    >
                        {DEPARTMENTS.map(d => (
                            <button
                                key={d.value}
                                type="button"
                                onClick={() => { onChange(d.value); setOpen(false) }}
                                className={`w-full px-4 py-3 text-left font-mono text-sm
                                    hover:bg-[var(--accent-blue-bright)]/10 transition-colors duration-150
                                    ${value === d.value ? "bg-[var(--accent-blue-bright)]/10 text-[var(--accent-blue-bright)] font-bold" : "text-primary-custom hover:text-white"}`}
                            >
                                {d.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default function Sidebar() {
    const location = useLocation()
    const { logout, user, setUser } = useAuth()

    // Profile Modal State
    const [showProfileModal, setShowProfileModal] = useState(false)
    const [editName, setEditName] = useState("")
    const [editDept, setEditDept] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    const openProfileModal = () => {
        setEditName(user?.full_name || "")
        setEditDept(user?.dept_id || "")
        setShowProfileModal(true)
    }

    const handleSaveProfile = async () => {
        if (!editName.trim()) {
            toast.error("Name cannot be empty")
            return
        }
        setIsSaving(true)
        try {
            const updatedUser = await api.updateProfile(editName, editDept)
            setUser(updatedUser)
            toast.success("Profile updated successfully")
            setShowProfileModal(false)
        } catch (err) {
            toast.error(err.message || "Failed to update profile")
        } finally {
            setIsSaving(false)
        }
    }

    // Basic active check logic - assuming exact match for root and startsWith for others
    const isActive = (path) => {
        if (path === "/") return location.pathname === "/"
        return location.pathname.startsWith(path)
    }

    return (
        <div className="h-full bg-surface-custom border-r border-subtle-custom flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-subtle-custom">
                <h1 className="text-3xl font-mono font-bold text-primary-custom tracking-wider">CORTEX</h1>
                <p className="text-sm text-secondary-custom mt-1 font-mono">Customer Insights OS</p>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {menuItems.map((item) => {
                    const active = isActive(item.path)
                    return (
                        <Link
                            key={item.id}
                            to={item.path}
                            className="relative block"
                        >
                            {active && (
                                <motion.div
                                    layoutId="activeSidebarBase"
                                    className="absolute inset-0 bg-[var(--accent-blue-dark)] border-l-4 border-[var(--accent-blue-bright)] soft-glow fluid-rounded"
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}

                            <div
                                className={cn(
                                    "relative z-10 flex items-center w-full p-4 font-mono text-sm transition-all duration-300 ease-in-out fluid-rounded hover:bg-white/5 hover:soft-glow-hover",
                                    active
                                        ? "text-[var(--accent-blue-bright)] text-shadow-[0_0_8px_rgba(0,191,255,0.5)]"
                                        : "text-secondary-custom hover:text-primary-custom"
                                )}
                            >
                                <span className="mr-4">{item.icon}</span>
                                {item.label}
                            </div>
                        </Link>
                    )
                })}
            </nav>

            <div className="p-4 border-t border-subtle-custom">
                <div onClick={openProfileModal} className="flex items-center space-x-3 p-3 fluid-rounded bg-surface-custom border border-transparent hover:border-[var(--accent-blue-bright)]/30 hover:bg-white/5 transition-all duration-300 cursor-pointer group">
                    <div className="w-10 h-10 bg-[var(--accent-blue-dark)] fluid-rounded flex items-center justify-center overflow-hidden group-hover:ring-2 ring-[var(--accent-blue-bright)] transition-all flex-shrink-0">
                        {user?.avatar_url ? (
                            <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-[var(--accent-blue-bright)] font-mono font-bold text-sm">
                                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-mono font-bold text-primary-custom truncate">
                            {user?.full_name ? user.full_name.split(' ')[0] : "User"}
                        </div>
                        <div className="text-[11px] uppercase tracking-wider font-bold text-secondary-custom font-mono truncate">
                            {user?.dept_id ? `Team ${user.dept_id}` : "Analyst (D06)"}
                        </div>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            logout()
                        }}
                        className="text-secondary-custom hover:text-[var(--semantic-error)] hover:text-shadow-[0_0_8px_rgba(255,59,48,0.5)] cursor-pointer transition-colors p-1 flex-shrink-0"
                        title="Logout"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Profile Edit Modal via Portal overlaying the entire DOM */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {showProfileModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[9999] backdrop-blur-md bg-[#0a0a0a]/80 flex items-center justify-center p-4"
                            onClick={() => setShowProfileModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 20 }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-2xl bg-[#1a1c20]/95 backdrop-blur-md border border-subtle-custom fluid-rounded-xl p-8 soft-shadow-lg relative flex flex-row gap-8"
                            >
                                <button
                                    onClick={() => setShowProfileModal(false)}
                                    className="absolute top-4 right-4 text-secondary-custom hover:text-primary-custom transition-colors cursor-pointer"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>

                                {/* Left Side: Avatar and Heading */}
                                <div className="w-2/5 flex flex-col items-center justify-center space-y-6 border-r border-subtle-custom pr-8">
                                    <div className="w-32 h-32 bg-[var(--accent-blue-dark)] rounded-full flex items-center justify-center overflow-hidden border-2 border-[var(--accent-blue-bright)] shadow-[0_0_15px_rgba(0,191,255,0.3)] shrink-0">
                                        {user?.avatar_url ? (
                                            <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-[var(--accent-blue-bright)] font-mono font-bold text-5xl">
                                                {editName ? editName.charAt(0).toUpperCase() : "U"}
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="text-xl font-mono font-bold text-primary-custom uppercase tracking-wider text-center">
                                        Agent Profile
                                    </h2>
                                </div>

                                {/* Right Side: Form Fields and Button */}
                                <div className="w-3/5 flex flex-col justify-center space-y-5">
                                    <div className="space-y-4 text-left">
                                        <div>
                                            <label className="text-xs font-mono text-secondary-custom uppercase tracking-wider mb-1 block">Full Name</label>
                                            <Input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom/50 fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300 h-11 w-full"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-mono text-secondary-custom uppercase tracking-wider mb-1 block">Department Lineage</label>
                                            <DepartmentDropdown
                                                value={editDept}
                                                onChange={(val) => setEditDept(val)}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-mono text-secondary-custom/60 uppercase tracking-wider mb-1 block">
                                                Email Address
                                            </label>
                                            <Input
                                                value={user?.email || ""}
                                                disabled
                                                className="bg-surface-custom/50 border-subtle-custom/50 text-secondary-custom/70 fluid-rounded cursor-not-allowed h-11 w-full"
                                            />
                                        </div>
                                    </div>

                                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                        <Button
                                            onClick={handleSaveProfile}
                                            disabled={isSaving}
                                            className="w-full gradient-button text-white font-mono uppercase tracking-wider py-5 fluid-rounded soft-shadow text-sm mt-2"
                                        >
                                            {isSaving ? "SYNCING CORTEX..." : "UPDATE PROFILE"}
                                        </Button>
                                    </motion.div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    )
}
