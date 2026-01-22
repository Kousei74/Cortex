
import { useEffect } from 'react'
import { DropZone } from './staging/drop-zone'
import { useStagingStore } from '@/store/stagingStore'
import { motion } from 'framer-motion'
import { FADE_IN } from '@/lib/animations'

export default function StagingArea() {
    const hydrate = useStagingStore(state => state.hydrate)
    const initialized = useStagingStore(state => state.initialized)

    useEffect(() => {
        hydrate()
    }, [hydrate])

    if (!initialized) return null;

    return (
        <motion.div {...FADE_IN} className="p-8 h-full flex flex-col">
            <div className="mb-8 flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-mono font-bold text-primary-custom tracking-tight">DATA NEURAL LINK</h1>
                    <p className="text-secondary-custom font-mono mt-2">Stage and prepare data for ingestion.</p>
                </div>
                <div className="flex space-x-4">
                    {/* Batch Actions could go here */}
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <DropZone />
            </div>
        </motion.div>
    )
}
