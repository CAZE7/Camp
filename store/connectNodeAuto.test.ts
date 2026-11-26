import { beforeEach, describe, expect, it } from 'vitest';

import { usePlannerStore } from './usePlannerStore';

/** R8-03: „Mit Sicherungskasten verbinden“ verkabelt nur das eine Gerät. */
describe('connectNodeAuto (R8-03)', () => {
  beforeEach(() => {
    usePlannerStore.getState().applyTemplate('kastenwagen');
  });

  it('schließt ein unverbundenes Gerät an und lässt den Rest unverändert', () => {
    const state = usePlannerStore.getState();
    state.addNode('consumer', 'Kaffeemaschine', { x: 1600, y: 900 }, 800);
    const vorher = usePlannerStore.getState();
    const kaffee = vorher.nodes.find((node) => node.data.label === 'Kaffeemaschine');
    expect(kaffee).toBeDefined();
    const kantenVorher = vorher.edges.length;
    expect(vorher.edges.some((edge) => edge.source === kaffee!.id || edge.target === kaffee!.id)).toBe(false);

    const ok = usePlannerStore.getState().connectNodeAuto(kaffee!.id);
    expect(ok).toBe(true);

    const nachher = usePlannerStore.getState();
    const neueKanten = nachher.edges.filter(
      (edge) => edge.source === kaffee!.id || edge.target === kaffee!.id
    );
    expect(neueKanten.length).toBeGreaterThan(0);
    expect(nachher.edges.length).toBe(kantenVorher + neueKanten.length);

    // Zweiter Aufruf: nichts mehr zu tun.
    expect(usePlannerStore.getState().connectNodeAuto(kaffee!.id)).toBe(false);
  });

  it('lehnt den Wasserplan ab', () => {
    usePlannerStore.setState({ viewMode: 'water' });
    expect(usePlannerStore.getState().connectNodeAuto('irgendwas')).toBe(false);
    usePlannerStore.setState({ viewMode: 'electric' });
  });
});
