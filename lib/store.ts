import { create } from 'zustand'

interface AppState {
  isProMode: boolean
  toggleProMode: () => void
}

export const useAppStore = create<AppState>((set) => ({
  isProMode: false,
  toggleProMode: () => set((state) => ({ isProMode: !state.isProMode })),
}))
