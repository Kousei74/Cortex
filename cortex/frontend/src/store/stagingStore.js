
import { create } from 'zustand'
import { get as idbGet, set as idbSet } from 'idb-keyval'

// We don't persist File objects directly to IDB easily in this simple MVP without caching logic.
// For now, we persist metadata. User might need to re-drag files if deep reload happens, 
// OR we store Blobs. Storing Blobs in IDB is supported.
// Let's try to store everything.

const STAGING_KEY = 'cortex_staging_v1'

export const useStagingStore = create((set, get) => ({
    files: [],
    initialized: false,

    // Actions
    addFiles: async (newFiles) => {
        // Wrap files in a structure
        const fileObjects = newFiles.map(file => ({
            id: crypto.randomUUID(),
            file: file, // File object (Blob)
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'staged', // staged, uploading, complete, error
            progress: 0,
            message: ''
        }))

        const currentFiles = get().files
        const updatedFiles = [...currentFiles, ...fileObjects]

        set({ files: updatedFiles })
        // persistence removed
    },

    removeFile: async (id) => {
        const currentFiles = get().files
        const updatedFiles = currentFiles.filter(f => f.id !== id)

        set({ files: updatedFiles })
        // persistence removed
    },

    clearBatch: async () => {
        set({ files: [] })
        // persistence removed
    },

    uploadBatch: async (api) => {
        const { files } = get()
        const filesToUpload = files.filter(f => f.status === 'staged' || f.status === 'error')

        if (filesToUpload.length === 0) return

        // Helper to update specific file status/progress
        const updateFileStatus = (id, status, progress = 0, message = '') => {
            const currentFiles = get().files
            const updated = currentFiles.map(f =>
                f.id === id ? { ...f, status, progress, message } : f
            )
            set({ files: updated })
        }

        // Process sequentially for now (or Promise.all for parallel)
        // Let's do parallel with Promise.all for the "Batch" feel
        const uploadPromises = filesToUpload.map(async (fileWrapper) => {
            updateFileStatus(fileWrapper.id, 'uploading', 0, 'INITIALIZING UPLINK...')

            try {
                const result = await api.uploadFile(
                    fileWrapper.file,
                    (progress) => {
                        updateFileStatus(fileWrapper.id, 'uploading', progress, 'TRANSMITTING...')
                    },
                    (statusMessage) => {
                        updateFileStatus(fileWrapper.id, 'uploading', fileWrapper.progress, statusMessage)
                    }
                )
                // Capture Backend ID
                // Note: result.id is the backend file_id
                const currentFiles = get().files
                const updated = currentFiles.map(f =>
                    f.id === fileWrapper.id ? { ...f, status: 'complete', progress: 100, message: 'SYNC COMPLETE', backendId: result.id } : f
                )
                set({ files: updated })
                // updateFileStatus would overwrite the backendId if called after?
                // We did manual update above.
            } catch (error) {
                console.error(`Failed to upload ${fileWrapper.name}:`, error)
                updateFileStatus(fileWrapper.id, 'error', 0, 'TRANSMISSION FAILED')
            }
        })

        await Promise.all(uploadPromises)
    },

    // Hydration
    hydrate: async () => {
        try {
            // CLEAR any existing data to enforce "Fresh Start"
            await idbSet(STAGING_KEY, [])

            set({ files: [], initialized: true })
        } catch (error) {
            console.error("Failed to hydrate staging store", error)
            set({ initialized: true })
        }
    }
}))

