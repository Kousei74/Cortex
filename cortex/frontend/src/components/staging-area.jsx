import { useEffect } from 'react'
import { DropZone } from './staging/drop-zone'
import { useStagingStore } from '@/store/stagingStore'
import { useAnalysisStore } from '@/store/analysisStore' // Global Store
import { motion } from 'framer-motion'
import { FADE_IN } from '@/lib/animations'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

export default function StagingArea() {
    const hydrate = useStagingStore(state => state.hydrate)
    const initialized = useStagingStore(state => state.initialized)
    const files = useStagingStore(state => state.files)

    const setJobId = useAnalysisStore(state => state.setJobId)
    const navigate = useNavigate();

    useEffect(() => {
        hydrate()
    }, [hydrate])

    const handleUploadComplete = async () => {
        const currentFiles = useStagingStore.getState().files;
        const uploadedFiles = currentFiles.filter(f => f.status === 'complete' && f.backendId);

        if (uploadedFiles.length === 0) {
            toast.error("Upload Sync Failed. Please try again.");
            return;
        }

        const backendIds = uploadedFiles.map(f => f.backendId);

        try {
            const jobData = await api.createReportJob(backendIds);
            if (jobData && jobData.job_id) {
                toast.success("Neural Link Established. Redirecting to Command Center...");
                setJobId(jobData.job_id); // Trigger Global Poller

                // Navigate to Dashboard for visualization
                setTimeout(() => navigate("/dashboard"), 1000);
            }
        } catch (err) {
            console.error("Job Creation Error:", err);
            toast.error(err.message || "Failed to initiate analysis.");
        }
    }

    if (!initialized) return null;

    return (
        <motion.div {...FADE_IN} className="p-8 h-full flex flex-col overflow-y-auto custom-scrollbar">
            <div className="mb-6 flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-mono font-bold text-primary-custom tracking-tight">DATA NEURAL LINK</h1>
                    <p className="text-secondary-custom font-mono mt-2">Stage and prepare data for ingestion.</p>
                </div>
                {files.length > 0 && (
                    <button
                        onClick={() => useStagingStore.getState().clearBatch()}
                        className="text-xs font-mono text-secondary-custom hover:text-red-500 transition-colors border border-subtle-custom px-3 py-1 rounded"
                    >
                        RESET UPLINK
                    </button>
                )}
            </div>

            <div className="flex-1 min-h-0 relative">
                <DropZone onUploadComplete={handleUploadComplete} />
            </div>
        </motion.div>
    )
}
