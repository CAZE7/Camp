import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlannerDashboard } from './PlannerDashboard';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useAppStore } from '../../lib/store';
import { toPng } from 'html-to-image';

// --- Mocks ---

// Mock html-to-image
vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,mocked')
}));

// Mock React Flow
const mockFitView = vi.fn();
vi.mock('reactflow', () => ({
  useReactFlow: () => ({
    fitView: mockFitView
  })
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
    };
    return selector(state);
  })
}));

// Mock App Store
const mockToggleProMode = vi.fn();
vi.mock('../../lib/store', () => ({
  useAppStore: vi.fn(() => ({
    isProMode: false,
    toggleProMode: mockToggleProMode
  }))
}));

// Mock Dropdown Menu to avoid Radix UI complexities in JSDOM testing
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: { children: React.ReactNode, onClick: () => void, className?: string }) => (
    <button onClick={onClick} className={className} data-testid={`menu-item-${children?.toString().trim()}`}>
      {children}
    </button>
  ),
}));

describe('PlannerDashboard - Core Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders default UI elements correctly', () => {
    render(<PlannerDashboard />);

    // Check main buttons

    expect(screen.getByText('Elektrik-Schaltplan')).toBeInTheDocument();
    expect(screen.getByText('Wasser & Sanitär')).toBeInTheDocument();
    expect(screen.getByText('Aktionen')).toBeInTheDocument();
    expect(screen.getByText('Sommer')).toBeInTheDocument();
    expect(screen.getByText('Winter')).toBeInTheDocument();
    expect(screen.getByText('Profi-Modus Aus')).toBeInTheDocument();
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

    fireEvent.click(screen.getByText('Winter'));
    expect(mockSetSeason).toHaveBeenCalledWith('winter');

    fireEvent.click(screen.getByText('Sommer'));
    expect(mockSetSeason).toHaveBeenCalledWith('summer');
  });

  it('calls toggleProMode when clicking Profi-Modus', () => {
    render(<PlannerDashboard />);

    fireEvent.click(screen.getByText('Profi-Modus Aus'));
    expect(mockToggleProMode).toHaveBeenCalledTimes(1);
  });
});

describe('PlannerDashboard - Action Menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches show-bom-modal and calls exportBOM when clicking Stückliste', async () => {
    render(<PlannerDashboard />);
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    fireEvent.click(screen.getByTestId('menu-item-Stückliste an KI senden'));

    expect(mockExportBOM).toHaveBeenCalledTimes(1);

    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('show-bom-modal');
  });

  it('calls autoWireSystem with fitView when clicking Automatisch Verkabeln', () => {
    render(<PlannerDashboard />);

    fireEvent.click(screen.getByTestId('menu-item-Automatisch Verkabeln & Absichern'));

    expect(mockAutoWireSystem).toHaveBeenCalledWith(mockFitView);
  });

  it('calls checkSchematic when clicking Schaltplan prüfen', () => {
    render(<PlannerDashboard />);

    fireEvent.click(screen.getByTestId('menu-item-Schaltplan von KI prüfen lassen'));

    expect(mockCheckSchematic).toHaveBeenCalledTimes(1);
  });

  it('calls onLayout with fitView when clicking Schaltplan aufräumen', () => {
    render(<PlannerDashboard />);

    fireEvent.click(screen.getByTestId('menu-item-Schaltplan aufräumen'));

    expect(mockOnLayout).toHaveBeenCalledWith(mockFitView);
  });
});

describe('PlannerDashboard - Image Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls toPng and downloads image when clicking Als Bild speichern', async () => {
    // Setup fake react-flow DOM element to prevent early return
    const mockReactFlowElem = document.createElement('div');
    mockReactFlowElem.className = 'react-flow';
    document.body.appendChild(mockReactFlowElem);

    const mockLink = {
      download: '',
      href: '',
      click: vi.fn(),
    };

    // Create an actual anchor element and override its methods/properties for observation
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const el = originalCreateElement(tagName, options);
      if (tagName === 'a') {
        // Intercept properties
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

    fireEvent.click(screen.getByTestId('menu-item-Als Bild speichern'));

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

  it('does not export image if react flow wrapper is not found', () => {
    // Ensure no wrapper exists
    const existingElements = document.querySelectorAll('.react-flow');
    existingElements.forEach(el => document.body.removeChild(el));

    vi.mocked(toPng).mockClear();

    render(<PlannerDashboard />);

    fireEvent.click(screen.getByTestId('menu-item-Als Bild speichern'));

    expect(toPng).not.toHaveBeenCalled();
  });

  it('filters out specific elements during image export', async () => {
    const mockReactFlowElem = document.createElement('div');
    mockReactFlowElem.className = 'react-flow';
    document.body.appendChild(mockReactFlowElem);

    render(<PlannerDashboard />);

    fireEvent.click(screen.getByTestId('menu-item-Als Bild speichern'));

    await waitFor(() => {
      expect(toPng).toHaveBeenCalled();
    });

    const filterFunc = (toPng as unknown as any).mock.calls[0][1].filter;

    // Test positive case
    const validNode = document.createElement('div');
    expect(filterFunc(validNode)).toBe(true);

    // Test negative cases
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

    // Setup wrapper but force an error from toPng
    const mockReactFlowElem = document.createElement('div');
    mockReactFlowElem.className = 'react-flow';
    document.body.appendChild(mockReactFlowElem);

    (toPng as unknown as any).mockRejectedValueOnce(new Error('Export failed'));

    render(<PlannerDashboard />);

    fireEvent.click(screen.getByTestId('menu-item-Als Bild speichern'));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to export image', expect.any(Error));
    });

    consoleErrorSpy.mockRestore();
    document.body.removeChild(mockReactFlowElem);
  });
});
