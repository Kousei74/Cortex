import { useState, useRef, useEffect, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, Calendar, X } from "lucide-react"

// ─── Helpers ────────────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay()
}

function formatDD_MM_YYYY(d) {
    if (!d) return ""
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
}

// ─── DatePicker Component ───────────────────────────────────────────

export default function DatePicker({ value, onChange, placeholder = "dd/mm/yyyy" }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    // Calendar state — default to current month/year
    const today = new Date()
    const [viewYear, setViewYear] = useState(value ? value.getFullYear() : today.getFullYear())
    const [viewMonth, setViewMonth] = useState(value ? value.getMonth() : today.getMonth())

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    // Sync view when value changes
    useEffect(() => {
        if (value) {
            setViewYear(value.getFullYear())
            setViewMonth(value.getMonth())
        }
    }, [value])

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
        else setViewMonth(m => m - 1)
    }

    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
        else setViewMonth(m => m + 1)
    }

    const selectDate = useCallback((day) => {
        const selected = new Date(viewYear, viewMonth, day)
        onChange(selected)
        setOpen(false)
    }, [viewYear, viewMonth, onChange])

    const clear = (e) => {
        e.stopPropagation()
        onChange(null)
    }

    // Build calendar grid
    const daysInMonth = getDaysInMonth(viewYear, viewMonth)
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
    const prevMonthDays = getDaysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1)

    const cells = []
    // Leading days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
        cells.push({ day: prevMonthDays - i, current: false })
    }
    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, current: true })
    }
    // Trailing days
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
        cells.push({ day: d, current: false })
    }

    const weeks = []
    for (let i = 0; i < cells.length; i += 7) {
        weeks.push(cells.slice(i, i + 7))
    }

    const isSelected = (day, isCurrent) => {
        if (!value || !isCurrent) return false
        return value.getDate() === day && value.getMonth() === viewMonth && value.getFullYear() === viewYear
    }

    const isToday = (day, isCurrent) => {
        if (!isCurrent) return false
        return day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
    }

    return (
        <div ref={ref} className="relative">
            {/* Input Display */}
            <div
                className="h-11 px-4 bg-surface-custom border border-subtle-custom fluid-rounded
                    flex items-center gap-2 font-mono text-sm cursor-pointer
                    soft-glow-hover soft-focus transition-all duration-300 group"
                onClick={() => setOpen(o => !o)}
            >
                <span className={value ? "text-primary-custom" : ""}
                    style={!value ? { color: "rgba(255,255,255,0.25)" } : undefined}
                >
                    {value ? formatDD_MM_YYYY(value) : placeholder}
                </span>
                <div className="ml-auto flex items-center gap-1">
                    {value && (
                        <button
                            type="button"
                            onClick={clear}
                            className="p-1 rounded-md text-secondary-custom/50 hover:text-[var(--semantic-error)] hover:bg-[var(--semantic-error)]/10 transition-all"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <Calendar className="w-4 h-4 text-secondary-custom/40 group-hover:text-[var(--accent-blue-bright)] transition-colors" />
                </div>
            </div>

            {/* Calendar Dropdown */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute top-[calc(100%+6px)] right-0 z-[100] w-[280px]
                            border border-subtle-custom fluid-rounded-xl overflow-hidden soft-shadow-lg p-3"
                        style={{ backgroundColor: "#0d1117", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
                    >
                        {/* Month/Year Navigation */}
                        <div className="flex items-center justify-between mb-3">
                            <button
                                type="button"
                                onClick={prevMonth}
                                className="p-1.5 rounded-lg text-secondary-custom hover:text-primary-custom hover:bg-surface-custom/80 transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-mono font-bold text-primary-custom tracking-wider uppercase">
                                {MONTHS[viewMonth].substring(0, 3)} {viewYear}
                            </span>
                            <button
                                type="button"
                                onClick={nextMonth}
                                className="p-1.5 rounded-lg text-secondary-custom hover:text-primary-custom hover:bg-surface-custom/80 transition-all"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Day Headers */}
                        <div className="grid grid-cols-7 mb-1">
                            {DAYS.map(d => (
                                <div key={d} className="text-center text-[10px] font-mono text-secondary-custom/50 uppercase tracking-wider py-1">
                                    {d}
                                </div>
                            ))}
                        </div>

                        {/* Day Grid */}
                        <div className="grid grid-cols-7 gap-0.5">
                            {weeks.map((week, wi) =>
                                week.map((cell, ci) => {
                                    const selected = isSelected(cell.day, cell.current)
                                    const todayMark = isToday(cell.day, cell.current)
                                    return (
                                        <button
                                            type="button"
                                            key={`${wi}-${ci}`}
                                            onClick={() => cell.current && selectDate(cell.day)}
                                            disabled={!cell.current}
                                            className={`
                                                w-[34px] h-[34px] flex items-center justify-center rounded-lg text-xs font-mono transition-all duration-150
                                                ${!cell.current
                                                    ? "cursor-default"
                                                    : selected
                                                        ? "bg-[var(--accent-blue-bright)] text-white shadow-[0_0_10px_rgba(0,191,255,0.4)] font-bold"
                                                        : todayMark
                                                            ? "text-[var(--accent-blue-bright)] font-bold ring-1 ring-[var(--accent-blue-bright)]/40"
                                                            : "text-primary-custom hover:bg-surface-custom/80 cursor-pointer"
                                                }
                                            `}
                                            style={!cell.current ? { color: "rgba(255,255,255,0.2)" } : undefined}
                                        >
                                            {cell.day}
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
