import { describe, it, expect } from 'vitest';
import {
  VDE_SIZES,
  VDE_CROSS_SECTIONS,
  VDE_AMPACITY_RAW,
  VDE_FUSE_MAP,
  VDE_CONDUIT_INNER_DIAMETERS,
  VDE_MAX_CONDUIT_FILL_PERCENT,
  VDE_CABLE_OUTER_DIAMETERS,
  VDE_INVERTER_EFFICIENCY,
  VDE_SOLAR_WINTER_REDUCTION,
  VDE_SOLAR_VMP_VOLTAGE,
  VDE_CHARGE_DERATING_FACTOR,
  VDE_BATTERY_DOD,
  calculateConduitFillPercent,
  recommendConduitType,
  getSystemVoltage,
  calculateEdgeCurrent,
  calculateAcEdgeCurrent,
  DEFAULT_SYSTEM_VOLTAGE,
  LEAD_SYSTEM_VOLTAGE,
} from './vde-standards';
import { amps, meters, mm2, volts, watts } from './units';
import type { Node, Edge } from 'reactflow';

describe('VDE Standards - Zentrale Konstanten', () => {
  describe('Kabelquerschnitte', () => {
    it('sollten die Standard-Normreihe aus electrical.ts enthalten', () => {
      expect(VDE_SIZES).toEqual([1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0]);
    });

    it('VDE_CROSS_SECTIONS ist ein Alias für VDE_SIZES', () => {
      expect(VDE_CROSS_SECTIONS).toBe(VDE_SIZES);
    });

    it('sollten aufsteigend sortiert sein', () => {
      for (let i = 1; i < VDE_SIZES.length; i++) {
        expect(VDE_SIZES[i]!).toBeGreaterThan(VDE_SIZES[i - 1]!);
      }
    });
  });

  describe('Strombelastbarkeit', () => {
    it('VDE_AMPACITY_RAW ist die deratete Belastbarkeitstabelle aus electrical.ts', () => {
      expect(VDE_AMPACITY_RAW[1.5]).toBe(16.5);
      expect(VDE_AMPACITY_RAW[70]).toBe(172);
    });

    it('größerer Querschnitt = höhere Strombelastbarkeit (monoton)', () => {
      for (let i = 1; i < VDE_SIZES.length; i++) {
        expect(VDE_AMPACITY_RAW[VDE_SIZES[i]!]!).toBeGreaterThan(VDE_AMPACITY_RAW[VDE_SIZES[i - 1]!]!);
      }
    });
  });

  describe('Sicherungstabelle', () => {
    it('VDE_FUSE_MAP ist die einzige Sicherungsgrenze (electrical.ts)', () => {
      // Mission 4: Die früheren Parallel-Tabellen (VDE_STANDARD_FUSES,
      // VDE_CONSERVATIVE_FUSES, VDE_CURRENT_CAPACITY) wurden entfernt —
      // selectFuseSize + FUSE_MAP sind die einzige Quelle der Wahrheit.
      expect(VDE_FUSE_MAP[1.5]).toBe(16);
      expect(VDE_FUSE_MAP[70]).toBe(160);
    });

    it('die Kabelgrenze bleibt unter der derateten Strombelastbarkeit', () => {
      for (const section of VDE_SIZES) {
        expect(VDE_FUSE_MAP[section]!).toBeLessThanOrEqual(VDE_AMPACITY_RAW[section]!);
      }
    });
  });

  describe('Wechselrichter-Konstanten', () => {
    it('Effizienz sollte 0.85 (15% Verlust) sein', () => {
      expect(VDE_INVERTER_EFFICIENCY).toBe(0.85);
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
      const diameters = Object.values(VDE_CONDUIT_INNER_DIAMETERS);
      for (let i = 1; i < diameters.length; i++) {
        expect(diameters[i]!).toBeGreaterThan(diameters[i - 1]!);
      }
    });

    it('Kabelaußendurchmesser ist für jeden Normquerschnitt definiert', () => {
      for (const size of VDE_SIZES) {
        expect(VDE_CABLE_OUTER_DIAMETERS[size]).toBeDefined();
      }
    });
  });
});

describe('VDE Berechnungsfunktionen', () => {
  describe('calculateConduitFillPercent', () => {
    it('gibt 0% zurück für ein leeres Leerrohr', () => {
      expect(calculateConduitFillPercent('EN 20', [])).toBe(0);
    });

    it('gibt 0% zurück für unbekannten Leerrohr-Typ', () => {
      // Unbekannter Leerrohr-Typ: bewusst ein ungültiger Schlüssel, deshalb
      // die Typzusicherung — der Querschnitt selbst bleibt typsicher.
      const unknownType = 'XXX' as keyof typeof VDE_CONDUIT_INNER_DIAMETERS;
      expect(calculateConduitFillPercent(unknownType, [mm2(2.5)])).toBe(0);
    });

    it('berechnet einen niedrigen Füllgrad für ein einzelnes dünnes Kabel', () => {
      const fill = calculateConduitFillPercent('EN 20', [mm2(2.5)]);
      // EN 20: Innen-Ø 16.9mm → Fläche 224.16 mm²
      // 2.5mm²: Außen-Ø 3.0mm → Fläche 7.07 mm²
      // Fill = 7.07 / 224.16 = 3.15%
      expect(fill).toBeCloseTo(3.15, 1);
    });

    it('zeigt Überfüllung bei zu vielen Kabeln', () => {
      const fill = calculateConduitFillPercent('EN 20', Array(10).fill(mm2(25)));
      expect(fill).toBeGreaterThan(VDE_MAX_CONDUIT_FILL_PERCENT);
    });
  });

  describe('recommendConduitType', () => {
    it('gibt EN 20 für ein einzelnes dünnes Kabel zurück', () => {
      expect(recommendConduitType([mm2(2.5)])).toBe('EN 20');
    });

    it('gibt ein größeres Rohr für mehr Kabel', () => {
      const rec = recommendConduitType(Array(5).fill(mm2(10)));
      expect(rec).not.toBe('EN 20');
      expect(rec).toBeTruthy();
    });

    it('gibt null zurück wenn kein Rohr groß genug ist', () => {
      const rec = recommendConduitType(Array(50).fill(mm2(50)));
      expect(rec).toBeNull();
    });
  });
});

describe('VDE-Standards mit typsicheren Einheiten (K1b)', () => {
  describe('getSystemVoltage', () => {
    const battery = (id: string = 'b1', data: Record<string, unknown> = {}): Node =>
      ({ id, type: 'battery', position: { x: 0, y: 0 }, data }) as Node;

    it('liefert die Default-Spannung ohne Batterie', () => {
      expect(getSystemVoltage([])).toBe(DEFAULT_SYSTEM_VOLTAGE);
      expect(getSystemVoltage([])).toBe(12.8);
    });

    it('liefert 12.0 V für Blei-Chemien', () => {
      expect(getSystemVoltage([battery('b1', { chemistry: 'AGM' })])).toBe(LEAD_SYSTEM_VOLTAGE);
      expect(getSystemVoltage([battery('b1', { chemistry: 'gel' })])).toBe(12.0);
    });

    it('übernimmt eine explizite nominalVoltage', () => {
      expect(getSystemVoltage([battery('b1', { nominalVoltage: 24 })])).toBe(24);
      expect(getSystemVoltage([battery('b1', { nominalVoltage: '24' })])).toBe(24);
    });

    it('ignoriert unbrauchbare nominalVoltage-Werte aus dem Speicher', () => {
      // Vorher wurde -12 bzw. NaN unverändert weitergereicht und hätte den
      // Spannungsfall in allen Folgerechnungen verfälscht.
      expect(getSystemVoltage([battery('b1', { nominalVoltage: -12 })])).toBe(DEFAULT_SYSTEM_VOLTAGE);
      expect(getSystemVoltage([battery('b1', { nominalVoltage: 'zwölf' })])).toBe(DEFAULT_SYSTEM_VOLTAGE);
      expect(getSystemVoltage([battery('b1', { nominalVoltage: 0 })])).toBe(DEFAULT_SYSTEM_VOLTAGE);
      expect(getSystemVoltage([battery('b1', { nominalVoltage: null })])).toBe(DEFAULT_SYSTEM_VOLTAGE);
    });

    it('bevorzugt ohne preferredBatteryId die Aufbaubatterie vor der Starterbatterie', () => {
      // Bug 11: Die 24-V-Starterbatterie steht in der Node-Reihenfolge vor der
      // 12-V-Aufbaubatterie — ohne Fix würde ALLES mit 24 V gerechnet.
      const starter = battery('s1', { label: 'Starterbatterie', nominalVoltage: 24 });
      const house = battery('h1', { label: 'Aufbaubatterie', nominalVoltage: 12 });
      expect(getSystemVoltage([starter, house])).toBe(12);
      expect(getSystemVoltage([house, starter])).toBe(12);
    });

    it('preferredBatteryId schlägt die Label-Priorität', () => {
      const starter = battery('s1', { label: 'Starterbatterie', nominalVoltage: 24 });
      const house = battery('h1', { label: 'Aufbaubatterie', nominalVoltage: 12 });
      expect(getSystemVoltage([house, starter], 's1')).toBe(24);
    });
  });

  describe('calculateEdgeCurrent', () => {
    const node = (type: string, data: Record<string, unknown>): Node =>
      ({ id: `${type}-1`, type, position: { x: 0, y: 0 }, data }) as Node;

    it('rechnet Verbraucherleistung mit der Systemspannung in Strom um', () => {
      const consumer = node('consumer', { watts: 60 });
      expect(calculateEdgeCurrent(undefined, consumer, [consumer], volts(12))).toBeCloseTo(5, 10);
    });

    it('fällt bei unlesbarem totalAmps auf die physikalische Herleitung zurück (statt 0 A)', () => {
      // Alter Bug: totalAmps vorhanden, aber unparsebar (Altbestand/Import) →
      // 0 A, was Spannungsfall- und Sicherungsprüfung stillschweigend
      // entschärfte. Heute: nur vertrauenswürdige Zahlen werden übernommen.
      const brokenSource = node('battery', { totalAmps: 'unsicher' });
      const consumer = node('consumer', { watts: 60 });
      expect(calculateEdgeCurrent(brokenSource, consumer, [brokenSource, consumer], volts(12))).toBeCloseTo(
        5,
        10
      );
      // Ein lesbarer Wert gewinnt dagegen weiterhin:
      const explicit = node('battery', { totalAmps: 7.5 });
      expect(calculateEdgeCurrent(explicit, consumer, [explicit, consumer], volts(12))).toBe(7.5);
    });

    it('behandelt negative oder unlesbare Leistungsangaben als 0 W', () => {
      const broken = node('consumer', { watts: -60 });
      expect(calculateEdgeCurrent(undefined, broken, [broken], volts(12))).toBe(0);

      const text = node('consumer', { watts: 'viel' });
      expect(calculateEdgeCurrent(undefined, text, [text], volts(12))).toBe(0);
    });

    it('rechnet den Wechselrichter-Eingangsstrom bit-identisch zur Division', () => {
      const inverter = node('inverter', { watts: 1000 });
      const expected = 1000 / 12.8 / VDE_INVERTER_EFFICIENCY;
      expect(calculateEdgeCurrent(inverter, undefined, [inverter], volts(12.8))).toBe(expected);
    });

    it('nutzt die Solar-Vmp-Spannung für Panel-Zuleitungen', () => {
      const panel = node('solar', { watts: 180 });
      expect(calculateEdgeCurrent(panel, undefined, [panel], volts(12.8))).toBeCloseTo(10, 10);
      expect(VDE_SOLAR_VMP_VOLTAGE).toBe(18);
    });

    it('liefert nie einen negativen Strom', () => {
      const consumers = [
        node('consumer', { watts: -100 }),
        node('inverter', { watts: -500 }),
        node('charger', { amps: -30 }),
      ];
      expect(calculateEdgeCurrent(undefined, undefined, consumers, volts(12))).toBeGreaterThanOrEqual(0);
    });

    it('nutzt im Fallback-Pfad continuousPower des Wechselrichters (Bug 9)', () => {
      // Batterie-Hauptleitung → Fallback-Pfad (Priorität 6). Der Wechsel-
      // richter trägt dort seine Dauerleistung (continuousPower), nicht nur
      // die veraltete watts-Angabe — sonst wird die Leitung zu dünn.
      const house = node('battery', {});
      const busbar = node('busbar', {});
      const inv = node('inverter', { watts: 100, continuousPower: 1000 });
      const nodes = [house, busbar, inv];
      const I = calculateEdgeCurrent(house, busbar, nodes, volts(12.8));
      expect(I).toBeCloseTo(1000 / 12.8 / VDE_INVERTER_EFFICIENCY, 10);
    });

    it('nutzt im Fallback-Pfad die 230-V-Last des Wechselrichters (acConsumerLoad)', () => {
      const house = node('battery', {});
      const busbar = node('busbar', {});
      const inv = node('inverter', { watts: 100 });
      const consumer230 = node('consumer230v', { watts: 2300 });
      const nodes = [house, busbar, inv, consumer230];
      const I = calculateEdgeCurrent(house, busbar, nodes, volts(12.8));
      // max(100 W, 2300 W) / 12,8 V / 0,85
      expect(I).toBeCloseTo(2300 / 12.8 / VDE_INVERTER_EFFICIENCY, 10);
    });
  });

  describe('calculateAcEdgeCurrent (Bug 3)', () => {
    const node = (id: string, type: string, data: Record<string, unknown>): Node =>
      ({ id, type, position: { x: 0, y: 0 }, data }) as Node;
    const edge = (
      id: string,
      source: string,
      target: string,
      data: Record<string, unknown> = {},
      sourceHandle?: string,
      targetHandle?: string
    ): Edge => ({ id, source, target, sourceHandle, targetHandle, type: 'cableEdge', data }) as Edge;

    it('dimensioniert die Landstrom-Zuleitung über alle erreichbaren 230-V-Verbraucher', () => {
      const nodes = [
        node('sp', 'shorePower', {}),
        node('c1', 'consumer230v', { watts: 1150 }),
        node('c2', 'consumer230v', { watts: 1150 }),
      ];
      const edges = [
        edge('e1', 'sp', 'c1', { edgeDomain: 'AC_230V' }, 'plus', 'plus'),
        edge('e2', 'sp', 'c2', { edgeDomain: 'AC_230V' }, 'plus', 'plus'),
      ];
      expect(calculateAcEdgeCurrent('sp', nodes, edges)).toBeCloseTo(10, 10);
    });

    it('dimensioniert eine Wechselrichter-Abzweigleitung nur mit deren eigenen Verbrauchern', () => {
      const nodes = [
        node('inv', 'inverter', {}),
        node('c1', 'consumer230v', { watts: 2300 }),
        node('sp2', 'shorePower', {}),
        node('other', 'consumer230v', { watts: 23000 }), // anderer Kreis, nicht erreichbar
      ];
      const edges = [
        edge('e1', 'inv', 'c1', {}, 'ac_out', 'plus'),
        edge('e2', 'sp2', 'other', { edgeDomain: 'AC_230V' }, 'plus', 'plus'),
      ];
      // Nur c1 hängt hinter dem Wechselrichter — der fremde 23-kW-Kreis an
      // sp2 darf die Abzweigleitung nicht aufblähen.
      expect(calculateAcEdgeCurrent('inv', nodes, edges)).toBeCloseTo(10, 10);
    });

    it('ignoriert DC-Kanten mit expliziter DC_12V-Domäne', () => {
      const nodes = [node('inv', 'inverter', {}), node('c1', 'consumer230v', { watts: 2300 })];
      const edges = [
        // data.edgeDomain sagt DC_12V — der BFS darf diese Kante NICHT als
        // AC-Pfad nutzen (getEdgeDomain würde wegen consumer230v AC sagen).
        edge('e1', 'inv', 'c1', { edgeDomain: 'DC_12V' }, 'plus', 'plus'),
      ];
      expect(calculateAcEdgeCurrent('inv', nodes, edges)).toBe(0);
    });

    it('liefert 0 A ohne erreichbare 230-V-Last', () => {
      const nodes = [node('inv', 'inverter', {})];
      expect(calculateAcEdgeCurrent('inv', nodes, [])).toBe(0);
      expect(calculateAcEdgeCurrent(undefined, nodes, [])).toBe(0);
    });
  });

  describe('typisierte Berechnungen', () => {
    it('calculateConduitFillPercent arbeitet mit mm²-Größen', () => {
      expect(calculateConduitFillPercent('EN 20', [mm2(2.5)])).toBeCloseTo(3.15, 1);
      expect(calculateConduitFillPercent('EN 20', [])).toBe(0);
    });
  });

  it('watts/amps-Konstruktoren sind in Tests dieselbe Quelle wie im Code', () => {
    expect(watts(60)).toBe(60);
    expect(amps(5)).toBe(5);
  });

  it('meters/mm2-Konstruktoren lehnen unbrauchbare Werte ab', () => {
    expect(() => mm2(0)).toThrow(RangeError);
    expect(() => meters(-1)).toThrow(RangeError);
  });
});
