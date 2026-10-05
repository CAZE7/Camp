import { describe, it, expect } from 'vitest';
import { EDGE_DATA_SCHEMA, sanitizeEdgeDataBySchema } from './edgeSchema';

/**
 * Vertragstest für das deklarative Kanten-Schema (AUDIT DOM-004).
 *
 * Gepinnt wird die Semantik aus `lib/nodeSchema.ts`, nur für `edge.data`:
 * BEKANNTE Felder mit falschem Laufzeit-Typ werden ENTFERNT (kein stilles
 * „Heilen“), UNBEKANNTE Felder bleiben erhalten, `undefined` heißt „nicht
 * gesetzt“ und zählt nicht als Verstoß.
 */

describe('edgeSchema — Kantendaten-Schema (DOM-004)', () => {
  it('lässt vollständig gültige Kantendaten unverändert', () => {
    const data = {
      length: 5.5,
      crossSection: 16,
      fuseSize: 120,
      edgeDomain: 'DC_12V',
      dropWarning: false,
      fuseWarning: true,
      fuseOffset: 0.2,
      fuseType: 'MEGA',
      acProtection: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 },
      fuseBreakingCapacity: 2000,
      autoWired: true,
      // Unbekanntes Feld: bleibt (Forward-Kompatibilität, wie bei nodeSchema).
      herkunft: 'import',
    };

    const result = sanitizeEdgeDataBySchema(data);

    expect(result.data).toEqual(data);
    expect(result.removedFields).toEqual([]);
  });

  it('entfernt falsch getippte BEKANNTE Felder statt sie zu heilen', () => {
    const result = sanitizeEdgeDataBySchema({
      length: '5,5',
      crossSection: '2,5',
      fuseSize: 'ja',
      dropWarning: 'nein',
      fuseOffset: null,
      fuseBreakingCapacity: Number.NaN,
      autoWired: 1,
      notiz: 'unbekannt bleibt',
    });

    expect(result.data).toEqual({ notiz: 'unbekannt bleibt' });
    expect(result.removedFields.sort()).toEqual(
      [
        'autoWired',
        'crossSection',
        'dropWarning',
        'fuseBreakingCapacity',
        'fuseOffset',
        'fuseSize',
        'length',
      ].sort()
    );
  });

  it('prüft edgeDomain gegen die erlaubten Domänen', () => {
    for (const domain of ['DC_12V', 'AC_230V', 'Solar']) {
      expect(sanitizeEdgeDataBySchema({ edgeDomain: domain }).removedFields).toEqual([]);
    }
    expect(sanitizeEdgeDataBySchema({ edgeDomain: 'HV_400V' }).removedFields).toEqual(['edgeDomain']);
  });

  it('akzeptiert einen Wegpunktsnapshot als Array und verwirft einen falschen Grundtyp', () => {
    const waypoints = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    expect(sanitizeEdgeDataBySchema({ lockedWaypoints: waypoints }).data).toEqual({
      lockedWaypoints: waypoints,
    });
    expect(sanitizeEdgeDataBySchema({ lockedWaypoints: '0,0 100,0' }).removedFields).toEqual([
      'lockedWaypoints',
    ]);
  });

  it('akzeptiert für acProtection nur Objekt-Deskriptoren', () => {
    expect(sanitizeEdgeDataBySchema({ acProtection: { kind: 'rcbo' } }).data).toEqual({
      acProtection: { kind: 'rcbo' },
    });
    for (const broken of ['rcbo', 42, null, ['rcbo']]) {
      expect(sanitizeEdgeDataBySchema({ acProtection: broken }).removedFields).toEqual(['acProtection']);
    }
  });

  it('wertet undefined als „nicht gesetzt“ (kein Verstoß)', () => {
    expect(sanitizeEdgeDataBySchema({ length: undefined }).removedFields).toEqual([]);
  });

  it('jedes Schema-Feld greift wirklich (Feldliste und Prüfung bleiben synchron)', () => {
    // Wäre ein Feld im Schema deklariert, aber im Sanitizer wirkungslos,
    // fiele das hier auf: jeder Typ bekommt einen passenden Falschwert.
    for (const [key, spec] of Object.entries(EDGE_DATA_SCHEMA)) {
      const invalid = spec.type === 'number' ? '5,5' : spec.type === 'boolean' ? 'ja' : 42;
      expect(sanitizeEdgeDataBySchema({ [key]: invalid }).removedFields).toEqual([key]);
    }
  });
});
