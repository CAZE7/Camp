/**
 * lib/edgeSchema.ts — deklaratives Runtime-Schema für `edge.data` (AUDIT DOM-004).
 *
 * Symmetrisch zu `lib/nodeSchema.ts`: Die Persistenz-Migration prüfte für
 * Kanten bisher nur, dass `data` ein Objekt ist. Falsch getippte Felder
 * (`crossSection: '2,5'`, `fuseSize: 'ja'`, `autoWired: 1`) überlebten den
 * Rehydrate; die Leseschicht fängt vieles ab (`quantityOr`, Marker-Kurzschlüsse),
 * aber nicht alles und nicht an einer benannten Stelle.
 *
 * Regeln (bewusst konservativ, Daten-Integrität vor Komfort):
 * - BEKANNTES Feld mit falschem Laufzeit-Typ → wird ENTFERNT (kaputte Werte
 *   werden nicht „geheilt“: stilles Ersetzen würde falsche Pläne plausibel
 *   machen; Entfernen fällt auf den dokumentierten Default der Leseschicht).
 * - UNBEKANNTE Felder bleiben erhalten (Forward-Kompatibilität: neuere
 *   Versionen dürfen ältere Stände lesen, ohne Daten zu verlieren).
 * - Enum-Felder (`edgeDomain`) prüfen gegen die erlaubten Werte.
 * - `acProtection` ist ein Deskriptor-Objekt; geprüft wird seine OBJEKT-Form
 *   (kein Array, kein `null`). Seine Einzelfelder liest `lib/acProtection.ts`
 *   defensiv — eine zweite Typ-Ebene hier wäre eine zweite Wahrheit.
 *
 * Kein Zod/Extern-Deps: wie `nodeSchema.ts` ein handgerolltes, auditierbares
 * Schema; die Feldliste spiegelt `lib/domain/cableEdgeData.ts`.
 */

export type EdgeDataFieldType = 'number' | 'string' | 'boolean' | 'object';

export interface EdgeDataFieldSpec {
  type: EdgeDataFieldType;
  /** Erlaubte Werte (nur für 'string'). */
  enumValues?: readonly string[];
}

/** Bekannte Felder einer elektrischen Kante (`CableEdgeData`). */
export const EDGE_DATA_SCHEMA: Record<string, EdgeDataFieldSpec> = {
  length: { type: 'number' },
  crossSection: { type: 'number' },
  fuseSize: { type: 'number' },
  edgeDomain: { type: 'string', enumValues: ['DC_12V', 'AC_230V', 'Solar'] },
  dropWarning: { type: 'boolean' },
  fuseWarning: { type: 'boolean' },
  fuseOffset: { type: 'number' },
  fuseType: { type: 'string' },
  acProtection: { type: 'object' },
  fuseBreakingCapacity: { type: 'number' },
  autoWired: { type: 'boolean' },
};

function fieldIsValid(value: unknown, spec: EdgeDataFieldSpec): boolean {
  switch (spec.type) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'string':
      if (typeof value !== 'string') return false;
      if (spec.enumValues && !spec.enumValues.includes(value)) return false;
      return true;
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return false;
  }
}

/**
 * Prüft/entfernt bekannte Felder mit falschem Typ aus `edge.data`.
 * Rückgabe: bereinigte Datenkopie + Namen der entfernten Felder (für Logs/Tests).
 * Unbekannte Felder bleiben unangetastet.
 */
export function sanitizeEdgeDataBySchema(data: Record<string, unknown>): {
  data: Record<string, unknown>;
  removedFields: string[];
} {
  const removedFields: string[] = [];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const spec = EDGE_DATA_SCHEMA[key];
    if (spec && value !== undefined && !fieldIsValid(value, spec)) {
      removedFields.push(key);
      continue;
    }
    out[key] = value;
  }
  return { data: out, removedFields };
}
