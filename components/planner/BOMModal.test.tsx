import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BOMModal } from './BOMModal';
import { usePlannerStore } from '../../store/usePlannerStore';
import { PX_PER_METER } from '../../lib/units';
import { requestBomModalOpen } from './utils/bomModalEvents';

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

  it('verwendet die eingetragene Länge und meldet den Widerspruch (Nachtest Bug 7)', async () => {
    // Geroutet: 38,10 m — derselbe Befund wie im Referenzplan `camper`
    // (dort 38,05 m gegen 22,10 m eingetragen). Auf eine Nachkommastelle
    // gerundet, damit die Assertion nicht an der Binärdarstellung von 38.05
    // hängt (38.05 · 100 = 3804.9999… px).
    routes.set('e1', { length: 38.1 * PX_PER_METER });
    render(<BOMModal />);
    openBom();

    expect(await screen.findByText('Stückliste')).toBeInTheDocument();
    // Nachtest Bug 7: Der Zeichenweg (100 px = 1 m, mit Umwegen) zeigte
    // zwischen Nachbarn 6,4 m und schlug per max() den Nutzereintrag.
    // Jetzt gewinnt der Eintrag; der Widerspruch bleibt gemeldet.
    expect(screen.getByText('22,1 m Kabel mit 4 mm²')).toBeInTheDocument();
    expect(screen.queryByText('38,1 m Kabel mit 4 mm²')).not.toBeInTheDocument();
    // Und der Widerspruch wird gesagt, mit beiden Zahlen.
    expect(
      screen.getByText(/widersprechen sich eingetragene Länge und gerouteter Verlegeweg/i)
    ).toBeInTheDocument();
    // Der Strecken-Name steht jetzt auch im Freigabe-Banner (kritischer Befund),
    // daher: mindestens ein Treffer statt eindeutig.
    expect(screen.getAllByText(/Batterie → Kühlbox/).length).toBeGreaterThan(0);
    expect(screen.getByText(/eingetragen 22,1 m, geroutet 38,1 m/i)).toBeInTheDocument();
  });

  it('kleine Abweichungen sind kein Widerspruch (Rundung/Toleranz)', async () => {
    routes.set('e1', { length: 22.5 * PX_PER_METER }); // 1,8 % über dem Eintrag
    render(<BOMModal />);
    openBom();

    expect(await screen.findByText('Stückliste')).toBeInTheDocument();
    // Verwendet wird der Eintrag (22,1 m); innerhalb der Toleranz entsteht
    // kein Widerspruchshinweis.
    expect(screen.getByText('22,1 m Kabel mit 4 mm²')).toBeInTheDocument();
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
    expect(screen.getByText('30,0 m Kabel mit 4 mm²')).toBeInTheDocument();
    expect(screen.queryByText(/Platzhalter/i)).not.toBeInTheDocument();
  });

  it('schließt den Dialog', async () => {
    render(<BOMModal />);
    openBom();
    expect(await screen.findByText('Stückliste')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Schließen'));
    expect(screen.queryByText('Stückliste')).not.toBeInTheDocument();
  });

  it('öffnet sich, wenn die Aktion vor dem Lazy-Import des Dialogs ausgelöst wurde', async () => {
    act(() => requestBomModalOpen());
    render(<BOMModal />);
    expect(await screen.findByText('Stückliste')).toBeInTheDocument();
  });

  it('hält den Stücklisteninhalt in einem begrenzten vertikalen Scrollbereich', async () => {
    render(<BOMModal />);
    openBom();

    expect(await screen.findByText('Stückliste')).toBeInTheDocument();
    const body = screen.getByTestId('bom-scroll-body');
    expect(body.className).toContain('min-h-0');
    expect(body.className).toContain('overflow-y-auto');
    expect(body.className).toContain('overflow-x-hidden');
  });
});

describe('BOMModal — Dokumentstatus und CSV-Freigabe', () => {
  beforeEach(() => {
    routes.clear();
    act(() => {
      usePlannerStore.getState().setNodes([
        { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Batterie' } },
        { id: 'c1', type: 'consumer', position: { x: 400, y: 0 }, data: { label: 'Kühlbox' } },
      ]);
      // 22,10 m ohne Schutzorgan ⇒ kritischer Befund (Grenze 200 mm) ⇒ gesperrt.
      usePlannerStore.getState().setEdges([
        {
          id: 'e1',
          source: 'b1',
          target: 'c1',
          sourceHandle: 'plus',
          targetHandle: 'plus',
          type: 'cableEdge',
          data: { length: 22.1, crossSection: 4, edgeDomain: 'DC_12V' },
        },
      ]);
    });
  });

  it('sperrt den CSV-Export, solange ein kritischer Befund offen ist, und nennt ihn', async () => {
    render(<BOMModal />);
    openBom();
    const status = await screen.findByTestId('bom-release-status');
    expect(status).toHaveAttribute('data-status', 'gesperrt');
    expect(screen.getByTestId('bom-blockers')).toHaveTextContent(/Leitung Batterie → Kühlbox/);
    expect(screen.getByTestId('bom-export-csv')).toBeDisabled();
  });

  it('erlaubt den CSV-Export ohne kritischen Befund (Entwurf-Kennzeichnung bleibt sichtbar)', async () => {
    act(() => {
      usePlannerStore.getState().setEdges([]);
    });
    render(<BOMModal />);
    openBom();
    const status = await screen.findByTestId('bom-release-status');
    expect(status).not.toHaveAttribute('data-status', 'gesperrt');
    // Ein Plan mit nur Bauteilen, ohne Leitungen, gilt nicht als geprüft.
    expect(status).toHaveTextContent(/Dokumentstatus/);
    expect(screen.getByTestId('bom-export-csv')).not.toBeDisabled();
  });

  it('N14 + N17: kopiert deutsche Text-Stückliste statt JSON und führt Starter-/Aufbaubatterie getrennt', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    act(() => {
      usePlannerStore.getState().setNodes([
        {
          id: 'starter-battery-1',
          type: 'battery',
          position: { x: 0, y: 0 },
          data: { label: 'Starterbatterie', role: 'starter', capacity: 90, chemistry: 'AGM' },
        },
        {
          id: 'battery-1',
          type: 'battery',
          position: { x: 200, y: 0 },
          data: { label: 'Aufbaubatterie', role: 'house', capacity: 100, chemistry: 'LiFePO4' },
        },
      ]);
      usePlannerStore.getState().setEdges([]);
    });
    render(<BOMModal />);
    openBom();

    expect(await screen.findByText('Starterbatterie (90 Ah AGM)')).toBeInTheDocument();
    expect(screen.getByText('Aufbaubatterie (100 Ah LiFePO4)')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Stückliste kopieren/i }));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0]?.[0] as string;
    expect(copied).toContain('1 × Starterbatterie (90 Ah AGM)');
    expect(copied).toContain('1 × Aufbaubatterie (100 Ah LiFePO4)');
    expect(copied).not.toContain('```json');
  });
});
