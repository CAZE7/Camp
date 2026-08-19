import { create } from 'zustand';

interface AppState {
  /**
   * Es gibt nur noch eine (vollständige) Ansicht — kein Umschalter mehr.
   * Das Flag bleibt als Konstante erhalten, weil der Kanten-Pfadstil es liest.
   */
  isProMode: boolean;
  calculatedSolarWatts: number;
  setCalculatedSolarWatts: (watts: number) => void;
  hasOnboarded: boolean;
  setHasOnboarded: (val: boolean) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  isProMode: true,
  calculatedSolarWatts: 0,
  setCalculatedSolarWatts: (watts) => set({ calculatedSolarWatts: watts }),
  hasOnboarded: false,
  setHasOnboarded: (val) => set({ hasOnboarded: val }),
}));
