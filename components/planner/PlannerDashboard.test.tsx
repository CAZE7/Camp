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
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,mocked'),
}));

// Mock React Flow
const mockFitView = vi.fn();
vi.mock('reactflow', () => ({
  useReactFlow: () => ({
    fitView: mockFitView,
  }),
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
  }),
}));

// Mock App Store
const mockToggleProMode = vi.fn();
vi.mock('../../lib/store', () => ({
  useAppStore: vi.fn(() => ({
    isProMode: false,
    toggleProMode: mockToggleProMode,
  })),
}));

// Mock Dropdown Menu to avoid Radix UI complexities in JSDOM testing
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: { children: React.ReactNode; onClick: () => void; className?: string }) => {
    const label = (Array.isArray(children) ? children : [children])
      .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
      .join('')
      .trim();
    return (
      <button onClick={onClick} className={className} data-testid={`menu-item-${label}`}>
        {children}
      </button>
    );
  },
}));

describe('PlannerDashboard', () => {
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
    expect(screen.getByText('Elektrik')).toBeInTheDocument();
    expect(screen.getByText('Wasser')).toBeInTheDocument();
    expect(screen.getByText('Aktionen')).toBeInTheDocument();
    expect(screen.getByText('Sommer')).toBeInTheDocument();
    expect(screen.getByText('Winter')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
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

    fireEvent.click(screen.getByText('Winter'));
    expect(mockSetSeason).toHaveBeenCalledWith('winter');

    fireEvent.click(screen.getByText('Sommer'));
    expect(mockSetSeason).toHaveBeenCalledWith('summer');
  });

  it('calls toggleProMode when clicking the Pro/Standard toggle', () => {
    render(<PlannerDashboard />);

    fireEvent.click(screen.getByText('Standard'));
    expect(mockToggleProMode).toHaveBeenCalledTimes(1);
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

    fireEvent.click(screen.getByTestId('menu-item-Automatisch Verkabeln'));

    expect(mockAutoWireSystem).toHaveBeenCalledWith(mockFitView);
  });

  it('calls checkSchematic when clicking Schaltplan prüfen', () => {
    render(<PlannerDashboard />);

    fireEvent.click(screen.getByTestId('menu-item-Schaltplan prüfen lassen'));

    expect(mockCheckSchematic).toHaveBeenCalledTimes(1);
  });

  it('calls onLayout with fitView when clicking Schaltplan aufräumen', () => {
    render(<PlannerDashboard />);

    fireEvent.click(screen.getByTestId('menu-item-Schaltplan aufräumen'));

    expect(mockOnLayout).toHaveBeenCalledWith(mockFitView);
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

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
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
});
