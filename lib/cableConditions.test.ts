/**
 * P0-3 — Fahrzeugkabel: auswählbare Verlegebedingungen statt Pauschalfaktor.
 */
import { describe, expect, it } from 'vitest';
import {
  CABLE_INSTALLATION_CONDITIONS,
  cableIzFor,
  cableSizingFor,
  isFuseFeasibleForConditions,
  isReferenceConditions,
  maxFuseForConditions,
  resolveCableConditions,
  selectFuseForConditions,
  thermalCrossSectionForConditions,
} from './cableConditions';
import {
  DERATE_FACTOR,
  FUSE_MAP,
  VDE_AMPACITY,
  VDE_SIZES,
  designAmpacity,
  lookupThermalCrossSection,
  selectFuseSize,
} from './electrical';

describe('Referenzmodell bleibt byte-stabil', () => {
  it('ohne Angabe gelten exakt die alten Werte (kein neuer Default)', () => {
    const conditions = resolveCableConditions();
    expect(isReferenceConditions(conditions)).toBe(true);
    expect(conditions.assessment).toBe('reference-model');
    for (const cs of VDE_SIZES) {
      expect(cableIzFor(cs, conditions).correctedIz).toBe(designAmpacity(cs));
      expect(maxFuseForConditions(cs, conditions)).toBe(FUSE_MAP[cs]);
      expect(selectFuseForConditions(20, cs, conditions)).toBe(selectFuseSize(20, cs));
    }
    for (const current of [5, 20, 60, 100, 147]) {
      expect(thermalCrossSectionForConditions(current, conditions).crossSectionMm2).toBe(
        lookupThermalCrossSection(current)
      );
    }
  });

  it('explizite Auswahl „Referenzmodell" ist ebenfalls stabil', () => {
    const conditions = resolveCableConditions({ installationCondition: 'reference' });
    expect(isReferenceConditions(conditions)).toBe(true);
    expect(cableIzFor(35, conditions).correctedIz).toBe(VDE_AMPACITY[35]! * DERATE_FACTOR);
  });
});

describe('Verlegebedingungen verändern Querschnitt, I_z und Sicherung', () => {
  it('Motorraum 60 °C / PVC: f₁ = 0,50 ⇒ halber Tabellenwert', () => {
    const conditions = resolveCableConditions({ installationCondition: 'engine-bay' });
    expect(conditions.assessment).toBe('assumption-based');
    expect(conditions.ambientC).toBe(60);
    expect(cableIzFor(10, conditions).correctedIz).toBeCloseTo(VDE_AMPACITY[10]! * 0.5, 6);
    expect(thermalCrossSectionForConditions(30, conditions).crossSectionMm2).toBe(16);
    expect(thermalCrossSectionForConditions(30, resolveCableConditions()).crossSectionMm2).toBe(10);
    expect(maxFuseForConditions(16, conditions)).toBe(32);
    expect(selectFuseForConditions(30, 16, conditions)).toBe(30);
  });

  it('Dach/Solar 60 °C / XLPE / 2 Stromkreise: f₁·f₂ ≈ 0,566', () => {
    const conditions = resolveCableConditions({ installationCondition: 'roof-solar' });
    expect(conditions.insulation).toBe('XLPE');
    expect(conditions.bundledCircuits).toBe(2);
    const expected = VDE_AMPACITY[6]! * Math.sqrt(30 / 60) * 0.8;
    expect(cableIzFor(6, conditions).correctedIz).toBeCloseTo(expected, 6);
  });

  it('milde Bedingungen bleiben nicht optimistischer als die Pauschale 0,7', () => {
    const conditions = resolveCableConditions({ installationCondition: 'cavity' });
    expect(cableIzFor(10, conditions).correctedIz).toBeCloseTo(designAmpacity(10), 6);
  });

  it('Herstellerangabe übersteuert die I_z — die Sicherungszuordnung aber nicht', () => {
    // BEFUND T-1 (Behebung 2026-11-06): Die Herstellerangabe ersetzt die I_z
    // für die EIGNUNGSFRAGE („trägt die Leitung 150 A?"). Sie hebt aber die
    // Norm-Sicherungszuordnung nicht auf: 2,5 mm² führt laut Tabelle 16 A,
    // und eine 95-A-Angabe macht daraus keine 80-A-Sicherung.
    // Vorher lieferte diese Zeile 80 A — die Schutzkoordination widersprach
    // damit der Referenzseite (FUSE_MAP[2.5] = 16).
    const conditions = resolveCableConditions({
      installationCondition: 'datasheet',
      manufacturerIzA: 95,
    });
    expect(conditions.assessment).toBe('manufacturer-data');
    expect(cableIzFor(2.5, conditions).correctedIz).toBe(95);
    expect(maxFuseForConditions(2.5, conditions)).toBe(16);
  });

  it('BEFUND T-1: der Trace nennt keinen Planerfaktor, den es nicht gibt', () => {
    // `correctedIz` ist hier die unveränderte Herstellerangabe. Ein
    // ausgewiesener `plannerFactor: 0,7` behauptete eine Abwertung, die
    // nicht stattgefunden hat — wer den Trace nachrechnete, kam auf eine
    // andere Zahl als die ausgewiesene.
    const conditions = resolveCableConditions({ manufacturerIzA: 172 });
    const trace = cableIzFor(70, conditions);
    expect(trace.correctedIz).toBe(172);
    expect(trace.plannerFactor).toBe(1);
    // Die Aneinanderreihung im Trace ergibt jetzt das ausgewiesene Ergebnis.
    expect(trace.baseIz * trace.plannerFactor).toBe(trace.correctedIz);
  });

  it('BEFUND T-1: auch eine hohe Hersteller-I_z hebt FUSE_MAP nicht auf', () => {
    // Der Fall aus dem Befund: 172 A Herstellerangabe auf 70 mm² ergaben
    // 160 A Sicherung, während der Referenzpfad für dieselbe Leitung 100 A
    // vorsieht.
    const conditions = resolveCableConditions({ manufacturerIzA: 172 });
    expect(maxFuseForConditions(70, conditions)).toBe(100);
    expect(maxFuseForConditions(70, resolveCableConditions())).toBe(100);
    // Und die Auswahl bleibt konsistent mit der Grenze.
    expect(selectFuseForConditions(150, 70, conditions)).toBe(100);
    expect(isFuseFeasibleForConditions(150, 70, conditions)).toBe(false);
  });

  it('eigene Werte überschreiben das Preset, nie umgekehrt', () => {
    const conditions = resolveCableConditions({
      installationCondition: 'custom',
      ambientC: 55,
      bundledCircuits: 4,
      cableInsulation: 'FLR2X-B',
    });
    expect(conditions.ambientC).toBe(55);
    expect(conditions.bundledCircuits).toBe(4);
    expect(conditions.insulation).toBe('XLPE');
    expect(conditions.installationFactor).toBe(1);
    expect(conditions.basis.length).toBeGreaterThan(0);
  });

  it('oberhalb der Modellgrenze: outside-model statt „70 mm² reicht"', () => {
    const conditions = resolveCableConditions({ installationCondition: 'engine-bay' });
    const choice = thermalCrossSectionForConditions(200, conditions);
    expect(choice.status).toBe('outside-model');
    expect(choice.maximumModeledCurrentA).toBeCloseTo(VDE_AMPACITY[70]! * 0.5, 6);
  });
});

describe('Keine stillen Fallbacks', () => {
  it('unbekannte Bedingung wirft statt auf Referenz zurückzufallen', () => {
    expect(() => resolveCableConditions({ installationCondition: 'zauberfaktor' })).toThrow(RangeError);
  });
  it('Temperatur ≥ Grenzleitertemperatur wirft', () => {
    expect(() =>
      resolveCableConditions({ installationCondition: 'custom', ambientC: 70, cableInsulation: 'FLRY-B' })
    ).toThrow(RangeError);
  });
  it('Häufung außerhalb der Tabelle 1…9 wirft', () => {
    expect(() => resolveCableConditions({ bundledCircuits: 10 })).toThrow(RangeError);
  });
  it('jedes Preset nennt eine Datengrundlage', () => {
    for (const preset of Object.values(CABLE_INSTALLATION_CONDITIONS)) {
      expect(preset.basis.length).toBeGreaterThan(0);
      expect(preset.label.length).toBeGreaterThan(5);
    }
  });
});

describe('cableSizingFor — eine Ableitung je Leitung', () => {
  it('Referenz und Motorraum liefern unterschiedliche, konsistente Werte', () => {
    const reference = cableSizingFor();
    const engine = cableSizingFor({ installationCondition: 'engine-bay' });
    expect(reference.isReference).toBe(true);
    expect(engine.isReference).toBe(false);
    expect(engine.iz(16)).toBeLessThan(reference.iz(16));
    expect(engine.maxFuse(16)).toBeLessThan(reference.maxFuse(16));
    // I_B ≤ I_n ≤ I_z bleibt auch unter verschärften Bedingungen gewahrt.
    const chosen = engine.thermalCrossSection(30);
    expect(chosen.status).toBe('within-model');
    expect(engine.selectFuse(30, chosen.crossSectionMm2)).toBeLessThanOrEqual(
      engine.iz(chosen.crossSectionMm2)
    );
  });
});

/** Review-Fund 2026-11-04: eigene Werte OHNE gewähltes Preset wurden still ignoriert. */
describe('Kein still ignoriertes Feld (Review-Korrektur)', () => {
  it('ambientC allein ⇒ custom, 60 °C halbiert I_z(10 mm²) auf 26 A', () => {
    const conditions = resolveCableConditions({ ambientC: 60 });
    expect(conditions.kind).toBe('custom');
    expect(conditions.assessment).toBe('assumption-based');
    expect(cableIzFor(10, conditions).correctedIz).toBeCloseTo(26, 6);
  });

  it('Häufung allein ⇒ custom und senkt I_z', () => {
    const conditions = resolveCableConditions({ bundledCircuits: 4 });
    expect(conditions.kind).toBe('custom');
    expect(cableIzFor(10, conditions).correctedIz).toBeLessThan(designAmpacity(10));
  });

  it('manufacturerIzA allein ⇒ Herstellerangabe, NICHT „Referenzmodell"', () => {
    const conditions = resolveCableConditions({ manufacturerIzA: 95 });
    expect(conditions.assessment).toBe('manufacturer-data');
    expect(cableIzFor(10, conditions).correctedIz).toBe(95);
  });

  it('Datenblatt ohne I_z wirft, statt 30 °C anzunehmen', () => {
    expect(() => resolveCableConditions({ installationCondition: 'datasheet' })).toThrow(/Datenblatt/);
  });

  it('Referenz plus eigene Werte wirft (widersprüchliche Eingabe)', () => {
    expect(() => resolveCableConditions({ installationCondition: 'reference', ambientC: 60 })).toThrow(
      /verträgt keine eigenen/
    );
  });

  it('unbekannter Leitungstyp und nicht-endliche Zahlen wirfen', () => {
    expect(() => resolveCableConditions({ cableInsulation: 'Gummi' })).toThrow(RangeError);
    expect(() => resolveCableConditions({ ambientC: Number.NaN })).toThrow(RangeError);
  });

  it('AutoWire-Fassade bricht bei ungültigen Plandaten nicht ab, meldet aber valid = false', () => {
    const facade = cableSizingFor({ installationCondition: 'custom', ambientC: 95 });
    expect(facade.valid).toBe(false);
    expect(facade.error).toMatch(/Grenzleitertemperatur/);
    expect(() => facade.iz(10)).not.toThrow();
  });
});
