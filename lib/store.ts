import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AppState {
  calculatedSolarWatts: number;
  setCalculatedSolarWatts: (watts: number) => void;
  hasOnboarded: boolean;
  setHasOnboarded: (val: boolean) => void;
}

const APP_STORAGE_VERSION = 2;

/**
 * Verteidigt die App-Präferenzen gegen veraltete/teilkorrupte localStorage-
 * Stände. Jeder Feldzugriff ist defensiv, damit ein alter Stand keinen
 * Laufzeitfehler auslöst.
 *
 * Versionsverlauf:
 *   1: ursprüngliche Felder isProMode, calculatedSolarWatts, hasOnboarded
 *   2: isProMode entfernt (alle Fach-Infos sind jetzt sichtbar); bereinigt
 */
function migrateAppPersisted(persisted: unknown, version: number): Partial<AppState> {
  const p = (persisted ?? {}) as Partial<AppState>;
  const safe: Partial<AppState> = {};

  if (typeof p.calculatedSolarWatts === 'number' && Number.isFinite(p.calculatedSolarWatts) && p.calculatedSolarWatts >= 0) {
    safe.calculatedSolarWatts = p.calculatedSolarWatts;
  }
  if (typeof p.hasOnboarded === 'boolean') safe.hasOnboarded = p.hasOnboarded;

  void version;
  return safe;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      calculatedSolarWatts: 0,
      setCalculatedSolarWatts: (watts) => set({ calculatedSolarWatts: watts }),
      hasOnboarded: false,
      setHasOnboarded: (val) => set({ hasOnboarded: val }),
    }),
    {
      name: 'werft-app-preferences-v1',
      version: APP_STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted, version) => migrateAppPersisted(persisted, version) as AppState,
      partialize: (state) => ({
        calculatedSolarWatts: state.calculatedSolarWatts,
        hasOnboarded: state.hasOnboarded,
      }),
    }
  )
);
