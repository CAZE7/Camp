import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  isProMode: boolean;
  toggleProMode: () => void;
  calculatedSolarWatts: number;
  setCalculatedSolarWatts: (watts: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isProMode: true,
      toggleProMode: () => set((state) => ({ isProMode: !state.isProMode })),
      calculatedSolarWatts: 0,
      setCalculatedSolarWatts: (watts) => set({ calculatedSolarWatts: watts }),
    }),
    {
      name: 'camper-app-storage',
    }
  )
);
