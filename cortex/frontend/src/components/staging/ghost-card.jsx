
import { motion } from "framer-motion"

export function GhostCard({ file, onRemove }) {
    const statusColor = {
        'staged': 'border-subtle-custom',
        'uploading': 'border-[var(--accent-blue-bright)]',
        'complete': 'border-[var(--semantic-success)]',
        'error': 'border-[var(--semantic-error)]'
    }[file.status] || 'border-subtle-custom'

    const statusText = {
        'staged': 'READY TO SYNC',
        'uploading': 'TRANSMITTING...',
        'complete': 'SYNC COMPLETE',
        'error': 'TRANSMISSION FAILED'
    }[file.status] || 'UNKNOWN'

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            whileHover={{ scale: 1.02, y: -2 }}
            className={`group relative overflow-hidden fluid-rounded bg-surface-custom/50 border ${statusColor} hover:border-[var(--accent-blue-bright)] p-4 transition-colors duration-300`}
        >
            {/* Holographic scanning effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--accent-blue-bright)]/5 to-transparent -translate-x-full group-hover:animate-scan pointer-events-none" />

            {/* Top Row: Type Badge and Close Button */}
            <div className="flex justify-between items-start mb-3 relative z-10">
                <div className="bg-[var(--accent-blue-bright)]/20 px-2 py-0.5 rounded text-[10px] font-mono text-[var(--accent-blue-bright)]">
                    {file.type ? file.type.split('/')[1]?.toUpperCase() : 'DATA'}
                </div>

                {/* Only show remove button if not uploading */}
                {file.status !== 'uploading' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(file.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-secondary-custom hover:text-[var(--semantic-error)] transition-all duration-200 transform hover:rotate-90"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Middle Row: Icon and Name */}
            <div className="flex items-center space-x-3 mb-3 relative z-10">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-blue-dark)]/30 flex items-center justify-center border border-dashed border-[var(--accent-blue-bright)]/30 flex-shrink-0">
                    {/* File Icon */}
                    <svg className="w-5 h-5 text-[var(--accent-blue-bright)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-mono text-sm text-primary-custom font-bold truncate pr-2" title={file.name}>
                        {file.name}
                    </h4>
                    <p className="font-mono text-xs text-secondary-custom">
                        {(file.size / 1024).toFixed(1)} KB
                    </p>
                </div>
            </div>

            {/* Bottom Row: Status */}
            <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${file.status === 'uploading' ? 'bg-[var(--accent-blue-bright)] animate-pulse' : file.status === 'complete' ? 'bg-[var(--semantic-success)]' : file.status === 'error' ? 'bg-[var(--semantic-error)]' : 'bg-subtle-custom'}`} />
                    <span className={`font-mono text-[10px] uppercase tracking-wider ${file.status === 'error' ? 'text-[var(--semantic-error)]' : 'text-secondary-custom'}`}>
                        {statusText}
                    </span>
                </div>
                <div className="font-mono text-[10px] text-secondary-custom/50">
                    ID: {file.id.slice(0, 4)}
                </div>
            </div>

            {/* Progress Bar for individual file */}
            {file.status === 'uploading' && (
                <div className="absolute bottom-0 left-0 h-1 bg-[var(--accent-blue-bright)]" style={{ width: `${file.progress}%` }} />
            )}
        </motion.div>
    )
}
