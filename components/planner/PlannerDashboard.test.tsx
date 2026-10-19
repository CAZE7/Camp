import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlannerDashboard } from './PlannerDashboard';
import { toPng } from 'html-to-image';

// --- Mocks ---

// Mock html-to-image (lazy-imported by the dashboard)
vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,mocked'),
}));

// Nachtest N2: Die Schrittleiste ist ausgeblendet, solange die Einführung
// offen ist. Diese Suite testet den Zustand NACH der Einführung.
let mockHasOnboarded = true;
vi.mock('../../lib/store', () => ({
  useAppStore: vi.fn((selector: (state: { hasOnboarded: boolean }) => unknown) =>
    selector({ hasOnboarded: mockHasOnboarded })
  ),
}));

// Mock Planner Store
const mockSetViewMode = vi.fn();
const mockSetSeason = vi.fn();
const mockAutoWireSystem = vi.fn();
const mockOnLayout = vi.fn();
const mockOnLayoutV2 = vi.fn().mockResolvedValue({ applied: true, engine: 'elk' });
const mockUndo = vi.fn();
const mockRedo = vi.fn();
const mockClearPlan = vi.fn();
const mockSetGuidedMode = vi.fn();
const mockFocusElement = vi.fn();
const mockEdges: Array<{ id: string; source: string; target: string; data: Record<string, unknown> }> = [];
let mockWaterWarning: string | null = null;
const mockLockedMutationErrors: Array<{
  code: 'ROUTING_LOCKED_MUTATION';
  severity: 'warning';
  category: 'routing';
  nodeIds: readonly string[];
  edgeIds: readonly string[];
  message: string;
  suggestedFix: string;
}> = [];

const planState = () => ({
  viewMode: 'electric',
  focusMode: false,
  guidedMode: true as boolean,
  nodes: [] as Array<{ id: string; type?: string; data: Record<string, unknown> }>,
  waterNodes: [] as Array<{ id: string; type?: string; data: Record<string, unknown> }>,
  focusElement: mockFocusElement,
  deleteSelected: vi.fn(),
});
const mockState = planState();

vi.mock('../../store/usePlannerStore', () => ({
  // AUDIT T1: Der Mock-Zustand ist ein Test-Double eigener Form — der
  // Selektor bekommt `unknown`, damit Aufruf und Rückgabe nicht `any` sind.
  usePlannerStore: Object.assign(
    vi.fn((selector: (state: unknown) => unknown) => {
      const state = {
        viewMode: mockState.viewMode,
        setViewMode: mockSetViewMode,
        season: 'summer',
        setSeason: mockSetSeason,
        autoWireSystem: mockAutoWireSystem,
        onLayout: mockOnLayout,
        onLayoutV2: mockOnLayoutV2,
        systemMessage: null,
        setSystemMessage: vi.fn(),
        focusElement: mockFocusElement,
        nodes: mockState.nodes,
        edges: mockEdges,
        waterNodes: mockState.waterNodes,
        waterEdges: [],
        waterWarning: mockWaterWarning,
        undo: mockUndo,
        redo: mockRedo,
        canUndo: true,
        canRedo: true,
        clearPlan: mockClearPlan,
        guidedMode: mockState.guidedMode,
        setGuidedMode: mockSetGuidedMode,
        // Auto-Wire-Report + PlannerError-Mapper (Sync aus useLiveValidation → Store)
        autoWireReport: null,
        plannerErrors: [],
        lockedMutationErrors: mockLockedMutationErrors,
        setPlannerErrors: vi.fn(),
        addPlannerError: vi.fn(),
        clearPlannerErrors: vi.fn(),
        //chrome-leiste: Werkzeug-/Ansichtszustände
        focusMode: mockState.focusMode,
        setFocusMode: vi.fn(),
        detailLevel: 'detail',
        setDetailLevel: vi.fn(),
        trunkMode: false,
        setTrunkMode: vi.fn(),
        backboneGrouping: true,
        setBackboneGrouping: vi.fn(),
        isSidebarOpen: true,
        setSidebarOpen: vi.fn(),
        toggleSidebar: vi.fn(),
        isInspectorOpen: true,
        setInspectorOpen: vi.fn(),
        toggleInspector: vi.fn(),
        deleteSelected: vi.fn(),
      };
      return selector(state);
    }),
    // Der Export-Pfad liest den Store direkt (`getState`) — der Doppel-Staat
    // muss auch diesen Zugang bedienen, sonst wäre der Test eine Attrappe.
    { getState: () => mockState }
  ),
}));

// Helper to open the overflow ("Mehr") menu where secondary actions live
const openMoreMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Weitere Aktionen' }));
};

// Helper to open one of the menubar menus (Datei … Hilfe)
const openMenu = (id: 'datei' | 'bearbeiten' | 'ansicht' | 'werkzeuge' | 'planung' | 'hilfe') => {
  fireEvent.click(screen.getByTestId(`menubar-${id}`));
};

describe('PlannerDashboard - Core Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.guidedMode = true;
    mockState.nodes = [];
    mockState.waterNodes = [];
    mockState.viewMode = 'electric';
    mockWaterWarning = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders default UI elements correctly', () => {
    render(<PlannerDashboard />);

    // View toggles
    expect(screen.getByText('Elektrik')).toBeInTheDocument();
    expect(screen.getByText('Wasser')).toBeInTheDocument();
    // Guided mode shows exactly the next step; AutoWire stays available in
    // the overflow and does not compete with the guided primary action.
    expect(screen.getByTestId('guided-primary-action')).toHaveTextContent('Batterie hinzufügen');
    expect(screen.queryByTestId('action-autowire')).not.toBeInTheDocument();

    // Expert actions remain reachable in the overflow menu.
    openMoreMenu();
    expect(screen.getByRole('menuitem', { name: /Auto-verbinden — Vorschlag prüfen/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Stückliste/ })).toBeInTheDocument();
    expect(screen.getByText(/Plan prüfen/)).toBeInTheDocument();
    expect(screen.getAllByText(/Aufräumen/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Bild exportieren/)).toBeInTheDocument();
    openMenu('planung');
    expect(screen.getByRole('menuitem', { name: 'Sommer' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Winter' })).toBeInTheDocument();

    // Der Pro-Modus-Schalter wurde entfernt; Fachdetails sind immer sichtbar.
  });

  it('supports keyboard navigation and focus restoration in the overflow menu', () => {
    render(<PlannerDashboard />);
    const trigger = screen.getByRole('button', { name: 'Weitere Aktionen' });
    fireEvent.click(trigger);

    const menu = screen.getByRole('menu', { name: 'Weitere Aktionen' });
    const items = within(menu)
      .getAllByRole('menuitem')
      .filter((item) => !(item as HTMLButtonElement).disabled);
    const firstItem = items[0];
    const secondItem = items[1];
    const lastItem = items[items.length - 1];
    if (!firstItem || !secondItem || !lastItem)
      throw new Error('Overflow menu must have at least two actions.');
    expect(firstItem).toHaveFocus();

    fireEvent.keyDown(firstItem, { key: 'ArrowDown' });
    expect(secondItem).toHaveFocus();
    fireEvent.keyDown(secondItem, { key: 'End' });
    expect(lastItem).toHaveFocus();

    fireEvent.keyDown(lastItem, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'Weitere Aktionen' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes the overflow menu when its trigger is clicked again', () => {
    render(<PlannerDashboard />);
    const trigger = screen.getByRole('button', { name: 'Weitere Aktionen' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu', { name: 'Weitere Aktionen' })).toBeInTheDocument();

    // Model the browser moving focus from a menu item to its trigger on pointer activation.
    fireEvent.mouseDown(trigger);
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.queryByRole('menu', { name: 'Weitere Aktionen' })).not.toBeInTheDocument();
  });

  it('supports keyboard navigation and focus restoration in menubar menus', () => {
    render(<PlannerDashboard />);
    const trigger = screen.getByTestId('menubar-planung');
    fireEvent.click(trigger);

    const menu = screen.getByRole('menu', { name: 'Menü' });
    const items = within(menu)
      .getAllByRole('menuitem')
      .filter((item) => !(item as HTMLButtonElement).disabled);
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    if (!firstItem || !lastItem) throw new Error('Menubar menu must have at least one action.');
    expect(firstItem).toHaveFocus();

    fireEvent.keyDown(firstItem, { key: 'ArrowUp' });
    expect(lastItem).toHaveFocus();
    fireEvent.keyDown(lastItem, { key: 'Escape' });

    expect(screen.queryByRole('menu', { name: 'Menü' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes a menubar dropdown when its trigger is clicked again', () => {
    render(<PlannerDashboard />);
    const trigger = screen.getByTestId('menubar-planung');
    fireEvent.click(trigger);
    expect(screen.getByRole('menu', { name: 'Menü' })).toBeInTheDocument();

    fireEvent.mouseDown(trigger);
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.queryByRole('menu', { name: 'Menü' })).not.toBeInTheDocument();
  });

  it('calls setViewMode when changing view mode', () => {
    render(<PlannerDashboard />);

    fireEvent.click(screen.getByText('Wasser'));
    expect(mockSetViewMode).toHaveBeenCalledWith('water');

    fireEvent.click(screen.getByText('Elektrik'));
    expect(mockSetViewMode).toHaveBeenCalledWith('electric');
  });

  it('calls setSeason when changing season', () => {
    render(<PlannerDashboard />);

    // Die Jahreszeit ist eine Planungsannahme und liegt im Menü „Planung“;
    // ein Menüpunkt schließt das Menü, deshalb wird es erneut geöffnet.
    openMenu('planung');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Winter' }));
    expect(mockSetSeason).toHaveBeenCalledWith('winter');

    openMenu('planung');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sommer' }));
    expect(mockSetSeason).toHaveBeenCalledWith('summer');
  });
});

describe('PlannerDashboard - Action Buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.guidedMode = true;
    mockState.nodes = [];
    mockState.waterNodes = [];
    mockState.viewMode = 'electric';
    mockWaterWarning = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches show-bom-modal when clicking Stückliste (BOM liest den Store selbst)', () => {
    render(<PlannerDashboard />);
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    openMoreMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /^Stückliste/ }));

    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const event = dispatchEventSpy.mock.calls[0]![0] as CustomEvent;
    expect(event.type).toBe('show-bom-modal');
  });

  it('hält den Prüfbericht im mobilen Werkzeugleisten-Statusbereich erreichbar', () => {
    mockState.nodes = [{ id: 'battery-1', type: 'battery', data: {} }];
    render(<PlannerDashboard />);

    const mobileAccess = screen.getByTestId('verification-seal-mobile-access');
    expect(mobileAccess.className).toContain('inline-flex');
    expect(mobileAccess.className).not.toContain('hidden');
    expect(within(mobileAccess).getByTestId('verification-seal-toggle')).toBeInTheDocument();
  });

  it('zählt elektrische Befunde nicht in der Wasseransicht', () => {
    mockState.viewMode = 'water';
    mockLockedMutationErrors.push({
      code: 'ROUTING_LOCKED_MUTATION',
      severity: 'warning',
      category: 'routing',
      nodeIds: [],
      edgeIds: ['electric-edge'],
      message: 'Elektrischer Befund gehört nicht in den Wasserbericht.',
      suggestedFix: 'Wechsle zur Elektrikansicht.',
    });

    render(<PlannerDashboard />);
    expect(screen.getByText('Keine Hinweise')).toBeInTheDocument();
    expect(screen.queryByText(/Elektrischer Befund/)).not.toBeInTheDocument();
    mockLockedMutationErrors.splice(0);
  });

  it('öffnet Fachwissen sowohl über das Hilfemenü als auch über die Werkzeugleiste', () => {
    const helpMenuRender = render(<PlannerDashboard />);
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    openMenu('hilfe');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hilfe & Fachwissen' }));
    expect(dispatchEventSpy.mock.calls.map(([event]) => (event as Event).type)).toContain(
      'planner-open-expert-panel'
    );

    helpMenuRender.unmount();
    render(<PlannerDashboard />);
    openMoreMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hilfe & Fachwissen' }));
    expect(dispatchEventSpy.mock.calls.map(([event]) => (event as Event).type)).toEqual([
      'planner-open-expert-panel',
      'planner-open-expert-panel',
    ]);
  });

  it('calls autoWireSystem from the toolbar primary action in expert mode', () => {
    mockState.guidedMode = false;
    render(<PlannerDashboard />);

    fireEvent.click(screen.getByText(/Automatisch verbinden/));

    expect(mockAutoWireSystem).toHaveBeenCalledTimes(1);
    expect(mockAutoWireSystem).toHaveBeenCalledWith();
  });

  it('öffnet die Warn-Zentrale bei vorhandenen Hinweisen statt eines toten Events', () => {
    render(<PlannerDashboard />);
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    openMoreMenu();
    fireEvent.click(screen.getByText(/Plan prüfen/));

    // Kein 'check-schematic'-Dispatch mehr (hatte nie einen Listener).
    const types = dispatchEventSpy.mock.calls.map((call) => (call[0] as CustomEvent).type);
    expect(types).not.toContain('check-schematic');
  });

  it('calls onLayout with no args when clicking Aufräumen', () => {
    render(<PlannerDashboard />);

    // UX-Reset: „Aufräumen" ist keine Toolbar-Aktion mehr (drei Layout-Begriffe
    // nebeneinander) — erreichbar bleibt sie im ⋯-Menü.
    openMoreMenu();
    fireEvent.click(screen.getByText(/Aufräumen/));

    expect(mockOnLayout).toHaveBeenCalledTimes(1);
    expect(mockOnLayout).toHaveBeenCalledWith();
  });

  /**
   * AUDIT ROUTE-003 / ADR 0018: Der ELK-Pass muss ein erreichbarer
   * Produktivpfad sein — der Befund war „Modul fertig, UI tot". Dieser
   * Test verankert die Verdrahtung, damit er es bleibt.
   */
  it('calls onLayoutV2 when clicking Strukturieren (ELK) and reports the engine', async () => {
    render(<PlannerDashboard />);

    openMoreMenu();
    fireEvent.click(screen.getByTestId('action-layout-v2-menu'));

    expect(mockOnLayoutV2).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText(/Plan mit ELK global strukturiert/)).toBeInTheDocument());
  });

  it('reports the Dagre fallback honestly instead of claiming ELK', async () => {
    mockOnLayoutV2.mockResolvedValueOnce({ applied: true, engine: 'dagre' });
    render(<PlannerDashboard />);

    openMoreMenu();
    fireEvent.click(screen.getByTestId('action-layout-v2-menu'));

    await waitFor(() => expect(screen.getByText(/Dagre-Fallback/)).toBeInTheDocument());
  });

  it('dispatches planner-fit-view when clicking the Übersicht (fit view) action', () => {
    render(<PlannerDashboard />);
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    // Die Übersicht wanderte aus der Toolbar ins ⋯-Menü: Der Canvas trägt
    // dieselbe Aktion bereits als Zoom-Steuerung („Ganzen Plan einpassen").
    openMoreMenu();
    fireEvent.click(screen.getByText(/^Gesamtübersicht$/));

    const dispatched = dispatchEventSpy.mock.calls.map((c) => (c[0] as CustomEvent).type);
    expect(dispatched).toContain('planner-fit-view');
  });

  /**
   * UX-Reset 2026-09: Die Toolbar darf nicht drei Layout-Begriffe
   * gleichzeitig anbieten („Übersicht / Aufräumen / Strukturieren (ELK)").
   * Sichtbar bleibt EIN „Plan ordnen"; die Einzelaktionen leben im ⋯-Menü.
   */
  it('bietet genau eine Layout-Aktion in der Toolbar an und ordnet den Plan', async () => {
    mockState.guidedMode = false;
    render(<PlannerDashboard />);

    expect(screen.getByTestId('action-tidy')).toHaveTextContent('Plan ordnen');
    expect(screen.queryByText('Strukturieren (ELK)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('action-tidy'));

    expect(mockOnLayoutV2).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText(/Plan mit ELK global strukturiert/)).toBeInTheDocument());
  });

  /**
   * UX-Reset 2026-09 (Priorität 1): Der Planer sagt, was als Nächstes zu tun
   * ist — die Schrittleiste zeigt den ersten offenen Schritt und dessen
   * Primäraktion, statt den Nutzer den Werkzeugkasten lesen zu lassen.
   */
  it('führt im geführten Modus mit dem ersten offenen Schritt', () => {
    render(<PlannerDashboard />);

    const rail = screen.getByTestId('guided-rail');
    expect(rail).toBeInTheDocument();
    // Leerer Plan: Schritt 1 (Anlage/Batterie) ist der aktuelle Schritt.
    expect(screen.getByTestId('guided-step-define')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText(/Schritt 1 von 5/)).toBeInTheDocument();
  });

  it('bietet schon im ersten Schritt eine ausführbare Aktion an', () => {
    render(<PlannerDashboard />);
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    // Eine Leiste ohne Knopf beantwortet „Was jetzt?" nicht — Schritt 1 öffnet
    // den Bauteilkatalog, statt nur zu zählen.
    const primary = screen.getByTestId('guided-primary-action');
    expect(primary).toHaveTextContent('Batterie hinzufügen');

    fireEvent.click(primary);
    const dispatched = dispatchEventSpy.mock.calls.map((call) => (call[0] as CustomEvent).type);
    expect(dispatched).toContain('planner-open-catalog');
  });

  it('schaltet über den Expertenmodus die Schrittleiste ab', () => {
    render(<PlannerDashboard />);

    fireEvent.click(screen.getByTestId('guided-expert-toggle'));

    expect(mockSetGuidedMode).toHaveBeenCalledWith(false);
  });
});

describe('PlannerDashboard - Mission 3 feedback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows tablet undo/redo controls with explicit disabled-capable targets', () => {
    render(<PlannerDashboard />);
    expect(screen.getByTestId('toolbar-undo')).toHaveClass('md:inline-flex');
    expect(screen.getByTestId('toolbar-redo')).toHaveClass('md:inline-flex');
  });

  it('shows a saved indicator on every viewport', () => {
    render(<PlannerDashboard />);
    const indicator = screen.getByTestId('save-indicator');
    expect(indicator).toHaveAttribute('role', 'status');
    expect(indicator.getAttribute('aria-label')).toMatch(/Zuletzt gespeichert/);
    expect(indicator.className).not.toContain('hidden');
  });

  it('offers a five-second undo action after clearing the plan', () => {
    render(<PlannerDashboard />);
    openMoreMenu();
    fireEvent.click(screen.getByText('Neuen leeren Plan starten'));
    fireEvent.click(screen.getByRole('button', { name: 'Plan leeren' }));
    expect(mockClearPlan).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('feedback-action'));
    expect(mockUndo).toHaveBeenCalledTimes(1);
  });
});

describe('PlannerDashboard - Image Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.guidedMode = true;
    mockState.nodes = [];
    mockState.waterNodes = [];
    mockState.viewMode = 'electric';
    mockWaterWarning = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls toPng and downloads image when clicking Bild Export', async () => {
    const mockReactFlowElem = document.createElement('div');
    mockReactFlowElem.className = 'react-flow';
    document.body.appendChild(mockReactFlowElem);

    const mockLink = {
      download: '',
      href: '',
      click: vi.fn(),
    };

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
        const el = originalCreateElement(tagName, options);
        if (tagName === 'a') {
          Object.defineProperty(el, 'download', {
            get: () => mockLink.download,
            set: (val: string) => (mockLink.download = val),
          });
          Object.defineProperty(el, 'href', {
            get: () => mockLink.href,
            set: (val: string) => (mockLink.href = val),
          });
          el.click = mockLink.click;
        }
        return el;
      });

    render(<PlannerDashboard />);

    openMoreMenu();
    fireEvent.click(screen.getByText(/Bild exportieren/));

    await waitFor(() => {
      expect(toPng).toHaveBeenCalledWith(mockReactFlowElem, expect.any(Object));
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockLink.download).toBe('werft-schaltplan.png');
      expect(mockLink.href).toBe('data:image/png;base64,mocked');
      expect(mockLink.click).toHaveBeenCalledTimes(1);
    });

    document.body.removeChild(mockReactFlowElem);
    createElementSpy.mockRestore();
  });

  it('does not export image if react flow wrapper is not found', async () => {
    const existingElements = document.querySelectorAll('.react-flow');
    existingElements.forEach((el) => document.body.removeChild(el));

    vi.mocked(toPng).mockClear();

    render(<PlannerDashboard />);

    openMoreMenu();
    fireEvent.click(screen.getByText(/Bild exportieren/));

    // Dem dynamischen Import einen Tick Zeit geben — in act(), weil der
    // Export-Handler asynchron Zustand setzt (sonst Update außerhalb des
    // Test-Rahmens).
    await act(async () => {
      await Promise.resolve();
    });
    expect(toPng).not.toHaveBeenCalled();
  });

  it('filters out specific elements during image export', async () => {
    const mockReactFlowElem = document.createElement('div');
    mockReactFlowElem.className = 'react-flow';
    document.body.appendChild(mockReactFlowElem);

    render(<PlannerDashboard />);

    openMoreMenu();
    fireEvent.click(screen.getByText(/Bild exportieren/));

    await waitFor(() => {
      expect(toPng).toHaveBeenCalled();
    });

    const [, pngOptions] = vi.mocked(toPng).mock.calls[0]!;
    const filterFunc = (pngOptions as { filter?: (el: HTMLElement) => boolean }).filter!;

    const validNode = document.createElement('div');
    expect(filterFunc(validNode)).toBe(true);

    const panelNode = document.createElement('div');
    panelNode.classList.add('react-flow__panel');
    expect(filterFunc(panelNode)).toBe(false);

    const controlsNode = document.createElement('div');
    controlsNode.classList.add('react-flow__controls');
    expect(filterFunc(controlsNode)).toBe(false);

    const minimapNode = document.createElement('div');
    minimapNode.classList.add('react-flow__minimap');
    expect(filterFunc(minimapNode)).toBe(false);

    document.body.removeChild(mockReactFlowElem);
  });

  it('zeigt einen sichtbaren Fehler, wenn der Bild-Export scheitert (M6-4)', async () => {
    // Regressionstest: der Export-Fehler war vorher NUR ein console.error —
    // für Nutzer unsichtbar. Jetzt erscheint eine role=alert-Meldung, und
    // console.error wird bewusst nicht mehr verwendet.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockReactFlowElem = document.createElement('div');
    mockReactFlowElem.className = 'react-flow';
    document.body.appendChild(mockReactFlowElem);

    const error = new Error('Export failed');
    error.name = 'SecurityError';
    vi.mocked(toPng).mockRejectedValueOnce(error);

    render(<PlannerDashboard />);

    openMoreMenu();
    fireEvent.click(screen.getByText(/Bild exportieren/));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    // leerer Plan (Mock-State): die kontextbezogene Erste-Meldung greift vor
    // der SecurityError-Klasse — beides sind Nutzer-sichtbare Pfade.
    expect(screen.getByRole('alert').textContent).toMatch(/Nichts zu exportieren|Export blockiert/);
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    document.body.removeChild(mockReactFlowElem);
  });
});

describe('Warnungs-Deduplizierung (M11-1)', () => {
  it('dupliziert die RCD-Regel nicht — kanonisch ist nur missing-rcd-* aus useLiveValidation', () => {
    // Früher meldete der Dashboard-Memo dieselbe Landstrom-Warnung ein zweites
    // Mal (id `rcd-${node.id}`) — doppelte Karten im Zentrum, driftende
    // Warnhinweise (WarningCenter spezialbehandelte nur die Duplikat-ID).
    const src = readFileSync(resolve(process.cwd(), 'components/planner/PlannerDashboard.tsx'), 'utf8');
    expect(src).not.toMatch(/id: `rcd-\$\{/);
    expect(src).not.toContain("type === 'shorePower'");
  });
});

describe('blockierte Änderungen an fixierten Leitungen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEdges.splice(0);
    mockLockedMutationErrors.splice(0);
  });

  it('zeigt den strukturierten Store-Befund anklickbar im WarningCenter', () => {
    mockEdges.push({
      id: 'edge-locked',
      source: 'battery',
      target: 'fuse',
      data: {
        locked: true,
        intent: 'locked',
        lockedWaypoints: [
          { x: 10, y: 20 },
          { x: 80, y: 20 },
        ],
      },
    });
    mockLockedMutationErrors.push({
      code: 'ROUTING_LOCKED_MUTATION',
      severity: 'warning',
      category: 'routing',
      nodeIds: ['battery'],
      edgeIds: ['edge-locked'],
      message: 'Änderung an fixierter Leitung wurde blockiert.',
      suggestedFix: 'Leitung entsperren, bevor sie geändert wird.',
    });

    render(<PlannerDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /Planungsprüfung öffnen/ }));

    const finding = screen.getByText('Änderung an fixierter Leitung blockiert').closest('li');
    expect(finding).not.toBeNull();
    fireEvent.click(within(finding as HTMLElement).getByRole('button', { name: 'Im Plan zeigen' }));
    expect(mockFocusElement).toHaveBeenCalledWith('edge-locked', 'edge');
  });
});
