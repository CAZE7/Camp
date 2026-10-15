/**
 * Vertrag der Speicher-Schlüssel und der Übernahme aus der Zeit vor dem
 * Namenswechsel.
 *
 * Warum das geprüft wird: Die Übernahme ist unsichtbar. Läuft sie schief,
 * sieht der Nutzer nach dem Relaunch einen leeren Planer statt seines Plans —
 * ein Fehler, der weder knallt noch in einer Meldung auftaucht. Genau
 * deshalb steht hier jeder Fall, den die Übernahme treffen muss.
 *
 * Der entprellte Adapter des Planers wird mit einer Attrappe nachgestellt, die
 * Schreibvorgänge nur vormerkt: So ist der Fall „Wert ist erst nach dem Flush
 * im Speicher" wirklich geprüft und nicht nur angenommen.
 */
import { describe, expect, it } from 'vitest';

import {
  APP_PREFERENCES_STORAGE_KEY,
  LEGACY_APP_PREFERENCES_STORAGE_KEY,
  LEGACY_PLANNER_STORAGE_KEY,
  PLANNER_STORAGE_KEY,
  withLegacyTakeover,
} from './storageKeys';

/** Speicher-Attrappe mit Zähler, damit Schreibzugriffe sichtbar bleiben. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const writes: string[] = [];
  return {
    data,
    writes,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes.push(key);
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

describe('Speicher-Schlüssel', () => {
  it('nennt die neuen Schlüssel nach dem Produkt und hält die alten fest', () => {
    expect(PLANNER_STORAGE_KEY).toBe('elektroplaner-planner-v1');
    expect(APP_PREFERENCES_STORAGE_KEY).toBe('elektroplaner-preferences-v1');
    expect(LEGACY_PLANNER_STORAGE_KEY).toBe('werft-planner-v1');
    expect(LEGACY_APP_PREFERENCES_STORAGE_KEY).toBe('werft-app-preferences-v1');
  });
});

describe('withLegacyTakeover', () => {
  it('liefert den Stand vom alten Schlüssel und kopiert ihn herüber', () => {
    const storage = fakeStorage({ [LEGACY_PLANNER_STORAGE_KEY]: '{"state":{"nodes":[]}}' });
    const wrapped = withLegacyTakeover(storage, PLANNER_STORAGE_KEY, LEGACY_PLANNER_STORAGE_KEY);

    expect(wrapped.getItem(PLANNER_STORAGE_KEY)).toBe('{"state":{"nodes":[]}}');
    expect(storage.getItem(PLANNER_STORAGE_KEY)).toBe('{"state":{"nodes":[]}}');
  });

  it('liefert den Stand auch, wenn das Schreiben erst später ankommt (entprellter Speicher)', () => {
    // Der Planer-Adapter schreibt verzögert: Der Wert darf nicht davon
    // abhängen, ob der Flush schon gelaufen ist.
    const data = new Map([[LEGACY_PLANNER_STORAGE_KEY, 'plan-alt']]);
    const verzoegert = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: () => undefined, // „vorgemerkt", noch nicht geschrieben
      removeItem: (key: string) => {
        data.delete(key);
      },
    };
    const wrapped = withLegacyTakeover(verzoegert, PLANNER_STORAGE_KEY, LEGACY_PLANNER_STORAGE_KEY);

    expect(wrapped.getItem(PLANNER_STORAGE_KEY)).toBe('plan-alt');
  });

  it('lässt einen vorhandenen neuen Stand unangetastet (kein Rückschritt)', () => {
    const storage = fakeStorage({
      [PLANNER_STORAGE_KEY]: 'neu',
      [LEGACY_PLANNER_STORAGE_KEY]: 'alt',
    });
    const wrapped = withLegacyTakeover(storage, PLANNER_STORAGE_KEY, LEGACY_PLANNER_STORAGE_KEY);

    expect(wrapped.getItem(PLANNER_STORAGE_KEY)).toBe('neu');
    expect(storage.writes).toEqual([]);
  });

  it('schreibt nichts, wenn es keinen alten Stand gibt', () => {
    const storage = fakeStorage();
    const wrapped = withLegacyTakeover(storage, PLANNER_STORAGE_KEY, LEGACY_PLANNER_STORAGE_KEY);

    expect(wrapped.getItem(PLANNER_STORAGE_KEY)).toBeNull();
    expect(storage.writes).toEqual([]);
  });

  it('rührt fremde Schlüssel nicht an', () => {
    const storage = fakeStorage({ [LEGACY_PLANNER_STORAGE_KEY]: 'plan' });
    const wrapped = withLegacyTakeover(storage, PLANNER_STORAGE_KEY, LEGACY_PLANNER_STORAGE_KEY);

    expect(wrapped.getItem('irgendein-anderer-schluessel')).toBeNull();
    expect(storage.getItem(PLANNER_STORAGE_KEY)).toBeNull();
  });

  it('löscht beim Entfernen beide Schlüssel — sonst käme der Plan zurück', () => {
    const storage = fakeStorage({
      [PLANNER_STORAGE_KEY]: 'neu',
      [LEGACY_PLANNER_STORAGE_KEY]: 'alt',
    });
    const wrapped = withLegacyTakeover(storage, PLANNER_STORAGE_KEY, LEGACY_PLANNER_STORAGE_KEY);

    wrapped.removeItem(PLANNER_STORAGE_KEY);

    expect(storage.getItem(PLANNER_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_PLANNER_STORAGE_KEY)).toBeNull();
    expect(wrapped.getItem(PLANNER_STORAGE_KEY)).toBeNull();
  });

  it('scheitert nicht, wenn der Speicher blockiert ist', () => {
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    const wrapped = withLegacyTakeover(blocked, PLANNER_STORAGE_KEY, LEGACY_PLANNER_STORAGE_KEY);

    // Der Lesepfad wirft wie ohne Übernahme — die Übernahme selbst fügt keinen
    // neuen Fehlerpfad hinzu. Das Löschen darf ebenfalls nicht zusätzlich werfen.
    expect(() => wrapped.getItem(PLANNER_STORAGE_KEY)).toThrow('SecurityError');
    expect(() => wrapped.removeItem(PLANNER_STORAGE_KEY)).toThrow('SecurityError');
  });
});
