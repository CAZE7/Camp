/**
 * lib/boosterSizing.ts — Ladestrom-Bemessung für den Ladebooster-Rechner
 * (`/rechner/ladestrom/`, eingebettet in `/camper-elektrik/ladebooster/`).
 *
 * Warum ein eigenes Modul: ARCHITECTURE-RULES Rule D — die Anzeige
 * implementiert keine elektrischen Berechnungen. Dieselbe Rechnung stand bis
 * zum Umbau des Vergleichs als DOM-Skript in
 * `components/seo/LadeboosterVergleichBehavior.tsx` und ist hierher
 * zeichengetreu umgezogen, nicht neu erfunden. Sechs Ausgaben sind seitdem per
 * e2e eingefroren; `boosterSizing.test.ts` pinnt sie (Gate G12 der Spec
 * `docs/superpowers/specs/2026-10-26-ladebooster-vergleich-design.md`).
 *
 * Was sie ist und was nicht: eine Faustregel, keine Messung. 90 %
 * Wirkungsgrad, 20 A Fahrzeuglast und 20 % Zuschlag für die
 * Konstantspannungsphase sind Modellannahmen — sie stehen hier als benannte
 * Konstanten, damit die Seite sie nennen kann, statt sie zu verstecken.
 */

/** Chemien, für die das Modell ein Ladefenster kennt. */
export type BoosterChemistry = 'LiFePO4' | 'Blei';

export const BOOSTER_CHEMISTRIES: readonly BoosterChemistry[] = ['LiFePO4', 'Blei'];

/** Anzeigename des Ladefensters — derselbe Wortlaut wie im Ergebnis. */
export const BOOSTER_FENSTER_NAME: Readonly<Record<BoosterChemistry, string>> = {
  LiFePO4: 'LiFePO4-Fenster',
  Blei: 'Blei-Fenster',
};

/**
 * Zulässige C-Rate beim Laden, als Vielfaches der Nennkapazität. Die Grenzen
 * sind Faustwerte aus den Datenblättern der Chemie, keine Norm: Blei (AGM,
 * Gel, Nassblei) lädt langsamer als LiFePO4.
 */
export const BOOSTER_C_FENSTER: Readonly<Record<BoosterChemistry, { minC: number; maxC: number }>> = {
  LiFePO4: { minC: 0.3, maxC: 0.5 },
  Blei: { minC: 0.2, maxC: 0.3 },
};

/** Wirkungsgrad des Boosters (Modellannahme, nicht gemessen). */
export const BOOSTER_WIRKUNGSGRAD = 0.9;

/** Strom, den das Fahrzeug beim Fahren ohnehin zieht (Modellannahme). */
export const BOOSTER_FAHRZEUGLAST_A = 20;

/** Zuschlag für die Konstantspannungsphase, in der der Strom sinkt. */
export const BOOSTER_LADEZEIT_ZUSCHLAG = 1.2;

/**
 * Zulässige Eingabebereiche. Außerhalb wirft `sizeBooster` — ein stiller
 * Rückfall auf eine Grenze würde eine Zahl ausgeben, die niemand bestellt hat
 * (AGENTS.md Rule M).
 */
export const BOOSTER_GRENZEN = {
  kapazitaetAh: { min: 50, max: 1200 },
  fahrzeitH: { min: 1, max: 24 },
  lichtmaschineA: { min: 40, max: 400 },
} as const;

/**
 * Bedarfsklassen der Geräte, aufsteigend. Der Zielstrom entscheidet, nicht der
 * Gerätegrenzstrom: Wer 79 A braucht, landet in der 90-A-Klasse, auch wenn ein
 * 70-A-Booster die Batterie ebenfalls irgendwann voll bekäme.
 */
export const BOOSTER_KLASSEN: readonly { bisA: number; label: string }[] = [
  { bisA: 35, label: '30-A-Klasse' },
  { bisA: 75, label: '60–70-A-Klasse' },
  { bisA: 100, label: '90-A-Klasse' },
  { bisA: 130, label: '100–120-A-Klasse' },
];

/** Klasse oberhalb der letzten Schwelle — hier entscheidet der Einzelfall. */
export const BOOSTER_KLASSE_OFFEN = 'über 120 A – Einzelfall prüfen';

/**
 * Bedarfsklasse zum Zielstrom. Ohne Tabelle und ohne `find`, damit die
 * Zuordnung unabhängig von der Listenreihenfolge bleibt (AGENTS.md §3.6).
 */
export function boosterKlasse(targetCurrentA: number): string {
  if (!Number.isFinite(targetCurrentA)) {
    throw new RangeError(`Zielstrom muss eine endliche Zahl sein, war ${targetCurrentA}`);
  }
  for (const klasse of BOOSTER_KLASSEN) {
    if (targetCurrentA <= klasse.bisA) return klasse.label;
  }
  return BOOSTER_KLASSE_OFFEN;
}

export type BoosterSizingInput = {
  /** Nennkapazität der Aufbaubatterie in Amperestunden. */
  capacityAh: number;
  /** Fahrzeit in Stunden, über die geladen werden soll. */
  driveHours: number;
  /** Nennstrom der Lichtmaschine in Ampere. */
  alternatorA: number;
  chemistry: BoosterChemistry;
};

/** Lage des Zielstroms zum Ladefenster der Chemie. */
export type FensterLage = 'innerhalb' | 'darueber' | 'darunter';

/** Auslastung der Lichtmaschine durch den Booster. */
export type LichtmaschinenLage = 'reserve' | 'nah' | 'ueberlastet';

export type BoosterSizing = {
  /**
   * Strom, den der Booster abgeben müsste, um die Batterie in der Fahrzeit
   * nachzuladen — inklusive des Zuschlags für die Konstantspannungsphase.
   * Das ist die BEDARFSZAHL; sie entscheidet über die Geräteklasse.
   */
  targetCurrentA: number;
  /** Bedarfsstrom als Vielfaches der Nennkapazität (C-Rate). */
  cRate: number;
  /** Unterer Rand des Ladefensters der Chemie in Ampere. */
  minCurrentA: number;
  /** Oberer Rand des Ladefensters der Chemie in Ampere. */
  maxCurrentA: number;
  fensterLage: FensterLage;
  /**
   * Strom, den ein Gerät tatsächlich liefern muss: der Zielstrom, auf das
   * Ladefenster begrenzt. Er — nicht der Zielstrom — bestimmt die Belastung
   * der Lichtmaschine, weil ein Gerät nicht mehr abgibt, als die Batterie
   * annimmt.
   */
  sizedCurrentA: number;
  /** Bedarfsklasse des Geräts (Schwellen in `BOOSTER_KLASSEN`). */
  deviceClass: string;
  /** Strom, den die Lichtmaschine liefern muss (Booster zuzüglich Fahrzeuglast). */
  inputCurrentA: number;
  /** Anteil am Nennstrom der Lichtmaschine in Prozent. */
  alternatorUtilizationPercent: number;
  alternatorLage: LichtmaschinenLage;
};

/**
 * Bemessung des Ladestroms.
 *
 * Rechenweg (unverändert aus dem DOM-Skript übernommen):
 *   Zielstrom  = (C_nenn / Fahrzeit) · 1,2
 *   Geräteauslegung = Zielstrom begrenzt auf [C_nenn · minC, C_nenn · maxC]
 *   Eingangsstrom = Geräteauslegung / 0,9 + 20 A
 *   Auslastung = Eingangsstrom / Nennstrom der Lichtmaschine
 *
 * @throws RangeError bei Eingaben außerhalb von `BOOSTER_GRENZEN` (Rule M).
 */
export function sizeBooster(input: BoosterSizingInput): BoosterSizing {
  const { capacityAh, driveHours, alternatorA, chemistry } = input;

  assertRange('Batteriekapazität', capacityAh, BOOSTER_GRENZEN.kapazitaetAh, 'Ah');
  assertRange('Fahrzeit', driveHours, BOOSTER_GRENZEN.fahrzeitH, 'h');
  assertRange('Nennstrom der Lichtmaschine', alternatorA, BOOSTER_GRENZEN.lichtmaschineA, 'A');

  // Die Chemie wird gegen die erklärte Liste geprüft, nicht gegen das
  // Fenster-Objekt: Ein Aufrufer, der einen fremden String durchreicht, soll
  // eine benannte Ablehnung bekommen und nicht `NaN` (Rule M).
  if (!BOOSTER_CHEMISTRIES.includes(chemistry)) {
    throw new RangeError(`Unbekannte Chemie "${chemistry}" — BOOSTER_CHEMISTRIES kennt sie nicht`);
  }

  const { minC, maxC } = BOOSTER_C_FENSTER[chemistry];
  const minCurrentA = capacityAh * minC;
  const maxCurrentA = capacityAh * maxC;
  const targetCurrentA = (capacityAh / driveHours) * BOOSTER_LADEZEIT_ZUSCHLAG;
  const sizedCurrentA = Math.min(maxCurrentA, Math.max(minCurrentA, targetCurrentA));
  const cRate = targetCurrentA / capacityAh;
  const inputCurrentA = sizedCurrentA / BOOSTER_WIRKUNGSGRAD + BOOSTER_FAHRZEUGLAST_A;
  const alternatorUtilizationPercent = (inputCurrentA / alternatorA) * 100;

  return {
    targetCurrentA,
    cRate,
    minCurrentA,
    maxCurrentA,
    fensterLage:
      targetCurrentA > maxCurrentA ? 'darueber' : targetCurrentA < minCurrentA ? 'darunter' : 'innerhalb',
    sizedCurrentA,
    deviceClass: boosterKlasse(targetCurrentA),
    inputCurrentA,
    alternatorUtilizationPercent,
    alternatorLage:
      alternatorUtilizationPercent > 100
        ? 'ueberlastet'
        : alternatorUtilizationPercent > 80
          ? 'nah'
          : 'reserve',
  };
}

function assertRange(label: string, value: number, range: { min: number; max: number }, unit: string): void {
  if (!Number.isFinite(value) || value < range.min || value > range.max) {
    throw new RangeError(`${label} muss zwischen ${range.min} und ${range.max} ${unit} liegen, war ${value}`);
  }
}
