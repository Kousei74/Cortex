import { create } from "zustand";

export const useTabLockStore = create((set) => ({
    isLocked: false,
    setLocked: (isLocked) => set({ isLocked }),
}));
