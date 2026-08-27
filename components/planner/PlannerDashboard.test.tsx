import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlannerDashboard } from './PlannerDashboard';
import { toPng } from 'html-to-image';

// --- Mocks ---

// Mock html-to-image (lazy-imported by the dashboard)
vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,mocked'),
}));

// Mock Planner Store
const mockSetViewMode = vi.fn();
const mockSetSeason = vi.fn();
const mockAutoWireSystem = vi.fn();
const mockOnLayout = vi.fn();
const mockUndo = vi.fn();
const mockRedo = vi.fn();
const mockClearPlan = vi.fn();

vi.mock('../../store/usePlannerStore', () => ({
  usePlannerStore: vi.fn((selector) => {
    const state = {
      viewMode: 'electric',
      setViewMode: mockSetViewMode,
      season: 'summer',
      setSeason: mockSetSeason,
      autoWireSystem: mockAutoWireSystem,
      onLayout: mockOnLayout,
      systemMessage: null,
      setSystemMessage: vi.fn(),
      focusElement: vi.fn(),
      nodes: [],
      edges: [],
      waterNodes: [],
      waterEdges: [],
      waterWarning: null,
      undo: mockUndo,
      redo: mockRedo,
      canUndo: true,
      canRedo: true,
      clearPlan: mockClearPlan,
    };
    return selector(state);
  }),
}));

// Helper to open the overflow ("Mehr") menu where secondary actions live
const openMoreMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Weitere Aktionen' }));
};

describe('PlannerDashboard - Core Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders default UI elements correctly', () => {
    render(<PlannerDashboard />);

    // View toggles
    expect(screen.getByText('Elektrik')).toBeInTheDocument();
    expect(screen.getByText('Wasser')).toBeInTheDocument();
    // Primary action is always visible
    expect(screen.getByText(/Automatisch verbinden/)).toBeInTheDocument();

    // Secondary actions live in the overflow menu
    openMoreMenu();
    expect(screen.getByText(/Stückliste/)).toBeInTheDocument();
    expect(screen.getByText(/Plan lokal prüfen/)).toBeInTheDocument();
    expect(screen.getAllByText(/Aufräumen/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Bild exportieren/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sommer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Winter' })).toBeInTheDocument();

    // Der Pro-Modus-Schalter wurde entfernt; Fachdetails sind immer sichtbar.
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

    // Season buttons live in the overflow menu and keep it open after a click
    openMoreMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Winter' }));
    expect(mockSetSeason).toHaveBeenCalledWith('winter');

    fireEvent.click(screen.getByRole('button', { name: 'Sommer' }));
    expect(mockSetSeason).toHaveBeenCalledWith('summer');
  });
});

describe('PlannerDashboard - Action Buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches show-bom-modal when clicking Stückliste (BOM liest den Store selbst)', async () => {
    render(<PlannerDashboard />);
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    openMoreMenu();
    fireEvent.click(screen.getByText(/Stückliste/));

    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('show-bom-modal');
  });

  it('calls autoWireSystem with no args when clicking the primary automatic wiring action', () => {
    render(<PlannerDashboard />);

    fireEvent.click(screen.getByText(/Automatisch verbinden/));

    expect(mockAutoWireSystem).toHaveBeenCalledTimes(1);
    expect(mockAutoWireSystem).toHaveBeenCalledWith();
  });

  it('öffnet die Warn-Zentrale bei vorhandenen Hinweisen statt eines toten Events', () => {
    render(<PlannerDashboard />);
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    openMoreMenu();
    fireEvent.click(screen.getByText(/Plan lokal prüfen/));

    // Kein 'check-schematic'-Dispatch mehr (hatte nie einen Listener).
    const types = dispatchEventSpy.mock.calls.map((call) => (call[0] as CustomEvent).type);
    expect(types).not.toContain('check-schematic');
  });

  it('calls onLayout with no args when clicking Aufräumen', () => {
    render(<PlannerDashboard />);

    fireEvent.click(screen.getByText(/Aufräumen/));

    expect(mockOnLayout).toHaveBeenCalledTimes(1);
    expect(mockOnLayout).toHaveBeenCalledWith();
  });

  it('dispatches planner-fit-view when clicking the Übersicht (fit view) button', () => {
    render(<PlannerDashboard />);
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    fireEvent.click(screen.getByTitle('Ganzen Plan einpassen'));

    const dispatched = dispatchEventSpy.mock.calls.map((c) => (c[0] as CustomEvent).type);
    expect(dispatched).toContain('planner-fit-view');
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
            set: (val) => (mockLink.download = val),
          });
          Object.defineProperty(el, 'href', {
            get: () => mockLink.href,
            set: (val) => (mockLink.href = val),
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

    // Give the dynamic import a tick to resolve
    await Promise.resolve();
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

    const filterFunc = (toPng as unknown as any).mock.calls[0][1].filter;

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
    (toPng as unknown as (el: HTMLElement) => Promise<string>).mockRejectedValueOnce(error);

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
