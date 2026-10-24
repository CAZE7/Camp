/**
 * lib/nodeSchema.ts — deklaratives Runtime-Schema für node.data (AUDIT DOM-003, K3, N9).
 *
 * Bisher lebten elektrisch relevante Felder (watts, amps, chemistry, hasRcd, …)
 * untypisiert in `node.data`; das disziplinierte Lesen über `parseQuantity`
 * fing Zahlensmüll zur Laufzeit ab, aber Persistenz/Import tolerierten
 * falsch getippte oder unphysikalische Werte (z. B. `watts: -5` aus einem
 * manipulierten `#plan=`-Link, K3) still. Dieses Modul deklariert die bekannten
 * Felder inkl. Wertebereich je Bauteiltyp zentral und stellt einen Prüflauf
 * bereit, den Persistenz-Migration (`store/slices/persistence.ts`) und
 * Projekt-/Link-Import (`store/projectFile.ts`) anwenden.
 *
 * Regeln (bewusst konservativ, Daten-Integrity vor Komfort):
 * - BEKANNTES Feld mit falschem Laufzeit-Typ oder außerhalb `[min, max]` →
 *   wird ENTFERNT (kaputte Werte nicht durch 0 ersetzen — stillersetzen würde
 *   falsche Pläne plausibel machen; Entfernen fällt auf den dokumentierten
 *   Default der Leseschicht).
 * - UNBEKANNTE Felder bleiben erhalten (Forward-Kompatibilität: neuere
 *   Versionen dürfen ältere Stände lesen, ohne Daten zu verlieren).
 * - Enum-Felder (chemistry, role, kind) prüfen gegen die erlaubten Werte.
 *
 * Kein Zod/Extern-Deps: das Repo führt seine eigene Units-/Typisierungslinie
 * (lib/units.ts) — ein handgerolltes Schema reicht für den deklarativen
 * Anspruch und bleibt auditierbar.
 */

export type NodeDataFieldType = 'number' | 'string' | 'boolean' | 'stringArray';

export interface NodeDataFieldSpec {
  type: NodeDataFieldType;
  /** Erlaubte Werte (nur für 'string'). */
  enumValues?: readonly string[];
  /** true = 0/'' ist erlaubt (Zahlen via Number.isFinite geprüft). */
  allowZero?: boolean;
  /** Untere Schranke inklusive (nur für 'number'). */
  min?: number;
  /** Obere Schranke inklusive (nur für 'number'). */
  max?: number;
}

/** Felder, die JEDE Bauteilart haben darf (CommonNodeData). */
const COMMON_FIELDS: Record<string, NodeDataFieldSpec> = {
  label: { type: 'string' },
  /** Laufende Anlagenkennung (G1, G1.2, …). Anzeige, keine elektrische Größe. */
  designator: { type: 'string' },
  watts: { type: 'number', allowZero: true, min: 0, max: 100_000 },
  concurrentDevices: { type: 'stringArray' },
  continuousPower: { type: 'number', allowZero: true, min: 0, max: 100_000 },
};

const WATER_NODE_FIELDS: Record<string, NodeDataFieldSpec> = {
  ...COMMON_FIELDS,
  kind: { type: 'string', enumValues: ['fresh', 'gray'] },
};

const ROOF_NODE_FIELDS: Record<string, NodeDataFieldSpec> = {
  ...COMMON_FIELDS,
  width: { type: 'number', allowZero: true, min: 0, max: 50_000 },
  height: { type: 'number', allowZero: true, min: 0, max: 50_000 },
  isInvalid: { type: 'boolean' },
  isOverlapping: { type: 'boolean' },
  rows: { type: 'number', min: 1, max: 100 },
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
    capacity: { type: 'number', allowZero: true, min: 0, max: 100_000 },
    chemistry: {
      type: 'string',
      enumValues: ['LiFePO4', 'AGM', 'Gel'],
    },
    nominalVoltage: { type: 'number', allowZero: false, min: 1, max: 1_000 },
    role: { type: 'string', enumValues: ['starter', 'house'] },
    hasInternalBms: { type: 'boolean' },
    hasExternalBms: { type: 'boolean' },
    bmsContinuousDischarge: { type: 'number', allowZero: true, min: 0, max: 10_000 },
    bmsPeakDischarge: { type: 'number', allowZero: true, min: 0, max: 10_000 },
    bmsContinuousCharge: { type: 'number', allowZero: true, min: 0, max: 10_000 },
    // AUDIT DOM-002: Batterie-Innenwiderstand (mΩ, Datenblatt) — schlägt
    // die Chemie-Faustformel in lib/shortCircuit.ts.
    internalResistance: { type: 'number', allowZero: true, min: 0, max: 10_000 },
    // DOM-002-Nachpflege: Peukert-Exponent (k ≥ 1, Datenblatt) — schlägt den
    // Chemie-Faustwert in lib/peukert.ts.
    peukertExponent: { type: 'number', min: 1, max: 2 },
    // ── V2: EXPLIZITES BANK-MODELL (lib/electricalGraph/batteryBank.ts) ──
    /** Zugehörigkeit zu einer Batteriebank (frei wählbarer Name). */
    bankId: { type: 'string' },
    /** Verschaltung der Bank. Fehlt sie bei mehreren Akkus: Rückfrage. */
    bankTopology: {
      type: 'string',
      enumValues: ['single', 'series', 'parallel', 'series-parallel'],
    },
    /** Stränge in Reihe (nur `series-parallel`). */
    bankSeries: { type: 'number', min: 1, max: 64 },
    /** Parallele Stränge (nur `series-parallel`). */
    bankParallel: { type: 'number', min: 1, max: 64 },
  },
  busbar: {
    ...COMMON_FIELDS,
    role: { type: 'string', enumValues: ['positive', 'negative'] },
    rating: { type: 'number', allowZero: true, min: 0, max: 10_000 },
  },
  fuse: { ...COMMON_FIELDS, rating: { type: 'number', allowZero: true, min: 0, max: 10_000 } },
  charger: {
    ...COMMON_FIELDS,
    amps: { type: 'number', allowZero: true, min: 0, max: 10_000 },
    efficiency: { type: 'number', allowZero: true, min: 0, max: 100 },
  },
  mpptController: {
    ...COMMON_FIELDS,
    amps: { type: 'number', allowZero: true, min: 0, max: 10_000 },
    efficiency: { type: 'number', allowZero: true, min: 0, max: 100 },
    maxPvVoltage: { type: 'number', allowZero: true, min: 0, max: 1_500 },
  },
  dcdcCharger: {
    ...COMMON_FIELDS,
    amps: { type: 'number', allowZero: true, min: 0, max: 10_000 },
    efficiency: { type: 'number', allowZero: true, min: 0, max: 100 },
  },
  acBatteryCharger: {
    ...COMMON_FIELDS,
    amps: { type: 'number', allowZero: true, min: 0, max: 10_000 },
    efficiency: { type: 'number', allowZero: true, min: 0, max: 100 },
    /** Speisende 230-V-Quelle (s. consumer230v.acSourceId). */
    acSourceId: { type: 'string' },
  },
  consumer: { ...COMMON_FIELDS, hours: { type: 'number', allowZero: true, min: 0, max: 24 } },
  consumer230v: {
    ...COMMON_FIELDS,
    hours: { type: 'number', allowZero: true, min: 0, max: 24 },
    acSourceId: { type: 'string' },
  },
  inverter: {
    ...COMMON_FIELDS,
    hasRcd: { type: 'boolean' },
    efficiency: { type: 'number', allowZero: true, min: 0, max: 100 },
    idleWatts: { type: 'number', allowZero: true, min: 0, max: 1_000 },
    hours: { type: 'number', allowZero: true, min: 0, max: 24 },
    /** Landstrom-Quelle am AC-Eingang (s. consumer230v.acSourceId). */
    acSourceId: { type: 'string' },
  },
  shorePower: {
    ...COMMON_FIELDS,
    hasRcd: { type: 'boolean' },
    rating: { type: 'number', allowZero: true, min: 0, max: 10_000 },
    acCurrentA: { type: 'number', allowZero: true, min: 0, max: 1_000 },
    prospectiveIkA: { type: 'number', allowZero: true, min: 0, max: 100_000 },
  },
  solar: {
    ...COMMON_FIELDS,
    voltage: { type: 'number', allowZero: true, min: 0, max: 1_500 },
    amps: { type: 'number', allowZero: true, min: 0, max: 1_000 },
    voc: { type: 'number', allowZero: true, min: 0, max: 1_500 },
    isc: { type: 'number', allowZero: true, min: 0, max: 1_000 },
    // Bruch pro Kelvin (−0,0035 = −0,35 %/K; Alt-Importe bis −2 %/K), negativ — AUDIT S1.
    tempCoefficient: { type: 'number', min: -2, max: 0 },
  },
  roofSolar: {
    ...ROOF_NODE_FIELDS,
    voc: { type: 'number', allowZero: true, min: 0, max: 1_500 },
    isc: { type: 'number', allowZero: true, min: 0, max: 1_000 },
    tempCoefficient: { type: 'number', min: -2, max: 0 },
  },
  roofWindow: { ...ROOF_NODE_FIELDS },
  roofBackground: { ...ROOF_NODE_FIELDS },
  shunt: { ...COMMON_FIELDS },
  ground: { ...COMMON_FIELDS },
  conduit: { ...COMMON_FIELDS, conduitType: { type: 'string' }, assignedEdges: { type: 'stringArray' } },
  freshWaterTank: { ...WATER_NODE_FIELDS },
  grayWaterTank: { ...WATER_NODE_FIELDS },
  pump: { ...WATER_NODE_FIELDS },
  accumulator: { ...WATER_NODE_FIELDS },
  preFilter: { ...WATER_NODE_FIELDS },
  sink: { ...WATER_NODE_FIELDS },
  shower: { ...WATER_NODE_FIELDS },
};

export const KNOWN_NODE_TYPES: ReadonlySet<string> = new Set(Object.keys(NODE_DATA_SCHEMA));

export function isKnownNodeType(nodeType: unknown): nodeType is string {
  return typeof nodeType === 'string' && KNOWN_NODE_TYPES.has(nodeType);
}

function fieldIsValid(value: unknown, spec: NodeDataFieldSpec): boolean {
  switch (spec.type) {
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
      if (spec.allowZero === false && value === 0) return false;
      if (spec.min !== undefined && value < spec.min) return false;
      if (spec.max !== undefined && value > spec.max) return false;
      return true;
    }
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
 * Deutsche Anzeigenamen für bekannte Knoten-Datenfelder (AUDIT N15).
 * Verhindert rohe JSON-Feldnamen wie `watts` oder `nominalVoltage` in Import-Warnungen.
 */
export const NODE_FIELD_LABELS_DE: Record<string, string> = {
  label: 'Bezeichnung',
  designator: 'Anlagenkennung',
  watts: 'Leistung (W)',
  continuousPower: 'Dauerleistung (W)',
  idleWatts: 'Eigenverbrauch (W)',
  hours: 'Nutzungsdauer (h/Tag)',
  capacity: 'Kapazität (Ah)',
  chemistry: 'Zellchemie',
  nominalVoltage: 'Nennspannung (V)',
  role: 'Rolle',
  hasInternalBms: 'Internes BMS',
  hasExternalBms: 'Externes BMS',
  bmsContinuousDischarge: 'BMS-Dauerentladestrom (A)',
  bmsPeakDischarge: 'BMS-Spitzenstrom (A)',
  bmsContinuousCharge: 'BMS-Ladestrom (A)',
  internalResistance: 'Innenwiderstand (mΩ)',
  peukertExponent: 'Peukert-Exponent',
  rating: 'Bemessungsstrom (A)',
  amps: 'Strom (A)',
  efficiency: 'Wirkungsgrad (%)',
  maxPvVoltage: 'Max. PV-Eingangsspannung (V)',
  voltage: 'Arbeitsspannung (V)',
  voc: 'Leerlaufspannung Voc (V)',
  isc: 'Kurzschlussstrom Isc (A)',
  tempCoefficient: 'Temperaturkoeffizient Voc',
  hasRcd: 'FI-Schutzschalter (RCD)',
  prospectiveIkA: 'Kurzschlussstrom Ik (A)',
  acCurrentA: 'AC-Strom (A)',
  width: 'Breite',
  height: 'Länge',
  conduitType: 'Rohrtyp',
  assignedEdges: 'Zugewiesene Leitungen',
  concurrentDevices: 'Gleichzeitige Geräte',
};

/** Deutsche Anzeigenamen für Bauteiltypen (AUDIT N15). */
export const NODE_TYPE_LABELS_DE: Record<string, string> = {
  battery: 'Batterie',
  solar: 'Solarmodul',
  mpptController: 'MPPT-Solarladeregler',
  dcdcCharger: 'Ladebooster (DC-DC)',
  acBatteryCharger: '230-V-Ladegerät',
  charger: 'Ladegerät',
  inverter: 'Wechselrichter',
  shorePower: 'Landstromanschluss',
  consumer: '12-V-Verbraucher',
  consumer230v: '230-V-Verbraucher',
  fuse: 'Sicherung / Sicherungskasten',
  busbar: 'Sammelschiene',
  shunt: 'Messshunt',
  ground: 'Massepunkt',
  conduit: 'Leerrohr',
  roofSolar: 'Dach-Solarmodul',
  roofWindow: 'Dachluke',
  freshWaterTank: 'Frischwassertank',
  grayWaterTank: 'Abwassertank',
  pump: 'Wasserpumpe',
  accumulator: 'Druckausgleichsgefäß',
  preFilter: 'Vorfilter',
  sink: 'Spüle',
  shower: 'Dusche',
};

export function describeNodeFieldDe(field: string): string {
  return NODE_FIELD_LABELS_DE[field] ?? field;
}

/**
 * Synchronisiert automatische Standardbezeichnungen („100Ah Lithium“, „150W Solar“,
 * „500W Inverter“, „Solarmodul 200 W“) mit geänderten Zahlenwerten, ohne frei
 * vergebene Nutzernamen („Aufbaubatterie Sitzbank“, „MultiPlus“) zu überschreiben
 * (AUDIT M7 + N13).
 */
export function syncDefaultNodeLabel(
  nodeType: string | null | undefined,
  currentData: Record<string, unknown>,
  patch?: Record<string, unknown>
): string | undefined {
  // Wenn der Aufrufer im selben Schritt explizit ein neues Label übergibt, gewinnt dieses.
  if (patch && typeof patch.label === 'string') return patch.label;

  const merged = patch ? { ...currentData, ...patch } : currentData;
  const rawLabel = typeof merged.label === 'string' ? merged.label.trim() : '';
  if (!rawLabel) return undefined;

  if (nodeType === 'inverter') {
    const power = Number(merged.continuousPower ?? merged.watts);
    if (!Number.isFinite(power) || power <= 0) return undefined;
    const rounded = Math.round(power);
    const leading = rawLabel.match(/^(\d+(?:[.,]\d+)?)(\s*)W\s+(Inverter|Wechselrichter)$/i);
    if (leading?.[3]) return `${rounded}${leading[2] ?? ''}W ${leading[3]}`;
    const trailing = rawLabel.match(/^(Inverter|Wechselrichter)(\s+)(\d+(?:[.,]\d+)?)(\s*)W$/i);
    if (trailing?.[1]) return `${trailing[1]}${trailing[2] ?? ' '}${rounded}${trailing[4] ?? ''}W`;
    return undefined;
  }

  if (nodeType === 'battery') {
    const cap = Number(merged.capacity);
    if (!Number.isFinite(cap) || cap <= 0) return undefined;
    const rounded = Math.round(cap);
    const chem = typeof merged.chemistry === 'string' ? merged.chemistry : undefined;
    const mapChemWord = (word: string): string => {
      if (!chem) return word;
      if (/^(lithium|lifepo4|agm|gel)$/i.test(word)) {
        if (chem === 'LiFePO4') return /^lithium$/i.test(word) ? 'Lithium' : 'LiFePO4';
        return chem;
      }
      return word;
    };
    const leading = rawLabel.match(
      /^(\d+(?:[.,]\d+)?)(\s*)Ah\s+(Lithium|LiFePO4|AGM|Gel|Batterie|Aufbaubatterie|Starterbatterie)$/i
    );
    if (leading?.[3]) {
      return `${rounded}${leading[2] ?? ''}Ah ${mapChemWord(leading[3])}`;
    }
    const trailing = rawLabel.match(
      /^(Batterie|Aufbaubatterie|Starterbatterie|Lithium|LiFePO4|AGM|Gel)(\s+)(\d+(?:[.,]\d+)?)(\s*)Ah$/i
    );
    if (trailing?.[1]) {
      return `${mapChemWord(trailing[1])}${trailing[2] ?? ' '}${rounded}${trailing[4] ?? ''}Ah`;
    }
    return undefined;
  }

  if (nodeType === 'solar' || nodeType === 'roofSolar') {
    const watts = Number(merged.watts);
    if (!Number.isFinite(watts) || watts <= 0) return undefined;
    const rounded = Math.round(watts);
    const leading = rawLabel.match(/^(\d+(?:[.,]\d+)?)(\s*)W(p?)\s+(Solar(?:modul|panel)?)$/i);
    if (leading?.[4]) {
      return `${rounded}${leading[2] ?? ''}W${leading[3] ?? ''} ${leading[4]}`;
    }
    const trailing = rawLabel.match(/^(Solar(?:modul|panel)?)(\s+)(\d+(?:[.,]\d+)?)(\s*)W(p?)$/i);
    if (trailing?.[1]) {
      return `${trailing[1]}${trailing[2] ?? ' '}${rounded}${trailing[4] ?? ''}W${trailing[5] ?? ''}`;
    }
    return undefined;
  }

  return undefined;
}

/**
 * Prüft/entfernt bekannte Felder mit falschem Typ oder außerhalb `[min, max]` aus node.data.
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
  const syncedLabel = syncDefaultNodeLabel(nodeType, out);
  if (syncedLabel !== undefined && syncedLabel !== out.label) {
    out.label = syncedLabel;
  }
  return { data: out, removedFields };
}
