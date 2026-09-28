import { describe, it, expect } from 'vitest';
import { EDGE_DATA_SCHEMA, sanitizeEdgeDataBySchema } from './edgeSchema';

/**
 * Vertragstest für das deklarative Kanten-Schema (AUDIT DOM-004).
 *
 * Gepinnt wird die dokumentierte Regel: Bekannte Felder mit falschem Typ
 * werden ENTFERNT (nicht „geheilt“), unbekannte bleiben erhalten — dieselbe
 * Semantik wie `lib/nodeSchema.ts` für `node.data`.
 */
describe('edgeSchema — deklaratives Kanten-Schema (DOM-004)', () => {
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
      // Unbekanntes Feld: bleibt (Forward-Kompatibilität).
      herkunft: 'import',
    };
    const result = sanitizeEdgeDataBySchema(data);
    expect(result.data).toEqual(data);
    expect(result.removedFields).toEqual([]);
  });

  it('entfernt falsch getippte bekannte Felder statt sie zu heilen', () => {
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

  it('akzeptiert für acProtection nur Deskriptor-Objekte', () => {
    expect(sanitizeEdgeDataBySchema({ acProtection: { kind: 'rcbo' } }).data).toEqual({
      acProtection: { kind: 'rcbo' },
    });
    for (const broken of ['rcbo', 42, null, ['rcbo']]) {
      expect(sanitizeEdgeDataBySchema({ acProtection: broken }).removedFields).toEqual(['acProtection']);
    }
  });

  it('undefined heißt „nicht gesetzt“ und wird nicht als Verstoß gezählt', () => {
    expect(sanitizeEdgeDataBySchema({ length: undefined }).removedFields).toEqual([]);
  });

  it('greift für jedes deklarierte Feld (Schema-Liste bleibt wirksam)', () => {
    // Ein falscher Wert je Feldtyp muss auffallen — sonst wäre ein Feld in
    // EDGE_DATA_SCHEMA deklariert, aber im Sanitizer wirkungslos.
    for (const [key, spec] of Object.entries(EDGE_DATA_SCHEMA)) {
      const invalid = spec.type === 'boolean' ? 'ja' : spec.type === 'number' ? '5,5' : 42;
      expect(sanitizeEdgeDataBySchema({ [key]: invalid }).removedFields).toEqual([key]);
    }
  });
});
