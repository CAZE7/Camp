import { describe, it, expect } from 'vitest';
import {
  SOLAR_CABLE_ISC_FACTOR,
  SOLAR_DESIGN_MIN_TEMPERATURE_C,
  SOLAR_FUSE_ISC_FACTOR,
  SOLAR_ISC_IMPFALLBACK_FACTOR,
  SOLAR_STC_TEMPERATURE_C,
  SOLAR_VOC_TEMP_COEFF_PER_KELVIN,
  solarColdVocOf,
  solarTempCoefficientPerKelvin,
  solarDesignCurrentOf,
  solarFuseFloorOf,
  solarImpOf,
  solarIscOf,
  solarStringsOf,
  solarWattsOf,
  stringColdVocOf,
} from './solar';
import type { Node, Edge } from './domain/graph';

const panel = (id: string, data: Record<string, unknown>): Node => ({
  id,
  type: 'solar',
  position: { x: 0, y: 0 },
  data,
});

const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});

describe('ELE-007 — Solar-Auslegungsmodell (lib/solar.ts)', () => {
  it('Imp-Näherung bleibt watts / 18 V (Vmp), konsistent zur Anzeige', () => {
    // 200 W / 18 V = 11,11 A — derselbe Wert wie bisher calculateEdgeCurrent.
    expect(solarImpOf(panel('p', { watts: 200 }))).toBeCloseTo(200 / 18, 10);
  });

  it('Isc: Datenblattwert gewinnt; ohne wird konservativ 1,25 × Imp geschätzt', () => {
    expect(solarIscOf(panel('p', { watts: 200, isc: 11.44 }))).toBeCloseTo(11.44, 10);
    // Schätzung deckt die typische Datenblatt-Spanne 1,03–1,25 × Imp ab.
    expect(solarIscOf(panel('p', { watts: 200 }))).toBeCloseTo((200 / 18) * SOLAR_ISC_IMPFALLBACK_FACTOR, 10);
    expect(SOLAR_ISC_IMPFALLBACK_FACTOR).toBe(1.25);
    // Ungültige Eingaben (Text, negativ) fallen auf die Schätzung zurück.
    expect(solarIscOf(panel('p', { watts: 200, isc: 'viel' }))).toBeCloseTo((200 / 18) * 1.25, 10);
    expect(solarIscOf(panel('p', { watts: 200, isc: -5 }))).toBeCloseTo((200 / 18) * 1.25, 10);
  });

  it('Thermischer Designstrom ≥ 1,25 × Isc (IEC-62548-Kontext Stringkabel)', () => {
    // Mit Datenblatt-Isc 11,44 A: max(11,11 A Imp; 14,3 A) = 14,3 A.
    expect(solarDesignCurrentOf(panel('p', { watts: 200, isc: 11.44 }))).toBeCloseTo(
      11.44 * SOLAR_CABLE_ISC_FACTOR,
      10
    );
    // Schätzung: 1,25 × 1,25 = 1,5625 × Imp.
    expect(solarDesignCurrentOf(panel('p', { watts: 200 }))).toBeCloseTo((200 / 18) * 1.5625, 10);
  });

  it('Sicherungs-Mindeststrom = 1,5625 × Isc (NEC 690.8 × 690.9)', () => {
    expect(SOLAR_FUSE_ISC_FACTOR).toBe(1.5625);
    // 200-W-Panel mit Datenblatt-Isc: 11,44 × 1,5625 = 17,88 A → Sicherung 20 A.
    expect(solarFuseFloorOf(panel('p', { watts: 200, isc: 11.44 }))).toBeCloseTo(17.875, 3);
    // Ohne Datenblatt: Schätzung Isc = 1,25 × Imp, Floor = 1,5625 × Isc
    // = 1,25 · 1,5625 · Imp ≈ 21,7 A → nächstgrößere Normsicherung 25 A.
    expect(solarFuseFloorOf(panel('p', { watts: 200 }))).toBeCloseTo((200 / 18) * 1.25 * 1.5625, 3);
  });

  it('Kalt-Voc: Formel Voc(T_min) = Voc_STC · (1 + |TK| · (25 − T_min))', () => {
    // 22 V STC, Default-TK −0,35 %/K, T_min −20 °C → Faktor 1,1575 → 25,47 V.
    expect(SOLAR_VOC_TEMP_COEFF_PER_KELVIN).toBeCloseTo(-0.0035, 10);
    expect(SOLAR_DESIGN_MIN_TEMPERATURE_C).toBe(-20);
    expect(SOLAR_STC_TEMPERATURE_C).toBe(25);
    expect(solarColdVocOf(panel('p', { voc: 22 }))).toBeCloseTo(22 * 1.1575, 6);
    // Eigener Koeffizient (z. B. −0,27 %/K) wird respektiert.
    expect(solarColdVocOf(panel('p', { voc: 22, tempCoefficient: -0.0027 }))).toBeCloseTo(
      22 * (1 + 0.0027 * 45),
      6
    );
    // Ohne Datenblatt-Voc: null statt Schätzung (ehrlich — Warnung fordert Wert an).
    expect(solarColdVocOf(panel('p', { watts: 200 }))).toBeNull();
  });

  // ── AUDIT S1: Einheit des Temperaturkoeffizienten ──────────────────────────
  describe('Temperaturkoeffizient Voc — eine Einheit an der Lesegrenze (AUDIT S1)', () => {
    it('Prozentangabe (UI/Datenblatt) und Bruch (Modell) ergeben dieselbe Kalt-Voc', () => {
      // Die Audit-Probe: 22-V-Panel, −20 °C. Mit dem Bruch −0,0035 kamen
      // 25,47 V heraus, mit dem UI-Wert −0,35 (als Bruch missverstanden)
      // 368,5 V — Faktor 14,5 auf eine Sicherheitsprüfung.
      const viaFraction = solarColdVocOf(panel('p', { voc: 22, tempCoefficient: -0.0035 }));
      const viaPercent = solarColdVocOf(panel('p', { voc: 22, tempCoefficient: -0.35 }));
      expect(viaFraction).toBeCloseTo(22 * 1.1575, 6);
      expect(viaPercent).toEqual(viaFraction);
      // Gegenprobe, dass hier nicht einfach alles auf den Default fällt:
      const other = solarColdVocOf(panel('p', { voc: 22, tempCoefficient: -0.27 }));
      expect(other).toBeCloseTo(22 * (1 + 0.0027 * 45), 6);
      expect(other).not.toEqual(viaFraction);
    });

    it('normalisiert an der Lesegrenze und fällt auf den Default zurück', () => {
      expect(solarTempCoefficientPerKelvin(-0.35)).toBeCloseTo(-0.0035, 12);
      expect(solarTempCoefficientPerKelvin(-0.0035)).toBeCloseTo(-0.0035, 12);
      // Fehlend, unsinnig oder positiv → dokumentierter Default.
      expect(solarTempCoefficientPerKelvin(undefined)).toBe(SOLAR_VOC_TEMP_COEFF_PER_KELVIN);
      expect(solarTempCoefficientPerKelvin(0.35)).toBe(SOLAR_VOC_TEMP_COEFF_PER_KELVIN);
      expect(solarTempCoefficientPerKelvin('−0,35')).toBe(SOLAR_VOC_TEMP_COEFF_PER_KELVIN);
      expect(solarTempCoefficientPerKelvin(Number.NaN)).toBe(SOLAR_VOC_TEMP_COEFF_PER_KELVIN);
    });

    it('wirft bei heißen Zelltemperaturen nicht, sondern meldet „nicht bewertbar"', () => {
      // +60 °C (NOCT-Fall) mit einem unsinnigen Koeffizienten kippte den
      // Temperaturfaktor ins Negative — volts() warf RangeError, in der
      // Live-Validierung ein uncaught Exception beim Tippen einer Zahl.
      const absurd = panel('p', { voc: 22, tempCoefficient: -50 });
      expect(() => solarColdVocOf(absurd, 60)).not.toThrow();
      expect(solarColdVocOf(absurd, 60)).toBeNull();
      expect(() => solarColdVocOf(panel('p', { voc: 22 }), Number.NaN)).not.toThrow();
      expect(solarColdVocOf(panel('p', { voc: 22 }), Number.NaN)).toBeNull();
      // Positivkontrolle: der normale Kalt-Fall bleibt eine Zahl.
      expect(solarColdVocOf(panel('p', { voc: 22 }), -20)).not.toBeNull();
      // Und der String-Pfad (Live-Validierung) erbt dasselbe Verhalten — mit
      // getrennten Flags, weil die Ursachen verschieden sind: Hier IST ein Voc
      // eingetragen, er ist nur nicht auswertbar.
      const { stringVoc, missingVoc, uncomputableVoc } = stringColdVocOf([absurd], [], 60);
      expect(uncomputableVoc).toBe(true);
      expect(missingVoc).toBe(false);
      expect(stringVoc).toEqual([0]);
      // Gegenprobe: ein Panel OHNE Voc hebt das andere Flag.
      const missing = stringColdVocOf([panel('q', { watts: 200 })], []);
      expect(missing.missingVoc).toBe(true);
      expect(missing.uncomputableVoc).toBe(false);
    });
  });

  it('Series-Strings: Verbundkomponenten über Solar↔Solar-Kanten', () => {
    const p1 = panel('p1', { watts: 100 });
    const p2 = panel('p2', { watts: 100 });
    const p3 = panel('p3', { watts: 100 });
    const mppt: Node = { id: 'm', type: 'mpptController', position: { x: 0, y: 0 }, data: {} };
    const nodes = [p1, p2, p3, mppt];
    const edges = [edge('p1', 'p2'), edge('p1', 'm'), edge('p3', 'm')];
    const strings = solarStringsOf(nodes, edges);
    expect(strings).toHaveLength(2); // [p1,p2] Serie + [p3] einzeln
    const ids = strings.map((chain) => chain.map((n) => n.id).sort()).sort();
    expect(ids).toEqual([['p1', 'p2'], ['p3']]);
  });

  it('stringColdVoc: Summe je String, fehlende Voc-Daten werden gemeldet', () => {
    const p1 = panel('p1', { voc: 22 });
    const p2 = panel('p2', { voc: 22 });
    const p3 = panel('p3', { watts: 100 }); // ohne voc
    const nodes = [p1, p2, p3];
    const edges = [edge('p1', 'p2')];
    const { stringVoc, missingVoc } = stringColdVocOf(nodes, edges);
    expect(stringVoc).toHaveLength(2);
    expect(Math.max(...stringVoc)).toBeCloseTo(2 * 22 * 1.1575, 6);
    expect(missingVoc).toBe(true); // p3 hat kein Datenblatt-Voc
  });

  it('solarWattsOf toleriert ungültige Angaben mit 0 W', () => {
    expect(solarWattsOf(panel('p', { watts: 'viel' }))).toBe(0);
    expect(solarWattsOf(undefined)).toBe(0);
  });
});
