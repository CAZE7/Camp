import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BOMModal } from './BOMModal';
import { usePlannerStore } from '../../store/usePlannerStore';
import { planCaptureIdentity } from './utils/planCaptureIdentity';
import { capturePlanImage } from './utils/exportPlanImage';
import { openPrintReport, openPrintReportWindow } from './utils/printReport';

/**
 * Der Druckbericht ist EIN Übergabedokument. Schaltplan, Stückliste und
 * Prüfbericht müssen denselben Planstand zeigen — sonst bekommt eine Werkstatt
 * ein widersprüchliches Dokument, das vollständig aussieht.
 *
 * Stückliste und Prüfbericht entstehen aus einem Snapshot beim Öffnen des
 * Dialogs. Das Bild entsteht später und liest den Store erneut. Dazwischen
 * liegen mehrere `await`s (dynamischer Import, html-to-image, ein Frame,
 * toPng). Genau in diesem Fenster kann sich der Plan ändern.
 *
 * Diese Datei prüft das Fenster, nicht den Normalfall.
 */

vi.mock('./utils/exportPlanImage', () => ({
  capturePlanImage: vi.fn(),
}));

vi.mock('./utils/printReport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils/printReport')>();
  return {
    ...actual,
    openPrintReport: vi.fn(() => true),
    openPrintReportWindow: vi.fn(() => fakeWindow),
  };
});

vi.mock('../edges/utils/cableRouteStore', () => ({
  getCableRoute: () => undefined,
  subscribeValidation: () => () => undefined,
  getCableRouteFinalValidation: () => undefined,
}));

const captureMock = vi.mocked(capturePlanImage);
const openMock = vi.mocked(openPrintReport);
const windowMock = vi.mocked(openPrintReportWindow);

/** Das synchron geöffnete Druckfenster muss bei Abbruch wieder zugehen. */
const closeSpy = vi.fn();
const fakeWindow = { close: closeSpy } as unknown as Window;

const PLAN_IMAGE = { dataUrl: 'data:image/png;base64,AAAA', width: 800, height: 600 };

/**
 * Der Mock verhält sich wie das Original, nur ohne Canvas: Er liest den
 * Store und meldet dessen Identität und Modus. Sonst würde der Test die
 * Nachprüfung mit einem erfundenen Wert bestehen lassen.
 */
const capturingFromStore = () => {
  const state = usePlannerStore.getState();
  return Promise.resolve({
    ...PLAN_IMAGE,
    viewMode: state.viewMode === 'water' ? ('water' as const) : ('electric' as const),
    identity: planCaptureIdentity(state),
  });
};

const openBom = () => {
  act(() => {
    window.dispatchEvent(new CustomEvent('show-bom-modal'));
  });
};

/** Zwei Bauteile ohne Leitung: dokumentierbar, keine kritischen Befunde. */
const seedPlan = () => {
  act(() => {
    usePlannerStore.getState().setNodes([
      { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Batterie' } },
      { id: 'c1', type: 'consumer', position: { x: 400, y: 0 }, data: { label: 'Kühlbox' } },
    ]);
    usePlannerStore.getState().setEdges([]);
  });
};

const clickPrint = async () => {
  const button = await screen.findByTestId('bom-print-report');
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
};

describe('Druckbericht — Planstand-Konsistenz über die asyn Aufnahme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openMock.mockReturnValue(true);
    captureMock.mockImplementation(capturingFromStore);
    act(() => {
      usePlannerStore.getState().setViewMode('electric');
      usePlannerStore.getState().setWaterNodes([]);
      usePlannerStore.getState().setWaterEdges([]);
    });
    seedPlan();
  });

  it('Normalfall: unveränderter Plan erzeugt genau ein Dokument mit Bild', async () => {
    render(<BOMModal />);
    openBom();
    await clickPrint();

    await waitFor(() => expect(openMock).toHaveBeenCalledTimes(1));
    const html = openMock.mock.calls[0]![0] as string;
    expect(html).toContain('data:image/png;base64,AAAA');
  });

  /**
   * Kernbefund: Die Planänderung passiert GENAU zwischen Vorprüfung und
   * Bildaufnahme — also innerhalb von `capturePlanImage`. Die Vorprüfung hat
   * den Plan noch als unverändert gesehen.
   */
  it('bricht ab, wenn sich der Plan WÄHREND der Bildaufnahme ändert', async () => {
    captureMock.mockImplementation(async () => {
      // Mitten in der Aufnahme: ein Bauteil wird umbenannt. Das Bild zeigt
      // danach den neuen Stand, Stückliste und Prüfbericht den alten.
      act(() => {
        usePlannerStore.getState().setNodes([
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Batterie' } },
          { id: 'c1', type: 'consumer', position: { x: 400, y: 0 }, data: { label: 'Heizung' } },
        ]);
      });
      return capturingFromStore();
    });

    render(<BOMModal />);
    openBom();
    await clickPrint();

    await waitFor(() => expect(captureMock).toHaveBeenCalled());
    // Es darf KEIN Dokument entstehen.
    expect(openMock).not.toHaveBeenCalled();
    expect(await screen.findByTestId('bom-report-error')).toHaveTextContent(/geändert/i);
  });

  it('bricht ab, wenn sich der Plan schon vor der Vorprüfung geändert hat', async () => {
    render(<BOMModal />);
    openBom();
    await screen.findByTestId('bom-print-report');

    act(() => {
      usePlannerStore
        .getState()
        .setNodes([
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Andere Batterie' } },
        ]);
    });

    await clickPrint();
    await waitFor(() => expect(screen.getByTestId('bom-report-error')).toHaveTextContent(/geändert/i));
    expect(openMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });
});

/**
 * Zweiter, unabhängiger Befund: `planFingerprintHash` hasht die PRÜFEINGABE
 * (id, type, data, Kantenanschluss, options) — bewusst ohne `position`, weil
 * die Lage eines Symbols kein elektrisches Ergebnis ändert.
 *
 * Für das BILD ist die Lage aber genau das, was sich ändert. Ein verschobenes
 * Bauteil zeichnet einen anderen Schaltplan, ohne dass die Vorprüfung es merkt.
 */
describe('Druckbericht — lageabhängige Bildkonsistenz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openMock.mockReturnValue(true);
    captureMock.mockImplementation(capturingFromStore);
    act(() => {
      usePlannerStore.getState().setViewMode('electric');
      usePlannerStore.getState().setWaterNodes([]);
      usePlannerStore.getState().setWaterEdges([]);
    });
    seedPlan();
  });

  it('erkennt ein verschobenes Bauteil während der Aufnahme', async () => {
    captureMock.mockImplementation(async () => {
      act(() => {
        usePlannerStore.getState().setNodes([
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Batterie' } },
          // Nur die Lage ändert sich — Daten identisch.
          { id: 'c1', type: 'consumer', position: { x: 1200, y: 900 }, data: { label: 'Kühlbox' } },
        ]);
      });
      return capturingFromStore();
    });

    render(<BOMModal />);
    openBom();
    await clickPrint();

    await waitFor(() => expect(captureMock).toHaveBeenCalled());
    expect(openMock).not.toHaveBeenCalled();
  });
});

/**
 * Dritter Befund: `capturePlanImage` wählt das Bild nach `viewMode`
 * (`water` ⇒ waterNodes), während `verificationReportFor(nodes, edges)`
 * immer die ELEKTRIK prüft und `buildBom` beide Gewerke mischt.
 *
 * Im Wassermodus entstünde ein Dokument mit Wasser-Schaltplan und
 * Elektrik-Prüfbericht — ohne jede Kennzeichnung. Zusätzlich deckt der
 * Elektrik-Fingerprint Wasseränderungen überhaupt nicht ab.
 */
describe('Druckbericht — Gewerk-Zuordnung im Wassermodus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openMock.mockReturnValue(true);
    captureMock.mockImplementation(capturingFromStore);
    seedPlan();
    act(() => {
      usePlannerStore
        .getState()
        .setWaterNodes([
          { id: 'w1', type: 'freshTank', position: { x: 0, y: 0 }, data: { label: 'Frischwasser' } },
        ]);
      usePlannerStore.getState().setWaterEdges([]);
      usePlannerStore.getState().setViewMode('water');
    });
  });

  it('nennt das Gewerk des aufgenommenen Bildes im Dokument', async () => {
    render(<BOMModal />);
    openBom();
    await clickPrint();

    await waitFor(() => expect(openMock).toHaveBeenCalledTimes(1));
    const html = openMock.mock.calls[0]![0] as string;
    // Das Dokument muss sagen, dass der Schaltplan das WASSER-Gewerk zeigt
    // und die Prüfung die ELEKTRIK betrifft.
    expect(html).toMatch(/Wasser/);
  });

  it('erkennt eine Wasseränderung während der Aufnahme', async () => {
    captureMock.mockImplementation(async () => {
      act(() => {
        usePlannerStore.getState().setWaterNodes([
          { id: 'w1', type: 'freshTank', position: { x: 0, y: 0 }, data: { label: 'Frischwasser' } },
          { id: 'w2', type: 'pump', position: { x: 300, y: 0 }, data: { label: 'Pumpe' } },
        ]);
      });
      return capturingFromStore();
    });

    render(<BOMModal />);
    openBom();
    await clickPrint();

    await waitFor(() => expect(captureMock).toHaveBeenCalled());
    expect(openMock).not.toHaveBeenCalled();
  });
});

/**
 * Druckfenster und Nutzeraktivierung.
 *
 * Browser binden `window.open` an eine laufende Nutzeraktivierung. Die
 * Aufnahme wartet auf Importe, einen Frame und toPng — bei großen Plänen
 * länger als das Aktivierungsfenster. Das Fenster muss deshalb synchron im
 * Klick aufgehen und darf bei einem Abbruch nicht als leere Seite zurückbleiben.
 */
describe('Druckbericht — Fenster und Nutzeraktivierung', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openMock.mockReturnValue(true);
    windowMock.mockReturnValue(fakeWindow);
    captureMock.mockImplementation(capturingFromStore);
    act(() => {
      usePlannerStore.getState().setViewMode('electric');
      usePlannerStore.getState().setWaterNodes([]);
      usePlannerStore.getState().setWaterEdges([]);
    });
    seedPlan();
  });

  it('öffnet das Fenster VOR der asynchronen Aufnahme', async () => {
    let windowOpenAtCapture = false;
    captureMock.mockImplementation(async () => {
      windowOpenAtCapture = windowMock.mock.calls.length > 0;
      return capturingFromStore();
    });

    render(<BOMModal />);
    openBom();
    await clickPrint();

    await waitFor(() => expect(openMock).toHaveBeenCalled());
    expect(windowOpenAtCapture).toBe(true);
  });

  it('schließt das Fenster wieder, wenn der Plan während der Aufnahme wechselt', async () => {
    captureMock.mockImplementation(async () => {
      act(() => {
        usePlannerStore.getState().setNodes([
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Batterie' } },
          { id: 'c1', type: 'consumer', position: { x: 400, y: 0 }, data: { label: 'Neu' } },
        ]);
      });
      return capturingFromStore();
    });

    render(<BOMModal />);
    openBom();
    await clickPrint();

    await waitFor(() => expect(closeSpy).toHaveBeenCalled());
    expect(openMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('bom-report-error')).toHaveTextContent(/kein Dokument erzeugt|nicht.*mischen/i);
  });

  it('meldet einen blockierten Pop-up, ohne die Aufnahme zu starten', async () => {
    windowMock.mockReturnValue(null);

    render(<BOMModal />);
    openBom();
    await clickPrint();

    await waitFor(() => expect(screen.getByTestId('bom-report-error')).toHaveTextContent(/Pop-ups/i));
    expect(captureMock).not.toHaveBeenCalled();
    expect(openMock).not.toHaveBeenCalled();
  });

  it('erzeugt trotz fehlgeschlagener Aufnahme ein Dokument, das den Grund benennt', async () => {
    captureMock.mockRejectedValue(new Error('Canvas blockiert'));

    render(<BOMModal />);
    openBom();
    await clickPrint();

    await waitFor(() => expect(openMock).toHaveBeenCalledTimes(1));
    const html = openMock.mock.calls[0]![0] as string;
    expect(html).toMatch(/Aufnahme fehlgeschlagen/);
    expect(html).toMatch(/kein Schaltplanbild/);
    expect(closeSpy).not.toHaveBeenCalled();
  });
});

/**
 * Langsames Rendering / große Pläne.
 *
 * Die Nutzeraktivierung ist nach wenigen Sekunden abgelaufen. Entscheidend
 * ist deshalb nicht, WIE LANGE die Aufnahme dauert, sondern dass das Fenster
 * schon offen ist, bevor sie beginnt. Der Test hält die Aufnahme kontrolliert an und
 * prüft genau diese Reihenfolge — ohne echte Wartezeit.
 */
describe('Druckbericht — langsame Aufnahme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openMock.mockReturnValue(true);
    windowMock.mockReturnValue(fakeWindow);
    act(() => {
      usePlannerStore.getState().setViewMode('electric');
      usePlannerStore.getState().setWaterNodes([]);
      usePlannerStore.getState().setWaterEdges([]);
    });
    seedPlan();
  });

  it('Fenster ist offen, bevor die Aufnahme beginnt — auch wenn sie lange dauert', async () => {
    let finish: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let windowOpenBeforeCapture = false;
    captureMock.mockImplementation(async () => {
      windowOpenBeforeCapture = windowMock.mock.calls.length === 1;
      await gate; // beliebig lang — hier kontrolliert freigegeben
      return capturingFromStore();
    });

    render(<BOMModal />);
    openBom();
    await clickPrint();

    // Die Aufnahme hängt, das Fenster ist bereits da.
    await waitFor(() => expect(captureMock).toHaveBeenCalled());
    expect(windowOpenBeforeCapture).toBe(true);
    expect(openMock).not.toHaveBeenCalled();

    finish!();
    await waitFor(() => expect(openMock).toHaveBeenCalledTimes(1));
    expect(closeSpy).not.toHaveBeenCalled();
  });
});
