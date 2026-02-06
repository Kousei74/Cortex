
import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { useStagingStore } from '@/store/stagingStore'
import { GhostCard } from './ghost-card'
import { ZenoBar } from '@/components/ui/zeno-bar'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useState } from 'react'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { validateMagicBytes } from '@/lib/magic-bytes'

export function DropZone({ onUploadComplete }) {
    const { addFiles, files, removeFile, uploadBatch } = useStagingStore()
    const [showResetDialog, setShowResetDialog] = useState(false)

    const onDrop = useCallback(acceptedFiles => {
        addFiles(acceptedFiles);
    }, [addFiles]);

    const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/json': ['.json'],
            'text/plain': ['.txt', '.log'],
            // 'application/pdf': ['.pdf'], // PDF support pending backend Ocr
            'image/*': ['.png', '.jpg', '.jpeg', '.webp']
        }
    });

    const handleUpload = async (e) => {
        e.stopPropagation();
        console.log("Starting upload...", api);

        if (!api) {
            alert("CRITICAL ERROR: API Client is undefined! Check imports.");
            return;
        }

        try {
            await uploadBatch(api);
            if (onUploadComplete) {
                onUploadComplete();
            }
        } catch (error) {
            console.error("Upload Batch Failed:", error);
            // Show user-friendly toast
            toast.error("Upload failed. Please reload the page.");
        }
    }

    const hasStagedFiles = files.some(f => f.status === 'staged' || f.status === 'error');
    const isUploading = files.some(f => f.status === 'uploading');

    // Aggregate upload progress
    const totalFiles = files.filter(f => f.status !== 'staged').length;
    let totalProgress = 0;
    if (totalFiles > 0) {
        const sumProgress = files.reduce((acc, f) => {
            const p = typeof f.progress === 'number' && isFinite(f.progress) ? f.progress : 0;
            return acc + p;
        }, 0);
        totalProgress = sumProgress / totalFiles;
    }

    const handlePaste = useCallback((e) => {
        if (e.clipboardData && e.clipboardData.files.length > 0) {
            e.preventDefault();
            const pastedFiles = Array.from(e.clipboardData.files).map(file => {
                // If it's a generic "image.png" from clipboard, give it a timestamp
                if (file.name === "image.png") {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                    return new File([file], `screenshot_${timestamp}.png`, { type: file.type });
                }
                return file;
            });
            addFiles(pastedFiles);
        }
    }, [addFiles]);

    return (
        <motion.div
            {...getRootProps()}
            onPaste={handlePaste}
            // Make div focusable so it can capture paste events without needing to click an input
            tabIndex={0}
            className={`
                relative h-full w-full fluid-rounded-lg border-2 border-dashed transition-all duration-300 flex flex-col overflow-hidden outline-none focus:ring-2 focus:ring-[var(--accent-blue-bright)]/50
                ${isDragActive ? 'border-[var(--accent-blue-bright)] bg-[var(--accent-blue-bright)]/5' : 'border-subtle-custom bg-surface-custom/30'}
                ${isDragReject ? 'border-[var(--semantic-error)] bg-[var(--semantic-error)]/5' : ''}
            `}
            animate={{
                scale: isDragActive ? 1.02 : 1,
            }}
        >
            <input {...getInputProps()} />

            {/* Empty State */}
            {files.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 pointer-events-none">
                    <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="mb-6 opacity-80"
                    >
                        {/* SVG Icon Placeholder */}
                        <div className="w-16 h-16 rounded-full bg-[var(--accent-blue-bright)]/10 flex items-center justify-center">
                            <span className="text-2xl">📥</span>
                        </div>
                    </motion.div>
                    <h3 className="text-xl font-mono font-bold text-primary-custom mb-2">INITIATE NEURAL LINK</h3>
                    <p className="text-secondary-custom font-mono text-sm max-w-md">
                        Drag and drop data fragments (CSV, JSON, LOG) to stage for ingestion.
                    </p>
                </div>
            )}

            {/* Staged Files Grid */}
            {files.length > 0 && (
                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                        layout
                    >
                        <div className="contents">
                            {files.map(file => (
                                <GhostCard key={file.id} file={file} onRemove={removeFile} />
                            ))}
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Upload Action Bar */}
            {files.length > 0 && (
                <div className="p-4 border-t border-subtle-custom bg-surface-custom/80 backdrop-blur-sm sticky bottom-0 z-10 flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
                    <div className="text-sm font-mono text-secondary-custom">
                        {files.length} FRAGMENT{files.length !== 1 ? 'S' : ''} DETECTED
                    </div>

                    <div className="flex-1 ml-6 max-w-md flex justify-end">
                        {isUploading ? (
                            <div className="w-full">
                                <ZenoBar
                                    progress={totalProgress}
                                    status="uploading"
                                    label={files.find(f => f.status === 'uploading' && f.message && !f.message.includes('TRANSMITTING'))?.message}
                                />
                            </div>
                        ) : (
                            hasStagedFiles && (
                                <div className="flex items-center">
                                    <Button
                                        onClick={handleUpload}
                                        className="gradient-button text-white font-mono shadow-[0_0_20px_var(--accent-blue-bright)] hover:shadow-[0_0_30px_var(--accent-blue-bright)] transition-all duration-300"
                                    >
                                        ACTUALIZE UPLOAD
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowResetDialog(true);
                                        }}
                                        className="border-semantic-error text-semantic-error hover:bg-semantic-error/10 font-mono tracking-wider transition-all duration-300 ml-4"
                                    >
                                        RESET
                                    </Button>
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}

            <ConfirmationDialog
                isOpen={showResetDialog}
                onClose={() => setShowResetDialog(false)}
                onConfirm={() => {
                    useStagingStore.getState().clearBatch();
                    toast.success("Batch reset successfully.");
                }}
                title="Reset Ingestion Batch?"
                description="This action will clear all currently staged files. This action cannot be undone."
                confirmText="YES, RESET BATCH"
                isDestructive={true}
            />


            {/* Decorative Corners */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[var(--accent-blue-bright)]/30 rounded-tl-lg m-4 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[var(--accent-blue-bright)]/30 rounded-br-lg m-4 pointer-events-none" />
        </motion.div >
    )
}
