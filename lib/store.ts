import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  isProMode: boolean;
  toggleProMode: () => void;
  calculatedSolarWatts: number;
  setCalculatedSolarWatts: (watts: number) => void;
}

type PersistedAppState = Partial<Pick<AppState, 'isProMode' | 'calculatedSolarWatts'>>;

function migrateAppState(value: unknown): PersistedAppState {
  if (!value || typeof value !== 'object') return {};
  const state = value as Record<string, unknown>;
  return {
    isProMode: typeof state.isProMode === 'boolean' ? state.isProMode : undefined,
    calculatedSolarWatts:
      typeof state.calculatedSolarWatts === 'number' && Number.isFinite(state.calculatedSolarWatts) && state.calculatedSolarWatts >= 0
        ? state.calculatedSolarWatts
        : undefined,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isProMode: true,
      toggleProMode: () => set((state) => ({ isProMode: !state.isProMode })),
      calculatedSolarWatts: 0,
      setCalculatedSolarWatts: (watts) =>
        set({ calculatedSolarWatts: Number.isFinite(watts) ? Math.max(0, watts) : 0 }),
    }),
    {
      name: 'camper-app-storage',
      version: 1,
      migrate: (persisted) => migrateAppState(persisted),
    }
  )
);

export { migrateAppState };
