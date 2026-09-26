/**
 * lib/solar.ts — PV-spezifisches Auslegungsmodell (AUDIT ELE-007).
 *
 * Vorher war im gesamten Solar-Pfad nur eine Imp-Näherung (watts / 18 V)
 * modelliert. Isc, kalte Leerlaufspannung (Voc), das Voc-Fenster des
 * Ladereglers und der Stringschutz fehlten komplett — obwohl das
 * ExpertPanel selbst davor warnt („MPPT muss Voc verkraften").
 *
 * Quellenlage (ehrlich, Stand 2026-09-07):
 * - Sicherungsfaktor 1,56 × Isc: NEC 690.8(A)(1) (max. Stromkreisstrom
 *   1,25 × Isc) × NEC 690.9(B)(1) (OCPD ≥ 125 % davon) = 1,5625 × Isc.
 *   VERIFIED über Mersen Tech-Topic „Sizing Fuses for Photovoltaic Systems
 *   per the NEC". Das ist die US-Regel (NEC) — als Modellannahme gewählt,
 *   weil sie am unteren Rand aller recherchierten Bereiche liegt (kleinste
 *   zulässige Sicherung, kein unnötiges Überdimensionieren).
 * - IEC 62548 (PV-Array-Auslegung): String-Sicherung im Bereich ca.
 *   1,25–2,4 × Isc (Entwurfsstand laut Fachartikel „Short circuit
 *   protection in PV systems", Ausgabe 2/2012) — UNVERIFIED im
 *   Klauselwortlaut, aber vereinbar mit dem 1,56-Mindestfaktor. Bei
 *   ≤ 2 parallelen Strings ist kein Stringschutz erforderlich
 *   (IEC-62548-Kontext) — der Planer modelliert Stringanzahlen nicht
 *   explizit und fordert daher konservativ immer die 1,56×Isc-Fläche.
 * - Stringkabel-Thermik ≥ 1,25 × Isc (IEC-62548-Kontext, Sekundärquelle):
 *   als Dimensionierungsstrom übernommen (SOLAR_CABLE_ISC_FACTOR).
 * - Temperaturkoeffizient der Leerlaufspannung (c-Si, datenblatttypisch):
 *   −0,25 bis −0,35 %/K. Modelldefault ist der schlechteste typische Wert
 *   −0,35 %/K (konservativ: höchste Kalt-Voc).
 * - Auslegungstemperatur −20 °C: MODELANNAHME für ein Fahrzeug in
 *   mitteleuropäischem Winterbetrieb (keine normative Verankerung im
 *   Fahrzeugkontext recherchiert); pro Panel über data.tempCoefficient
 *   überschreibbar.
 *
 * Alles hier ist reine Domänenlogik ohne React/Store-Abhängigkeit.
 */

import type { Node, Edge } from './domain/graph';
import { amps, quantityOr, volts, watts, type Amps, type Volts, type Watts } from './units';
import { VDE_SOLAR_VMP_VOLTAGE } from './vde-standards';

/**
 * Faktor Isc/Imp, wenn kein Datenblatt-Isc vorliegt.
 * Typische c-Si-Module liegen bei 1,03–1,25 × Imp; 1,25 deckt die Spanne
 * ab — fehlende Datenblattwerte dürfen nie zu NIEDRIG dimensionieren.
 */
export const SOLAR_ISC_IMPFALLBACK_FACTOR = 1.25;

/** Thermischer Dimensionierungsstrom Stringkabel = 1,25 × Isc (IEC-62548-Kontext). */
export const SOLAR_CABLE_ISC_FACTOR = 1.25;

/** Mindest-Sicherung Solar-Zuleitung = 1,5625 × Isc (NEC 690.8 × 690.9). */
export const SOLAR_FUSE_ISC_FACTOR = 1.5625;

/** Default Temperaturkoeffizient Voc: −0,35 %/K (schlechtester typischer c-Si-Wert). */
export const SOLAR_VOC_TEMP_COEFF_PER_KELVIN = -0.0035;

/** Auslegungs-Mindesttemperatur (Modellannahme Fahrzeug/Winter, s. Dateikopf). */
export const SOLAR_DESIGN_MIN_TEMPERATURE_C = -20;

/** STC-Referenztemperatur der Datenblattwerte. */
export const SOLAR_STC_TEMPERATURE_C = 25;

const isSolarType = (type: string | undefined): boolean => type === 'solar' || type === 'roofSolar';

const dataOf = (node: Node | undefined): Record<string, unknown> | undefined => node?.data;

/** Alle Solar-Panels (solar/roofSolar) eines Plans. */
export function solarPanelsOf(nodes: Node[]): Node[] {
  return nodes.filter((n) => isSolarType(n.type));
}

/** Panel-Nennleistung in W (ungültige Angaben → 0 W). */
export function solarWattsOf(node: Node | undefined): Watts {
  return quantityOr(dataOf(node)?.watts, watts, watts(0));
}

/**
 * Imp-Näherung: watts / Vmp (18 V MPP-Spannung eines 12-V-System-Panels).
 * Identisch zur bisherigen calculateEdgeCurrent-Priorität 2 — nur zentral.
 */
export function solarImpOf(node: Node | undefined): Amps {
  return amps(solarWattsOf(node) / VDE_SOLAR_VMP_VOLTAGE);
}

/**
 * Isc: Datenblattwert (solar.data.isc) wenn vorhanden und > 0,
 * sonst konservative Schätzung 1,25 × Imp (Begründung s. Konstante).
 */
export function solarIscOf(node: Node | undefined): Amps {
  const isc = quantityOr(dataOf(node)?.isc, amps, amps(0));
  return isc > 0 ? isc : amps(solarImpOf(node) * SOLAR_ISC_IMPFALLBACK_FACTOR);
}

/** Thermischer Dimensionierungsstrom der Panel-Zuleitung (≥ 1,25 × Isc). */
export function solarDesignCurrentOf(node: Node | undefined): Amps {
  return amps(Math.max(solarImpOf(node), solarIscOf(node) * SOLAR_CABLE_ISC_FACTOR));
}

/** Mindest-Sicherungsstrom der Panel-Zuleitung (1,5625 × Isc, NEC-Regel). */
export function solarFuseFloorOf(node: Node | undefined): Amps {
  return amps(solarIscOf(node) * SOLAR_FUSE_ISC_FACTOR);
}

/**
 * Grenze, ab der ein gespeicherter Temperaturkoeffizient als PROZENTANGABE
 * (%/K) und nicht als Bruch (1/K) gelesen wird.
 *
 * Physikalisch gibt es keine Überschneidung: c-Si-Module liegen bei
 * −0,20…−0,50 %/K, also −0,0020…−0,0050 als Bruch. Die Größenordnungen
 * unterscheiden sich um Faktor 100 — ein Schwellwert dazwischen ist damit
 * keine Raterei, sondern eine trennende Messgröße.
 */
export const SOLAR_TEMP_COEFF_PERCENT_THRESHOLD = 0.05;

/**
 * Temperaturkoeffizient Voc als BRUCH pro Kelvin — die einzige Lesestelle
 * dieses Datenfelds (AUDIT S1).
 *
 * Das Feld war doppeldeutig: Die UI beschriftete es mit „%/K" und schrieb
 * `−Math.abs(val)`, also **−0,35**; das Modell rechnete mit einem Bruch
 * (Default **−0,0035**). Beides stand im selben Feld. Gemessene Folge für ein
 * 22-V-Panel bei −20 °C: 25,47 V mit dem Default, **368,5 V** mit dem
 * UI-Wert — Faktor 14,5 auf eine Sicherheitsprüfung (Voc-Fenster des
 * Ladereglers). Die Anzeige behauptete „%/K", der Code rechnete „1/K".
 *
 * Hier wird normalisiert, und zwar an der Lesegrenze statt per Migration:
 *  - |TK| ≥ 0,05 ⇒ Prozentangabe ⇒ /100 (Altpläne und UI-Schreibweise),
 *  - |TK| < 0,05  ⇒ bereits ein Bruch (Datenblatt-Schreibweise des Modells),
 *  - fehlend/positiv/unsinnig ⇒ dokumentierter Default.
 * Der Schwellwert ist begründet (s. Konstante), nicht geraten.
 */
export function solarTempCoefficientPerKelvin(raw: unknown): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : Number.NaN;
  // Positiv oder unlesbar: ein positiver TK würde bedeuten, Voc STEIGE in der
  // Kälte — physikalisch falsch für c-Si. Default statt stiller Übernahme.
  if (Number.isNaN(value) || value >= 0) return SOLAR_VOC_TEMP_COEFF_PER_KELVIN;
  return value <= -SOLAR_TEMP_COEFF_PERCENT_THRESHOLD ? value / 100 : value;
}

/**
 * Kalte Leerlaufspannung EINES Panels:
 *   Voc(T_min) = Voc_STC · (1 + |TK| · (STC − T_min))
 * Liefert null, wenn kein Datenblatt-Voc (node.data.voc > 0) vorliegt —
 * raten (z. B. aus Vmp hochrechnen) wäre unehrlich; die Validierung
 * fordert stattdessen den Datenblattwert an.
 *
 * null auch dann, wenn der Temperaturfaktor nicht positiv ist (AUDIT S1):
 * Bei Zelltemperaturen über STC wird der Faktor kleiner als 1, und mit einem
 * unsinnigen Koeffizienten oder einer Auslegungstemperatur weit über 25 °C
 * (z. B. +60 °C NOCT-Fall) kippt er ins Negative. `volts()` wirft dort
 * RangeError — in der Live-Validierung ein uncaught Exception, der das Panel
 * beim Tippen einer Zahl abraumen ließ. Ehrliche Antwort ist „nicht
 * bewertbar" (null), dieselbe wie bei fehlendem Datenblatt-Voc.
 */
export function solarColdVocOf(
  node: Node | undefined,
  minTempC: number = SOLAR_DESIGN_MIN_TEMPERATURE_C
): Volts | null {
  const data = dataOf(node);
  const voc = quantityOr(data?.voc, volts, volts(0));
  if (voc <= 0) return null;
  const coeff = solarTempCoefficientPerKelvin(data?.tempCoefficient);
  const factor = 1 + Math.abs(coeff) * (SOLAR_STC_TEMPERATURE_C - minTempC);
  if (!(factor > 0)) return null; // auch NaN: `!(NaN > 0)` ist true
  return volts(voc * factor);
}

/**
 * Series-Strings erkennen: Verbundkomponenten über Solar↔Solar-Kanten
 * (die einzige „Series-Exception" im Planer). Panels, die einzeln am
 * Regler hängen, bilden Einelement-Strings.
 */
export function solarStringsOf(nodes: Node[], edges: Edge[]): Node[][] {
  const panels = solarPanelsOf(nodes);
  const byId = new Map(panels.map((p) => [p.id, p]));
  const adj = new Map<string, string[]>();
  for (const p of panels) adj.set(p.id, []);
  for (const edge of edges) {
    const s = byId.get(edge.source);
    const t = byId.get(edge.target);
    if (s && t) {
      adj.get(s.id)!.push(t.id);
      adj.get(t.id)!.push(s.id);
    }
  }
  const visited = new Set<string>();
  const strings: Node[][] = [];
  for (const p of panels) {
    if (visited.has(p.id)) continue;
    const chain: Node[] = [];
    const queue = [p.id];
    visited.add(p.id);
    while (queue.length > 0) {
      const id = queue.shift()!;
      chain.push(byId.get(id)!);
      for (const next of adj.get(id) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    strings.push(chain);
  }
  return strings;
}

/** Liegt ein Datenblatt-Voc vor? Trennt „Wert fehlt" von „Wert nicht auswertbar". */
export function solarHasDatasheetVoc(node: Node | undefined): boolean {
  return quantityOr(dataOf(node)?.voc, volts, volts(0)) > 0;
}

/**
 * Maximale KALT-Voc je String: Summe der Kalt-Voc der Panels im String.
 *
 * Panels, deren Kalt-Voc nicht ermittelt werden kann, zahlen 0 ein und heben
 * ein Flag — statt die Stringspannung still zu unterschätzen. Zwei Flags,
 * weil zwei Ursachen (AUDIT S1): `missingVoc` = kein Datenblatt-Voc
 * eingetragen, `uncomputableVoc` = Voc ist da, aber der Temperaturfaktor ist
 * nicht positiv (unsinniger Koeffizient oder Auslegungstemperatur so hoch,
 * dass das Modell außerhalb seines Geltungsbereichs wäre). Beides in einem
 * Flag zu melden hieße, dem Nutzer „Wert fehlt" zu sagen, wenn er einen
 * eingetragen hat.
 */
export function stringColdVocOf(
  nodes: Node[],
  edges: Edge[],
  minTempC?: number
): { stringVoc: Volts[]; missingVoc: boolean; uncomputableVoc: boolean } {
  let missingVoc = false;
  let uncomputableVoc = false;
  const stringVoc = solarStringsOf(nodes, edges).map((chain) =>
    chain.reduce((sum, panel) => {
      const voc = solarColdVocOf(panel, minTempC);
      if (voc === null) {
        if (solarHasDatasheetVoc(panel)) uncomputableVoc = true;
        else missingVoc = true;
        return sum;
      }
      return volts(sum + voc);
    }, volts(0))
  );
  return { stringVoc, missingVoc, uncomputableVoc };
}

/** Das Panel-Endpunkt einer Kante, falls eines existiert (sonst undefined). */
export function solarPanelEndOf(source: Node | undefined, target: Node | undefined): Node | undefined {
  if (isSolarType(source?.type)) return source;
  if (isSolarType(target?.type)) return target;
  return undefined;
}

/**
 * Referenzspannung (Basis) des Spannungsfalls auf der Panel-Zuleitung
 * (Panel → Laderegler) — AUDIT ELE-007 Restpunkt, nachgezogen 2026-09-08.
 *
 * Bis dahin wurde der prozentuale Spannungsfall auch auf Solar-Kanten gegen
 * die 12,8-V-Systemreferenz gerechnet: ein Fall von 0,5 V erschien als 3,9 %
 * statt als 2,8 % — konservativ, aber fachlich falsch bemessen (das Budget
 * greift so schon deutlich vor dem 3-%-Ziel an der MPP-Spannung).
 *
 * Basis ist die Betriebsspannung MPP des Modells (`VDE_SOLAR_VMP_VOLTAGE`,
 * 18 V: typische Vmp-Lage von „12-V"-Modulen, 36 Zellen, Vmp ≈ 17–18,5 V).
 * Bewusst NICHT panelindividuell: ein Datenblatt-Vmp-Feld existiert im
 * Modell nicht (das Feld data.voltage ist ein Legacy-Nennspannungsfeld ohne
 * Vmp-Semantik — 12-V-Nennlage ≠ 18-V-Betriebspunkt). Erweiterungspunkt:
 * echtes Datenblatt-Vmp anlegen und hier bevorzugen.
 */
export function solarDropBasisVoltageOf(): Volts {
  return VDE_SOLAR_VMP_VOLTAGE;
}

/**
 * Mindest-Sicherungsstrom für eine konkrete Kante:
 * Solar-Kante (Panel-Endpunkt) → 1,5625 × Isc des Panels,
 * sonst 0 (kein Solar-Sonderfaktor).
 */
export function solarEdgeFuseFloorOf(nodes: Node[], edge: Pick<Edge, 'source' | 'target'>): Amps {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const panel = solarPanelEndOf(byId.get(edge.source), byId.get(edge.target));
  return panel ? solarFuseFloorOf(panel) : amps(0);
}
