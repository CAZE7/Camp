import { describe, expect, it } from 'vitest';

import {
  BOOSTER_C_FENSTER,
  BOOSTER_GRENZEN,
  BOOSTER_KLASSEN,
  BOOSTER_KLASSE_OFFEN,
  boosterKlasse,
  sizeBooster,
} from './boosterSizing';

/**
 * Die sechs eingefrorenen Ausgaben des Rechners (Gate G12).
 *
 * Sie stammen aus `tests/e2e/ladebooster-vergleich.spec.ts`, das sie seit dem
 * ersten Ladebooster-Vergleich gegen die gerenderte Seite prüft. Die Anzeige
 * formatiert mit `toFixed(n).replace('.', ',')`; die Werte hier sind die
 * Zahlen, aus denen genau diese Zeichenketten entstehen:
 *
 *   330 Ah / 5 h / 180 A → „79 A · 0,24 C", „90-A-Klasse", „130 A · 72 %"
 *   100 Ah / 5 h / 180 A → „24 A · 0,24 C", „30-A-Klasse", „53 A · 30 %"
 *
 * Würde jemand die Formel „nur aufräumen", fielen diese Zahlen zuerst.
 */
describe('sizeBooster — eingefrorene Ausgaben', () => {
  const anzeige = (wert: number, stellen: number) => wert.toFixed(stellen).replace('.', ',');

  it('330 Ah, 5 h Fahrzeit, 180 A Lichtmaschine (LiFePO4)', () => {
    const ergebnis = sizeBooster({
      capacityAh: 330,
      driveHours: 5,
      alternatorA: 180,
      chemistry: 'LiFePO4',
    });

    expect(anzeige(ergebnis.targetCurrentA, 0)).toBe('79');
    expect(anzeige(ergebnis.cRate, 2)).toBe('0,24');
    expect(ergebnis.deviceClass).toBe('90-A-Klasse');
    expect(anzeige(ergebnis.inputCurrentA, 0)).toBe('130');
    expect(anzeige(ergebnis.alternatorUtilizationPercent, 0)).toBe('72');
  });

  it('100 Ah, 5 h Fahrzeit, 180 A Lichtmaschine (LiFePO4)', () => {
    const ergebnis = sizeBooster({
      capacityAh: 100,
      driveHours: 5,
      alternatorA: 180,
      chemistry: 'LiFePO4',
    });

    expect(anzeige(ergebnis.targetCurrentA, 0)).toBe('24');
    expect(anzeige(ergebnis.cRate, 2)).toBe('0,24');
    expect(ergebnis.deviceClass).toBe('30-A-Klasse');
    expect(anzeige(ergebnis.inputCurrentA, 0)).toBe('53');
    expect(anzeige(ergebnis.alternatorUtilizationPercent, 0)).toBe('30');
  });

  it('begrenzt einen zu kleinen Bedarf auf den unteren Fensterrand', () => {
    // 24 A Zielstrom liegen unter 0,3 C von 100 Ah (30 A): Das Gerät muss
    // mindestens den unteren Fensterrand liefern, sonst lädt es im
    // Teillastbereich, für den die C-Angabe nicht gilt.
    const ergebnis = sizeBooster({
      capacityAh: 100,
      driveHours: 5,
      alternatorA: 180,
      chemistry: 'LiFePO4',
    });

    expect(ergebnis.fensterLage).toBe('darunter');
    expect(ergebnis.sizedCurrentA).toBeCloseTo(30, 10);
    expect(ergebnis.minCurrentA).toBeCloseTo(30, 10);
  });

  it('begrenzt einen zu großen Bedarf auf den oberen Fensterrand', () => {
    // 330 Ah in 2 Stunden wären 198 A (0,6 C) — über dem Fenster von 0,5 C.
    const ergebnis = sizeBooster({
      capacityAh: 330,
      driveHours: 2,
      alternatorA: 180,
      chemistry: 'LiFePO4',
    });

    expect(ergebnis.targetCurrentA).toBeCloseTo(198, 6);
    expect(ergebnis.fensterLage).toBe('darueber');
    expect(ergebnis.sizedCurrentA).toBeCloseTo(165, 10);
    expect(ergebnis.maxCurrentA).toBeCloseTo(165, 10);
    expect(ergebnis.alternatorLage).toBe('ueberlastet');
  });

  it('meldet einen Bedarf innerhalb des Fensters als solchen', () => {
    const ergebnis = sizeBooster({
      capacityAh: 200,
      driveHours: 5,
      alternatorA: 180,
      chemistry: 'LiFePO4',
    });

    // 200 Ah / 5 h · 1,2 = 48 A; Fenster 60–100 A für LiFePO4 → darunter.
    expect(ergebnis.targetCurrentA).toBeCloseTo(48, 6);
    expect(ergebnis.fensterLage).toBe('darunter');

    const innen = sizeBooster({
      capacityAh: 200,
      driveHours: 3,
      alternatorA: 180,
      chemistry: 'LiFePO4',
    });
    // 200 Ah / 3 h · 1,2 = 80 A → innerhalb 60–100 A.
    expect(innen.targetCurrentA).toBeCloseTo(80, 6);
    expect(innen.fensterLage).toBe('innerhalb');
    expect(innen.sizedCurrentA).toBeCloseTo(80, 6);
  });
});

describe('sizeBooster — Chemie', () => {
  it('rechnet Blei mit dem engeren Ladefenster', () => {
    const blei = sizeBooster({
      capacityAh: 330,
      driveHours: 5,
      alternatorA: 180,
      chemistry: 'Blei',
    });

    expect(blei.minCurrentA).toBeCloseTo(66, 10);
    expect(blei.maxCurrentA).toBeCloseTo(99, 10);
    // 79,2 A Zielstrom liegen im Blei-Fenster — es wird also nicht begrenzt,
    // und die Lichtmaschine sieht weniger Strom als bei LiFePO4.
    expect(blei.fensterLage).toBe('innerhalb');
    expect(blei.sizedCurrentA).toBeCloseTo(79.2, 6);
    expect(blei.inputCurrentA).toBeCloseTo(108, 6);
  });

  it('kennt für jede deklarierte Chemie ein Fenster', () => {
    expect(Object.keys(BOOSTER_C_FENSTER).sort()).toEqual(['Blei', 'LiFePO4']);
    for (const fenster of Object.values(BOOSTER_C_FENSTER)) {
      expect(fenster.minC).toBeGreaterThan(0);
      expect(fenster.maxC).toBeGreaterThan(fenster.minC);
    }
  });
});

describe('sizeBooster — Auslastung der Lichtmaschine', () => {
  const lagen = [
    { alternatorA: 400, erwartet: 'reserve' },
    { alternatorA: 150, erwartet: 'nah' },
    { alternatorA: 100, erwartet: 'ueberlastet' },
  ] as const;

  it.each(lagen)('nennt $erwartet bei $alternatorA A Nennstrom', ({ alternatorA, erwartet }) => {
    const ergebnis = sizeBooster({
      capacityAh: 330,
      driveHours: 5,
      alternatorA,
      chemistry: 'LiFePO4',
    });
    expect(ergebnis.alternatorLage).toBe(erwartet);
  });

  it('setzt die Schwellen bei 80 und 100 Prozent', () => {
    // Eingangsstrom ist hier 130 A: 170 A Nennstrom → 76 %, 160 A → 81 %,
    // 125 A → 104 %. Die Lagen wechseln also an den erklärten Schwellen.
    const lage = (alternatorA: number) =>
      sizeBooster({ capacityAh: 330, driveHours: 5, alternatorA, chemistry: 'LiFePO4' }).alternatorLage;

    expect(lage(170)).toBe('reserve');
    expect(lage(160)).toBe('nah');
    expect(lage(135)).toBe('nah');
    expect(lage(125)).toBe('ueberlastet');
  });
});

describe('boosterKlasse — Bedarfsklassen', () => {
  it('ordnet die Schwellen aufsteigend und lückenlos', () => {
    const schwellen = BOOSTER_KLASSEN.map((klasse) => klasse.bisA);
    expect(schwellen).toEqual([...schwellen].sort((a, b) => a - b));
    expect(schwellen[0]).toBe(35);
    expect(schwellen.at(-1)).toBe(130);
  });

  it('nennt die Klasse an der Schwelle und darüber', () => {
    expect(boosterKlasse(35)).toBe('30-A-Klasse');
    expect(boosterKlasse(35.1)).toBe('60–70-A-Klasse');
    expect(boosterKlasse(75)).toBe('60–70-A-Klasse');
    expect(boosterKlasse(75.1)).toBe('90-A-Klasse');
    expect(boosterKlasse(100)).toBe('90-A-Klasse');
    expect(boosterKlasse(100.1)).toBe('100–120-A-Klasse');
    expect(boosterKlasse(130)).toBe('100–120-A-Klasse');
    expect(boosterKlasse(130.1)).toBe(BOOSTER_KLASSE_OFFEN);
  });

  it('lehnt keine Zahl ab', () => {
    expect(() => boosterKlasse(Number.NaN)).toThrow(RangeError);
    expect(() => boosterKlasse(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('sizeBooster — Eingabegrenzen (Rule M: kein stiller Rückfall)', () => {
  const gueltig = { capacityAh: 330, driveHours: 5, alternatorA: 180, chemistry: 'LiFePO4' } as const;

  const faelle = [
    { name: 'Kapazität unter 50 Ah', eingabe: { ...gueltig, capacityAh: 49 } },
    { name: 'Kapazität über 1200 Ah', eingabe: { ...gueltig, capacityAh: 1201 } },
    { name: 'Fahrzeit unter 1 h', eingabe: { ...gueltig, driveHours: 0.5 } },
    { name: 'Fahrzeit über 24 h', eingabe: { ...gueltig, driveHours: 25 } },
    { name: 'Lichtmaschine unter 40 A', eingabe: { ...gueltig, alternatorA: 39 } },
    { name: 'Lichtmaschine über 400 A', eingabe: { ...gueltig, alternatorA: 401 } },
    { name: 'Kapazität keine Zahl', eingabe: { ...gueltig, capacityAh: Number.NaN } },
  ];

  it.each(faelle)('wirft bei $name', ({ eingabe }) => {
    expect(() => sizeBooster(eingabe)).toThrow(RangeError);
  });

  it('akzeptiert die Grenzen selbst', () => {
    expect(() => sizeBooster({ ...gueltig, capacityAh: BOOSTER_GRENZEN.kapazitaetAh.min })).not.toThrow();
    expect(() => sizeBooster({ ...gueltig, capacityAh: BOOSTER_GRENZEN.kapazitaetAh.max })).not.toThrow();
    expect(() => sizeBooster({ ...gueltig, driveHours: BOOSTER_GRENZEN.fahrzeitH.max })).not.toThrow();
    expect(() => sizeBooster({ ...gueltig, alternatorA: BOOSTER_GRENZEN.lichtmaschineA.min })).not.toThrow();
  });

  it('lehnt eine unbekannte Chemie ab, statt stillschweigend Blei zu rechnen', () => {
    expect(() => sizeBooster({ ...gueltig, chemistry: 'Natrium' as unknown as 'Blei' })).toThrow(RangeError);
  });
});
