import type { StateStorage } from 'zustand/middleware';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Debounced `StateStorage`-Adapter für Zustand-`persist` (Mission 5, Persistenz).
 *
 * Zustand ruft `storage.setItem` nach **jedem** `set` auf. Beim Ziehen eines
 * Knotens feuert React Flow mehrere `set` pro Sekunde, und die komplette
 * partialisierte Plan-Struktur (Nodes, Edges, …) wird jedes Mal serialisiert
 * und nach `localStorage` geschrieben — messbar teuer bei großen Plänen.
 *
 * Dieser Adapter fasst schnelle Schreibfolgen zu einem einzigen Schreibvorgang
 * zusammen (Trailing-Debounce) und flusht den letzten Stand bei `pagehide`/
 * `beforeunload`, damit kein laufender Drag-Stand verloren geht.
 *
 * `getItem`/`removeItem` bleiben unverzögert: Rehydration und Löschen warten
 * nie. Es wird pro Storage-Key nur der jeweils letzte ausstehende Wert
 * gehalten, sodass kein Zwischenzustand durchsickert.
 */
export function createDebouncedStorage(getStorage: () => StorageLike, delayMs = 200): StateStorage {
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending.size === 0) return;
    // Kein `window` mehr = kein Storage mehr: Der Flush kann feuern, nachdem die
    // Seite (oder die jsdom-Umgebung eines Tests) bereits abgeräumt wurde — ein
    // ausstehender Schreibvorgang ist dann hinfällig, werfen darf er nicht
    // (CI: `ReferenceError: window is not defined` aus einem hängenden Timer).
    if (typeof window === 'undefined') {
      pending.clear();
      return;
    }
    const storage = getStorage();
    pending.forEach((value, key) => storage.setItem(key, value));
    pending.clear();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  }

  return {
    getItem: (name) => getStorage().getItem(name),
    setItem: (name, value) => {
      pending.set(name, value);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    removeItem: (name) => {
      pending.delete(name);
      getStorage().removeItem(name);
    },
  };
}

/** Debounced Storage-Adapter des Planer-Stores. */
export const plannerDebouncedStorage = createDebouncedStorage(() => window.localStorage);
