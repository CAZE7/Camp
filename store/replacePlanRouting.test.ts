import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearCableRoutes,
  getCableRouteFinalValidation,
  publishCableRouteFinalValidation,
} from '../components/edges/utils/cableRouteStore';
import type { FinalValidationReport } from '../lib/routing/finalValidation';
import { usePlannerStore } from './usePlannerStore';

/**
 * R8-02: Nach jedem „Plan ersetzen“ (Vorlage, Undo/Redo, Import, Leeren)
 * darf der Routing-Prüfstand des alten Plans nicht weiterzählen.
 */
const ALTER_BERICHT = {
  status: 'INVALID',
  edgeCount: 3,
  counts: {
    contractViolations: 0,
    edgeNodeCollisions: 7,
    edgeEdgeOverlaps: 5,
    clearanceViolations: 1,
    lockedRouteViolations: 0,
  },
} as unknown as FinalValidationReport;

describe('Plan ersetzen invalidiert das Kabelrouting (R8-02)', () => {
  beforeEach(() => {
    clearCableRoutes();
    usePlannerStore.getState().applyTemplate('kastenwagen');
    clearCableRoutes();
  });

  it('Vorlagenwechsel verwirft den alten Prüfbericht', () => {
    publishCableRouteFinalValidation(ALTER_BERICHT);
    expect(getCableRouteFinalValidation()).toBeDefined();
    usePlannerStore.getState().applyTemplate('autark');
    expect(getCableRouteFinalValidation()).toBeUndefined();
  });

  it('Undo über einen Vorlagenwechsel verwirft den alten Prüfbericht', () => {
    usePlannerStore.getState().applyTemplate('autark');
    publishCableRouteFinalValidation(ALTER_BERICHT);
    usePlannerStore.getState().undo();
    expect(getCableRouteFinalValidation()).toBeUndefined();
  });

  it('Plan leeren verwirft den alten Prüfbericht', () => {
    publishCableRouteFinalValidation(ALTER_BERICHT);
    usePlannerStore.getState().clearPlan();
    expect(getCableRouteFinalValidation()).toBeUndefined();
  });
});
