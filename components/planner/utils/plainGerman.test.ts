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
});
