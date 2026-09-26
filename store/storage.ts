import type { StateStorage } from 'zustand/middleware';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Was beim Speichern schiefging — die Grundlage des `saveFailed`-Flags
 * (AUDIT D3).
 */
export type SaveFailure = {
  /** Betroffener Storage-Key (z. B. `werft-planner-v1`). */
  key: string;
  /** Meldung des Storage-Zugriffs, z. B. QuotaExceededError. */
  message: string;
  /** Zeitpunkt in ms seit Epoch. */
  at: number;
};

type SaveFailureListener = (failure: SaveFailure | null) => void;

/**
 * Beobachtbares Signal für fehlgeschlagene Plan-Speicherungen.
 *
 * Bewusst KEIN Feld im persistierten Store: Ein Fehlerzustand, der selbst
 * persistiert würde, wäre nach dem nächsten Laden ein alter Eintrag — und er
 * müsste in den Persistenzvertrag (partialize/Migration) aufgenommen werden.
 * Komponenten lesen ihn über `useSyncExternalStore` (FlowCanvas zeigt die
 * Meldung), `getSaveFailure()` liefert den letzten Stand für Tests.
 */
const listeners = new Set<SaveFailureListener>();
let lastFailure: SaveFailure | null = null;

function reportSaveFailure(failure: SaveFailure | null): void {
  // Nur bei Zustandswechsel melden — ein voller Speicher schlägt bei jedem
  // Flush erneut fehl, die UI soll nicht pro Tastendruck neu flackern.
  const unchanged =
    (failure === null && lastFailure === null) ||
    (failure !== null &&
      lastFailure !== null &&
      failure.key === lastFailure.key &&
      failure.message === lastFailure.message);
  if (unchanged) return;
  lastFailure = failure;
  listeners.forEach((listener) => listener(failure));
}

/** Letzter fehlgeschlagener Schreibvorgang (`null` = alles gespeichert). */
export function getSaveFailure(): SaveFailure | null {
  return lastFailure;
}

/**
 * Setzt das Signal zurück — `@internal` für Unit-Tests: Der Zustand lebt
 * modulweit, Tests dürfen nicht voneinander erben, ob ein Schreibvorgang
 * fehlgeschlagen ist.
 */
export function resetSaveFailure(): void {
  lastFailure = null;
  listeners.clear();
}

/** Abonnement für React (`useSyncExternalStore`). Gibt die Kündigung zurück. */
export function subscribeSaveFailure(listener: SaveFailureListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Debounced `StateStorage`-Adapter für Zustand-`persist` (Mission 5, Persistenz).
 *
 * Zustand ruft `storage.setItem` nach **jedem** `set` auf. Beim Ziehen eines
 * Knotens feuert React Flow mehrere `set` pro Sekunde, und die komplette
 * partialisierte Plan-Struktur (Nodes, Edges, …) wird jedes Mal serialisiert
 * und nach `localStorage` geschrieben — messbar teuer bei großen Plänen.
 *
 * Dieser Adapter fasst schnelle Schreibfolgen zu einem einzigen Schreibvorgang
 * zusammen (Trailing-Debounce) und flusht den letzten Stand bei `pagehide`,
 * `beforeunload` und `visibilitychange`, damit kein laufender Drag-Stand
 * verloren geht.
 *
 * Fehlerbehandlung (AUDIT D3)
 * ===========================
 * Vorher lief `pending.forEach((value, key) => storage.setItem(key, value))`
 * ungeschützt und danach `pending.clear()`. Ein `QuotaExceededError` (voller
 * localStorage, Safari Private Mode, Kontingent im Embed) brach den Flush ab —
 * UND warf den ausstehenden Wert weg, weil das `clear()` im normalen Ablauf
 * folgte bzw. der Timer nie wieder neu ansetzte. Ergebnis: Der Planer zeigte
 * einen gespeicherten Plan, der nie gespeichert wurde. Beim nächsten Laden war
 * der Stand weg, ohne dass irgendwo eine Meldung stand.
 *
 * Jetzt gilt pro Key:
 *  - `setItem` läuft in try/catch — ein voller Speicher wirft nicht mehr in
 *    den Debounce-Timer hinein (ein Wurf dort wäre unbeobachtet),
 *  - ein fehlgeschlagener Wert BLEIBT in `pending` und wird beim nächsten
 *    Flush erneut versucht (Speicher kann wieder frei werden),
 *  - jeder Fehlschlag wird über `reportSaveFailure` sichtbar, jeder
 *    erfolgreiche Flush nimmt die Meldung zurück.
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

    let storage: StorageLike;
    try {
      storage = getStorage();
    } catch (error) {
      // Der Storage selbst ist nicht erreichbar (z. B. blockiert). Werte
      // behalten und melden — Wegwerfen wäre der stille Datenverlust.
      reportSaveFailure({ key: '(storage)', message: describeError(error), at: Date.now() });
      return;
    }

    let failed = 0;
    pending.forEach((value, key) => {
      try {
        storage.setItem(key, value);
        pending.delete(key);
      } catch (error) {
        failed += 1;
        reportSaveFailure({ key, message: describeError(error), at: Date.now() });
      }
    });
    if (failed === 0) {
      reportSaveFailure(null); // alles geschrieben — Meldung zurücknehmen
    }
  };

  const onVisibilityChange = () => {
    // Mobil wird `beforeunload`/`pagehide` nicht zuverlässig geliefert: Ein
    // Tab-Wechsel oder das Sperren des Bildschirms ist der letzte Zeitpunkt,
    // an dem der Stand gesichert werden kann (AUDIT D3).
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      flush();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
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

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/** Debounced Storage-Adapter des Planer-Stores. */
export const plannerDebouncedStorage = createDebouncedStorage(() => window.localStorage);
