/**
 * lib/units.ts
 *
 * Typsichere physikalische Einheiten (Branded Types).
 *
 * Problem
 * =======
 * Die Fachlogik rechnet mit `number` für Watt, Ampere, Volt, mm², Meter und
 * Millivolt. Der Compiler kann deshalb nicht erkennen, wenn ein Strom dort
 * landet, wo eine Länge erwartet wird:
 *
 *     calculateMinCrossSection(length, current)   // vertauscht — kompiliert
 *
 * Das ist bei einer Auslegung, die am Ende einen Kabelquerschnitt bestimmt,
 * ein Sicherheitsrisiko und kein Stilproblem.
 *
 * Lösung
 * ======
 * Jede Größe bekommt eine eigene, nominal getrennte Marke:
 *
 *     type Amps = number & { readonly [UNIT_BRAND]: 'Amps' }
 *
 * Zur Laufzeit bleibt es ein `number` (kein Wrapper-Objekt, keine Allokation,
 * keine Performance-Kosten, JSON-kompatibel). Zur Compilezeit gilt:
 *
 *   - `Amps` ist überall verwendbar, wo `number` erwartet wird (Ausgabe-Seite).
 *   - Ein `number` ist NICHT als `Amps` verwendbar (Eingabe-Seite).
 *   - `Amps` ist NICHT als `Volts` verwendbar.
 *
 * Grenzen (bewusst)
 * =================
 *   - Persistenz (localStorage, React-Flow-`data`, JSON) speichert weiterhin
 *     primitive Zahlen. Die Konstruktoren dieses Moduls sind die Schleuse
 *     zwischen "unbekannte Zahl von außen" und "geprüfte Größe innen".
 *   - `+`, `-`, `*` auf zwei Marken ergeben in TypeScript wieder `number`,
 *     nicht die Marke. Deshalb gibt es benannte Operationen (`power`,
 *     `currentFromPower`, `addWatts`, …) statt roher Arithmetik.
 *   - Die Konstruktoren prüfen zur Laufzeit; sie sind kein `as`-Ersatz.
 *
 * Keine `any`-Casts, kein `@ts-ignore`, keine unterdrückten Fehler.
 */

// ============================================================================
// MARKEN
// ============================================================================

declare const UNIT_BRAND: unique symbol;

/** Ein `number` mit nominaler Einheiten-Marke. */
export type Quantity<Name extends string> = number & {
  readonly [UNIT_BRAND]: Name;
};

/** Wirkleistung in Watt (W). */
export type Watts = Quantity<'Watts'>;
/** Stromstärke in Ampere (A). */
export type Amps = Quantity<'Amps'>;
/** Spannung in Volt (V). */
export type Volts = Quantity<'Volts'>;
/** Leiterquerschnitt in Quadratmillimetern (mm²). */
export type Mm2 = Quantity<'Mm2'>;
/** Länge in Metern (m). */
export type Meters = Quantity<'Meters'>;
/** Spannung in Millivolt (mV) — für kleine Spannungsfälle. */
export type Millivolts = Quantity<'Millivolts'>;
/** Widerstand in Ohm (Ω). */
export type Ohms = Quantity<'Ohms'>;

/** Jede in diesem Modul definierte physikalische Größe. */
export type PhysicalQuantity = Watts | Amps | Volts | Mm2 | Meters | Millivolts | Ohms;

/**
 * Dimensionslose Zahl — Wirkungsgrad, Derating-Faktor, Anteil, Stückzahl.
 *
 * Warum nicht einfach `number`? Weil jede Marke *zu* `number` zuweisbar ist:
 * `scaleAmps(current, voltage)` wäre mit `factor: number` gültiger Code und
 * würde Ampere mit Volt multiplizieren. Die optionale, auf `undefined`
 * festgelegte Marke lässt rohe Zahlen zu und schließt markierte Größen aus.
 */
export type Scalar = number & { readonly [UNIT_BRAND]?: undefined };

// ============================================================================
// KONSTRUKTOREN
// ============================================================================

type Bounds = {
  /** Kleinster erlaubter Wert (inklusiv). */
  readonly min: number;
  /** Ist der Minimalwert selbst erlaubt? */
  readonly minInclusive: boolean;
};

const BOUNDS: Record<string, Bounds> = {
  // Leistungsaufnahme/-abgabe wird im Planer als Betrag geführt.
  Watts: { min: 0, minInclusive: true },
  Amps: { min: 0, minInclusive: true },
  Volts: { min: 0, minInclusive: true },
  // Ein Leiter mit 0 mm² existiert nicht und würde durch Division durch
  // null zu Infinity im Spannungsfall führen.
  Mm2: { min: 0, minInclusive: false },
  Meters: { min: 0, minInclusive: true },
  Millivolts: { min: 0, minInclusive: true },
  Ohms: { min: 0, minInclusive: true },
};

const SYMBOL: Record<string, string> = {
  Watts: 'W',
  Amps: 'A',
  Volts: 'V',
  Mm2: 'mm²',
  Meters: 'm',
  Millivolts: 'mV',
  Ohms: 'Ω',
};

/**
 * Prüft einen Rohwert und markiert ihn. Wirft `RangeError` bzw. `TypeError`,
 * statt still einen Ersatzwert einzusetzen — ein stiller Fallback würde eine
 * falsche Auslegung plausibel aussehen lassen.
 */
function construct<Name extends string>(name: Name, value: number): Quantity<Name> {
  if (typeof value !== 'number') {
    throw new TypeError(`${name}: erwartet number, erhalten ${typeof value}`);
  }
  if (Number.isNaN(value)) {
    throw new RangeError(`${name}: NaN ist kein gültiger Wert`);
  }
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name}: ${value} ist nicht endlich`);
  }
  const bounds = BOUNDS[name];
  if (bounds) {
    const violated = bounds.minInclusive ? value < bounds.min : value <= bounds.min;
    if (violated) {
      const comparator = bounds.minInclusive ? '≥' : '>';
      throw new RangeError(
        `${name}: ${value} ${SYMBOL[name]} ist unzulässig (erwartet ${comparator} ${bounds.min})`
      );
    }
  }
  return value as Quantity<Name>;
}

/** Leistung in Watt. Wirft bei NaN, Infinity oder negativen Werten. */
export const watts = (value: number): Watts => construct('Watts', value);
/** Strom in Ampere. Wirft bei NaN, Infinity oder negativen Werten. */
export const amps = (value: number): Amps => construct('Amps', value);
/** Spannung in Volt. Wirft bei NaN, Infinity oder negativen Werten. */
export const volts = (value: number): Volts => construct('Volts', value);
/** Querschnitt in mm². Wirft bei NaN, Infinity und Werten ≤ 0. */
export const mm2 = (value: number): Mm2 => construct('Mm2', value);
/** Länge in Metern. Wirft bei NaN, Infinity oder negativen Werten. */
export const meters = (value: number): Meters => construct('Meters', value);
/** Spannung in Millivolt. Wirft bei NaN, Infinity oder negativen Werten. */
export const millivolts = (value: number): Millivolts => construct('Millivolts', value);
/** Widerstand in Ohm. Wirft bei NaN, Infinity oder negativen Werten. */
export const ohms = (value: number): Ohms => construct('Ohms', value);

/**
 * Zeichenmaßstab des Planer-Canvas: so viele Pixel entsprechen einem Meter.
 *
 * EINZIGE Quelle für die Umrechnung Pixel ↔ Meter. Drei Stellen hängen an
 * diesem Verhältnis und dürfen nie auseinanderlaufen:
 *   - `lib/autoWire.ts` (geometrische Längenschätzung beim Verdrahten)
 *   - `components/edges/CableEdge.tsx` (Längenanzeige auf der Kante)
 *   - `components/edges/utils/voltageDrop.ts` (Längenschätzung für den
 *     Spannungsfall-Hinweis)
 * Ob ein Mindestwert (z. B. 1 m) erzwungen wird, ist Sache der Aufrufer —
 * die Stellen unterscheiden sich hier bewusst (siehe Kommentare dort).
 */
export const PX_PER_METER = 100;

// ============================================================================
// GRENZEN ZUR AUSSENWELT (UI, JSON, React-Flow-`data`)
// ============================================================================

/**
 * Entpackt eine Größe zu einer rohen Zahl. Zur Laufzeit die Identität —
 * der Zweck ist die *sichtbare* Stelle im Code, an der die Einheit endet
 * (Rendering, `JSON.stringify`, React-Flow-`data`).
 */
export const toNumber = (quantity: PhysicalQuantity): number => quantity;

/** Wie `toNumber`, auf eine Dezimalstelle gerundet — für Anzeigen. */
export const toFixedNumber = (quantity: PhysicalQuantity, digits: Scalar = 1): number => {
  if (!Number.isInteger(digits) || digits < 0 || digits > 20) {
    throw new RangeError(`toFixedNumber: digits muss 0…20 sein, war ${digits}`);
  }
  const factor = Math.pow(10, digits);
  return Math.round(quantity * factor) / factor;
};

type Parser<Q extends PhysicalQuantity> = (value: number) => Q;

/**
 * Zerlegt den Ziffernteil einer Zahl in Integer- und Dezimalanteil — oder
 * liefert `null`, wenn die Schreibweise MEHRDEUTIG ist.
 *
 * Regeln (bewusst entschieden, nicht geraten):
 *  1. Komma UND Punkt im Text ⇒ der RECHTE ist das Dezimalzeichen, der linke
 *     ein Tausender-Trenner: `"1.234,56"` (deutsch) und `"1,234.56"`
 *     (englisch) sind damit beide eindeutig und beide korrekt lesbar.
 *  2. Ein Trenner genau einmal ⇒ Dezimalzeichen. Komma ⇒ Dezimalkomma
 *     (UI-Sprache Deutsch), Punkt ⇒ Dezimalpunkt (Schreibweise von
 *     `<input type="number">` und JSON).
 *  3. Derselbe Trenner mehrfach ⇒ Tausender-Trenner, aber nur als echte
 *     Dreiergruppen (`"1.000.000"` ✓, `"1.2.3"` ✗).
 */
function splitDecimalBody(body: string): { intPart: string; fracPart: string | null } | null {
  const isDigits = (text: string): boolean => /^\d+$/.test(text);
  const thousandsGroups = (text: string, separator: string): string | null => {
    const groups = text.split(separator);
    const head = groups[0];
    if (head === undefined || !/^\d{1,3}$/.test(head)) return null;
    return groups.slice(1).every((group) => /^\d{3}$/.test(group)) ? groups.join('') : null;
  };
  /** Teilt genau einmal — `null`, wenn der Trenner fehlt oder mehrfach steht. */
  const splitOnce = (text: string, separator: string): [string, string] | null => {
    const parts = text.split(separator);
    const head = parts[0];
    const tail = parts[1];
    if (parts.length !== 2 || head === undefined || tail === undefined) return null;
    return [head, tail];
  };

  const commas = body.split(',').length - 1;
  const dots = body.split('.').length - 1;

  // Fall 1: beide Trennerarten — der rechte trennt die Dezimalstellen.
  if (commas > 0 && dots > 0) {
    const decimalSep = body.lastIndexOf(',') > body.lastIndexOf('.') ? ',' : '.';
    const pair = splitOnce(body, decimalSep);
    if (!pair) return null; // "1,2,3.4" — mehrdeutig
    const [rawInt, fracPart] = pair;
    if (!isDigits(fracPart)) return null;
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    const intPart = rawInt.includes(thousandsSep)
      ? thousandsGroups(rawInt, thousandsSep)
      : rawInt === '' || isDigits(rawInt)
        ? rawInt
        : null;
    if (intPart === null) return null;
    return { intPart, fracPart };
  }

  // Fall 3: ein Trenner mehrfach — Tausender-Gruppen, keine Dezimalstellen.
  if (commas > 1) {
    const intPart = thousandsGroups(body, ',');
    return intPart === null ? null : { intPart, fracPart: null };
  }
  if (dots > 1) {
    const intPart = thousandsGroups(body, '.');
    return intPart === null ? null : { intPart, fracPart: null };
  }

  // Fall 2: ein Trenner genau einmal — Dezimalzeichen.
  if (commas === 1 || dots === 1) {
    const pair = splitOnce(body, commas === 1 ? ',' : '.');
    if (!pair) return null;
    const [intPart, fracPart] = pair;
    if (!isDigits(fracPart)) return null;
    if (intPart !== '' && !isDigits(intPart)) return null;
    return { intPart, fracPart };
  }

  return isDigits(body) ? { intPart: body, fracPart: null } : null;
}

/**
 * Zahl aus einem String — locale-tolerant, aber streng (AUDIT S2/S4).
 *
 * Warum nicht `parseFloat`: `parseFloat` liest einen PRÄFIX und schweigt zum
 * Rest. `"2,5"` wurde zu `2` (Dezimalkomma ignoriert), `"2.5mm"` zu `2.5`
 * (Einheit verschluckt) — in beiden Fällen meldete die Eingabe einen gültigen
 * Wert, der ein anderer war als der getippte. Bei Leitungsquerschnitten und
 * Sicherungsströmen ist das eine Unterdimensionierung mit Anschein von
 * Korrektheit. `parseFloat`-Verhalten ist hier deshalb ausdrücklich verboten:
 * Diese Funktion liefert nur dann eine Zahl, wenn der GESAMTE Text eine Zahl
 * ist, sonst `null`.
 *
 * Akzeptiert: `"12"`, `"12.5"`, `"12,5"`, `"+12,5"`, `"−12,5"` (Unicode-Minus),
 * `"1.234,56"`, `"1,234.56"`, `"12 345,6"` (Leer-/Tausenderzeichen), `".5"`.
 * Abgelehnt (`null`): `""`, `"abc"`, `"2.5mm"`, `"1,2,3"`, `"1.23.456"`, `"--1"`.
 */
export function parseDecimalString(input: string): number | null {
  // Unicode-Minus (U+2212) und Leer-/Tausenderzeichen (geschützt, schmal,
  // U+2000–U+200A) kommen aus Copy-Paste und Tabellenkalkulation — `\s`
  // deckt sie in JS ab. Beides sind echte Nutzereingaben, kein Müll.
  const normalized = input.replace(/\u2212/g, '-').replace(/\s+/g, '');
  if (normalized === '') return null;

  const negative = normalized.startsWith('-');
  const body = negative || normalized.startsWith('+') ? normalized.slice(1) : normalized;
  if (body === '' || !/^[\d.,]+$/.test(body)) return null;

  const split = splitDecimalBody(body);
  if (!split) return null;

  const value = Number(`${split.intPart || '0'}${split.fracPart ? `.${split.fracPart}` : ''}`);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/**
 * Liest einen unbekannten Wert (Formulareingabe, geladenes JSON, `node.data`)
 * und gibt `null` zurück, wenn er keine gültige Größe ergibt.
 *
 * Akzeptiert Zahlen und Zahl-Strings (`"12.5"`, `"12,5"`, `"1.234,5"`), aber
 * weder leere Strings noch `null`, `undefined`, Booleans oder Objekte.
 * Strings werden über `parseDecimalString` gelesen — ein Text, der nicht
 * vollständig eine Zahl ist, ergibt `null` statt eines still gekürzten Werts.
 */
export function parseQuantity<Q extends PhysicalQuantity>(input: unknown, parser: Parser<Q>): Q | null {
  let raw: number;
  if (typeof input === 'number') {
    raw = input;
  } else if (typeof input === 'string') {
    const parsed = parseDecimalString(input);
    if (parsed === null) return null;
    raw = parsed;
  } else {
    return null;
  }
  try {
    return parser(raw);
  } catch {
    return null;
  }
}

/** `parseQuantity` mit Ersatzwert statt `null`. */
export function quantityOr<Q extends PhysicalQuantity>(input: unknown, parser: Parser<Q>, fallback: Q): Q {
  return parseQuantity(input, parser) ?? fallback;
}

// ============================================================================
// PHYSIKALISCHE OPERATIONEN
// ============================================================================

/** P = U · I */
export const power = (voltage: Volts, current: Amps): Watts => construct('Watts', voltage * current);

/** I = P / U. Wirft bei U = 0 (kein sinnvoller Strom definierbar). */
export const currentFromPower = (load: Watts, voltage: Volts): Amps => {
  if (voltage === 0) {
    throw new RangeError('currentFromPower: Division durch 0 V ist nicht definiert');
  }
  return construct('Amps', load / voltage);
};

/** U = P / I. Wirft bei I = 0. */
export const voltageFromPower = (load: Watts, current: Amps): Volts => {
  if (current === 0) {
    throw new RangeError('voltageFromPower: Division durch 0 A ist nicht definiert');
  }
  return construct('Volts', load / current);
};

/** U = R · I (Ohmsches Gesetz). */
export const voltageFromResistance = (resistance: Ohms, current: Amps): Volts =>
  construct('Volts', resistance * current);

/**
 * Leiterwiderstand R = ρ · L / A.
 *
 * @param length       Leiterlänge (einfache Strecke)
 * @param crossSection Querschnitt
 * @param resistivity  Spezifischer Widerstand in Ω·mm²/m (Kupfer ≈ 0.0175)
 */
export const conductorResistance = (length: Meters, crossSection: Mm2, resistivity: Scalar): Ohms => {
  if (!Number.isFinite(resistivity) || resistivity <= 0) {
    throw new RangeError(`conductorResistance: ρ muss > 0 sein, war ${resistivity}`);
  }
  return construct('Ohms', (resistivity * length) / crossSection);
};

/** 1 V = 1000 mV. */
export const voltsToMillivolts = (value: Volts): Millivolts => construct('Millivolts', value * 1000);

/** 1000 mV = 1 V. */
export const millivoltsToVolts = (value: Millivolts): Volts => construct('Volts', value / 1000);

/**
 * Anteil eines Spannungsfalls an der Systemspannung (0…1, dimensionslos).
 * Bewusst ein roher `number`: ein Verhältnis hat keine Einheit.
 */
export const dropFraction = (drop: Volts, system: Volts): number => {
  if (system === 0) {
    throw new RangeError('dropFraction: Systemspannung 0 V ist nicht definiert');
  }
  return drop / system;
};

/** Anteil in Prozent (0…100). */
export const dropPercent = (drop: Volts, system: Volts): number => dropFraction(drop, system) * 100;

// ── Additionen und Skalierungen (einheitenerhaltend) ────────────────────────

const scaleFactor = (name: string, factor: Scalar): number => {
  if (!Number.isFinite(factor)) {
    throw new RangeError(`${name}: Faktor ${factor} ist nicht endlich`);
  }
  return factor;
};

/**
 * Divisor für einheitenerhaltende Division (Wirkungsgrad, Derating).
 * Bewusst getrennt von `scaleFactor`: 0 ist als Faktor erlaubt, als Divisor
 * nicht.
 */
const divisorOf = (name: string, divisor: Scalar): number => {
  if (!Number.isFinite(divisor) || divisor === 0) {
    throw new RangeError(`${name}: Divisor ${divisor} ist ungültig`);
  }
  return divisor;
};

export const addWatts = (a: Watts, b: Watts): Watts => construct('Watts', a + b);
export const sumWatts = (values: readonly Watts[]): Watts =>
  construct(
    'Watts',
    values.reduce<number>((total, value) => total + value, 0)
  );
export const scaleWatts = (value: Watts, factor: Scalar): Watts =>
  construct('Watts', value * scaleFactor('scaleWatts', factor));

export const addAmps = (a: Amps, b: Amps): Amps => construct('Amps', a + b);
export const sumAmps = (values: readonly Amps[]): Amps =>
  construct(
    'Amps',
    values.reduce<number>((total, value) => total + value, 0)
  );
export const scaleAmps = (value: Amps, factor: Scalar): Amps =>
  construct('Amps', value * scaleFactor('scaleAmps', factor));

export const addVolts = (a: Volts, b: Volts): Volts => construct('Volts', a + b);
export const subtractVolts = (a: Volts, b: Volts): Volts => construct('Volts', a - b);
export const sumVolts = (values: readonly Volts[]): Volts =>
  construct(
    'Volts',
    values.reduce<number>((total, value) => total + value, 0)
  );
export const scaleVolts = (value: Volts, factor: Scalar): Volts =>
  construct('Volts', value * scaleFactor('scaleVolts', factor));

/**
 * Spannungsfall einer Hin- und Rückleitung: ΔU = I · 2L / (κ · A).
 * Der einzige benannte Ort, an dem aus Strom/Länge/Querschnitt wieder Volt
 * entstehen — so bleiben Einheiten an der Typgrenze sichtbar und nachprüfbar.
 */
export const voltageDrop = (
  current: Amps,
  length: Meters,
  crossSection: Mm2,
  conductivity: Scalar
): Volts => {
  if (!Number.isFinite(conductivity) || conductivity <= 0) {
    throw new RangeError(`voltageDrop: κ muss > 0 sein, war ${conductivity}`);
  }
  return construct('Volts', (current * (length * 2)) / (conductivity * crossSection));
};

/**
 * Kleinster Querschnitt, der bei Strom/Länge/κ den Spannungsfall ΔU einhält:
 * A = I · 2L / (κ · ΔU).
 */
export const crossSectionForVoltageDrop = (
  current: Amps,
  length: Meters,
  allowedDrop: Volts,
  conductivity: Scalar
): Mm2 => {
  if (!Number.isFinite(conductivity) || conductivity <= 0) {
    throw new RangeError(`crossSectionForVoltageDrop: κ muss > 0 sein, war ${conductivity}`);
  }
  if (allowedDrop <= 0) {
    throw new RangeError('crossSectionForVoltageDrop: ΔU muss > 0 sein');
  }
  return construct('Mm2', (current * (length * 2)) / (conductivity * allowedDrop));
};

export const addMeters = (a: Meters, b: Meters): Meters => construct('Meters', a + b);
export const sumMeters = (values: readonly Meters[]): Meters =>
  construct(
    'Meters',
    values.reduce<number>((total, value) => total + value, 0)
  );
export const scaleMeters = (value: Meters, factor: Scalar): Meters =>
  construct('Meters', value * scaleFactor('scaleMeters', factor));

export const scaleMm2 = (value: Mm2, factor: Scalar): Mm2 =>
  construct('Mm2', value * scaleFactor('scaleMm2', factor));

/**
 * Division durch eine dimensionslose Zahl — z. B. Strom geteilt durch den
 * Wirkungsgrad eines Wechselrichters. Bewahrt die Einheit und ist
 * bit-identisch zur direkten Division (anders als eine Multiplikation
 * mit dem Kehrwert).
 */
export const divideAmps = (value: Amps, divisor: Scalar): Amps =>
  construct('Amps', value / divisorOf('divideAmps', divisor));
export const divideWatts = (value: Watts, divisor: Scalar): Watts =>
  construct('Watts', value / divisorOf('divideWatts', divisor));

/** Größere der beiden Größen — bleibt in der Einheit. */
export const maxAmps = (a: Amps, b: Amps): Amps => (a >= b ? a : b);
export const maxMm2 = (a: Mm2, b: Mm2): Mm2 => (a >= b ? a : b);
export const maxWatts = (a: Watts, b: Watts): Watts => (a >= b ? a : b);
export const minMm2 = (a: Mm2, b: Mm2): Mm2 => (a <= b ? a : b);

// ── Häufige Konstanten ──────────────────────────────────────────────────────

/** 0 W */
export const ZERO_WATTS: Watts = watts(0);
/** 0 A */
export const ZERO_AMPS: Amps = amps(0);
/** 0 V */
export const ZERO_VOLTS: Volts = volts(0);
/** 0 m */
export const ZERO_METERS: Meters = meters(0);
