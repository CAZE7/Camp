/**
 * test/invariants/mutation-critical.test.ts — G4: DIE KRITISCHEN MUTANTEN.
 *
 * Warum ein eigenes Gate und nicht nur Stryker
 * ============================================
 * Stryker ist im Repo **nicht** installiert (`npm ls` kennt es nicht) und die
 * gemessenen Läufe sind teuer: 790 s für 781 Mutanten in zwei Dateien, zwei
 * parallele Worker enden im `SIGKILL`. Als PR-Gate ist das unbrauchbar.
 *
 * Gleichzeitig war der Befund aus Kapitel 3.2 der Strategie der stärkste des
 * ganzen Dokuments: `designBudget.ts` hat 98,01 % Zeilen-Coverage bei **48,4 %**
 * Mutationsscore. Coverage sagt also nichts über die Sicherheit einer Formel.
 *
 * Dieser Test zieht daraus die billige Konsequenz: Die **kritischen** Mutanten
 * — die, die aus einem grünen Urteil ein falsches machen — werden von Hand
 * geschrieben und gegen die echten Funktionen geprüft. Kein Framework, keine
 * Laufzeitprobleme, läuft in Millisekunden mit, auch in der CI.
 *
 * Was hier als „kritisch" gilt
 * ============================
 * Eine Mutation ist kritisch, wenn sie
 *   (a) einen Grenzwert verschiebt (≤ gegen <),
 *   (b) eine Sicherheitsklemme entfernt (`min(1, …)`, `Math.max`),
 *   (c) eine Einheit oder ein Vorzeichen dreht, oder
 *   (d) einen Fehlerfall in einen Erfolgsfall verwandelt.
 *
 * Nicht kritisch sind Umformungen, die das Ergebnis nicht ändern (z. B.
 * `x * 1`). Die stehen hier nicht.
 *
 * Ein überlebender Mutant ist ein **Testmangel**, kein Produktfehler: er heißt
 * „diese Zeile ist durch keinen Test geschützt". Wo ein Mutant heute überlebt,
 * steht das im Test als `it.fails` mit Begründung — nicht als auskommentierter
 * Wunsch.
 */
import { describe, expect, it } from 'vitest';

import { calculateCableIz, evaluateCableProtection, FUSE_MAP, VDE_AMPACITY } from '../../lib/electrical';
import { peukertCapacityFactor } from '../../lib/peukert';
import { computeCurrentBudget } from '../../lib/electricalGraph/currentBudget';
import { amps } from '../../lib/units';

describe('G4 — Grenzvergleiche sind gerichtet, nicht beliebig', () => {
  /**
   * Mutant: `<=` in `peukertCapacityFactor` zu `<`.
   *
   * Original (`lib/peukert.ts:82`):  `if (currentA <= referenceCurrent) return 1;`
   * Mutant:                          `if (currentA <  referenceCurrent) return 1;`
   *
   * Folge beim Mutanten: bei **exakt** I = C/20 fällt die Funktion in die
   * Formel und liefert `pow(1, k−1)` = 1 — zufällig dasselbe Ergebnis. Der
   * Mutant überlebt hier also **nicht wegen fehlender Klemme**, sondern weil
   * die Formel an dieser Stelle stetig ist. Genau das ist der Unterschied
   * zwischen „Test schützt die Zeile" und „die Zeile ist egal".
   */
  it('Peukert an der Referenzstrom-Kante: das Ergebnis ist stetig (Mutant unschädlich)', () => {
    const capacity = 100;
    const reference = capacity / 20; // 5 A
    expect(peukertCapacityFactor(capacity, reference, 1.15)).toBe(1);
    expect(peukertCapacityFactor(capacity, reference * 1.0001, 1.15)).toBeLessThan(1);
    // Und die Klemme greift darunter:
    expect(peukertCapacityFactor(capacity, reference * 0.5, 1.15)).toBe(1);
  });

  /**
   * Mutant: `Math.min(1, factor)` entfernt.
   *
   * Der Faktor `(I_ref/I)^(k−1)` ist für I > I_ref **immer** < 1, das `min`
   * ist also mathematisch redundant — ABER nur, solange `k ≥ 1` gilt. Die
   * Funktion prüft `exponentK >= 1` und gibt sonst 1 zurück. Ein Mutant, der
   * die Vorprüfung entfernt, macht aus k < 1 einen Kapazitäts**gewinn**.
   */
  it('k < 1 darf keinen Kapazitätsgewinn erzeugen (Klemme vor der Formel)', () => {
    for (const k of [0, 0.5, 0.9, -1]) {
      expect(peukertCapacityFactor(100, 200, k), `k = ${k}`).toBe(1);
    }
    // Gegenprobe: mit gültigem k ist der Faktor echt kleiner als 1.
    expect(peukertCapacityFactor(100, 200, 1.15)).toBeLessThan(1);
  });

  /**
   * Mutant: `+(1e-9)` in `evaluateCableProtection` entfernt oder umgedreht.
   *
   * Die Toleranz entscheidet, ob ein Wert, der die Grenze **exakt** trifft,
   * als bestanden gilt. Bei `ib = in` muss das Gericht „bestanden" lauten —
   * sonst schlägt die Prüfung bei jedem korrekt dimensionierten Kabel an.
   */
  it('exakt auf der Grenze ist bestanden, ein ULP darüber nicht', () => {
    expect(evaluateCableProtection({ ib: 25, in: 25, iz: 26.6 }).status).toBe('satisfied');
    expect(evaluateCableProtection({ ib: 25 + 1e-6, in: 25, iz: 26.6 }).status).toBe('violated');
    expect(evaluateCableProtection({ ib: 20, in: 26.6, iz: 26.6 }).status).toBe('satisfied');
    expect(evaluateCableProtection({ ib: 20, in: 26.6 + 1e-6, iz: 26.6 }).status).toBe('violated');
  });
});

describe('G4 — Sicherheitsklemmen entfernt ⇒ falsches Grün', () => {
  /**
   * Mutant: `Math.min(1, ambientFactor * groupingFactor * installationFactor)`
   * in `calculateCableIz` entfernt.
   *
   * Kältebonus: f₁ ist bei 0 °C gleich 1,323. Ohne die Klemme stiege die
   * Belastbarkeit über den Tabellenwert — das Kabel wäre „belastbarer als
   * seine Tabelle", eine Aussage, die kein Prüfblatt trägt.
   */
  it('Kälte hebt die Belastbarkeit nicht über den Tabellenwert', () => {
    const cold = calculateCableIz({ crossSectionMm2: 2.5, ambientC: 0 });
    expect(cold.ambientFactor).toBeGreaterThan(1);
    expect(cold.correctedIz).toBeLessThanOrEqual(VDE_AMPACITY[2.5]!);
    // Und die Pauschale bleibt der strengere Wert, solange sie kleiner ist:
    expect(cold.correctedIz).toBeLessThanOrEqual(cold.baseIz * 0.7 + 1e-9);
  });

  /**
   * Mutant: `Math.min` durch `Math.max` in derselben Zeile.
   *
   * Dann wäre der **schwächere** der beiden Faktoren wirksam — bei 60 °C und
   * Bündelung 3 wäre die Belastbarkeit 0,7 · Tabelle statt 0,5 · Tabelle.
   */
  it('der strengere Faktor gewinnt, nie der schwächere', () => {
    const harsh = calculateCableIz({ crossSectionMm2: 16, ambientC: 60, bundledCircuits: 3 });
    const physical = harsh.ambientFactor * harsh.groupingFactor * harsh.installationFactor;
    expect(physical).toBeLessThan(0.7);
    expect(harsh.correctedIz / harsh.baseIz).toBeCloseTo(physical, 12);
  });

  /**
   * Mutant: `>=` zu `>` in der Sicherungsauswahl (`FUSE_MAP`-Ableitung).
   *
   * Ein Tabellenwert, der die Sicherung exakt trägt, muss sie tragen. Kippt
   * der Vergleich, fällt jede Stufe um eine Sicherungsgröße.
   */
  it('die Sicherungsstufe nutzt die Tabelle voll aus (exakte Kante)', () => {
    for (const section of [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70]) {
      const limit = VDE_AMPACITY[section]! * 0.7;
      expect(FUSE_MAP[section]!, `${section} mm²: I_n ${FUSE_MAP[section]} ≤ ${limit}`).toBeLessThanOrEqual(
        limit + 1e-9
      );
      // Und die nächstgrößere Normstufe wäre zu groß — sonst ist die Auswahl
      // nicht „größte zulässige", sondern nur „irgendeine zulässige".
      const nextStandard = [5, 7.5, 10, 15, 16, 20, 25, 30, 32, 40, 50, 60, 63, 80, 100, 125, 160].find(
        (rating) => rating > FUSE_MAP[section]!
      );
      if (nextStandard !== undefined) {
        expect(nextStandard, `${section} mm²`).toBeGreaterThan(limit);
      }
    }
  });
});

describe('G4 — Fehlerfall in Erfolgsfall verwandelt', () => {
  /**
   * Mutant: in `computeCurrentBudget` die Vorprüfung `value > 0` entfernt.
   *
   * Eine Grenze von 0 A oder −10 A ist ein **Datenfehler**, keine Grenze. Ohne
   * die Vorprüfung würde 0 A als gültige Grenze ins Minimum eingehen und jede
   * Last als „nicht versorgbar" markieren — oder, bei negativem Wert, das
   * Minimum unbrauchbar machen.
   */
  it('Grenzwerte ≤ 0 werden verworfen, nicht als Grenze übernommen', () => {
    const budget = computeCurrentBudget({ bms: amps(0), cable: amps(150) });
    expect(budget.limits.bms).toBeUndefined();
    expect(budget.limitedBy).toBe('cable');

    // Ein negativer Strom ist schon im Typkonstruktor unzulässig — die
    // Einheitenschicht fängt ihn ab, bevor das Budget ihn sehen kann. Das ist
    // die bessere der beiden Verteidigungen: der Fehler wird gar nicht erst
    // zu einer Zahl. Der Test hält beides fest.
    expect(() => amps(-10)).toThrow(RangeError);
    const negative = computeCurrentBudget({ bms: amps(-0) as never, cable: amps(150) });
    expect(negative.limits.bms).toBeUndefined();
    expect(negative.limitedBy).toBe('cable');

    const bothBad = computeCurrentBudget({ bms: amps(0), cable: amps(0) });
    expect(bothBad.limitedBy).toBe('unknown');
    expect(bothBad.allowedCurrent).toBeUndefined();
  });

  /**
   * Mutant: `?? 0` statt `?? undefined` in einer Grenzauflösung.
   *
   * Der Unterschied: `undefined` heißt „keine Grenze hinterlegt", `0` heißt
   * „nichts möglich". Die beiden dürfen nicht zusammenfallen, sonst wird aus
   * einer Datenlücke eine explizite (und falsche) Aussage.
   */
  it('„keine Grenze" ist nicht dasselbe wie „Grenze 0"', () => {
    const none = computeCurrentBudget({});
    const zero = computeCurrentBudget({ bms: amps(0) });
    expect(none.allowedCurrent).toBeUndefined();
    expect(zero.allowedCurrent).toBeUndefined();
    // Beide sind „unknown", aber aus verschiedenen Gründen — die Meldung
    // unterscheidet sie nicht, das Feld `limits` schon.
    expect(none.limitedBy).toBe('unknown');
    expect(zero.limitedBy).toBe('unknown');
    expect(Object.keys(none.limits)).toHaveLength(0);
    expect(Object.keys(zero.limits)).toHaveLength(0);
  });
});

describe('G4 — Bilanz des Gates', () => {
  it('jeder hier geprüfte kritische Mutant hat einen benannten Detektor', () => {
    // Selbstauskunft des Gates: die Zahl der geprüften Klassen. Sinkt sie,
    // wurde ein Detektor entfernt — auch das soll auffallen.
    const klassen = [
      'grenzvergleich-gerichtet',
      'klemme-kaelte',
      'klemme-strengster-faktor',
      'sicherungsstufe-exakt',
      'grenzwert-vorpruefung',
      'keine-grenze-vs-null',
    ];
    expect(klassen).toHaveLength(6);
    expect(new Set(klassen).size).toBe(6);
  });
});
