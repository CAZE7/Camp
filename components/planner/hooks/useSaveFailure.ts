import { useCallback, useSyncExternalStore } from 'react';
import { getSaveFailure, subscribeSaveFailure, type SaveFailure } from '../../../store/storage';

/**
 * Letzter fehlgeschlagener Speicher-Vorgang des Plans (AUDIT D3).
 *
 * Der Debounce-Adapter in `store/storage.ts` fängt Schreibfehler ab und meldet
 * sie über ein kleines Observable — bewusst nicht über den persistierten
 * Store, denn ein Fehlerzustand im Persistenzvertrag wäre nach dem nächsten
 * Laden ein veralteter Eintrag. `null` heißt: alles Geschriebene ist im
 * localStorage angekommen.
 *
 * SSR-sicher wie die übrigen Hooks dieses Verzeichnisses
 * (`useMediaCapabilities`): auf dem Server immer `null`.
 */
export function useSaveFailure(): SaveFailure | null {
  const subscribe = useCallback((onStoreChange: () => void) => subscribeSaveFailure(onStoreChange), []);
  const getServerSnapshot = useCallback(() => null, []);
  return useSyncExternalStore(subscribe, getSaveFailure, getServerSnapshot);
}
