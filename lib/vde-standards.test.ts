import { describe, it, expect } from 'vitest';
import {
  VDE_SIZES,
  VDE_CROSS_SECTIONS,
  VDE_CURRENT_CAPACITY,
  VDE_STANDARD_FUSES,
  VDE_CONSERVATIVE_FUSES,
  VDE_COPPER_RESISTIVITY,
  VDE_MAX_VOLTAGE_DROP_12V,
  VDE_MAX_VOLTAGE_DROP_230V,
  VDE_CONDUIT_INNER_DIAMETERS,
  VDE_MAX_CONDUIT_FILL_PERCENT,
  VDE_CABLE_OUTER_DIAMETERS,
  VDE_INVERTER_EFFICIENCY,
  VDE_INVERTER_MAX_LOAD_FRACTION,
  VDE_RCD_MAX_TRIP_CURRENT_MA,
  VDE_230V_PERSON_PROTECTION_MA,
  VDE_SOLAR_WINTER_REDUCTION,
  VDE_SOLAR_VMP_VOLTAGE,
  VDE_CHARGE_DERATING_FACTOR,
  VDE_BATTERY_DOD,
  VDE_MIN_CROSS_SECTION,
  calculateMinCrossSection,
  roundUpToVDECrossSection,
  calculateVoltageDrop,
  calculateConduitFillPercent,
  recommendConduitType,
  calculateWire,
  validateCableEdge,
  validateBatteryNode,
  validateShorePowerNode,
  validateInverterNode,
  validateSchematic,
} from './vde-standards';
import type { Edge, Node } from 'reactflow';

describe('VDE Standards - Zentrale Konstanten', () => {
  describe('Kabelquerschnitte', () => {
    it('sollten die Standard-Normreihe aus electrical.ts enthalten', () => {
      expect(VDE_CROSS_SECTIONS).toEqual([1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0]);
    });

    it('VDE_CROSS_SECTIONS ist ein Alias für VDE_SIZES', () => {
      expect(VDE_CROSS_SECTIONS).toBe(VDE_SIZES);
    });

    it('sollten aufsteigend sortiert sein', () => {
      for (let i = 1; i < VDE_CROSS_SECTIONS.length; i++) {
        expect(VDE_CROSS_SECTIONS[i]).toBeGreaterThan(VDE_CROSS_SECTIONS[i - 1]);
      }
    });

    it('VDE_MIN_CROSS_SECTION sollte 1.5 mm² sein', () => {
      expect(VDE_MIN_CROSS_SECTION).toBe(1.5);
    });
  });

  describe('Strombelastbarkeit', () => {
    it('sollte für jeden Querschnitt eine sinnvolle Strombelastbarkeit haben', () => {
      for (const cs of VDE_CROSS_SECTIONS) {
        expect(VDE_CURRENT_CAPACITY[cs]).toBeGreaterThan(0);
      }
    });

    it('größerer Querschnitt = höhere Strombelastbarkeit (monoton)', () => {
      for (let i = 1; i < VDE_CROSS_SECTIONS.length; i++) {
        const prev = VDE_CURRENT_CAPACITY[VDE_CROSS_SECTIONS[i - 1]];
        const curr = VDE_CURRENT_CAPACITY[VDE_CROSS_SECTIONS[i]];
        expect(curr).toBeGreaterThan(prev);
      }
    });

    it('1.5mm² darf max. 16A führen (Validierungswert)', () => {
      expect(VDE_CURRENT_CAPACITY[1.5]).toBe(16);
    });
  });

  describe('Sicherungstabellen', () => {
    it('VDE_STANDARD_FUSES sollte für jeden Querschnitt eine Sicherung definieren', () => {
      for (const cs of VDE_CROSS_SECTIONS) {
        expect(VDE_STANDARD_FUSES[cs]).toBeGreaterThan(0);
      }
    });

    it('VDE_CONSERVATIVE_FUSES sollten konservativer als die Standardwerte sein', () => {
      for (const cs of VDE_CROSS_SECTIONS) {
        const conservative = VDE_CONSERVATIVE_FUSES[cs];
        const standard = VDE_STANDARD_FUSES[cs];
        if (conservative !== undefined && standard !== undefined) {
          expect(conservative).toBeLessThanOrEqual(standard);
        }
      }
    });
  });

  describe('Spannungsabfall-Konstanten', () => {
    it('Kupferwiderstand sollte 0.0175 Ω·mm²/m betragen', () => {
      expect(VDE_COPPER_RESISTIVITY).toBe(0.0175);
    });

    it('12V erlaubt 10% Spannungsabfall (1.2V)', () => {
      expect(VDE_MAX_VOLTAGE_DROP_12V).toBe(0.10);
    });

    it('230V erlaubt 3% Spannungsabfall (6.9V)', () => {
      expect(VDE_MAX_VOLTAGE_DROP_230V).toBe(0.03);
    });
  });

  describe('Wechselrichter-Konstanten', () => {
    it('Effizienz sollte 0.85 (15% Verlust) sein', () => {
      expect(VDE_INVERTER_EFFICIENCY).toBe(0.85);
    });

    it('Max Load Fraction sollte 0.80 (80% der Nennleistung) sein', () => {
      expect(VDE_INVERTER_MAX_LOAD_FRACTION).toBe(0.80);
    });
  });

  describe('RCD-Konstanten', () => {
    it('RCD max Trip Current sollte 30mA sein (Personenschutz)', () => {
      expect(VDE_RCD_MAX_TRIP_CURRENT_MA).toBe(30);
    });

    it('230V-Personenschutz sollte 30mA sein', () => {
      expect(VDE_230V_PERSON_PROTECTION_MA).toBe(30);
    });
  });

  describe('Solar- und Lade-Konstanten', () => {
    it('Winter-Reduktion sollte 0.35 sein', () => {
      expect(VDE_SOLAR_WINTER_REDUCTION).toBe(0.35);
    });

    it('Vmp-Spannung sollte 18V sein', () => {
      expect(VDE_SOLAR_VMP_VOLTAGE).toBe(18);
    });

    it('Ladezeit-Derating sollte 1.15 sein', () => {
      expect(VDE_CHARGE_DERATING_FACTOR).toBe(1.15);
    });
  });

  describe('Batterie DoD', () => {
    it('LiFePO4 darf zu 90% entladen werden', () => {
      expect(VDE_BATTERY_DOD.LiFePO4).toBe(0.9);
    });

    it('AGM darf nur zu 50% entladen werden', () => {
      expect(VDE_BATTERY_DOD.AGM).toBe(0.5);
    });

    it('Gel darf nur zu 50% entladen werden', () => {
      expect(VDE_BATTERY_DOD.Gel).toBe(0.5);
    });

    it('Blei darf nur zu 30% entladen werden', () => {
      expect(VDE_BATTERY_DOD.Blei).toBe(0.3);
    });
  });

  describe('Leerrohr-Konstanten', () => {
    it('Maximaler Füllgrad ist 60%', () => {
      expect(VDE_MAX_CONDUIT_FILL_PERCENT).toBe(60);
    });

    it('EN 20 hat 16.9mm Innendurchmesser', () => {
      expect(VDE_CONDUIT_INNER_DIAMETERS['EN 20']).toBe(16.9);
    });

    it('Alle Leerrohre sind aufsteigend sortiert', () => {
      const values = Object.values(VDE_CONDUIT_INNER_DIAMETERS);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });

    it('Kabelaußendurchmesser ist für jeden Normquerschnitt definiert', () => {
      for (const cs of VDE_CROSS_SECTIONS) {
        expect(VDE_CABLE_OUTER_DIAMETERS[cs]).toBeGreaterThan(0);
      }
    });
  });
});

describe('VDE Berechnungsfunktionen', () => {
  describe('calculateMinCrossSection', () => {
    it('gibt das Minimum (1.5 mm²) zurück bei 0A Strom', () => {
      expect(calculateMinCrossSection(0, 5)).toBe(1.5);
    });

    it('gibt das Minimum (1.5 mm²) zurück bei 0m Länge', () => {
      expect(calculateMinCrossSection(10, 0)).toBe(1.5);
    });

    it('gibt das Minimum zurück bei negativem Strom', () => {
      expect(calculateMinCrossSection(-5, 3)).toBe(1.5);
    });

    it('berechnet den Mindestquerschnitt für 10A bei 3m Länge (12V, 10% drop)', () => {
      // A_min = (0.0175 * 3 * 2 * 10) / (0.1 * 12) = 1.05 / 1.2 = 0.875 mm²
      const result = calculateMinCrossSection(10, 3);
      expect(result).toBeCloseTo(0.875, 3);
    });

    it('rundet calculateWire auf 1.5 mm² auf, da Minimum das VDE-Limit ist', () => {
      const result = calculateWire(10, 3);
      expect(result.crossSection).toBe(1.5);
    });

    it('berechnet größeren Querschnitt für hohen Strom über lange Strecke', () => {
      // 50A über 10m: A_min = (0.0175 * 10 * 2 * 50) / 1.2 = 17.5 / 1.2 = 14.58 mm²
      const result = calculateMinCrossSection(50, 10);
      expect(result).toBeGreaterThan(10);
      expect(result).toBeCloseTo(14.583, 2);
    });

    it('verwendet den übergebenen maxVoltageDropFraction Parameter', () => {
      const at10pct = calculateMinCrossSection(20, 5, 0.10);
      const at5pct = calculateMinCrossSection(20, 5, 0.05);
      expect(at5pct).toBeGreaterThan(at10pct);
    });
  });

  describe('roundUpToVDECrossSection', () => {
    it('rundet 1.0 auf 1.5 auf', () => {
      expect(roundUpToVDECrossSection(1.0)).toBe(1.5);
    });

    it('rundet 1.5 auf 1.5 (exakter Treffer)', () => {
      expect(roundUpToVDECrossSection(1.5)).toBe(1.5);
    });

    it('rundet 1.6 auf 2.5 auf', () => {
      expect(roundUpToVDECrossSection(1.6)).toBe(2.5);
    });

    it('rundet 5.0 auf 6.0 auf', () => {
      expect(roundUpToVDECrossSection(5.0)).toBe(6.0);
    });

    it('gibt den größten Wert zurück, wenn die Anforderung > 70 mm² ist', () => {
      expect(roundUpToVDECrossSection(500)).toBe(70);
    });
  });

  describe('calculateVoltageDrop', () => {
    it('gibt 0V zurück bei 0A', () => {
      expect(calculateVoltageDrop(0, 5, 2.5)).toBe(0);
    });

    it('berechnet 0.7V für 10A, 5m, 2.5mm² (Kupfer 0.0175)', () => {
      // ΔU = (0.0175 * 5 * 2 * 10) / 2.5 = 1.75 / 2.5 = 0.7V
      expect(calculateVoltageDrop(10, 5, 2.5)).toBeCloseTo(0.7, 5);
    });

    it('max 1.2V bei 12V ist die 10%-Grenze', () => {
      expect(VDE_MAX_VOLTAGE_DROP_12V * 12).toBeCloseTo(1.2, 5);
    });

    it('gibt Infinity zurück bei 0mm² (Division durch 0 verhindert)', () => {
      expect(calculateVoltageDrop(10, 5, 0)).toBe(Infinity);
    });

    it('verwendet korrekte Kupferwerte', () => {
      // 100A über 2m bei 50mm²: ΔU = (0.0175 * 2 * 2 * 100) / 50 = 7 / 50 = 0.14V
      expect(calculateVoltageDrop(100, 2, 50)).toBeCloseTo(0.14, 5);
    });
  });

  describe('calculateConduitFillPercent', () => {
    it('gibt 0% zurück für ein leeres Leerrohr', () => {
      expect(calculateConduitFillPercent('EN 20', [])).toBe(0);
    });

    it('gibt 0% zurück für unbekannten Leerrohr-Typ', () => {
      expect(calculateConduitFillPercent('XXX' as any, [2.5])).toBe(0);
    });

    it('berechnet einen niedrigen Füllgrad für ein einzelnes dünnes Kabel', () => {
      const fill = calculateConduitFillPercent('EN 20', [2.5]);
      // EN 20: Innen-Ø 16.9mm → Fläche 224.16 mm²
      // 2.5mm²: Außen-Ø 3.0mm → Fläche 7.07 mm²
      // Fill = 7.07 / 224.16 = 3.15%
      expect(fill).toBeCloseTo(3.15, 1);
    });

    it('zeigt Überfüllung bei zu vielen Kabeln', () => {
      const fill = calculateConduitFillPercent('EN 20', Array(10).fill(25));
      expect(fill).toBeGreaterThan(VDE_MAX_CONDUIT_FILL_PERCENT);
    });
  });

  describe('recommendConduitType', () => {
    it('gibt EN 20 für ein einzelnes dünnes Kabel zurück', () => {
      expect(recommendConduitType([2.5])).toBe('EN 20');
    });

    it('gibt ein größeres Rohr für mehr Kabel', () => {
      const rec = recommendConduitType(Array(5).fill(10));
      expect(rec).not.toBe('EN 20');
      expect(rec).toBeTruthy();
    });

    it('gibt null zurück wenn kein Rohr groß genug ist', () => {
      const rec = recommendConduitType(Array(50).fill(50));
      expect(rec).toBeNull();
    });
  });

  describe('calculateWire', () => {
    it('gibt Minimum-Querschnitt für sehr kleine Lasten', () => {
      const result = calculateWire(1, 1);
      expect(result.crossSection).toBe(1.5);
      expect(result.fuseSize).toBeGreaterThan(0);
      expect(result.fuseSize).toBeLessThanOrEqual(VDE_CURRENT_CAPACITY[1.5]);
    });

    it('rundet auf den nächstgrößeren normierten Querschnitt auf', () => {
      // 20A über 5m: A_min = (0.0175 * 5 * 2 * 20) / 1.2 = 3.5 / 1.2 = 2.92 mm²
      // → 4.0 mm²
      const result = calculateWire(20, 5);
      expect(result.crossSection).toBe(4.0);
    });

    it('Sicherung passt zum gewählten Querschnitt (max Ampere)', () => {
      const result = calculateWire(20, 5);
      const maxAmpere = VDE_CURRENT_CAPACITY[result.crossSection];
      expect(result.fuseSize).toBeLessThanOrEqual(maxAmpere);
    });

    it('enthält minCrossSection für Validierungszwecke', () => {
      const result = calculateWire(20, 5);
      expect(result.minCrossSection).toBeGreaterThan(0);
      expect(result.crossSection).toBeGreaterThanOrEqual(result.minCrossSection);
    });
  });
});

describe('VDE Validator', () => {
  function makeNode(id: string, type: string, data: any = {}): Node {
    return { id, type, position: { x: 0, y: 0 }, data };
  }

  function makeEdge(id: string, source: string, target: string, data: any = { length: 3, crossSection: 2.5 }): Edge {
    return { id, source, target, data, type: 'cableEdge' };
  }

  describe('validateCableEdge', () => {
    it('gibt Fehler zurück wenn Edge keine Daten hat (NO_DATA)', () => {
      const edge = { id: 'e1', source: 'a', target: 'b', data: undefined } as any;
      const result = validateCableEdge(edge, undefined, undefined, 5);
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('NO_DATA');
    });

    it('gibt Fehler zurück bei Querschnitt unter VDE-Mindestmaß (UNDERSIZED_CABLE)', () => {
      const edge = makeEdge('e1', 'a', 'b', { length: 3, crossSection: 1.0 });
      const result = validateCableEdge(edge, undefined, undefined, 5);
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('UNDERSIZED_CABLE');
    });

    it('gibt Warnung bei hohem Spannungsabfall (HIGH_VOLTAGE_DROP)', () => {
      // 100A über 5m bei 1.5mm²: ΔU = (0.0175 * 5 * 2 * 100) / 1.5 = 11.67V (zu hoch)
      const edge = makeEdge('e1', 'a', 'b', { length: 5, crossSection: 1.5 });
      const result = validateCableEdge(edge, undefined, undefined, 100);
      expect(result.severity).toBe('warning');
      expect(result.code).toBe('HIGH_VOLTAGE_DROP');
    });

    it('gibt Fehler bei zu großer Sicherung (OVERSIZED_FUSE)', () => {
      const edge = makeEdge('e1', 'a', 'b', { length: 3, crossSection: 1.5, fuseSize: 30 });
      const result = validateCableEdge(edge, undefined, undefined, 5);
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('OVERSIZED_FUSE');
      expect(result.message).toContain('Brandgefahr');
    });

    it('gibt Warnung bei nicht-normiertem Querschnitt (NON_STANDARD_CROSS_SECTION)', () => {
      const edge = makeEdge('e1', 'a', 'b', { length: 3, crossSection: 3.0 });
      const result = validateCableEdge(edge, undefined, undefined, 5);
      expect(result.severity).toBe('warning');
      expect(result.code).toBe('NON_STANDARD_CROSS_SECTION');
    });

    it('gibt OK für korrekt dimensioniertes Kabel zurück', () => {
      const edge = makeEdge('e1', 'a', 'b', { length: 3, crossSection: 4.0, fuseSize: 25 });
      const result = validateCableEdge(edge, undefined, undefined, 10);
      expect(result.isValid).toBe(true);
      expect(result.severity).toBe('ok');
      expect(result.code).toBe('OK');
    });
  });

  describe('validateBatteryNode', () => {
    it('akzeptiert bekannte Chemie (LiFePO4)', () => {
      const node = makeNode('b1', 'battery', { capacity: 100, chemistry: 'LiFePO4' });
      const results = validateBatteryNode(node);
      expect(results.filter(r => r.severity === 'error')).toHaveLength(0);
    });

    it('warnt bei unbekannter Chemie', () => {
      const node = makeNode('b1', 'battery', { capacity: 100, chemistry: 'MysteryChem' });
      const results = validateBatteryNode(node);
      expect(results.some(r => r.code === 'UNKNOWN_CHEMISTRY')).toBe(true);
    });
  });

  describe('validateShorePowerNode', () => {
    it('gibt Fehler wenn RCD fehlt', () => {
      const node = makeNode('s1', 'shorePower', { hasRcd: false });
      const results = validateShorePowerNode(node);
      expect(results).toHaveLength(1);
      expect(results[0].code).toBe('MISSING_RCD');
      expect(results[0].message).toContain('VDE 0100-721');
    });

    it('gibt keinen Fehler wenn RCD vorhanden', () => {
      const node = makeNode('s1', 'shorePower', { hasRcd: true });
      const results = validateShorePowerNode(node);
      expect(results).toHaveLength(0);
    });
  });

  describe('validateInverterNode', () => {
    it('gibt OK zurück wenn continuousPower nicht gesetzt', () => {
      const node = makeNode('i1', 'inverter', {});
      const results = validateInverterNode(node, []);
      expect(results).toHaveLength(0);
    });

    it('gibt Fehler bei Überlastung', () => {
      const node = makeNode('i1', 'inverter', { continuousPower: 1000, concurrentDevices: ['c1'] });
      const consumer = makeNode('c1', 'consumer230v', { watts: 1500 });
      const results = validateInverterNode(node, [node, consumer]);
      expect(results.some(r => r.code === 'INVERTER_OVERLOADED')).toBe(true);
    });

    it('gibt Warnung bei Last nahe 80% Grenze', () => {
      const node = makeNode('i1', 'inverter', { continuousPower: 1000, concurrentDevices: ['c1'] });
      const consumer = makeNode('c1', 'consumer230v', { watts: 850 });
      const results = validateInverterNode(node, [node, consumer]);
      expect(results.some(r => r.code === 'INVERTER_NEAR_LIMIT')).toBe(true);
    });

    it('ignoriert nicht ausgewählte 230V-Verbraucher', () => {
      const node = makeNode('i1', 'inverter', { continuousPower: 1000, concurrentDevices: [] });
      const consumer = makeNode('c1', 'consumer230v', { watts: 5000 });
      const results = validateInverterNode(node, [node, consumer]);
      expect(results).toHaveLength(0);
    });
  });

  describe('validateSchematic', () => {
    it('gibt leeres Array für leeren Plan zurück', () => {
      const results = validateSchematic([], []);
      expect(results).toEqual([]);
    });

    it('findet RCD-Mangel an Landstrom', () => {
      const shorePower = makeNode('s1', 'shorePower', { hasRcd: false });
      const results = validateSchematic([shorePower], []);
      expect(results.some(r => r.code === 'MISSING_RCD')).toBe(true);
    });

    it('findet Kabel-Validierungsfehler', () => {
      const consumer = makeNode('c1', 'consumer', { watts: 600 });
      const battery = makeNode('b1', 'battery', { capacity: 100, chemistry: 'LiFePO4' });
      const edge = makeEdge('e1', 'b1', 'c1', { length: 3, crossSection: 0.5 });
      const results = validateSchematic([battery, consumer], [edge]);
      expect(results.some(r => r.code === 'UNDERSIZED_CABLE')).toBe(true);
    });

    it('kombiniert Fehler aus mehreren Quellen', () => {
      const shorePower = makeNode('s1', 'shorePower', { hasRcd: false });
      const battery = makeNode('b1', 'battery', { capacity: 100, chemistry: 'Mystery' });
      const edge = makeEdge('e1', 's1', 'b1', { length: 3, crossSection: 1.5, fuseSize: 30 });
      const results = validateSchematic([shorePower, battery], [edge]);
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });
});
