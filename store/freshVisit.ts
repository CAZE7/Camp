import { nodesWithUniqueDesignators } from '../components/nodes/designatorModel';
import { STARTER_TEMPLATE_ID, TEMPLATES_DICT } from '../components/planner/templates';
import { useAppStore } from '../lib/store';
import { LEGACY_PLANNER_STORAGE_KEY, PLANNER_STORAGE_KEY } from '../lib/storageKeys';
import { usePlannerStore } from './usePlannerStore';

/**
 * Erstbesuch nach einem geleerten Browser-Speicher.
 *
 * „Clear site data“ löscht localStorage, ohne die App zu fragen. Der Plan liegt
 * danach noch im Speicher der offenen Seite und würde beim Verlassen zurück-
 * geschrieben (entprellter Flush). Diese Funktion setzt stattdessen den
 * Erststart: Beispielplan, Assistent, leere Undo-Historie. Ein `#plan=`-Hash
 * ist die einzige weitere Kopie — er wird mit entfernt, sonst lädt der Neustart
 * genau den gelöschten Plan wieder.
 */
export function restoreFirstVisit(): void {
  const template = TEMPLATES_DICT[STARTER_TEMPLATE_ID];
  if (!template) return;
  usePlannerStore.setState({
    nodes: nodesWithUniqueDesignators(template.nodes),
    edges: [...template.edges],
    waterNodes: [],
    waterEdges: [],
    selectedNodes: [],
    selectedEdges: [],
    firstTappedHandle: null,
    historyPast: [],
    historyFuture: [],
    canUndo: false,
    canRedo: false,
    autoStructurePending: false,
  });
  useAppStore.getState().setHasOnboarded(false);
  if (typeof window === 'undefined') return;
  if (window.location.hash.includes('plan=')) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }
}

export function hasPlannerStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.localStorage.getItem(PLANNER_STORAGE_KEY) !== null ||
      window.localStorage.getItem(LEGACY_PLANNER_STORAGE_KEY) !== null
    );
  } catch {
    return false;
  }
}

/**
 * IndexedDB, Cache Storage und Service Worker halten in dieser App keinen Plan.
 * Ein geleerter localStorage soll auch keine vergessene Kopie dort zurücklassen.
 */
export async function forgetAuxiliaryBrowserStorage(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const cacheStorage = window.caches;
    if (cacheStorage) {
      const names = await cacheStorage.keys();
      await Promise.all(names.map((name) => cacheStorage.delete(name)));
    }
  } catch {
    // Cache Storage kann fehlen (älterer Browser, blockierter Speicher).
  }
  try {
    if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases.map(
          (database) =>
            new Promise<void>((resolve) => {
              if (!database.name) {
                resolve();
                return;
              }
              const request = indexedDB.deleteDatabase(database.name);
              request.onsuccess = () => resolve();
              request.onerror = () => resolve();
              request.onblocked = () => resolve();
            })
        )
      );
    }
  } catch {
    // Kein IndexedDB — nichts zu vergessen.
  }
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((registrations ?? []).map((registration) => registration.unregister()));
  } catch {
    // Kein Service Worker registriert.
  }
}
