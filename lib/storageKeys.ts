import type { StateStorage } from 'zustand/middleware';

/**
 * lib/storageKeys.ts — die Schlüssel, unter denen der Browser den Stand hält,
 * und die einmalige Übernahme der alten Schlüssel.
 *
 * Der Produktname hieß bis Oktober 2026 „Werft“. In den Browsern von
 * Bestandsnutzern liegen Plan und Einstellungen deshalb noch unter
 * `werft-…`. Diese Schlüssel werden weiter GELESEN — ein Plan, den jemand im
 * Sommer gezeichnet hat, muss den Namenswechsel überleben —, aber nicht mehr
 * geschrieben: Beim ersten Zugriff wandert der alte Stand unter den neuen
 * Schlüssel, und der alte Name verschwindet aus dem Speicher, sobald wieder
 * gespeichert wird.
 *
 * Warum eine eigene Datei: Der Planer (`store/slices/persistence.ts`), die
 * Einstiegslogik (`usePlannerEntryPlan`) und die App-Einstellungen
 * (`lib/store.ts`) müssen sich über Schlüssel und Übernahme einig sein. Drei
 * Stellen mit drei Zeichenketten wären drei Gelegenheiten, die Übernahme zu
 * vergessen — und der Fehler wäre still: Der Nutzer sähe einen leeren Planer.
 *
 * Die Übernahme GIBT den herübergeholten Wert zurück, statt ihn nur zu
 * schreiben. Grund: Der Planer speichert über einen entprellten Adapter
 * (`store/storage.ts`), der Schreibvorgänge um bis zu 200 ms verzögert. Würde
 * `getItem` nach dem Anstoßen der Kopie nur noch einmal lesen, käme beim
 * ersten Aufruf „nichts" heraus — der Bestandsplan erschiene erst nach einem
 * zweiten Neuladen. Der Wert steht deshalb sofort im Rückgabewert; die
 * dauerhafte Kopie folgt mit dem nächsten Flush.
 */

/** Nur der Ausschnitt des Speichers, den die Übernahme braucht. */
export type MinimalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Speicher-Schlüssel des Planer-Stands (Entwurf, Ansicht, Bauteile). */
export const PLANNER_STORAGE_KEY = 'elektroplaner-planner-v1';

/** Früherer Schlüssel des Planer-Stands — wird nur noch gelesen. */
export const LEGACY_PLANNER_STORAGE_KEY = 'werft-planner-v1';

/** Speicher-Schlüssel der App-Einstellungen (Onboarding, Solarleistung). */
export const APP_PREFERENCES_STORAGE_KEY = 'elektroplaner-preferences-v1';

/** Früherer Schlüssel der App-Einstellungen — wird nur noch gelesen. */
export const LEGACY_APP_PREFERENCES_STORAGE_KEY = 'werft-app-preferences-v1';

/**
 * Liest einen Eintrag synchron. Ein Promise (asynchroner Speicher) gilt als
 * „nichts vorhanden" — die Übernahme darf einen laufenden Ladevorgang nicht
 * überholen, und ohne sofort lesbaren Wert gibt es nichts zu übernehmen.
 */
function readEntry(storage: MinimalStorage, name: string): string | null {
  const value = storage.getItem(name) as unknown;
  return typeof value === 'string' ? value : null;
}

/**
 * Legt die Übernahme vor einen `StateStorage` von Zustand-`persist`.
 *
 * Gelesen wird nur der eigene Schlüssel, und nur dann der alte: Zustand liest
 * den Stand genau einmal beim Rehydrieren. Liegt unter dem neuen Schlüssel
 * schon etwas (auch ein noch laufender asynchroner Ladevorgang), bleibt es
 * dabei — ein späterer Aufruf darf keinen aktuellen Stand mit einem alten
 * überschreiben.
 *
 * `removeItem` räumt BEIDE Schlüssel ab. Ohne das wäre „Plan löschen" eine
 * Falle: Der neue Schlüssel verschwände, der alte bliebe liegen, und beim
 * nächsten Laden holte die Übernahme genau den gelöschten Plan zurück.
 */
export function withLegacyTakeover(storage: StateStorage, key: string, legacyKey: string): StateStorage {
  const sync = storage as unknown as MinimalStorage;

  return {
    getItem: (name) => {
      if (name !== key) return storage.getItem(name);

      const direct = storage.getItem(name);
      if (direct !== null && direct !== undefined) return direct;

      try {
        const legacy = readEntry(sync, legacyKey);
        if (legacy === null) return direct;
        storage.setItem(key, legacy);
        return legacy;
      } catch {
        // Blockierter Speicher (Privatmodus, Kontingent): kein Grund, den
        // Start zu verhindern — es bleibt beim Verhalten ohne Übernahme.
        return direct;
      }
    },
    setItem: (name, value) => storage.setItem(name, value),
    removeItem: (name) => {
      storage.removeItem(name);
      if (name !== key) return;
      try {
        storage.removeItem(legacyKey);
      } catch {
        // Wie bei der Übernahme: Der Zugriff darf scheitern, ohne zu stören.
      }
    },
  };
}
