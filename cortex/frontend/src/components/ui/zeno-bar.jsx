
import { motion } from "framer-motion"

export function ZenoBar({ progress, status }) {
    // Sanitize progress to ensure it's always a valid number between 0 and 100
    const safeProgress = (typeof progress === 'number' && isFinite(progress))
        ? Math.min(Math.max(progress, 0), 100)
        : 0;

    return (
        <div className="w-full space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-secondary-custom uppercase tracking-wider">
                    {status === 'uploading' ? 'NEURAL UPLINK ACTIVE' : status === 'complete' ? 'TRANSMISSION COMPLETE' : 'WAITING'}
                </span>
                <span className="text-[var(--accent-blue-bright)]">
                    {Math.round(safeProgress)}%
                </span>
            </div>

            <div className="h-1 bg-surface-custom border border-subtle-custom rounded-full overflow-hidden relative">
                {/* Background glow for active state */}
                {status === 'uploading' && (
                    <motion.div
                        className="absolute inset-0 bg-[var(--accent-blue-bright)] opacity-20 blur-sm"
                        animate={{ opacity: [0.1, 0.3, 0.1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    />
                )}

                {/* The Bar */}
                <motion.div
                    className="h-full bg-[var(--accent-blue-bright)] shadow-[0_0_10px_var(--accent-blue-bright)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${safeProgress}%` }}
                    transition={{
                        type: "spring",
                        stiffness: 50,
                        damping: 15
                    }}
                />
            </div>
        </div>
    )
}
