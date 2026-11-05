/**
 * test/reference/rm1-voltage-drop.ts — REFERENZMODELL 1: Spannungsfall.
 *
 * Zweck
 * =====
 * Unabhängige Nachrechnung von ΔU und der daraus geforderten Querschnittsfläche.
 * Dieses Modul darf **keine** produktive Rechenfunktion importieren
 * (`lib/electrical.ts`, `lib/units.ts`-Funktionen, `lib/verify/physics.ts`,
 * `lib/autoWire/*`, `components/edges/utils/voltageDrop.ts`). Es importiert
 * ausschließlich Typen und deklariert seine Zahlen selbst.
 *
 * Warum das Duplikat Absicht ist
 * ------------------------------
 * Ein Referenzwert, der aus dem geprüften Code stammt, kann dessen Fehler nicht
 * finden. Die Tabellen- und Materialkonstanten stehen deshalb hier **erneut**:
 * Wer `COPPER_CONDUCTIVITY_MS_PER_MM2` in `lib/materials.ts` ändert, macht
 * diesen Test rot — und muss entscheiden, ob die Änderung fachlich gewollt ist.
 * Genau diese Entscheidung ist der Zweck.
 *
 * Mathematische Definition
 * ------------------------
 * Hin- und Rückleiter, Gleichstrom, Leitertemperatur T:
 *
 *     ρ(T) = ρ₂₀ · (1 + α₂₀ · (T − 20 °C))          [Ω·mm²/m]
 *     ΔU   = I · 2 · L · ρ(T) / A                     [V]
 *     ΔU%  = 100 · ΔU / U_n                           [%]
 *     A_min = I · 2 · L · ρ(T) / ΔU_zul               [mm²]
 *
 * Zwei Schreibweisen sind im Repo in Gebrauch und **physikalisch identisch**,
 * solange dieselbe Temperatur gilt:
 *
 *     ΔU = I · 2L / (κ · A)      mit κ = 1/ρ        (Leitwert, S·m/mm²)
 *     ΔU = I · 2L · ρ / A        mit ρ in Ω·mm²/m
 *
 * κ = 58 S·m/mm² entspricht ρ = 1/58 = 0,017241 Ω·mm²/m, also ρ bei 20 °C.
 * Der Unterschied zwischen den beiden Pfaden ist damit **kein Formelfehler,
 * sondern eine Temperaturfrage**: κ = 58 gilt kalt, ρ(T) gilt bei T.
 *
 * Einheiten
 * ---------
 * I [A], L [m] (einfache Länge, nicht Hin+Rück), A [mm²], T [°C],
 * ρ [Ω·mm²/m], κ [S·m/mm²], U [V], ΔU [V], ΔU% [%].
 *
 * Gültigkeitsbereich
 * ------------------
 * - Kupfer, Temperaturen 0 °C ≤ T < 200 °C.
 *
 *   KORREKTUR (Audit 2026-11-05): Hier stand, „das Produktivmodell wirft dort
 *   ebenfalls". Das ist **falsch** — gemessen: `copperResistivityAt(200 | 250 |
 *   300)` liefert 0,02988 / 0,03332 / 0,03676 Ω·mm²/m ohne Fehler; nur unterhalb
 *   des absoluten Nullpunkts wirft es. RM-1 ist an der oberen Grenze also
 *   **strenger** als die Produktivseite. Das ist bewusst so (das lineare
 *   α-Modell trägt oberhalb ~200 °C keine Aussage mehr), heißt aber: der
 *   Differentialtest kann diesen Bereich nicht vergleichen, und er tut es auch
 *   nicht (`fc.integer({min:0, max:69})`). Wer RM-1 für höhere Temperaturen
 *   öffnet, muss die Physik begründen, nicht die Toleranz.
 * - Reine Leitung ohne Übergangswiderstände, Kontakte, Sicherungen.
 * - Ein Leiterpaar (Hin- und Rückweg gleicher Querschnitt). Unsymmetrische
 *   Querschnitte (z. B. N/PE) sind NICHT abgedeckt — dafür gibt es RM-4.
 *
 * Bekannte Grenzen
 * ----------------
 * - Kein Skineffekt (bei 50 Hz und ≤ 70 mm² vernachlässigbar).
 * - Keine Stromverdrängung in Bündeln.
 * - Der Faktor 2 gilt für Hin+Rück; eine Fahrzeugkarosserie als Rückleiter
 *   hätte einen anderen Pfadfaktor (das Produktivmodell kennt `1 | 2`).
 *
 * Quellen
 * -------
 * - ρ₂₀ = 0,0175 Ω·mm²/m und α₂₀ = 0,00393 1/K: physikalische Materialwerte
 *   für Kupfer (Leitfähigkeit 56–58 MS/m je nach Reinheitsgrad; CAMP nutzt
 *   58 S·m/mm² ⇒ ρ = 0,017241). → **Materialwert, keine Normklausel.**
 * - Die ΔU-Grenzwerte (1 / 3 / 4 %, AC 2 %) sind **MODELLANNAHME** von CAMP;
 *   DIN VDE 0298-4 enthält keine Spannungsfall-Grenzwerte. Sie werden hier
 *   als Parameter übergeben, nicht als Normwert deklariert.
 *
 * Abweichungstoleranz
 * -------------------
 * Gegenüber `lib/verify/physics.ts#voltageDropVolts` **exakt** (≤ 1e-9 relativ)
 * bei gleicher Temperatur: beide Seiten rechnen ρ(T) mit ρ₂₀ = 0,0175 und
 * α₂₀ = 0,00393. Eine Abweichung > 1e-9 heißt hier: eine der beiden Seiten hat
 * die Temperatur oder den Pfadfaktor falsch.
 *
 * Gegenüber `lib/units.ts#voltageDrop` **NICHT exakt**, sondern bis 1,48 %
 * (Allowlist-Eintrag K-1): die Produktivfunktion bekommt κ als Parameter und
 * wird im Repo mit κ = 58 aufgerufen, also ρ = 0,017241 statt 0,0175. Diese
 * Differenz ist eine Konstantenrundung, keine Formelfrage — aber sie ist real
 * und wird deshalb als Toleranz ausgewiesen statt als „exakt" behauptet.
 *
 * Konsequenz für die Aussagekraft: An der ΔU-Grenze (Befund K-2) reicht diese
 * Differenz, um das Urteil zu kippen (Design 3,000 % vs. Engine 3,045 %). Der
 * Differentialtest prüft deshalb zwei Dinge getrennt — die Engine-Seite exakt,
 * die Design-Seite mit ausgewiesener Toleranz.
 */

/** Kupfer-Widerstand bei 20 °C [Ω·mm²/m]. Materialwert, gerundet auf 4 Stellen. */
export const REF_RHO_CU_20 = 0.0175;

/** Temperaturkoeffizient von Kupfer [1/K]. Materialwert. */
export const REF_ALPHA_CU_20 = 0.00393;

/** Referenztemperatur der Materialwerte [°C]. */
export const REF_T_REFERENCE_C = 20;

/** Physikalisch zulässiger Temperaturbereich des linearen Modells [°C]. */
export const REF_T_MIN_C = 0;
export const REF_T_MAX_C = 200;

/**
 * Widerstand von Kupfer in Abhängigkeit der Leitertemperatur [Ω·mm²/m].
 *
 * @throws RangeError außerhalb des Gültigkeitsbereichs — ein extrapolierter
 *   Wert wäre eine Aussage, die das Modell nicht tragen kann.
 */
export function refCopperResistivity(temperatureC: number): number {
  if (!Number.isFinite(temperatureC)) {
    throw new RangeError(`refCopperResistivity: Temperatur muss endlich sein (${temperatureC})`);
  }
  if (temperatureC < REF_T_MIN_C || temperatureC >= REF_T_MAX_C) {
    throw new RangeError(
      `refCopperResistivity: ${temperatureC} °C liegt außerhalb des Modellbereichs [${REF_T_MIN_C}, ${REF_T_MAX_C}) °C`
    );
  }
  return REF_RHO_CU_20 * (1 + REF_ALPHA_CU_20 * (temperatureC - REF_T_REFERENCE_C));
}

/** Leitwert κ = 1/ρ bei Temperatur T [S·m/mm²]. */
export function refConductivity(temperatureC: number): number {
  return 1 / refCopperResistivity(temperatureC);
}

export interface RefDropInput {
  /** Betriebsstrom I_b [A], ≥ 0. */
  currentA: number;
  /** Einfache Leitungslänge L [m], ≥ 0. */
  lengthM: number;
  /** Leiterquerschnitt A [mm²], > 0. */
  crossSectionMm2: number;
  /** Nennspannung des Stromkreises U_n [V], > 0. */
  nominalVoltageV: number;
  /** Leitertemperatur [°C]; Standard 20 °C (kalter Planungswert). */
  temperatureC?: number;
  /** 2 = Hin- und Rückleiter (Standard), 1 = Karosserie als Rückleiter. */
  pathFactor?: 1 | 2;
}

export interface RefDropResult {
  /** ΔU in Volt. */
  dropV: number;
  /** ΔU in Prozent von U_n. */
  dropPercent: number;
  /** Angesetztes ρ [Ω·mm²/m] — damit der Wert nachrechenbar bleibt. */
  resistivity: number;
  /** Angesetzter Pfadfaktor. */
  pathFactor: 1 | 2;
}

/**
 * Spannungsfall ΔU = k · L · I · ρ(T) / A, in Volt und Prozent.
 *
 * @throws RangeError bei negativer Länge, nicht-positivem Querschnitt,
 *   nicht-positiver Nennspannung oder nicht-endlichem Strom.
 */
export function refVoltageDrop(input: RefDropInput): RefDropResult {
  const { currentA, lengthM, crossSectionMm2, nominalVoltageV } = input;
  const temperatureC = input.temperatureC ?? REF_T_REFERENCE_C;
  const pathFactor: 1 | 2 = input.pathFactor ?? 2;

  if (!Number.isFinite(currentA) || currentA < 0) {
    throw new RangeError(`refVoltageDrop: Strom muss ≥ 0 und endlich sein (${currentA})`);
  }
  if (!Number.isFinite(lengthM) || lengthM < 0) {
    throw new RangeError(`refVoltageDrop: Länge muss ≥ 0 sein (${lengthM})`);
  }
  if (!(crossSectionMm2 > 0)) {
    throw new RangeError(`refVoltageDrop: Querschnitt muss > 0 sein (${crossSectionMm2})`);
  }
  if (!(nominalVoltageV > 0)) {
    throw new RangeError(`refVoltageDrop: Nennspannung muss > 0 sein (${nominalVoltageV})`);
  }

  const resistivity = refCopperResistivity(temperatureC);
  const dropV = (pathFactor * lengthM * currentA * resistivity) / crossSectionMm2;
  return { dropV, dropPercent: (dropV / nominalVoltageV) * 100, resistivity, pathFactor };
}

/**
 * Kleinster Querschnitt, der ein ΔU-Budget einhält [mm²] — Umkehrung derselben
 * Gleichung, **ohne** Aufrundung auf die Normreihe. Die Normreihe ist eine
 * Auswahlregel (RM-2), keine Physik; sie wird hier bewusst nicht angewendet.
 *
 * @throws RangeError wenn das Budget ≤ 0 ist (Division durch 0 wäre keine
 *   Empfehlung, sondern eine unendliche Fläche).
 */
export function refCrossSectionForDrop(input: {
  currentA: number;
  lengthM: number;
  allowedDropV: number;
  temperatureC?: number;
  pathFactor?: 1 | 2;
}): number {
  if (!(input.allowedDropV > 0)) {
    throw new RangeError(`refCrossSectionForDrop: ΔU muss > 0 sein (${input.allowedDropV})`);
  }
  const { resistivity } = refVoltageDrop({
    currentA: input.currentA,
    lengthM: input.lengthM,
    crossSectionMm2: 1,
    nominalVoltageV: 1,
    ...(input.temperatureC === undefined ? {} : { temperatureC: input.temperatureC }),
    ...(input.pathFactor === undefined ? {} : { pathFactor: input.pathFactor }),
  });
  const pathFactor = input.pathFactor ?? 2;
  return (pathFactor * input.lengthM * input.currentA * resistivity) / input.allowedDropV;
}

/**
 * Prozentualer Spannungsfall-Anteil **einer** Kante, wie ihn die Anzeige
 * rechnet (κ = 58, also kalt) — bewusst als eigene Funktion, damit der
 * Unterschied zur Engine (ρ bei Betriebstemperatur) messbar ist und nicht in
 * einem Kommentar verschwindet.
 */
export function refDropPercentCold(input: {
  currentA: number;
  lengthM: number;
  crossSectionMm2: number;
  nominalVoltageV: number;
}): number {
  return refVoltageDrop({ ...input, temperatureC: REF_T_REFERENCE_C }).dropPercent;
}

/**
 * κ-Wert, den `lib/materials.ts` als `COPPER_CONDUCTIVITY_MS_PER_MM2` führt.
 * Steht hier als **Sollwert** — nicht als Import. Der Test vergleicht beide.
 */
export const REF_CONDUCTIVITY_DESIGN = 58;
