/**
 * lib/electricalGraph/constraints.ts — EIN CONSTRAINT-MODELL FÜR BAUTEILE.
 *
 * Befund V2-CONST-001: Bauteilwissen lag als `if (node.type === 'battery')`
 * über den Baum verteilt — in `useLiveValidation`, in `sizing.ts`, in
 * `connectionRules.ts`, in `CableEdge.tsx`. Jede neue Bauteilart bedeutete
 * eine Suche nach allen Stellen; jede vergessene Stelle war ein stiller
 * Logikloch (gemessen: BMS-Grenzen standen im Schema, wurden aber nur an
 * EINER Stelle gelesen — der Rest der Kette dimensionierte ohne sie).
 *
 * Hier steht das Wissen EINMAL und DEKLARATIV:
 *
 *   - `CONSTRAINT_FIELD_MAP`  welches `node.data`-Feld welche Grenze ist
 *   - `COMPONENT_CONSTRAINT_DEFAULTS` was unabhängig von Nutzerdaten gilt
 *     (zulässige Domänen, Schutzpflicht)
 *
 * `resolveComponentConstraints(node)` wertet beides generisch aus. Neue
 * Bauteilarten brauchen damit einen Tabelleneintrag, keinen neuen
 * `if`-Zweig irgendwo im Baum.
 *
 * WAS HIER NICHT PASSIERT: rechnen. Diese Datei liest Datenblattwerte und
 * normalisiert sie. Ströme aus Leistung (P/U), Querschnitte und Sicherungen
 * bleiben in `lib/vde-standards.ts` / `lib/electrical.ts` — eine Quelle.
 */

import { amps, parseQuantity, volts, watts, type Amps, type Volts, type Watts } from '../units';
import type { HandleDomainValue } from '../domain/handleDomains';
import { classifySystemVoltage, type SystemVoltageClass } from './powerSystem';

/** Schutzorgan, das ein Bauteil an seiner Quellseite verlangt. */
export type RequiredProtection = 'fuse' | 'rcd' | 'none';

/**
 * Betriebsgrenzen eines Bauteils. Jedes Feld ist optional — ein fehlender
 * Wert heißt „nicht angegeben", niemals „unbegrenzt". Wer eine Grenze
 * braucht und keine hat, meldet das (Regel M: kein stiller Fallback).
 */
export interface ComponentConstraints {
  /** Kleinste zulässige Betriebsspannung (V). */
  minVoltage?: Volts;
  /** Größte zulässige Betriebsspannung (V). */
  maxVoltage?: Volts;
  /** Ausdrücklich deklarierte Bordnetzebene (aus `nominalVoltage` abgeleitet). */
  voltageClass?: SystemVoltageClass;
  /** Höchststrom (A), auch kurzzeitig. */
  maxCurrent?: Amps;
  /** Dauerstrom (A). */
  continuousCurrent?: Amps;
  /** Höchster Ladestrom (A) — BMS/Bauteilgrenze. */
  maxChargeCurrent?: Amps;
  /** Höchster Entladestrom (A) — BMS/Bauteilgrenze. */
  maxDischargeCurrent?: Amps;
  /** Dauerleistung (W) — z. B. Wechselrichter. */
  continuousPower?: Watts;
  /** Domänen, in denen das Bauteil überhaupt betrieben werden darf. */
  allowedDomains?: readonly HandleDomainValue[];
  /** Schutzorgan, das die Quellseite verlangt. */
  requiredProtection?: RequiredProtection;
  /** Vom Datenblatt empfohlener Sicherungsnennstrom (A). */
  preferredFuse?: Amps;
}

/** Schmale Knotensicht — nur Typ und Datenfeld werden gelesen. */
export type ConstraintNode = {
  type?: string | undefined;
  data?: Record<string, unknown> | undefined;
};

type NumericTarget =
  | 'minVoltage'
  | 'maxVoltage'
  | 'maxCurrent'
  | 'continuousCurrent'
  | 'maxChargeCurrent'
  | 'maxDischargeCurrent'
  | 'continuousPower'
  | 'preferredFuse';

type FieldSpec = {
  /** Feldname in `node.data`. */
  key: string;
  /** Zielgrenze im Constraint-Modell. */
  target: NumericTarget;
};

/**
 * Welches `node.data`-Feld ist welche Grenze? Je Bauteiltyp.
 *
 * Die Feldnamen spiegeln `lib/nodeSchema.ts` — dort steht die
 * Laufzeit-Typprüfung, hier die FACHLICHE Bedeutung. Ein Feld, das in beiden
 * Tabellen fehlt, existiert für die Engine nicht (Test hält sie synchron).
 */
export const CONSTRAINT_FIELD_MAP: Readonly<Record<string, readonly FieldSpec[]>> = {
  battery: [
    { key: 'bmsContinuousDischarge', target: 'maxDischargeCurrent' },
    { key: 'bmsPeakDischarge', target: 'maxCurrent' },
    { key: 'bmsContinuousCharge', target: 'maxChargeCurrent' },
  ],
  busbar: [{ key: 'rating', target: 'continuousCurrent' }],
  fuse: [{ key: 'rating', target: 'preferredFuse' }],
  charger: [{ key: 'amps', target: 'continuousCurrent' }],
  mpptController: [
    { key: 'amps', target: 'continuousCurrent' },
    { key: 'maxPvVoltage', target: 'maxVoltage' },
  ],
  dcdcCharger: [{ key: 'amps', target: 'continuousCurrent' }],
  acBatteryCharger: [{ key: 'amps', target: 'continuousCurrent' }],
  inverter: [{ key: 'continuousPower', target: 'continuousPower' }],
  shorePower: [
    { key: 'rating', target: 'continuousCurrent' },
    { key: 'acCurrentA', target: 'continuousCurrent' },
  ],
  solar: [{ key: 'isc', target: 'maxCurrent' }],
  roofSolar: [{ key: 'isc', target: 'maxCurrent' }],
};

/**
 * Statische Eigenschaften je Bauteiltyp — unabhängig von Nutzerdaten.
 *
 * `requiredProtection` benennt NUR die Pflicht, nicht die Größe: Welcher
 * Nennstrom passt, entscheidet `selectFuseSize` (lib/electrical.ts).
 */
export const COMPONENT_CONSTRAINT_DEFAULTS: Readonly<
  Record<string, Pick<ComponentConstraints, 'allowedDomains' | 'requiredProtection'>>
> = {
  battery: { allowedDomains: ['DC_12V'], requiredProtection: 'fuse' },
  busbar: { allowedDomains: ['DC_12V'], requiredProtection: 'none' },
  shunt: { allowedDomains: ['DC_12V'], requiredProtection: 'none' },
  fuse: { allowedDomains: ['DC_12V'], requiredProtection: 'none' },
  ground: { allowedDomains: ['DC_12V'], requiredProtection: 'none' },
  conduit: { allowedDomains: ['DC_12V', 'AC_230V', 'Solar'], requiredProtection: 'none' },
  consumer: { allowedDomains: ['DC_12V'], requiredProtection: 'fuse' },
  consumer230v: { allowedDomains: ['AC_230V'], requiredProtection: 'rcd' },
  inverter: { allowedDomains: ['DC_12V', 'AC_230V'], requiredProtection: 'fuse' },
  shorePower: { allowedDomains: ['AC_230V'], requiredProtection: 'rcd' },
  acBatteryCharger: { allowedDomains: ['AC_230V', 'DC_12V'], requiredProtection: 'fuse' },
  charger: { allowedDomains: ['DC_12V', 'Solar'], requiredProtection: 'fuse' },
  mpptController: { allowedDomains: ['DC_12V', 'Solar'], requiredProtection: 'fuse' },
  dcdcCharger: { allowedDomains: ['DC_12V'], requiredProtection: 'fuse' },
  solar: { allowedDomains: ['Solar'], requiredProtection: 'fuse' },
  roofSolar: { allowedDomains: ['Solar'], requiredProtection: 'fuse' },
};

/** Parser je Zielgrenze — Volt, Ampere oder Watt. */
function assignNumeric(out: ComponentConstraints, target: NumericTarget, raw: unknown): void {
  switch (target) {
    case 'minVoltage':
    case 'maxVoltage': {
      const value = parseQuantity(raw, volts);
      if (value !== null && value > 0) out[target] = value;
      return;
    }
    case 'continuousPower': {
      const value = parseQuantity(raw, watts);
      if (value !== null && value > 0) out.continuousPower = value;
      return;
    }
    default: {
      const value = parseQuantity(raw, amps);
      if (value !== null && value > 0) out[target] = value;
    }
  }
}

/**
 * Grenzen eines Bauteils aus Typ + `node.data`.
 *
 * Deterministisch und seiteneffektfrei: dieselbe Eingabe ⇒ dasselbe Ergebnis
 * (Grundlage der Property-Tests). Unbekannte Typen liefern ein leeres
 * Constraint-Objekt — das ist ehrlicher als geratene Grenzen.
 */
export function resolveComponentConstraints(node: ConstraintNode): ComponentConstraints {
  const out: ComponentConstraints = {};
  const type = node.type;
  if (!type) return out;

  const defaults = COMPONENT_CONSTRAINT_DEFAULTS[type];
  if (defaults?.allowedDomains) out.allowedDomains = defaults.allowedDomains;
  if (defaults?.requiredProtection) out.requiredProtection = defaults.requiredProtection;

  const data = node.data;
  if (!data) return out;

  for (const spec of CONSTRAINT_FIELD_MAP[type] ?? []) {
    assignNumeric(out, spec.target, data[spec.key]);
  }

  // Die Nennspannung bestimmt die Bordnetzebene des Bauteils. Sie ist KEINE
  // Grenze (min/max), sondern eine Zuordnung — deshalb getrennt behandelt.
  const nominal = parseQuantity(data['nominalVoltage'], volts);
  if (nominal !== null && nominal > 0) {
    const cls = classifySystemVoltage(nominal);
    if (cls !== 'unknown') out.voltageClass = cls;
  }

  // Ein Wechselrichter ohne `continuousPower` trägt seine Leistung häufig in
  // `watts` (ELE-006, historische Datenform). Nur als Rückfall — ein
  // vorhandener Dauerleistungswert bleibt unangetastet.
  if (type === 'inverter' && out.continuousPower === undefined) {
    const fallback = parseQuantity(data['watts'], watts);
    if (fallback !== null && fallback > 0) out.continuousPower = fallback;
  }

  return out;
}

/**
 * Engste Dauerstromgrenze eines Bauteils: `continuousCurrent`, sonst
 * `maxDischargeCurrent`, sonst `maxCurrent`. `undefined` heißt „keine
 * Angabe" und wird vom Strombudget als „unbeschränkt durch dieses Bauteil"
 * geführt — sichtbar, nicht still (s. `currentBudget.ts`).
 */
export function componentCurrentLimit(constraints: ComponentConstraints): Amps | undefined {
  return constraints.continuousCurrent ?? constraints.maxDischargeCurrent ?? constraints.maxCurrent;
}
