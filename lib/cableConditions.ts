/**
 * lib/cableConditions.ts — FAHRZEUGSPEZIFISCHE VERLEGEBEDINGUNGEN (P0-3).
 *
 * Review 2026-11 / ELE-001: Bisher galt für JEDES Kabel
 * `VDE_AMPACITY(B2/30 °C) × pauschal 0,7`. Ob die Leitung einzeln im
 * Innenraum liegt oder zu dritt gebündelt im 60 °C warmen Motorraum, war
 * für Querschnitt, Sicherung und Prüfung gleich — und wurde im Bericht als
 * „geeignet" ausgewiesen.
 *
 * Dieses Modell führt KEINEN weiteren pauschalen Sicherheitsfaktor ein.
 * Es setzt die bereits im Repo dokumentierten Faktoren der EINEN I_z-Wahrheit
 * (`calculateCableIz`) je Leitung zusammen:
 *
 * ```text
 * I_z = I_z,Basis(B2/30 °C) · min(0,7 [Planerpauschale], f₁ · f₂ · f₃)
 *        f₁ = √((T_max − ϑ_U)/(T_max − 30 °C))   (IEC 60364-5-52 Tab. 52-4)
 *        f₂ = k_B(n)                             (VDE_GROUP_FACTORS, Q1/Q2)
 *        f₃ = 1                                 (keine geprüfte Verlegeart-Tabelle!)
 * ```
 *
 * Auswählbar sind daher **messbare Zustände** (Umgebungstemperatur, Anzahl
 * belasteter Stromkreise, Isolierstoffklasse der Fahrzeugleitung), nicht ein
 * erfundener „Motorraum-Faktor". Wo ein Hersteller einen konkreten I_z nennt,
 * kann `manufacturerIzA` die Tabellenrechnung übersteuern — mit eigener
 * Herkunftsangabe. Datengrundlage und Grenzen: `docs/KABEL-VERLEGEBEDINGUNGEN.md`.
 *
 * Referenzpläne ohne Angabe bleiben BYTE-GLEICH beim bisherigen Modell:
 * `kind === 'reference'` delegiert an `lookupThermalCrossSection`, `FUSE_MAP`
 * und `designAmpacity`. Es gibt keinen stillen neuen Default.
 */

import {
  DERATE_FACTOR,
  FUSE_MAP,
  MAX_MODELED_AMPACITY_A,
  MAX_MODELED_CROSS_SECTION_MM2,
  MIN_STANDARD_FUSE,
  STANDARD_FUSE_SIZES,
  VDE_SIZES,
  calculateCableIz,
  calculateMaxFuse,
  designAmpacity,
  groupFactor,
  isFuseFeasible,
  selectFuseSize,
  ambientTemperatureFactor,
  MAX_CONDUCTOR_TEMPERATURE_C,
  REFERENCE_AMBIENT_C,
  lookupThermalCrossSection,
  type CableIzResult,
  type InsulationClass,
} from './electrical';

/** Auswählbare Verlegebedingung. `reference` = unverändertes Auslieferungsmodell. */
export type CableInstallationConditionId =
  | 'reference'
  | 'interior-single'
  | 'interior-bundle'
  | 'cavity'
  | 'engine-bay'
  | 'roof-solar'
  | 'custom'
  | 'datasheet';

/** Fahrzeugleitungstyp → Isolierstoffklasse der I_z-Rechnung. */
export type CableInsulationId = 'FLRY-B' | 'FLR2X-B';

export interface CableInstallationPreset {
  id: CableInstallationConditionId;
  label: string;
  description: string;
  ambientC: number;
  bundledCircuits: number;
  insulation: InsulationClass;
  /** Herkunft der Angaben — erscheint im Inspektor und im Prüfbericht. */
  basis: readonly string[];
  /** Ist die Temperatur eine Annahme des Presets statt einer Messung? */
  temperatureIsAssumption: boolean;
}

/**
 * Presets sind BEWUSST keine Normtabellen: Sie benennen eine Einbausituation
 * und übersetzen sie in die zwei bereits dokumentierten Faktoren f₁ und f₂.
 * Die Temperaturwerte sind Planungsannahmen für typische Fahrzeugzonen,
 * keine Hersteller- oder Normmesswerte (siehe Dokumentation).
 */
export const CABLE_INSTALLATION_CONDITIONS: Readonly<
  Record<Exclude<CableInstallationConditionId, 'custom' | 'datasheet'>, CableInstallationPreset>
> = Object.freeze({
  reference: {
    id: 'reference',
    label: 'Referenzmodell (wie bisher)',
    description: 'Verlegeart B2, 30 °C, ein Stromkreis, PVC — unveränderte Auslieferungsannahme.',
    ambientC: REFERENCE_AMBIENT_C,
    bundledCircuits: 1,
    insulation: 'PVC',
    basis: [
      'VDE_AMPACITY: veröffentlichte B2-Reihe, 2 belastete Adern, 30 °C (AUDIT NORM-003)',
      'DERATE_FACTOR 0,7: dokumentierte Planerpauschale (AUDIT ELE-001)',
    ],
    temperatureIsAssumption: false,
  },
  'interior-single': {
    id: 'interior-single',
    label: 'Innenraum, einzeln frei verlegt',
    description: 'Wohnbereich, Luft um 30 °C, keine Bündelung mit anderen belasteten Stromkreisen.',
    ambientC: 30,
    bundledCircuits: 1,
    insulation: 'PVC',
    basis: ['Umgebung 30 °C = Tabellenreferenz (f₁ = 1)', 'Häufung n = 1 = VDE_GROUP_FACTORS[1] (f₂ = 1)'],
    temperatureIsAssumption: true,
  },
  'interior-bundle': {
    id: 'interior-bundle',
    label: 'Kabelkanal / Bündel im Innenraum (3 Stromkreise)',
    description: 'Drei gleichzeitig belastete Stromkreise in einer gemeinsamen Trasse bei 30 °C.',
    ambientC: 30,
    bundledCircuits: 3,
    insulation: 'PVC',
    basis: [
      'f₂ = VDE_GROUP_FACTORS[3] = 0,70 (DIN VDE 0298-4 Transkription Q1/Q2)',
      'Umgebung 30 °C = Tabellenreferenz (f₁ = 1)',
    ],
    temperatureIsAssumption: true,
  },
  cavity: {
    id: 'cavity',
    label: 'Hinter Verkleidung / Dachhohlraum (40 °C)',
    description: 'Wärmestau hinter Möbel- oder Dachverkleidung, einzeln verlegt.',
    ambientC: 40,
    bundledCircuits: 1,
    insulation: 'PVC',
    basis: [
      'f₁ = √((70 − 40)/(70 − 30)) ≈ 0,866 (IEC 60364-5-52 Tab. 52-4, PVC T_max 70 °C)',
      '40 °C ist eine Planungsannahme, kein Messwert',
    ],
    temperatureIsAssumption: true,
  },
  'engine-bay': {
    id: 'engine-bay',
    label: 'Motorraum / Abgasnähe (60 °C)',
    description: 'Heiße Zone, einzeln verlegt, PVC-Isolierung.',
    ambientC: 60,
    bundledCircuits: 1,
    insulation: 'PVC',
    basis: [
      'f₁ = √((70 − 60)/(70 − 30)) = 0,50 (IEC 60364-5-52 Tab. 52-4, PVC T_max 70 °C)',
      '60 °C ist eine konservative Planungsannahme, kein Messwert',
    ],
    temperatureIsAssumption: true,
  },
  'roof-solar': {
    id: 'roof-solar',
    label: 'Dach / unter Solarmodul (60 °C, 2 Stromkreise)',
    description: 'Aufgeheizte Modulrückseite, zwei gleichzeitig belastete Solarstränge.',
    ambientC: 60,
    bundledCircuits: 2,
    insulation: 'XLPE',
    basis: [
      'f₁ = √((90 − 60)/(90 − 30)) ≈ 0,707 (IEC 60364-5-52 Tab. 52-4, XLPE T_max 90 °C)',
      'f₂ = VDE_GROUP_FACTORS[2] = 0,80 (DIN VDE 0298-4 Transkription Q1/Q2)',
      'FLR2X-B (vernetztes PE) statt FLRY-B — Temperaturklasse, keine ISO-6722-Ampazitätstabelle',
    ],
    temperatureIsAssumption: true,
  },
});

export const CABLE_INSULATION_LABELS: Readonly<Record<CableInsulationId, string>> = Object.freeze({
  'FLRY-B': 'FLRY-B (PVC, 70 °C Leiter)',
  'FLR2X-B': 'FLR2X-B (XLPE, 90 °C Leiter)',
});

export const insulationClassOf = (id: CableInsulationId): InsulationClass =>
  id === 'FLR2X-B' ? 'XLPE' : 'PVC';

/** Persistierte Felder auf `edge.data` (siehe `lib/domain/cableEdgeData.ts`). */
export interface CableConditionFields {
  /** `string` statt Union: Importe können unbekannte Werte mitbringen. */
  installationCondition?: string;
  ambientC?: number;
  bundledCircuits?: number;
  cableInsulation?: string;
  /** Datenblatt-I_z in A — übersteuert die Tabellenrechnung. */
  manufacturerIzA?: number;
}

/** Teilaktualisierung aus dem Inspektor; `reset` entfernt alle Felder. */
export interface CableConditionPatch extends CableConditionFields {
  reset?: boolean;
}

export type CableConditionKind = 'reference' | 'preset' | 'custom' | 'datasheet';

/** Vertrauensgrad — nie „geprüft" ohne Datenblatt. */
export type CableConditionAssessment = 'reference-model' | 'assumption-based' | 'manufacturer-data';

export interface ResolvedCableConditions {
  kind: CableConditionKind;
  conditionId: CableInstallationConditionId;
  label: string;
  ambientC: number;
  bundledCircuits: number;
  insulation: InsulationClass;
  insulationId: CableInsulationId;
  /** f₃ — bewusst 1, solange keine geprüfte Verlegeart-Tabelle hinterlegt ist. */
  installationFactor: number;
  manufacturerIzA?: number;
  assessment: CableConditionAssessment;
  basis: readonly string[];
  assumptions: readonly string[];
  /** Menschenlesbare Erklärung für Inspektor und Prüfbericht. */
  explanation: string;
}

const isConditionId = (value: unknown): value is CableInstallationConditionId =>
  typeof value === 'string' &&
  (value === 'custom' ||
    value === 'datasheet' ||
    Object.prototype.hasOwnProperty.call(CABLE_INSTALLATION_CONDITIONS, value));

const finite = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * Einzige Ableitung der Verlegebedingungen EINER Leitung.
 *
 * @throws RangeError bei unzulässigen Werten (T ≥ T_max, n außerhalb 1…9).
 *   Kein stiller Fallback: ein unsinniger Nutzerwert muss sichtbar scheitern.
 */
export function resolveCableConditions(fields: CableConditionFields = {}): ResolvedCableConditions {
  if (fields.installationCondition !== undefined && !isConditionId(fields.installationCondition)) {
    throw new RangeError(
      `resolveCableConditions: unbekannte Verlegebedingung „${String(fields.installationCondition)}“ — kein stiller Rückfall auf das Referenzmodell`
    );
  }
  if (
    fields.cableInsulation !== undefined &&
    fields.cableInsulation !== 'FLRY-B' &&
    fields.cableInsulation !== 'FLR2X-B'
  ) {
    throw new RangeError(
      `resolveCableConditions: unbekannter Leitungstyp „${String(fields.cableInsulation)}“ — kein stiller Rückfall auf FLRY-B`
    );
  }
  // Nicht-endliche oder nicht-numerische Importwerte dürfen NICHT durch
  // `finite()` verschwinden: sonst stünde im Plan „60 °C", gerechnet würde 30 °C.
  for (const [name, value] of [
    ['ambientC', fields.ambientC],
    ['bundledCircuits', fields.bundledCircuits],
    ['manufacturerIzA', fields.manufacturerIzA],
  ] as const) {
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new RangeError(
        `resolveCableConditions: ${name} muss eine endliche Zahl sein (erhielt ${String(value)}) — kein stiller Rückfall`
      );
    }
  }
  const hasOwnFields =
    fields.ambientC !== undefined ||
    fields.bundledCircuits !== undefined ||
    fields.cableInsulation !== undefined ||
    fields.manufacturerIzA !== undefined;
  // Ohne ausdrückliche Auswahl, ABER mit eigenen Werten ist die Leitung
  // „custom" — nicht „reference". Vorher wurden solche Werte still ignoriert.
  const id: CableInstallationConditionId =
    fields.installationCondition ?? (hasOwnFields ? 'custom' : 'reference');
  if (id === 'reference' && hasOwnFields) {
    throw new RangeError(
      'resolveCableConditions: das Referenzmodell verträgt keine eigenen Temperatur-, Bündelungs- oder Datenblattwerte — bitte „Eigene Werte" oder „Datenblatt" wählen'
    );
  }
  if (id === 'datasheet' && fields.manufacturerIzA === undefined) {
    throw new RangeError(
      'resolveCableConditions: „Herstellerangabe" braucht I_z aus dem Datenblatt — ohne Wert ist die Leitung nicht bewertbar, nicht 30 °C'
    );
  }
  const preset = id === 'custom' || id === 'datasheet' ? undefined : CABLE_INSTALLATION_CONDITIONS[id];
  const insulationId: CableInsulationId = fields.cableInsulation === 'FLR2X-B' ? 'FLR2X-B' : 'FLRY-B';
  const insulation = preset?.insulation ?? insulationClassOf(insulationId);
  const ambientC = finite(fields.ambientC) ?? preset?.ambientC ?? REFERENCE_AMBIENT_C;
  const bundledCircuits = finite(fields.bundledCircuits) ?? preset?.bundledCircuits ?? 1;
  const manufacturerIzA = finite(fields.manufacturerIzA);

  if (ambientC >= MAX_CONDUCTOR_TEMPERATURE_C[insulation]) {
    throw new RangeError(
      `resolveCableConditions: Umgebung ${ambientC} °C ≥ Grenzleitertemperatur ${MAX_CONDUCTOR_TEMPERATURE_C[insulation]} °C (${insulation}) — Betrieb unzulässig`
    );
  }
  if (!Number.isInteger(bundledCircuits) || bundledCircuits < 1 || bundledCircuits > 9) {
    throw new RangeError(
      `resolveCableConditions: Häufung muss ganze Zahl 1…9 sein (erhielt ${bundledCircuits}) — VDE_GROUP_FACTORS ist dort definiert`
    );
  }
  groupFactor(bundledCircuits); // wirft bei undefinierter Tabellenzeile
  ambientTemperatureFactor(ambientC, insulation); // wirft bei unzulässiger Temperatur
  if (manufacturerIzA !== undefined && manufacturerIzA <= 0) {
    throw new RangeError('resolveCableConditions: Hersteller-I_z muss > 0 A sein');
  }

  const kind: CableConditionKind =
    id === 'custom' ? 'custom' : id === 'datasheet' ? 'datasheet' : preset ? 'preset' : 'reference';
  // Referenz NUR, wenn wirklich nichts Eigenes angegeben wurde.
  const isReference = id === 'reference';
  const assessment: CableConditionAssessment =
    manufacturerIzA !== undefined && (id === 'datasheet' || id === 'custom')
      ? 'manufacturer-data'
      : isReference
        ? 'reference-model'
        : 'assumption-based';
  const basis = preset?.basis ?? [
    'VDE_AMPACITY (B2/30 °C) + f₁/f₂ aus den dokumentierten Korrekturfunktionen',
    ...(manufacturerIzA !== undefined ? [`Herstellerangabe I_z = ${manufacturerIzA} A (Datenblatt)`] : []),
  ];
  const assumptions = [
    ...(preset?.temperatureIsAssumption || id === 'custom'
      ? [`Umgebungstemperatur ${ambientC} °C ist eine Planungsannahme, kein Messwert.`]
      : []),
    'f₃ (Verlegeart) = 1: für Verlegearten liegt im Repo KEINE geprüfte Korrekturtabelle vor — es wird kein Faktor erfunden.',
    'Die Basistabelle stammt aus der Hausinstallation (B2), nicht aus einer ISO-6722-Fahrzeugleitungstabelle.',
  ];
  const label =
    preset?.label ?? (id === 'datasheet' ? 'Herstellerangabe (Datenblatt)' : 'Eigene Verlegebedingungen');
  const explanation =
    manufacturerIzA !== undefined
      ? `I_z = ${manufacturerIzA.toFixed(1)} A (Herstellerangabe, übersteuert die Tabellenrechnung).`
      : `${label}: ${ambientC} °C, ${bundledCircuits} Stromkreis(e), ${insulation} — f₁ ${ambientTemperatureFactor(ambientC, insulation).toFixed(3)} × f₂ ${groupFactor(bundledCircuits).toFixed(3)} × f₃ 1,00, mindestens jedoch Planerpauschale ${DERATE_FACTOR}.`;

  return {
    kind: isReference ? 'reference' : kind,
    conditionId: id,
    label,
    ambientC,
    bundledCircuits,
    insulation,
    insulationId,
    installationFactor: 1,
    ...(manufacturerIzA !== undefined ? { manufacturerIzA } : {}),
    assessment,
    basis,
    assumptions,
    explanation,
  };
}

/** Ist für diese Leitung das unveränderte Auslieferungsmodell maßgeblich? */
export const isReferenceConditions = (conditions: ResolvedCableConditions): boolean =>
  conditions.kind === 'reference' && conditions.manufacturerIzA === undefined;

/**
 * Zulässige Belastbarkeit I_z EINES Querschnitts unter den Bedingungen.
 * Referenzbedingungen delegieren an `designAmpacity` (byte-stabil).
 */
export function cableIzFor(crossSectionMm2: number, conditions: ResolvedCableConditions): CableIzResult {
  if (isReferenceConditions(conditions)) {
    return calculateCableIz({ crossSectionMm2 });
  }
  if (conditions.manufacturerIzA !== undefined) {
    const base = calculateCableIz({ crossSectionMm2 }).baseIz;
    const iz = conditions.manufacturerIzA;
    const fakeFactors = { ambientFactor: 1, groupingFactor: 1, installationFactor: 1 };
    return {
      baseIz: base,
      ...fakeFactors,
      plannerFactor: DERATE_FACTOR,
      correctedIz: iz,
      source: 'physics-correction',
      confidence: 'computed',
      explanation: `I_z = ${iz.toFixed(2)} A (Herstellerangabe/Datenblatt; Tabellenbasis ${base.toFixed(2)} A nicht verwendet).`,
    };
  }
  return calculateCableIz({
    crossSectionMm2,
    ambientC: conditions.ambientC,
    insulation: conditions.insulation,
    bundledCircuits: conditions.bundledCircuits,
    installationFactor: conditions.installationFactor,
  });
}

/** Größter Strom, den das Modell unter diesen Bedingungen überhaupt abbildet. */
export function maximumModeledCurrentFor(conditions: ResolvedCableConditions): number {
  if (isReferenceConditions(conditions)) return MAX_MODELED_AMPACITY_A * DERATE_FACTOR;
  return cableIzFor(MAX_MODELED_CROSS_SECTION_MM2, conditions).correctedIz;
}

export interface ThermalCableChoice {
  status: 'within-model' | 'outside-model';
  crossSectionMm2: number;
  requiredCurrentA: number;
  maximumModeledCurrentA: number;
}

/**
 * Kleinster Normquerschnitt, der den Strom unter den gewählten Bedingungen
 * thermisch trägt. Oberhalb der Modellgrenze wird NICHT „70 mm² reicht"
 * behauptet — der Aufrufer muss `status` auswerten (Regel M).
 */
export function thermalCrossSectionForConditions(
  currentA: number,
  conditions: ResolvedCableConditions
): ThermalCableChoice {
  if (!Number.isFinite(currentA) || currentA < 0) {
    throw new RangeError(
      `thermalCrossSectionForConditions: Strom muss endlich und ≥ 0 sein (erhielt ${currentA})`
    );
  }
  const maximum = maximumModeledCurrentFor(conditions);
  if (isReferenceConditions(conditions)) {
    const boundary = currentA > maximum + 1e-9;
    return {
      status: boundary ? 'outside-model' : 'within-model',
      crossSectionMm2: lookupThermalCrossSection(currentA),
      requiredCurrentA: currentA,
      maximumModeledCurrentA: maximum,
    };
  }
  const size = VDE_SIZES.find((cs) => cableIzFor(cs, conditions).correctedIz + 1e-9 >= currentA);
  return {
    status: size === undefined ? 'outside-model' : 'within-model',
    crossSectionMm2: size ?? MAX_MODELED_CROSS_SECTION_MM2,
    requiredCurrentA: currentA,
    maximumModeledCurrentA: maximum,
  };
}

/** Größte Norm-Sicherung ≤ I_z des Querschnitts unter den Bedingungen. */
export function maxFuseForConditions(crossSectionMm2: number, conditions: ResolvedCableConditions): number {
  if (isReferenceConditions(conditions))
    return FUSE_MAP[crossSectionMm2] ?? calculateMaxFuse(crossSectionMm2);
  const iz = cableIzFor(crossSectionMm2, conditions).correctedIz;
  return [...STANDARD_FUSE_SIZES].reverse().find((rating) => rating <= iz + 1e-9) ?? MIN_STANDARD_FUSE;
}

/** Kleinste Norm-Sicherung ≥ Betriebsstrom, aber nie über I_z. */
export function selectFuseForConditions(
  currentA: number,
  crossSectionMm2: number,
  conditions: ResolvedCableConditions
): number {
  if (isReferenceConditions(conditions)) return selectFuseSize(currentA, crossSectionMm2);
  const maxFuse = maxFuseForConditions(crossSectionMm2, conditions);
  const minFuse = Math.max(1, Math.ceil(currentA));
  return STANDARD_FUSE_SIZES.find((size) => size >= minFuse && size <= maxFuse) ?? maxFuse;
}

export function isFuseFeasibleForConditions(
  currentA: number,
  crossSectionMm2: number,
  conditions: ResolvedCableConditions
): boolean {
  if (isReferenceConditions(conditions)) return isFuseFeasible(currentA, crossSectionMm2);
  return Math.max(1, Math.ceil(currentA)) <= maxFuseForConditions(crossSectionMm2, conditions);
}

/** Fassade für AutoWire: eine Bedingung, alle Sizing-Fragen derselben Leitung. */
export interface CableSizingFacade {
  conditions: ResolvedCableConditions;
  isReference: boolean;
  /**
   * `false` ⇒ die gespeicherten Verlegebedingungen sind ungültig. Aufrufer
   * MÜSSEN die Leitung als „nicht ausführbar" markieren: der Prüfbericht
   * meldet UNVERIFIABLE, der Inspektor zeigt den Fehler. Die mitgelieferten
   * Rechenfunktionen arbeiten dann auf der Referenzbasis, damit ein
   * AutoWire-Lauf nicht mitten im Plan abbricht — sie sind aber ausdrücklich
   * NICHT als gültige Bewertung zu verstehen.
   */
  valid: boolean;
  error?: string;
  iz: (cs: number) => number;
  thermalCrossSection: (I: number) => ThermalCableChoice;
  maxFuse: (cs: number) => number;
  selectFuse: (I: number, cs: number) => number;
  isFuseFeasible: (I: number, cs: number) => boolean;
}

export function cableSizingFor(fields: CableConditionFields = {}): CableSizingFacade {
  let conditions: ResolvedCableConditions;
  let valid = true;
  let error: string | undefined;
  try {
    conditions = resolveCableConditions(fields);
  } catch (cause) {
    valid = false;
    error = cause instanceof Error ? cause.message : String(cause);
    conditions = resolveCableConditions(); // reine Rechenbasis, nie als gültig gemeldet
  }
  const isReference = isReferenceConditions(conditions);
  return {
    conditions,
    isReference,
    valid,
    ...(error !== undefined ? { error } : {}),
    iz: (cs: number) => (isReference ? designAmpacity(cs) : cableIzFor(cs, conditions).correctedIz),
    thermalCrossSection: (I: number) => thermalCrossSectionForConditions(I, conditions),
    maxFuse: (cs: number) => maxFuseForConditions(cs, conditions),
    selectFuse: (I: number, cs: number) => selectFuseForConditions(I, cs, conditions),
    isFuseFeasible: (I: number, cs: number) => isFuseFeasibleForConditions(I, cs, conditions),
  };
}
