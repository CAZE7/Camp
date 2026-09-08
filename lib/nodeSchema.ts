/**
 * lib/nodeSchema.ts — deklaratives Runtime-Schema für node.data (AUDIT DOM-003).
 *
 * Bisher lebten elektrisch relevante Felder (watts, amps, chemistry, hasRcd, …)
 * untypisiert in `node.data`; das disziplinierte Lesen über `parseQuantity`
 * fing Zahlensmüll zur Laufzeit ab, aber Persistenz/Import tolerierten
 * falsch getippte Felder still. Dieses Modul deklariert die bekannten Felder
 * je Bauteiltyp zentral und stellt einen Prüflauf bereit, den die
 * Persistenz-Migration (store/slices/persistence.ts) anwendet.
 *
 * Regeln (bewusst konservativ, Daten-Integrity vor Komfort):
 * - BEKANNTES Feld mit falschem Laufzeit-Typ → wird ENTFERNT (kaputte Werte
 *   nicht durch 0 ersetzen — stillersetzen würde falsche Pläne plausibel
 *   machen; Entfernen fällt auf den dokumentierten Default der Leseschicht).
 * - UNBEKANNTE Felder bleiben erhalten (Forward-Kompatibilität: neuere
 *   Versionen dürfen ältere Stände lesen, ohne Daten zu verlieren).
 * - Enum-Felder (chemistry, role) prüfen gegen die erlaubten Werte.
 *
 * Kein Zod/Extern-Deps: das Repo führt seine eigene Units-/Typisierungslinie
 * (lib/units.ts) — ein handgerolltes 40-Zeilen-Schema reicht für den
 * deklarativen Anspruch und bleibt auditierbar.
 */

export type NodeDataFieldType = 'number' | 'string' | 'boolean' | 'stringArray';

export interface NodeDataFieldSpec {
  type: NodeDataFieldType;
  /** Erlaubte Werte (nur für 'string'). */
  enumValues?: readonly string[];
  /** true = 0/'' ist erlaubt (Zahlen via Number.isFinite geprüft). */
  allowZero?: boolean;
}

/** Felder, die JEDE Bauteilart haben darf (CommonNodeData). */
const COMMON_FIELDS: Record<string, NodeDataFieldSpec> = {
  label: { type: 'string' },
  watts: { type: 'number', allowZero: true },
  concurrentDevices: { type: 'stringArray' },
  continuousPower: { type: 'number', allowZero: true },
};

/**
 * Deklarative Feldtabelle je Bauteiltyp — Spiegel von
 * components/nodes/types.ts (NodeDataRegistry). Änderungen dort gehören
 * hierher (Test nodeSchema.test.ts hält die Feldnamen synchron, soweit
 * elektrisch relevant).
 */
export const NODE_DATA_SCHEMA: Record<string, Record<string, NodeDataFieldSpec>> = {
  battery: {
    ...COMMON_FIELDS,
    capacity: { type: 'number', allowZero: true },
    chemistry: {
      type: 'string',
      enumValues: ['LiFePO4', 'AGM', 'Gel'],
    },
    nominalVoltage: { type: 'number', allowZero: true },
    role: { type: 'string', enumValues: ['starter', 'house'] },
    hasInternalBms: { type: 'boolean' },
    hasExternalBms: { type: 'boolean' },
    bmsContinuousDischarge: { type: 'number', allowZero: true },
    bmsPeakDischarge: { type: 'number', allowZero: true },
    bmsContinuousCharge: { type: 'number', allowZero: true },
    // AUDIT DOM-002: Batterie-Innenwiderstand (mΩ, Datenblatt) — schlägt
    // die Chemie-Faustformel in lib/shortCircuit.ts.
    internalResistance: { type: 'number', allowZero: true },
  },
  busbar: {
    ...COMMON_FIELDS,
    role: { type: 'string', enumValues: ['positive', 'negative'] },
    rating: { type: 'number', allowZero: true },
  },
  fuse: { ...COMMON_FIELDS, rating: { type: 'number', allowZero: true } },
  charger: {
    ...COMMON_FIELDS,
    amps: { type: 'number', allowZero: true },
    efficiency: { type: 'number', allowZero: true },
  },
  mpptController: {
    ...COMMON_FIELDS,
    amps: { type: 'number', allowZero: true },
    efficiency: { type: 'number', allowZero: true },
    maxPvVoltage: { type: 'number', allowZero: true },
  },
  dcdcCharger: {
    ...COMMON_FIELDS,
    amps: { type: 'number', allowZero: true },
    efficiency: { type: 'number', allowZero: true },
  },
  acBatteryCharger: {
    ...COMMON_FIELDS,
    amps: { type: 'number', allowZero: true },
    efficiency: { type: 'number', allowZero: true },
  },
  consumer: { ...COMMON_FIELDS, hours: { type: 'number', allowZero: true } },
  consumer230v: { ...COMMON_FIELDS, hours: { type: 'number', allowZero: true } },
  inverter: {
    ...COMMON_FIELDS,
    // continuousPower steckt in COMMON_FIELDS (ELE-006).
    hasRcd: { type: 'boolean' },
  },
  shorePower: {
    ...COMMON_FIELDS,
    hasRcd: { type: 'boolean' },
    rating: { type: 'number', allowZero: true },
    acCurrentA: { type: 'number', allowZero: true },
  },
  solar: {
    ...COMMON_FIELDS,
    voltage: { type: 'number', allowZero: true },
    amps: { type: 'number', allowZero: true },
    voc: { type: 'number', allowZero: true },
    isc: { type: 'number', allowZero: true },
    tempCoefficient: { type: 'number' }, // negativ erlaubt, 0 unsinnig aber ungiftig
  },
  roofSolar: {
    ...COMMON_FIELDS,
    voc: { type: 'number', allowZero: true },
    isc: { type: 'number', allowZero: true },
    tempCoefficient: { type: 'number' },
  },
  shunt: { ...COMMON_FIELDS },
  ground: { ...COMMON_FIELDS },
  conduit: { ...COMMON_FIELDS, conduitType: { type: 'string' } },
};

function fieldIsValid(value: unknown, spec: NodeDataFieldSpec): boolean {
  switch (spec.type) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'string':
      if (typeof value !== 'string') return false;
      if (spec.enumValues && !spec.enumValues.includes(value)) return false;
      return true;
    case 'boolean':
      return typeof value === 'boolean';
    case 'stringArray':
      return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
    default:
      return false;
  }
}

/**
 * Prüft/entfernt bekannte Felder mit falschem Typ aus node.data.
 * Rückgabe: bereinigte Datenkopie + Namen der entfernten Felder (für Logs/Tests).
 * Unbekannte Felder und unbekannte Bauteiltypen bleiben unangetastet.
 */
export function sanitizeNodeDataBySchema(
  nodeType: string | null | undefined,
  data: Record<string, unknown>
): { data: Record<string, unknown>; removedFields: string[] } {
  const spec = nodeType ? NODE_DATA_SCHEMA[nodeType] : undefined;
  if (!spec) return { data, removedFields: [] };
  const removedFields: string[] = [];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const fieldSpec = spec[key];
    if (fieldSpec && value !== undefined && !fieldIsValid(value, fieldSpec)) {
      removedFields.push(key);
      continue;
    }
    out[key] = value;
  }
  return { data: out, removedFields };
}
