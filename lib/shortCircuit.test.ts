import { describe, it, expect } from 'vitest';
import {
  BATTERY_RI_MILLIOHM_AT_100AH,
  FUSE_BREAKING_CAPACITY_A,
  bankEquivalentRiMilliOhm,
  bankShortCircuitCurrentA,
  batteryShortCircuitCurrentA,
  breakingCapacityAOf,
  cableLoopResistanceOhm,
  internalResistanceMilliOhmOf,
  isFuseType,
  shortCircuitAtFuseA,
} from './shortCircuit';
import { VDE_SOLAR_VMP_VOLTAGE } from './vde-standards';
import type { Node } from './domain/graph';

const battery = (id: string, data: Record<string, unknown>): Node => ({
  id,
  type: 'battery',
  position: { x: 0, y: 0 },
  data,
});

describe('DOM-002 — Batterie-Innenwiderstand (Faustformel/Datenblatt)', () => {
  it('expliziter Datenblatt-Ri schlägt die Chemie-Schätzung', () => {
    expect(
      internalResistanceMilliOhmOf(
        battery('b', { capacity: 200, chemistry: 'LiFePO4', internalResistance: 2 })
      )
    ).toBe(2);
  });

  it('Faustformel: LiFePO4 100 Ah ≈ 3 mΩ (Faustregel 3 mΩ je 100 Ah)', () => {
    expect(internalResistanceMilliOhmOf(battery('b', { capacity: 100, chemistry: 'LiFePO4' }))).toBe(
      BATTERY_RI_MILLIOHM_AT_100AH['LiFePO4']
    );
  });

  it('Faustformel skaliert antiproportional zur Kapazität (200 Ah → halber Ri)', () => {
    expect(internalResistanceMilliOhmOf(battery('b', { capacity: 200, chemistry: 'LiFePO4' }))).toBeCloseTo(
      1.5,
      10
    );
    expect(internalResistanceMilliOhmOf(battery('b', { capacity: 50, chemistry: 'AGM' }))).toBeCloseTo(
      10,
      10
    );
  });

  it('Chemie-Tabelle: Gel eigener Wert, Unbekanntes fällt auf LiFePO4 zurück', () => {
    expect(internalResistanceMilliOhmOf(battery('b', { capacity: 100, chemistry: 'Gel' }))).toBe(
      BATTERY_RI_MILLIOHM_AT_100AH['Gel']
    );
    // Konservativ: unbekannte Chemie → LiFePO4-Anker (kleinstes Ri → größtes Ik)
    expect(internalResistanceMilliOhmOf(battery('b', { capacity: 100, chemistry: 'NasBatterie' }))).toBe(
      BATTERY_RI_MILLIOHM_AT_100AH['LiFePO4']
    );
  });

  it('ohne Kapazität ehrlich nicht schätzbar → null statt Default-Raten', () => {
    expect(internalResistanceMilliOhmOf(battery('b', { chemistry: 'LiFePO4' }))).toBeNull();
  });
});

describe('DOM-002 — Kurzschlussstrom Ik', () => {
  it('Eine 100-Ah-LiFePO4 (≈ 3 mΩ) liefert am Pol ≈ 4,27 kA bei 12,8 V', () => {
    // 12,8 V / 0,003 Ω = 4266,67 A — Größenordnung des ABYC-5000-A-Regimes
    expect(batteryShortCircuitCurrentA(battery('b', { capacity: 100, chemistry: 'LiFePO4' }))).toBeCloseTo(
      4266.67,
      2
    );
  });

  it('Parallelschaltung addiert Ströme (Bank-Äquivalent-Ri halbiert sich bei 2 Blocken)', () => {
    const bank = [
      battery('b1', { capacity: 100, chemistry: 'LiFePO4' }),
      battery('b2', { capacity: 100, chemistry: 'LiFePO4' }),
    ];
    expect(bankEquivalentRiMilliOhm(bank)).toBeCloseTo(1.5, 10);
    expect(bankShortCircuitCurrentA(bank)).toBeCloseTo(8533.33, 1);
  });

  it('Starterbatterien (Rolle/Label) fließen in den Bank-Ik nicht ein', () => {
    const bank = [
      battery('b1', { capacity: 100, chemistry: 'LiFePO4' }),
      battery('b2', { role: 'starter', label: 'Starterbatterie', capacity: 90, chemistry: 'AGM' }),
    ];
    expect(bankShortCircuitCurrentA(bank)).toBeCloseTo(4266.67, 2);
  });

  it('Bank ohne schätzbaren Block → null (ehrliche Leere statt Zahl)', () => {
    expect(bankShortCircuitCurrentA([battery('b1', { etiquettes: true })])).toBeNull();
  });
});

describe('DOM-002 — Kabeldämpfung bis zur Sicherung', () => {
  it('Kupfer-Loop: 0,5 m Hin+Rück auf 50 mm² dämpft den Ik spürbar', () => {
    // R_loop = 2 × 0,5 / (58 × 50) = 0,000345 Ω
    expect(cableLoopResistanceOhm(0.5, 50)).toBeCloseTo(0.000345, 6);
    const bank = [battery('b1', { capacity: 100, chemistry: 'LiFePO4' })];
    const ik = shortCircuitAtFuseA(bank, 0.5, 50, 12.8)!;
    // R_ges = 0,003 + 0,000345 = 0,003345 Ω → 12,8 / 0,003345 = 3826,9 A
    // 12,8 / 0,003345 = 3826,8 A
    expect(ik).toBeCloseTo(3826.8, 0);
    expect(ik).toBeLessThan(bankShortCircuitCurrentA(bank)!);
  });

  it('fehlende Werte greifen auf die benannten Ersatzwerte zurück (0 m / 16 mm²)', () => {
    const bank = [battery('b1', { capacity: 100, chemistry: 'LiFePO4' })];
    expect(shortCircuitAtFuseA(bank, undefined, undefined, 12.8)).toBe(
      shortCircuitAtFuseA(bank, 0, 16, 12.8)
    );
  });
});

describe('DOM-002 — Abschaltvermögen der Sicherung', () => {
  it('explizites Datenblatt-Abschaltvermögen schlägt die Bauform-Tabelle', () => {
    expect(breakingCapacityAOf('ato', 3000)).toBe(3000);
  });

  it('Bauform-Tabelle spiegelt die Hersteller-Datenblattanker (VERIFIED)', () => {
    expect(breakingCapacityAOf('classT', undefined)).toBe(FUSE_BREAKING_CAPACITY_A.classT);
    // Littelfuse-Blatt: ATO 1 kA, MEGA/MIDI 2 kA @32 VDC
    expect(FUSE_BREAKING_CAPACITY_A.ato).toBe(1000);
    expect(FUSE_BREAKING_CAPACITY_A.mega).toBe(2000);
    expect(FUSE_BREAKING_CAPACITY_A.midi).toBe(2000);
    // Blue-Sea-Quick-Guide: ANL 6 kA @32 VDC, Class T 20 kA
    expect(FUSE_BREAKING_CAPACITY_A.anl).toBe(6000);
    expect(FUSE_BREAKING_CAPACITY_A.classT).toBe(20000);
  });

  it('MRBF ist spannungsabhängig (Blue-Sea-Datenblatt 10/5/2 kA je Korridor)', () => {
    expect(breakingCapacityAOf('mrbf', undefined, 12.8)).toBe(10000); // 12-V-System
    expect(breakingCapacityAOf('mrbf', undefined, 25.6)).toBe(5000); // 24-V-System
    expect(breakingCapacityAOf('mrbf', undefined, 51.2)).toBe(2000); // 48-V-System
    expect(breakingCapacityAOf('mrbf', undefined, 65)).toBeNull(); // jenseits der Bauform
    // Default ohne Systemspannung: konservativ der 12-V-Tabellenwert
    expect(breakingCapacityAOf('mrbf', undefined)).toBe(FUSE_BREAKING_CAPACITY_A.mrbf);
  });

  it('unbekannte Bauform → nicht bewertbar (null)', () => {
    expect(breakingCapacityAOf('klingeldraht', undefined)).toBeNull();
    expect(breakingCapacityAOf(undefined, undefined)).toBeNull();
  });

  it('isFuseType trennt Bauform-Strings von Freitext', () => {
    expect(isFuseType('mrbf')).toBe(true);
    expect(isFuseType('ATO')).toBe(false);
  });
});

describe('DOM-002 — Regelanker begründet die Bauformwahl', () => {
  it('Class-T-Deckel (20 kA) liegt klarr über dem Ik typischer Camper-Bänke', () => {
    // 2 × 100 Ah LiFePO4 ≈ 8,5 kA am Pol — doppelt so starke Bank (4 × 200 Ah
    // ≈ 34 kA) läge über der Tabelle und ist bewusst Modellgrenze.
    const bank = [
      battery('b1', { capacity: 100, chemistry: 'LiFePO4' }),
      battery('b2', { capacity: 100, chemistry: 'LiFePO4' }),
    ];
    expect(bankShortCircuitCurrentA(bank)!).toBeLessThan(FUSE_BREAKING_CAPACITY_A.classT);
    // … aber über dem ATO-Deckel → genau der Fall, den der Warncheck anzeigt.
    expect(bankShortCircuitCurrentA(bank)!).toBeGreaterThan(FUSE_BREAKING_CAPACITY_A.ato);
    // MRBF (10 kA @12 V) trägt die typische Zweiblock-Bank noch — erst
    // ab ~2,5 kA-Ik ist Class T der letzte Bauform-Punkt.
    expect(bankShortCircuitCurrentA(bank)!).toBeLessThan(FUSE_BREAKING_CAPACITY_A.mrbf);
  });

  it('Solar-Teilmenge dieses Tests: Vmp-Anker bleibt 18 V (ELE-007-Pin)', () => {
    expect(VDE_SOLAR_VMP_VOLTAGE).toBe(18);
  });
});
