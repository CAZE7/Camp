import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  /**
   * Der Basis-Modus zeigt nur die wichtigsten Werte. Der Profi-Modus ergänzt
   * technische Detailinformationen; die fachlichen Berechnungen bleiben identisch.
   */
  isProMode: boolean;
  setIsProMode: (value: boolean) => void;
  calculatedSolarWatts: number;
  setCalculatedSolarWatts: (watts: number) => void;
  hasOnboarded: boolean;
  setHasOnboarded: (val: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isProMode: false,
      setIsProMode: (value) => set({ isProMode: value }),
      calculatedSolarWatts: 0,
      setCalculatedSolarWatts: (watts) => set({ calculatedSolarWatts: watts }),
      hasOnboarded: false,
      setHasOnboarded: (val) => set({ hasOnboarded: val }),
    }),
    {
      name: 'werft-app-preferences-v1',
      partialize: (state) => ({
        isProMode: state.isProMode,
        calculatedSolarWatts: state.calculatedSolarWatts,
        hasOnboarded: state.hasOnboarded,
      }),
    }
  )
);
