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
  DEFAULT_SYSTEM_VOLTAGE,
  LEAD_SYSTEM_VOLTAGE,
} from './vde-standards';
import { amps, meters, mm2, volts, watts } from './units';
import type { Node } from 'reactflow';

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
        expect(VDE_SIZES[i]).toBeGreaterThan(VDE_SIZES[i - 1]);
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
        expect(VDE_AMPACITY_RAW[VDE_SIZES[i]]).toBeGreaterThan(VDE_AMPACITY_RAW[VDE_SIZES[i - 1]]);
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
        expect(VDE_FUSE_MAP[section]).toBeLessThanOrEqual(VDE_AMPACITY_RAW[section]);
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
        expect(diameters[i]).toBeGreaterThan(diameters[i - 1]);
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
    const battery = (data: Record<string, unknown>): Node =>
      ({ id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data }) as Node;

    it('liefert die Default-Spannung ohne Batterie', () => {
      expect(getSystemVoltage([])).toBe(DEFAULT_SYSTEM_VOLTAGE);
      expect(getSystemVoltage([])).toBe(12.8);
    });

    it('liefert 12.0 V für Blei-Chemien', () => {
      expect(getSystemVoltage([battery({ chemistry: 'AGM' })])).toBe(LEAD_SYSTEM_VOLTAGE);
      expect(getSystemVoltage([battery({ chemistry: 'gel' })])).toBe(12.0);
    });

    it('übernimmt eine explizite nominalVoltage', () => {
      expect(getSystemVoltage([battery({ nominalVoltage: 24 })])).toBe(24);
      expect(getSystemVoltage([battery({ nominalVoltage: '24' })])).toBe(24);
    });

    it('ignoriert unbrauchbare nominalVoltage-Werte aus dem Speicher', () => {
      // Vorher wurde -12 bzw. NaN unverändert weitergereicht und hätte den
      // Spannungsfall in allen Folgerechnungen verfälscht.
      expect(getSystemVoltage([battery({ nominalVoltage: -12 })])).toBe(DEFAULT_SYSTEM_VOLTAGE);
      expect(getSystemVoltage([battery({ nominalVoltage: 'zwölf' })])).toBe(DEFAULT_SYSTEM_VOLTAGE);
      expect(getSystemVoltage([battery({ nominalVoltage: 0 })])).toBe(DEFAULT_SYSTEM_VOLTAGE);
      expect(getSystemVoltage([battery({ nominalVoltage: null })])).toBe(DEFAULT_SYSTEM_VOLTAGE);
    });
  });

  describe('calculateEdgeCurrent', () => {
    const node = (type: string, data: Record<string, unknown>): Node =>
      ({ id: `${type}-1`, type, position: { x: 0, y: 0 }, data }) as Node;

    it('rechnet Verbraucherleistung mit der Systemspannung in Strom um', () => {
      const consumer = node('consumer', { watts: 60 });
      expect(calculateEdgeCurrent(undefined, consumer, [consumer], volts(12))).toBeCloseTo(5, 10);
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
