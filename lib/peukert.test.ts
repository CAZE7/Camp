import { describe, it, expect } from 'vitest';
import {
  PEUKERT_EXPONENT,
  peukertCapacityFactor,
  peukertExponentOf,
  usableCapacityWithPeukertAh,
} from './peukert';

describe('DOM-002-Nachpflege — Peukert-Faustmodell (lib/peukert.ts)', () => {
  it('k = 1 (ideale Batterie): kein Effekt bei beliebigem Strom', () => {
    expect(peukertCapacityFactor(100, 40, 1)).toBe(1);
  });

  it('Chemie-Faustwerte: LiFePO4 1,05 / AGM 1,12 / Gel 1,15 (UNVERIFIED-Anker)', () => {
    expect(PEUKERT_EXPONENT['LiFePO4']).toBe(1.05);
    expect(PEUKERT_EXPONENT['AGM']).toBe(1.12);
    expect(PEUKERT_EXPONENT['Gel']).toBe(1.15);
  });

  it('LiFePO4 100 Ah bei 40 A Dauerlast: ≈ 0,901 (Peukert mäßig)', () => {
    // I_ref = 5 A → (5/40)^0.05 = 0,125^0,05 = e^(−0,104) ≈ 0,901
    expect(peukertCapacityFactor(100, 40, 1.05)).toBeCloseTo(0.9013, 3);
  });

  it('AGM 100 Ah bei 40 A Dauerlast: ≈ 0,779 (Peukert spürbar)', () => {
    // (5/40)^0.12 = e^(0,12 · ln 0,125) = e^(−0,2495) ≈ 0,779
    expect(peukertCapacityFactor(100, 40, 1.12)).toBeCloseTo(0.7793, 3);
  });

  it('Last unter Referenzstrom (C/20) schenkt nichts hinzu — Deckel 1', () => {
    expect(peukertCapacityFactor(100, 2, 1.12)).toBe(1); // 2 A < 5 A Referenz
    expect(peukertCapacityFactor(100, 5, 1.12)).toBe(1); // genau C/20
  });

  it('ungültige Eingaben bleiben beim ehrlichen Nennmodell (Faktor 1)', () => {
    expect(peukertCapacityFactor(0, 40, 1.12)).toBe(1);
    expect(peukertCapacityFactor(100, 0, 1.12)).toBe(1);
    expect(peukertCapacityFactor(100, -5, 1.12)).toBe(1);
    expect(peukertCapacityFactor(NaN, 10, 1.12)).toBe(1);
    expect(peukertCapacityFactor(100, 10, Number.NaN)).toBe(1);
  });

  it('Exponent: Datenblatt (≥ 1) schlägt Chemie; Unbekanntes fällt auf LiFePO4', () => {
    expect(peukertExponentOf({ peukertExponent: 1.2, chemistry: 'LiFePO4' })).toBe(1.2);
    expect(peukertExponentOf({ peukertExponent: 0.8, chemistry: 'Gel' })).toBe(PEUKERT_EXPONENT['Gel']); // k < 1 verworfen
    expect(peukertExponentOf({ chemistry: 'NasBatterie' })).toBe(PEUKERT_EXPONENT['LiFePO4']);
    expect(peukertExponentOf(undefined)).toBe(PEUKERT_EXPONENT['LiFePO4']);
  });

  it('usableCapacityWithPeukertAh: DoD und Faktor multiplizieren sich', () => {
    // 100 Ah AGM, DoD 50 %, 40 A: 100 · 0,5 · 0,7793 ≈ 38,97 Ah
    expect(usableCapacityWithPeukertAh(100, 0.5, 40, 1.12)).toBeCloseTo(38.97, 1);
    // Ohne Last: Nennmodell unverändert
    expect(usableCapacityWithPeukertAh(100, 0.5, 0, 1.12)).toBe(50);
    // Ungültige Kapazität: 0 (nicht raten)
    expect(usableCapacityWithPeukertAh(0, 0.5, 40, 1.12)).toBe(0);
  });
});
