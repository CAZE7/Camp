import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlannerDashboard } from './PlannerDashboard';
import { toPng } from 'html-to-image';

// --- Mocks ---

// Mock html-to-image (lazy-imported by the dashboard)
vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,mocked')
}));

// Mock Planner Store
const mockSetViewMode = vi.fn();
const mockSetSeason = vi.fn();
const mockExportBOM = vi.fn();
const mockAutoWireSystem = vi.fn();
const mockCheckSchematic = vi.fn();
const mockOnLayout = vi.fn();

vi.mock('../../store/usePlannerStore', () => ({
  usePlannerStore: vi.fn((selector) => {
    const state = {
      viewMode: 'electric',
      setViewMode: mockSetViewMode,
      season: 'summer',
      setSeason: mockSetSeason,
      exportBOM: mockExportBOM,
      autoWireSystem: mockAutoWireSystem,
      checkSchematic: mockCheckSchematic,
      onLayout: mockOnLayout,
      systemMessage: null,
      setSystemMessage: vi.fn(),
      focusElement: vi.fn(),
      nodes: [],
      edges: [],
      waterNodes: [],
      waterEdges: [],
    };
    return selector(state);
  })
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
    expect(screen.getByText('Elektrik-Schaltplan')).toBeInTheDocument();
    expect(screen.getByText('Wasser & Sanitär')).toBeInTheDocument();
    // Primary action is always visible
    expect(screen.getByText(/Auto-Wire/)).toBeInTheDocument();

    // Secondary actions live in the overflow menu
    openMoreMenu();
    expect(screen.getByText(/Stückliste/)).toBeInTheDocument();
    expect(screen.getByText(/KI-Check/)).toBeInTheDocument();
    expect(screen.getByText(/Aufräumen/)).toBeInTheDocument();
    expect(screen.getByText(/Bild Export/)).toBeInTheDocument();
    expect(screen.getByText(/Sommer/)).toBeInTheDocument();
    expect(screen.getByText(/Winter/)).toBeInTheDocument();

    // The Pro-Mode switch has been removed entirely
    expect(screen.queryByText(/Profi-Modus/)).not.toBeInTheDocument();
  });

  it('calls setViewMode when changing view mode', () => {
    render(<PlannerDashboard />);

    fireEvent.click(screen.getByText('Wasser & Sanitär'));
    expect(mockSetViewMode).toHaveBeenCalledWith('water');

    fireEvent.click(screen.getByText('Elektrik-Schaltplan'));
    expect(mockSetViewMode).toHaveBeenCalledWith('electric');
  });

  it('calls setSeason when changing season', () => {
    render(<PlannerDashboard />);

    // Season buttons live in the overflow menu and keep it open after a click
    openMoreMenu();
    fireEvent.click(screen.getByText(/Winter/));
    expect(mockSetSeason).toHaveBeenCalledWith('winter');

    fireEvent.click(screen.getByText(/Sommer/));
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

  it('dispatches show-bom-modal and calls exportBOM when clicking Stückliste', async () => {
    render(<PlannerDashboard />);
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    openMoreMenu();
    fireEvent.click(screen.getByText(/Stückliste/));

    expect(mockExportBOM).toHaveBeenCalledTimes(1);

    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('show-bom-modal');
  });

  it('calls autoWireSystem with no args when clicking the primary Auto-Wire action', () => {
    render(<PlannerDashboard />);

    fireEvent.click(screen.getByText(/Auto-Wire/));

    expect(mockAutoWireSystem).toHaveBeenCalledTimes(1);
    expect(mockAutoWireSystem).toHaveBeenCalledWith();
  });

  it('calls checkSchematic when clicking KI-Check', () => {
    render(<PlannerDashboard />);

    openMoreMenu();
    fireEvent.click(screen.getByText(/KI-Check/));

    expect(mockCheckSchematic).toHaveBeenCalledTimes(1);
  });

  it('calls onLayout with no args when clicking Aufräumen', () => {
    render(<PlannerDashboard />);

    openMoreMenu();
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
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const el = originalCreateElement(tagName, options);
      if (tagName === 'a') {
        Object.defineProperty(el, 'download', {
          get: () => mockLink.download,
          set: (val) => mockLink.download = val,
        });
        Object.defineProperty(el, 'href', {
          get: () => mockLink.href,
          set: (val) => mockLink.href = val,
        });
        el.click = mockLink.click;
      }
      return el;
    });

    render(<PlannerDashboard />);

    openMoreMenu();
    fireEvent.click(screen.getByText(/Bild Export/));

    await waitFor(() => {
      expect(toPng).toHaveBeenCalledWith(mockReactFlowElem, expect.any(Object));
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockLink.download).toBe('schaltplan.png');
      expect(mockLink.href).toBe('data:image/png;base64,mocked');
      expect(mockLink.click).toHaveBeenCalledTimes(1);
    });

    document.body.removeChild(mockReactFlowElem);
    createElementSpy.mockRestore();
  });

  it('does not export image if react flow wrapper is not found', async () => {
    const existingElements = document.querySelectorAll('.react-flow');
    existingElements.forEach(el => document.body.removeChild(el));

    vi.mocked(toPng).mockClear();

    render(<PlannerDashboard />);

    openMoreMenu();
    fireEvent.click(screen.getByText(/Bild Export/));

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
    fireEvent.click(screen.getByText(/Bild Export/));

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

  it('logs an error if image export fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockReactFlowElem = document.createElement('div');
    mockReactFlowElem.className = 'react-flow';
    document.body.appendChild(mockReactFlowElem);

    (toPng as unknown as any).mockRejectedValueOnce(new Error('Export failed'));

    render(<PlannerDashboard />);

    openMoreMenu();
    fireEvent.click(screen.getByText(/Bild Export/));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to export image', expect.any(Error));
    });

    consoleErrorSpy.mockRestore();
    document.body.removeChild(mockReactFlowElem);
  });
});
