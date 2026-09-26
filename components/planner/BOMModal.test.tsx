import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BOMModal } from './BOMModal';
import { usePlannerStore } from '../../store/usePlannerStore';
import { PX_PER_METER } from '../../lib/units';

/**
 * AUDIT L1 — die Stückliste nennt Längen und muss ihre Quelle kennen.
 *
 * Der Befund: Im Referenzplan `camper` standen 22,10 m als Länge eingetragen,
 * der Router kannte 38,05 m Verlegeweg — Faktor 1,72. Die Stückliste nannte
 * die eingetragene (kleinere) Zahl und schwieg über die zweite Quelle. Wer
 * danach bestellt, bestellt zu kurzes Kabel. Ursache war die Reihenfolge im
 * alten `edgeLengthM`: „eingetragen zuerst, sonst geroutet" — und AutoWire
 * trägt als Länge die **Luftlinie** ein, die systematisch kürzer ist als der
 * Verlegeweg.
 */

// Der Route-Store ist global und wird hier je Kante gesetzt (geteilter Store
// über beide Plan-Modi).
const routes = new Map<string, { length: number }>();
vi.mock('../edges/utils/cableRouteStore', () => ({
  getCableRoute: (edgeId: string) => routes.get(edgeId),
  subscribeValidation: () => () => undefined,
  getCableRouteFinalValidation: () => undefined,
}));

const openBom = () => {
  act(() => {
    window.dispatchEvent(new CustomEvent('show-bom-modal'));
  });
};

describe('BOMModal — Längen mit Quelle (AUDIT L1)', () => {
  beforeEach(() => {
    routes.clear();
    act(() => {
      usePlannerStore.getState().setNodes([
        { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Batterie' } },
        { id: 'c1', type: 'consumer', position: { x: 400, y: 0 }, data: { label: 'Kühlbox' } },
      ]);
      usePlannerStore.getState().setEdges([
        {
          id: 'e1',
          source: 'b1',
          target: 'c1',
          sourceHandle: 'plus',
          targetHandle: 'plus',
          type: 'cableEdge',
          // Eingetragen: 22,10 m (Luftlinie aus der Geometrie).
          data: { length: 22.1, crossSection: 4, edgeDomain: 'DC_12V' },
        },
      ]);
    });
  });

  it('verwendet die größere Länge und meldet den Widerspruch', async () => {
    // Geroutet: 38,10 m — derselbe Befund wie im Referenzplan `camper`
    // (dort 38,05 m gegen 22,10 m eingetragen). Auf eine Nachkommastelle
    // gerundet, damit die Assertion nicht an der Binärdarstellung von 38.05
    // hängt (38.05 · 100 = 3804.9999… px).
    routes.set('e1', { length: 38.1 * PX_PER_METER });
    render(<BOMModal />);
    openBom();

    expect(await screen.findByText('Stückliste')).toBeInTheDocument();
    // Verwendet wird die geroutete Länge, nicht die eingetragene.
    expect(screen.getByText('38.1 m Kabel mit 4 mm²')).toBeInTheDocument();
    expect(screen.queryByText('22.1 m Kabel mit 4 mm²')).not.toBeInTheDocument();
    // Und der Widerspruch wird gesagt, mit beiden Zahlen.
    expect(
      screen.getByText(/widersprechen sich eingetragene Länge und gerouteter Verlegeweg/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Batterie → Kühlbox/)).toBeInTheDocument();
    expect(screen.getByText(/eingetragen 22.1 m, geroutet 38.1 m/i)).toBeInTheDocument();
  });

  it('kleine Abweichungen sind kein Widerspruch (Rundung/Toleranz)', async () => {
    routes.set('e1', { length: 22.5 * PX_PER_METER }); // 1,8 % über dem Eintrag
    render(<BOMModal />);
    openBom();

    expect(await screen.findByText('Stückliste')).toBeInTheDocument();
    expect(screen.getByText('22.5 m Kabel mit 4 mm²')).toBeInTheDocument();
    expect(
      screen.queryByText(/widersprechen sich eingetragene Länge und gerouteter Verlegeweg/i)
    ).not.toBeInTheDocument();
  });

  it('ohne Eintrag und ohne Route wird die Platzhalterlänge als erfunden gekennzeichnet', async () => {
    act(() => {
      usePlannerStore.getState().setEdges([
        {
          id: 'e1',
          source: 'b1',
          target: 'c1',
          sourceHandle: 'plus',
          targetHandle: 'plus',
          type: 'cableEdge',
          data: { crossSection: 4, edgeDomain: 'DC_12V' }, // keine Länge
        },
      ]);
    });
    render(<BOMModal />);
    openBom();

    expect(await screen.findByText('Stückliste')).toBeInTheDocument();
    expect(screen.getByText(/Platzhalter — Länge im Leitungs-Inspektor eintragen/i)).toBeInTheDocument();
    expect(screen.getByText(/weder ein Längeneintrag noch eine Route vor/i)).toBeInTheDocument();
  });

  it('eine Route ohne Eintrag ist keine Annahme, sondern der Verlegeweg', async () => {
    routes.set('e1', { length: 30 * PX_PER_METER });
    act(() => {
      usePlannerStore.getState().setEdges([
        {
          id: 'e1',
          source: 'b1',
          target: 'c1',
          sourceHandle: 'plus',
          targetHandle: 'plus',
          type: 'cableEdge',
          data: { crossSection: 4, edgeDomain: 'DC_12V' }, // keine Länge
        },
      ]);
    });
    render(<BOMModal />);
    openBom();

    expect(await screen.findByText('Stückliste')).toBeInTheDocument();
    expect(screen.getByText('30.0 m Kabel mit 4 mm²')).toBeInTheDocument();
    expect(screen.queryByText(/Platzhalter/i)).not.toBeInTheDocument();
  });

  it('schließt den Dialog', async () => {
    render(<BOMModal />);
    openBom();
    expect(await screen.findByText('Stückliste')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Schließen'));
    expect(screen.queryByText('Stückliste')).not.toBeInTheDocument();
  });
});
