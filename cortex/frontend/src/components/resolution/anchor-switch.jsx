import { motion } from "framer-motion";

export function AnchorSwitch({ viewMode, setViewMode }) {
    const options = [
        { id: 'CONSOLIDATED', label: 'CONSOLIDATED VIEW' },
        { id: 'DIVERGING', label: 'DIVERGING VIEW' }
    ];

    return (
        <div className="flex justify-start mb-6 border-b border-subtle-custom pb-1">
            <div className="flex space-x-1 bg-surface-custom/50 p-1 rounded-lg">
                {options.map((opt) => {
                    const isActive = viewMode === opt.id;
                    return (
                        <button
                            key={opt.id}
                            onClick={() => setViewMode(opt.id)}
                            className={`
                                relative px-4 py-2 text-sm font-mono font-medium rounded-md transition-all duration-300
                                ${isActive ? 'text-primary-custom shadow-sm' : 'text-secondary-custom hover:text-primary-custom'}
                            `}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="switch-indicator"
                                    className="absolute inset-0 bg-white rounded-md shadow-sm z-0"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <span className="relative z-10">{opt.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
