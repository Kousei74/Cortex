import { create } from 'zustand'

export const useAnalysisStore = create((set) => ({
    jobId: null,
    status: 'IDLE', // IDLE, PENDING, PROCESSING, COMPLETED, FAILED, TIMEOUT
    progress: 0,
    payload: null,
    error: null,

    // Actions
    setJobId: (id) => set({ jobId: id, status: 'PENDING', progress: 0, error: null }),
    updateStatus: (status, progress) => set({ status, progress }),
    setPayload: (payload) => set({ payload, status: 'COMPLETED', progress: 100 }),
    setError: (error) => set({ error, status: 'FAILED' }),
    reset: () => set({ jobId: null, status: 'IDLE', progress: 0, payload: null, error: null })
}))
