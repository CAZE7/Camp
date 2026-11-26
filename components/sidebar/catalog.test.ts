import { describe, expect, it } from 'vitest';

import { searchRank, type Comp } from './catalog';

const eintrag = (label: string, description = ''): Pick<Comp, 'label' | 'description'> => ({
  label,
  description,
});

describe('searchRank (R8-07)', () => {
  it('findet Alltagswoerter ueber Synonyme', () => {
    expect(searchRank(eintrag('LED-Beleuchtung'), 'Licht')).toBe(1);
    expect(searchRank(eintrag('LED-Beleuchtung'), 'Lampe')).toBe(1);
    expect(searchRank(eintrag('Kompressorkühlschrank'), 'Kühlbox')).toBe(1);
    expect(searchRank(eintrag('Wechselrichter'), 'Inverter')).toBe(1);
    expect(searchRank(eintrag('Solarmodul'), 'Panel')).toBe(1);
  });

  it('ordnet Namenstreffer vor Beschreibungstreffern', () => {
    const led = searchRank(eintrag('LED-Beleuchtung', 'Sparsame Beleuchtung'), 'Licht');
    const booster = searchRank(eintrag('Ladebooster (DC-DC)', 'Lädt über die Lichtmaschine'), 'Licht');
    expect(led).toBeLessThan(booster);
  });

  it('liefert -1 ohne Treffer (dort greift „Eigenes Gerät anlegen“)', () => {
    expect(searchRank(eintrag('LED-Beleuchtung'), 'Fernseher')).toBe(-1);
    expect(searchRank(eintrag('LED-Beleuchtung'), '')).toBe(-1);
  });
});
