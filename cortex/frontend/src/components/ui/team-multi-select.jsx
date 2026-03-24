import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

export const TEAM_OPTIONS = [
    { value: "D01", label: "Dev 1 (D01)" },
    { value: "D02", label: "Dev 2 (D02)" },
    { value: "D03", label: "Dev 3 (D03)" },
    { value: "D04", label: "CS 1 (D04)" },
    { value: "D05", label: "CS 2 (D05)" },
    { value: "D06", label: "Analyst (D06)" },
    { value: "D07", label: "Risk (D07)" },
]

export function TeamMultiSelect({ selected = [], onChange, immutableValues = [], excludeValues = [] }) {
    const [open, setOpen] = useState(false)
    const ref = useRef()

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    const toggleTeam = (val) => {
        if (immutableValues.includes(val)) return // Cannot toggle immutable values
        
        if (selected.includes(val)) {
            onChange(selected.filter(t => t !== val))
        } else {
            onChange([...selected, val])
        }
    }

    const unselectAll = (e) => {
        e.stopPropagation()
        // Keep only immutable values
        onChange(selected.filter(val => immutableValues.includes(val)))
    }

    // Render chips
    const renderChips = () => {
        if (selected.length === 0) return <span className="text-secondary-custom/40">Select additional teams...</span>
        return (
            <div className="flex flex-wrap gap-1.5">
                {selected.map(val => {
                    const opt = TEAM_OPTIONS.find(o => o.value === val)
                    const isImmutable = immutableValues.includes(val)
                    return (
                        <div key={val} className="flex items-center gap-1 bg-[var(--accent-blue-bright)]/10 border border-[var(--accent-blue-bright)]/20 px-2 py-0.5 rounded text-xs font-bold text-[var(--accent-blue-bright)]">
                            {opt ? opt.label.split(' ')[0] : val}
                            {!isImmutable && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); toggleTeam(val) }}
                                    className="hover:text-primary-custom ml-1 focus:outline-none"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }

    const canUnselect = selected.some(val => !immutableValues.includes(val))
    const filteredOptions = TEAM_OPTIONS.filter(opt => !excludeValues.includes(opt.value))

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`w-full min-h-[44px] px-3 py-2 bg-surface-custom border fluid-rounded
                    flex items-center justify-between font-mono text-sm
                    soft-glow-hover transition-all duration-300 group
                    ${open ? "border-[var(--accent-blue-bright)] soft-shadow text-primary-custom" : "border-subtle-custom text-primary-custom"}`}
            >
                <div className="flex-1 text-left flex items-center pr-2 overflow-hidden">
                    {renderChips()}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {canUnselect && (
                        <button type="button" onClick={unselectAll} className="text-secondary-custom/40 hover:text-[var(--semantic-error)] transition-colors focus:outline-none">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                    <svg
                        className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180 text-[var(--accent-blue-bright)]" : "text-secondary-custom"}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute top-[calc(100%+6px)] left-0 right-0 z-50
                            frosted-glass border border-subtle-custom fluid-rounded overflow-hidden soft-shadow-lg max-h-60 overflow-y-auto custom-scrollbar"
                    >
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(opt => {
                                const isChecked = selected.includes(opt.value)
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => toggleTeam(opt.value)}
                                        className={`w-full px-4 py-2.5 flex items-center gap-3 font-mono text-sm
                                            hover:bg-[var(--accent-blue-bright)]/10 transition-colors duration-150
                                            ${isChecked ? "bg-[var(--accent-blue-bright)]/5" : ""}`}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors 
                                            ${isChecked ? "bg-[var(--accent-blue-bright)] border-[var(--accent-blue-bright)]" : "border-subtle-custom bg-surface-custom"}`}>
                                            {isChecked && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                        <span className={`tracking-wider ${isChecked ? "text-[var(--accent-blue-bright)]" : "text-primary-custom"}`}>{opt.label}</span>
                                    </button>
                                )
                            })
                        ) : (
                            <div className="px-4 py-3 text-xs font-mono text-secondary-custom/50 italic text-center uppercase tracking-widest">
                                No additional teams available
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
