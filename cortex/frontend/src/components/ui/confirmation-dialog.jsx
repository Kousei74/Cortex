import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './button';

export function ConfirmationDialog({ isOpen, onClose, onConfirm, title, description, confirmText = "Confirm", cancelText = "Cancel", isDestructive = false }) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Dialog Content */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ type: "spring", duration: 0.3 }}
                        className="relative w-full max-w-md bg-[var(--surface-color)] border border-subtle-custom rounded-xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 pb-2">
                            <h3 className="text-xl font-mono font-bold text-primary-custom tracking-tight">
                                {title}
                            </h3>
                            <p className="mt-2 text-sm text-secondary-custom font-sans">
                                {description}
                            </p>
                        </div>

                        {/* Footer / Actions */}
                        <div className="p-6 pt-6 flex justify-end gap-3 bg-[var(--surface-color)]/50">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                className="font-mono text-sm"
                            >
                                {cancelText}
                            </Button>
                            <Button
                                onClick={() => {
                                    onConfirm();
                                    onClose();
                                }}
                                className={`font-mono text-sm text-white shadow-lg transition-all duration-300 ${isDestructive
                                    ? 'bg-semantic-error hover:bg-semantic-error/90 shadow-semantic-error/20'
                                    : 'gradient-button'
                                    }`}
                            >
                                {confirmText}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
