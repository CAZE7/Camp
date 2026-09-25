import { COPPER_RESISTIVITY_OHM_MM2_PER_M as COPPER_RESISTIVITY_OHM_MM2_PER_M_SOURCE } from './materials';

/**
 * lib/acProtection.ts — DOM-001: Mehrleiter-/Schutzmodell der 230-V-Seite.
 *
 * Bisher waren AC-Kanten Einleiter-Abstraktionen: „3-adrig (L, N, PE)" war
 * Label-Text ohne Modell, und `fuseSize` war ein Zahlenfeld ohne Bauform,
 * Charakteristik und Abschaltvermögen (AUDIT DOM-001, VERIFIED). Dieses
 * Modul trägt den normativen Kern nach — als reine Funktionen:
 *
 * 1. **Mehrleiter-Zusammensetzung** (`acCableComposition`): Phase/Neutral
 *    aus dem Leitungsquerschnitt, Schutzleiter nach
 *    **IEC 60364-5-54 Tabelle 54.2** (PE = S bis 16 mm², PE = 16 mm² bis
 *    35 mm², PE = S/2 darüber — Mindestquerschnitte ohne gesonderte Rechnung).
 * 2. **Leitungsschutzschalter-Daten** (`AcProtectionDescriptor`): Bauart
 *    (LS/MCB, FI-LS/RCBO), Charakteristik (B/C) und Bemessungs-
 *    Abschaltvermögen nach **IEC 60898-1** — magnetische Schnellauslöse-
 *    bereiche B = 3–5×In, C = 5–10×In; übliche Icn-Stufen 6 kA / 10 kA.
 * 3. **Abschaltbedingung** (`evaluateAcEdgeProtection`) nach
 *    **IEC 60364-4-41 §411.3.2** (automatische Abschaltung der
 *    Stromversorgung, TN-Netz): Zs·Ia ≤ U0. Ia ist der garantierte
 *    Auslösestrom = obere Grenze des magnetischen Bereichs (B: 5×In,
 *    C: 10×In). Die Schätzung rechnet konservativ:
 *
 *    - Schleifenanteil der Leitung mit dem PE aus Tabelle 54.2
 *      (ρ_Cu = 0,0175 Ω·mm²/m bei 20 °C; Hin- und Rückweg über Phase und
 *      PE — das Mehrleitermodell wirkt hier konkret),
 *    - zulässiges Zs mit der **2/3-Regel** aus DIN VDE 0100-600
 *      (deckt Messunsicherheit und Leitererwärmung im Fehlerfall ab),
 *    - vorgelagerte Netzimpedanz als deklarierte Annahme
 *      (`UPSTREAM_IMPEDANCE_ASSUMPTION_OHM`, 0,8 Ω CEE-16-A-Näherung,
 *      UNVERIFIED — ein Messwert vor Ort schlägt diese Annahme).
 *
 *    Sonderfälle ehrlich statt allgemein: Wechselrichter-Ausgänge sind
 *    elektronisch strombegrenzt (kein TN-Schleifenmodell — Hersteller-
 *    Datenblatt), und ein 30-mA-FI (`hasRcd` am Landstrom oder RCBO)
 *    deckt den Fehlerschutz auch außerhalb der magnetischen
 *    Abschaltbedingung. Bleibende Modellgrenzen: N-Leiterführung einzeln,
 *    Trenn-/Umschalteinrichtungen und Selektivität — der Plan bleibt ein
 *    Single-Line-Schema.
 */

/**
 * Leitfähigkeits-Resistivität von Kupfer bei 20 °C [Ω·mm²/m] — EINE Quelle
 * (lib/materials.ts). Vorher stand hier 0,0175, während der Spannungsfall in
 * electrical.ts/voltageDrop.ts mit κ = 58 rechnete (Kehrwert 0,017241): zwei
 * Kupferwerte für denselben Werkstoff (AUDIT ELE-010).
 */
const COPPER_RESISTIVITY_OHM_MM2_PER_M = COPPER_RESISTIVITY_OHM_MM2_PER_M_SOURCE;

/**
 * Angenommene vorgelagerte Netzimpedanz bis zur Einspeisestelle (CEE-16-A-
 * Campingzuleitung/Trafonäherung). UNVERIFIED — ein Messwert vor Ort
 * schlägt diese Annahme; die Formel ist bewusst austauschbar gebaut.
 */
export const UPSTREAM_IMPEDANCE_ASSUMPTION_OHM = 0.8;

/** Referenzspannung der 230-V-Modellebene (Bordnetz-AC) in Volt. */
export const AC_MODEL_VOLTAGE_V = 230;

/** Bauform des AC-Schutzorgans: Leitungsschutzschalter oder FI/LS-Kombi. */
export type AcProtectionKind = 'mcb' | 'rcbo';

/** Magnetische Charakteristik nach IEC 60898-1 (B/C — D hier unüblich). */
export type McbCharacteristic = 'B' | 'C';

/** Beschreibt das AC-Schutzorgan an einer Kante (neben `fuseSize` = In). */
export type AcProtectionDescriptor = {
  /** 'mcb' = LS (L/N-Schutz), 'rcbo' = FI/LS mit integriertem 30-mA-Fehlerschutz. */
  kind?: string;
  characteristic?: string;
  /** Bemessungs-Abschaltvermögen (Icn) in kA — übliche Stufen 6/10. */
  breakingCapacityKA?: number;
};

/** Zusammensetzung einer 3-adrigen AC-Leitung in mm². */
export type AcCableComposition = {
  phase: number;
  neutral: number;
  protectiveEarth: number;
  /** Kompakte Leitungsmarke nach NYM-J-Art, z. B. „3G2,5“. */
  label: string;
};

/**
 * IEC 60364-5-54 Tabelle 54.2 — Schutzleiter-Mindestquerschnitt aus dem
 * Außenleiterquerschnitt (ohne gesonderte Rechnung): S ≤ 16 → PE = S,
 * 16 < S ≤ 35 → PE = 16, S > 35 → PE = S/2.
 */
export function protectiveEarthCrossSectionMm2(phaseCrossSectionMm2: number): number {
  if (!(phaseCrossSectionMm2 > 0)) return 0;
  if (phaseCrossSectionMm2 <= 16) return phaseCrossSectionMm2;
  if (phaseCrossSectionMm2 <= 35) return 16;
  return phaseCrossSectionMm2 / 2;
}

/** 3-adrige AC-Leitung (L/N/PE): N wie S, PE nach Tabelle 54.2. */
export function acCableComposition(phaseCrossSectionMm2: number): AcCableComposition {
  const protectiveEarth = protectiveEarthCrossSectionMm2(phaseCrossSectionMm2);
  const format = (mm2: number): string => String(mm2).replace('.', ',');
  return {
    phase: phaseCrossSectionMm2,
    neutral: phaseCrossSectionMm2,
    protectiveEarth,
    label: `3G${format(phaseCrossSectionMm2)}`,
  };
}

const isKind = (value: unknown): value is AcProtectionKind => value === 'mcb' || value === 'rcbo';
const isCharacteristic = (value: unknown): value is McbCharacteristic => value === 'B' || value === 'C';

/**
 * Obere Grenze des magnetischen Schnellauslösebereichs (Vielfaches von In)
 * nach IEC 60898-1: B = 3–5×, C = 5–10×. Für die Abschaltbedingung zählt
 * der ungünstigste Fall innerhalb des Bereichs — die obere Grenze.
 */
export const MCB_INSTANT_TRIP_MAX_MULTIPLE: Record<McbCharacteristic, number> = {
  B: 5,
  C: 10,
};

/** Übliche Bemessungs-Abschaltvermögen (Icn) nach IEC 60898-1. */
export const MCB_BREAKING_CAPACITY_KA_OPTIONS: readonly number[] = [6, 10];

/**
 * Garantierter Auslösestrom Ia [A] für die Abschaltzeit-Bedingung
 * (IEC 60364-4-41 §411.3.2.5): obere Grenze der Charakteristik × In.
 */
export function guaranteedTripCurrentA(ratedCurrentA: number, characteristic: McbCharacteristic): number {
  return ratedCurrentA * MCB_INSTANT_TRIP_MAX_MULTIPLE[characteristic];
}

/**
 * Zulässiger Schleifenwiderstand [Ω] nach Zs ≤ U0/Ia — mit der 2/3-Regel
 * aus DIN VDE 0100-600 (deckt Messunsicherheit und Leitererwärmung im
 * Fehlerfall ab; ohne sie wäre die Schätzung zu optimistisch).
 */
export function maxLoopImpedanceOhm(ratedCurrentA: number, characteristic: McbCharacteristic): number {
  const ia = guaranteedTripCurrentA(ratedCurrentA, characteristic);
  if (!(ia > 0)) return 0;
  return (2 / 3) * (AC_MODEL_VOLTAGE_V / ia);
}

/**
 * Schleifenanteil EINER AC-Leitung [Ω]: Hinweg Phase, Rückweg PE.
 * ρ_Cu(20 °C) × L × (1/S_phase + 1/S_PE). Die 2/3-Regel in
 * `maxLoopImpedanceOhm` deckt Erwärmung/Übergänge ab — deshalb wird hier
 * bewusst der kalte Leiterwert ohne Pseudo-Faktor verwendet.
 *
 * @param lengthM Leitungslänge in Meter (einfach, nicht Hin+Rück).
 * @param phaseCrossSectionMm2 Außenleiterquerschnitt.
 * @param peCrossSectionMm2  PE-Querschnitt (Standard: Tabelle 54.2).
 */
export function cableLoopContributionOhm(
  lengthM: number,
  phaseCrossSectionMm2: number,
  peCrossSectionMm2: number = protectiveEarthCrossSectionMm2(phaseCrossSectionMm2)
): number {
  if (!(lengthM >= 0) || !(phaseCrossSectionMm2 > 0) || !(peCrossSectionMm2 > 0)) return 0;
  return COPPER_RESISTIVITY_OHM_MM2_PER_M * lengthM * (1 / phaseCrossSectionMm2 + 1 / peCrossSectionMm2);
}

/** Woher eine AC-Kante gespeist wird — nach Quell-Knotentyp. */
export type AcSourceKind = 'shore' | 'inverter' | 'unknown';

/**
 * Klassifikation über den direkt vorgelagerten Knoten: Wechselrichter-
 * Ausgänge sind elektronisch strombegrenzt (kein TN-Schleifenmodell),
 * Landstrom/Netzseite ist das TN-Referenzmodell. Unbekanntes wird dem
 * konservativeren Fall (`unknown` ⇔ 'shore' in der Bewertung) zugeordnet.
 */
export function acSourceKindOf(sourceNodeType: string | undefined): AcSourceKind {
  if (sourceNodeType === 'inverter') return 'inverter';
  if (sourceNodeType === 'shorePower' || sourceNodeType === 'acdcCharger') return 'shore';
  return 'unknown';
}

/**
 * WARUM eine Bewertung nicht möglich war (AUDIT ELE-002/003, Regel M).
 *
 * `not-modeled` allein war stumm: die Anzeige unterschied nicht zwischen
 * „kein Schutzorgan eingetragen“ und „Leitungslänge fehlt“. Schlimmer: die
 * fehlende Länge wurde intern zu `0 m` — die Schleifenimpedanz war dann nur
 * die Netzimpedanz, und die Kante bestand die Prüfung (`ok-with-assumption`).
 * Eine 30-m-Leitung mit C16 auf 2,5 mm² ist real ein `fail`.
 * Jede Lücke hat hier einen eigenen Namen und wird als UNKNOWN gemeldet,
 * niemals als PASS.
 */
export type AcLimitation =
  'missing-length' | 'missing-cross-section' | 'missing-rated-current' | 'missing-descriptor';

/** Ergebnis der Abschaltbedingungs-Schätzung. */
export type AcTripVerdict =
  | 'not-modeled'
  | 'inverter-limited'
  | 'ignored-too-weak-fuse'
  | 'ok-with-assumption'
  | 'borderline'
  | 'rcd-covered'
  | 'breaking-capacity-fail'
  | 'fail';

export type AcTripAssessment = {
  verdict: AcTripVerdict;
  /** Garantierter Auslösestrom Ia [A], falls bewertbar. */
  iaA: number | null;
  /** Zulässiges Zs [Ω] nach 2/3-Regel, falls bewertbar. */
  zsMaxOhm: number | null;
  /** Geschätzter Schleifenanteil der Leitung [Ω]. */
  cableLoopOhm: number;
  /** Geschätztes Gesamt-Zs (Annahme vorgelagert + Leitung) [Ω], falls bewertbar. */
  zsEstimateOhm: number | null;
  /** Vollständig getypte Schutzorgan-Daten, falls vorhanden und gültig. */
  descriptor: {
    kind: AcProtectionKind;
    characteristic: McbCharacteristic;
    breakingCapacityKA: number;
  } | null;
  /**
   * Prospektiver Kurzschlussstrom am Kantenanfang [A], geschätzt aus der
   * deklarierten Netzimpedanz-Annahme: I_p = U0 / Zs. UNVERIFIED wie die
   * Annahme selbst — aber eine Zahl statt eines dekorativen Icn-Feldes
   * (AUDIT ELE-005).
   */
  prospectiveIkA: number | null;
  /** Grund, warum nicht bewertet werden konnte (UNKNOWN, nie PASS). */
  limitation?: AcLimitation;
  /**
   * true = es war kein Datenblatt hinterlegt; gerechnet wurde mit der
   * konservativen Annahme C/6 kA (AUDIT ELE-004). Der Aufrufer MUSS die
   * Annahme sichtbar machen.
   */
  descriptorAssumed: boolean;
  /** Freitext-Begründung für UI/Audit (de). */
  reason: string;
};

/**
 * Bewertet die Abschaltbedingung einer AC-Kante.
 *
 * @param params.ratedCurrentA Bemessungsstrom In der Sicherung (`fuseSize`).
 * @param params.descriptor    Bauform/Charakteristik/Icn (`acProtection`).
 * @param params.lengthM       Leitungslänge [m].
 * @param params.crossSection  Außenleiterquerschnitt [mm²].
 * @param params.sourceKind    Speisung: shore/inverter/unknown (s. oben).
 * @param params.upstreamRcd   30-mA-FI am Einspeisepunkt vorhanden
 *                             (shorePower/acdcCharger `hasRcd`).
 */
export function evaluateAcEdgeProtection(params: {
  ratedCurrentA?: number;
  descriptor?: AcProtectionDescriptor;
  lengthM?: number;
  crossSection?: number;
  sourceKind?: AcSourceKind;
  upstreamRcd?: boolean;
}): AcTripAssessment {
  const { sourceKind = 'unknown', upstreamRcd = false } = params;
  const rated = params.ratedCurrentA ?? 0;

  /**
   * Regel M: KEIN stiller Fallback. Fehlt die Länge oder der Querschnitt,
   * wird nicht mit 0 gerechnet (das machte die Schleifenimpedanz künstlich
   * klein und ließ die Kante bestehen), sondern ehrlich UNKNOWN gemeldet.
   * Ein gespeichertes 0 m ist für eine AC-Leitung ebenso unbrauchbar wie ein
   * fehlender Wert — beides ist eine Datenlücke, kein Messergebnis.
   */
  const hasLength =
    typeof params.lengthM === 'number' && Number.isFinite(params.lengthM) && params.lengthM > 0;
  const hasCrossSection =
    typeof params.crossSection === 'number' &&
    Number.isFinite(params.crossSection) &&
    params.crossSection > 0;
  const lengthM = hasLength ? (params.lengthM as number) : 0;
  const crossSection = hasCrossSection ? (params.crossSection as number) : 0;
  const cableLoopOhm = hasLength && hasCrossSection ? cableLoopContributionOhm(lengthM, crossSection) : 0;

  const base: Omit<AcTripAssessment, 'verdict' | 'reason' | 'prospectiveIkA' | 'descriptorAssumed'> = {
    iaA: null,
    zsMaxOhm: null,
    cableLoopOhm,
    zsEstimateOhm: null,
    descriptor: null,
  };

  // Wechselrichter-Ausgang: kein TN-Schleifenmodell — die Stromquelle ist
  // elektronisch begrenzt; die Schutzbeurteilung obliegt dem Datenblatt.
  if (sourceKind === 'inverter') {
    return {
      ...base,
      prospectiveIkA: null,
      descriptorAssumed: false,
      verdict: 'inverter-limited',
      reason:
        'Wechselrichter-Ausgänge sind elektronisch strombegrenzt (kein TN-Schleifenmodell) — die Abschaltbeurteilung steht im Hersteller-Datenblatt.',
    };
  }

  if (!(rated > 0)) {
    return {
      ...base,
      prospectiveIkA: null,
      descriptorAssumed: false,
      verdict: 'not-modeled',
      limitation: 'missing-rated-current',
      reason:
        'Kein Bemessungsstrom (fuseSize) an der AC-Kante — Abschaltbedingung nicht bewertbar (UNKNOWN, kein Freibrief).',
    };
  }

  // Regel M: Länge und Querschnitt sind Eingangsgrößen der Schleifenimpedanz.
  // Fehlt eine davon, ist das Ergebnis UNKNOWN — früher wurde daraus 0 Ω
  // Kabelanteil und damit ein scheinbares „ok-with-assumption“ (AUDIT ELE-002).
  if (!hasLength || !hasCrossSection) {
    return {
      ...base,
      prospectiveIkA: null,
      descriptorAssumed: false,
      verdict: 'not-modeled',
      limitation: !hasLength ? 'missing-length' : 'missing-cross-section',
      reason: !hasLength
        ? 'Leitungslänge der AC-Kante nicht angegeben — Schleifenimpedanz und Abschaltbedingung sind nicht bewertbar (UNKNOWN). Länge im Leitungs-Inspektor eintragen.'
        : 'Querschnitt der AC-Kante nicht angegeben — Schleifenimpedanz und Abschaltbedingung sind nicht bewertbar (UNKNOWN). Querschnitt im Leitungs-Inspektor eintragen.',
    };
  }

  const kind = isKind(params.descriptor?.kind) ? params.descriptor.kind : undefined;
  const characteristic = isCharacteristic(params.descriptor?.characteristic)
    ? params.descriptor.characteristic
    : undefined;
  const breaking = params.descriptor?.breakingCapacityKA;
  const descriptorAssumed = !kind || !characteristic || !(Number(breaking) > 0);

  /**
   * AUDIT ELE-004: Fehlt das Datenblatt, wird NICHT stillschweigend mit einer
   * bequemen Charakteristik gerechnet und das Ergebnis „ok" genannt. Stattdessen
   * gilt die UNGÜNSTIGSTE übliche Charakteristik (C, 10 × In statt B, 5 × In)
   * als ausdrücklich benannte Annahme:
   *
   *   Zs,max(C16) = 0,958 Ω  vs.  Zs,max(B16) = 1,917 Ω
   *
   * Eine Leitung, die unter der C-Annahme besteht, besteht auch mit jedem real
   * verbauten B-Gerät — die Annahme irrt nur in die sichere Richtung. AutoWire
   * stempelt keine erfundenen Gerätedaten mehr auf die Kante; der Aufrufer
   * sieht `descriptorAssumed` und meldet die Annahme sichtbar (Regel M:
   * Annahme ist erlaubt, Schweigen nicht).
   */
  const descriptor = descriptorAssumed
    ? { kind: 'mcb' as const, characteristic: 'C' as const, breakingCapacityKA: 6 }
    : {
        kind: kind as AcProtectionKind,
        characteristic: characteristic as McbCharacteristic,
        breakingCapacityKA: Number(breaking),
      };
  const assumptionNote = descriptorAssumed
    ? ' Annahme mangels Datenblatt: LS mit Charakteristik C (ungünstigste übliche, IEC 60898-1) und 6 kA — Datenblatt im Leitungs-Inspektor eintragen.'
    : '';
  const iaA = guaranteedTripCurrentA(rated, descriptor.characteristic);
  const zsMaxOhm = maxLoopImpedanceOhm(rated, descriptor.characteristic);
  const zsEstimateOhm = UPSTREAM_IMPEDANCE_ASSUMPTION_OHM + cableLoopOhm;

  /**
   * AUDIT ELE-005: Das Abschaltvermögen Icn war dekorativ — geprüft wurde nur
   * „> 0“, für AC wurde NIE ein Kurzschlussstrom gerechnet. B16 mit 6 kA und
   * mit 0,5 kA ergaben dasselbe „ok-with-assumption“.
   *
   * Jetzt wird der prospektive Kurzschlussstrom aus derselben deklarierten
   * Netzimpedanz-Annahme gerechnet, aus der auch Zs stammt:
   * I_p = U0 / Zs. Mit 0,8 Ω vorgelagert ergibt das ≈ 0,29 kA — die üblichen
   * 6-kA-Geräte liegen also weit darüber, und der Vergleich schlägt genau bei
   * Datenblatt-Werten an, die zur Installation nicht passen. Die Annahme ist
   * UNVERIFIED (ein Messwert vor Ort schlägt sie), aber sie ist wenigstens
   * gerechnet und steht als Zahl in UI/Audit — nicht als stiller Haken.
   */
  const prospectiveIkA = zsEstimateOhm > 0 ? AC_MODEL_VOLTAGE_V / zsEstimateOhm : null;
  const breakingCapacityA = descriptor.breakingCapacityKA * 1000;
  if (prospectiveIkA !== null && prospectiveIkA > breakingCapacityA) {
    return {
      ...base,
      iaA,
      zsMaxOhm,
      zsEstimateOhm,
      descriptor,
      prospectiveIkA,
      descriptorAssumed,
      verdict: 'breaking-capacity-fail',
      reason: `Abschaltvermögen Icn = ${descriptor.breakingCapacityKA} kA liegt unter dem geschätzten prospektiven Kurzschlussstrom ≈ ${(prospectiveIkA / 1000).toFixed(2)} kA (I_p = U0 / Zs aus der Netzimpedanz-Annahme ${UPSTREAM_IMPEDANCE_ASSUMPTION_OHM} Ω).${assumptionNote}`,
    };
  }

  // FI-Falle: 30-mA-Fehlerschutz deckt Personen-/Fehlerschutz auch dann,
  // wenn die magnetische Abschaltbedingung knapp oder gerissen wäre.
  const rcdProtects = upstreamRcd || descriptor.kind === 'rcbo';
  if (zsEstimateOhm > zsMaxOhm) {
    if (rcdProtects) {
      return {
        ...base,
        iaA,
        zsMaxOhm,
        zsEstimateOhm,
        descriptor,
        prospectiveIkA,
        descriptorAssumed,
        verdict: 'rcd-covered',
        reason: `Geschätzte Schleifenimpedanz ≈ ${zsEstimateOhm.toFixed(2)} Ω über dem TN-Zulasswert ${zsMaxOhm.toFixed(2)} Ω — Fehlerschutz über den 30-mA-FI${descriptor.kind === 'rcbo' ? ' des FI/LS' : ' am Einspeisepunkt'} gedeckt; Messung vor Ort bleibt Pflicht.${assumptionNote}`,
      };
    }
    return {
      ...base,
      iaA,
      zsMaxOhm,
      zsEstimateOhm,
      descriptor,
      prospectiveIkA,
      descriptorAssumed,
      verdict: 'fail',
      reason: `Geschätzte Schleifenimpedanz ≈ ${zsEstimateOhm.toFixed(2)} Ω über dem zulässigen ${zsMaxOhm.toFixed(2)} Ω (Ia = ${Math.round(iaA)} A, 2/3-Regel) — magnetische Abschaltung im Fehlerfall nicht gesichert.${assumptionNote}`,
    };
  }

  // Grenzwert-Komfortzone: nur der Kabelanteil unter der Annahme nah den
  // Zulasswert → der real gemessene Netzanteil entscheidet.
  if (cableLoopOhm > 0.5 * zsMaxOhm) {
    return {
      ...base,
      iaA,
      zsMaxOhm,
      zsEstimateOhm,
      descriptor,
      prospectiveIkA,
      descriptorAssumed,
      verdict: 'borderline',
      reason: `Leitungsanteil ≈ ${cableLoopOhm.toFixed(2)} Ω beträgt mehr als die Hälfte des zulässigen ${zsMaxOhm.toFixed(2)} Ω — Abschaltbedingung hängt an der (angenommenen) Netzimpedanz; Schleifenimpedanz messen lassen.${assumptionNote}`,
    };
  }

  return {
    ...base,
    iaA,
    zsMaxOhm,
    zsEstimateOhm,
    descriptor,
    prospectiveIkA,
    descriptorAssumed,
    verdict: 'ok-with-assumption',
    reason: `Abschaltbedingung rechnerisch erfüllt unter Annahmen (vorgelagert ≈ ${UPSTREAM_IMPEDANCE_ASSUMPTION_OHM} Ω, 2/3-Regel, ρ_Cu 20 °C): ≈ ${zsEstimateOhm.toFixed(2)} Ω ≤ ${zsMaxOhm.toFixed(2)} Ω.${assumptionNote}`,
  };
}

/** Beschriftung der Schutzorgan-Auswahl für den Inspektor. */
export function describeAcProtection(descriptor: AcProtectionDescriptor | undefined): string {
  const kind = isKind(descriptor?.kind) ? descriptor.kind : undefined;
  const ch = isCharacteristic(descriptor?.characteristic) ? descriptor.characteristic : undefined;
  const kA = Number(descriptor?.breakingCapacityKA);
  if (!kind || !ch || !(kA > 0)) return 'nicht angegeben';
  const label = kind === 'rcbo' ? 'FI/LS (RCBO, 30 mA)' : 'LS-Schalter (MCB)';
  return `${label} ${ch} · ${kA} kA`;
}
