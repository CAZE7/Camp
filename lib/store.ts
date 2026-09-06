import { create } from 'zustand';

interface AppState {
  isProMode: boolean;
  toggleProMode: () => void;
  calculatedSolarWatts: number;
  setCalculatedSolarWatts: (watts: number) => void;
  hasOnboarded: boolean;
  setHasOnboarded: (val: boolean) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  isProMode: true,
  toggleProMode: () => set((state) => ({ isProMode: !state.isProMode })),
  calculatedSolarWatts: 0,
  setCalculatedSolarWatts: (watts) => set({ calculatedSolarWatts: watts }),
  hasOnboarded: false,
  setHasOnboarded: (val) => set({ hasOnboarded: val }),
}));
