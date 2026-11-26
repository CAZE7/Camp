import { beforeEach, describe, expect, it } from 'vitest';

import { loadHeizungState, parseHeizungState, saveHeizungState, type HeizungEingaben } from './heizungState';

const VEHICLES = new Set(['vw-t6', 'ducato-l2h2']);
const HEIZUNGEN = new Set(['autoterm-2d', 'autoterm-4d']);

const GUELTIG: HeizungEingaben = {
  version: 1,
  vehicleId: 'ducato-l2h2',
  heaterId: 'autoterm-4d',
  insulationThickness: 25,
  tempInside: 21,
  tempOutside: -15,
  windowArea: 2.5,
  insulationCoverage: 90,
  quickHeat: true,
};

describe('parseHeizungState', () => {
  it('nimmt gültige Eingaben an', () => {
    expect(parseHeizungState(GUELTIG, VEHICLES, HEIZUNGEN)).toEqual(GUELTIG);
  });

  it('lehnt unbekannte Kennungen und unplausible Werte ab', () => {
    expect(parseHeizungState({ ...GUELTIG, vehicleId: 'unbekannt' }, VEHICLES, HEIZUNGEN)).toBeNull();
    expect(parseHeizungState({ ...GUELTIG, heaterId: 'unbekannt' }, VEHICLES, HEIZUNGEN)).toBeNull();
    expect(parseHeizungState({ ...GUELTIG, tempOutside: -500 }, VEHICLES, HEIZUNGEN)).toBeNull();
    expect(parseHeizungState({ ...GUELTIG, insulationCoverage: 101 }, VEHICLES, HEIZUNGEN)).toBeNull();
    expect(parseHeizungState({ ...GUELTIG, quickHeat: 'ja' }, VEHICLES, HEIZUNGEN)).toBeNull();
    expect(parseHeizungState({ ...GUELTIG, version: 2 }, VEHICLES, HEIZUNGEN)).toBeNull();
    expect(parseHeizungState(null, VEHICLES, HEIZUNGEN)).toBeNull();
  });
});

describe('Speicher-Roundtrip', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stellt gespeicherte Eingaben wieder her', () => {
    saveHeizungState(GUELTIG);
    expect(loadHeizungState(VEHICLES, HEIZUNGEN)).toEqual(GUELTIG);
  });

  it('verwirft einen manipulierten Speicherstand', () => {
    window.localStorage.setItem('12v-planer.heizung.v1', '{"version":1,"vehicleId":"x"}');
    expect(loadHeizungState(VEHICLES, HEIZUNGEN)).toBeNull();
  });
});
