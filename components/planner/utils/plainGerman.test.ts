import { describe, expect, it } from 'vitest';
import { toPlainGerman } from './plainGerman';

describe('toPlainGerman', () => {
  it('ersetzt die Formelzeichen aus dem Nachtest durch Klartext', () => {
    expect(toPlainGerman('höchstens 100 A (I_n ≤ I_z, AMP-001).')).toBe(
      'höchstens 100 A (der Nennstrom darf die zulässige Strombelastbarkeit nicht übersteigen).'
    );
    expect(toPlainGerman('verkleinern (I_b beachten), den Querschnitt erhöhen')).toContain(
      'den Betriebsstrom dabei nicht unterschreiten'
    );
    expect(toPlainGerman('(In ≥ I_b, In ≤ I_z)')).not.toMatch(/I_[bnz]|In\s*[≤≥]/);
    expect(toPlainGerman('I_z stammt aus der Tabelle.')).toBe(
      'zulässige Strombelastbarkeit stammt aus der Tabelle.'
    );
    expect(toPlainGerman('Regel AMP-001-ib-in-iz bleibt intern.')).not.toMatch(/AMP-/);
  });

  it('schreibt Auto-Wire-Konflikte und Sicherungshinweise in Klartext', () => {
    const conflict = toPlainGerman(
      'Verbindung umgelegt (Regel AUTO-SHUNT-BYPASS): Rückleiter. auto-node:shunt:Smart%20Shunt → busbar-minus.'
    );
    expect(conflict).not.toMatch(/AUTO-|%20|auto-node:|busbar-minus/);
    expect(conflict).toContain('Batteriecomputer „Smart Shunt“');
    expect(conflict).toContain('Minus-Sammelschiene');

    const hint = toPlainGerman(
      'Sicherung 80 A (ul248-classT classT): I_2 im Feld `i2A` eintragen (Regel AUTO-SHUNT-BYPASS).'
    );
    expect(hint).not.toMatch(/ul248|classT|i2A|AUTO-/);
    expect(hint).toContain('Class T');
    expect(hint).toContain('Prüfstrom');
  });
});
