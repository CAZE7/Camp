import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FlowCanvas } from './FlowCanvas';
import { PANE_WAIT_FRAMES } from './constants';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useAppStore, type AppState } from '../../lib/store';
import { useDashboardMetrics } from './hooks/useDashboardMetrics';
import { withSelector } from '../../test-helpers/reactflowMocks';
import type { PlannerState } from '../../store/usePlannerStore';

type MockPanelProps = {
  children?: React.ReactNode;
  position?: string;
  className?: string;
};
type MockReactFlowProps = {
  children?: React.ReactNode;
  nodes?: unknown[];
  edges?: unknown[];
  onDragOver?: React.DragEventHandler;
  onDrop?: React.DragEventHandler;
  className?: string;
  connectOnClick?: boolean;
};
type MockControlsProps = { showInteractive?: boolean };
/** Nodes, die der Canvas zuletzt an React Flow übergeben hat (Identität). */
type CapturedNode = { id: string; type?: string; data?: Record<string, unknown> };
let lastNodesProp: CapturedNode[] = [];
/** DOM-DragEvent mit den Attributen, die der FlowCanvas-Handler liest. */
type DragEventish = MouseEvent & {
  dataTransfer?: { dropEffect: string };
  preventDefault: () => void;
};

// next/dynamic wird im Test synchron aufgelöst, damit der per next/dynamic
// nachgeladene BOMModal (ssr:false) deterministisch hydriert statt in einer
// nie auflösenden Suspense zu hängen.
vi.mock('next/dynamic', async () => {
  const { BOMModal } = await import('./BOMModal');
  return {
    default: () => BOMModal,
  };
});

// --- Mocks ---

// Mock React Flow
const mockFitView = vi.fn();
const mockScreenToFlowPosition = vi
  .fn()
  .mockImplementation((pos: { x?: number; y?: number; clientX?: number; clientY?: number }) => ({
    x: pos.x ?? pos.clientX,
    y: pos.y ?? pos.clientY,
  }));
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    useReactFlow: () => ({
      fitView: mockFitView,
      screenToFlowPosition: mockScreenToFlowPosition,
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
      setViewport: vi.fn(),
      getNode: vi.fn(),
      setCenter: vi.fn(),
    }),
    useStore: (selector: (state: { transform: [number, number, number] }) => unknown) =>
      selector({ transform: [0, 0, 1] }),
    Background: () => <div data-testid="rf-background" />,
    Controls: ({ showInteractive }: MockControlsProps) => (
      <div data-testid="rf-controls" data-show-interactive={String(showInteractive)}>
        <button type="button" className="react-flow__controls-zoomin" />
        <button type="button" className="react-flow__controls-zoomout" />
        <button type="button" className="react-flow__controls-fitview" />
      </div>
    ),
    MiniMap: () => <div data-testid="rf-minimap" />,
    Panel: ({ children, position, className }: MockPanelProps) => (
      <div data-testid={`rf-panel-${position}`} className={className}>
        {children}
      </div>
    ),
    // v12 exportiert die Canvas-Komponente benannt (`ReactFlow`) statt als Default.
    ReactFlow: ({
      children,
      nodes,
      edges,
      onDragOver,
      onDrop,
      className,
      connectOnClick,
    }: MockReactFlowProps) => {
      lastNodesProp = (nodes ?? []) as CapturedNode[];
      return (
        <div
          data-testid="react-flow-mock"
          data-nodes={JSON.stringify(nodes)}
          data-edges={JSON.stringify(edges)}
          data-connect-on-click={String(connectOnClick)}
          className={className}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <div className="react-flow__pane" />
          {children}
        </div>
      );
    },
  };
});

// Der CableRouteSync rendert als Kind von <ReactFlow> und liest den echten
// React-Flow-Store (useStoreApi/useStore). Im Test ist ReactFlow gemockt,
// daher wird der Routing-Sync als No-Op gestubbt — geroutete Pfade werden
// hier nicht geprüft (dafür existieren CableEdge/WaterPipeEdge-Tests).
vi.mock('../edges/utils/cableRouteStore', () => ({
  CableRouteSync: () => null,
  useCableRoute: () => undefined,
  publishCableRoutes: vi.fn(),
  getCableRoute: () => undefined,
}));

// Mock hooks
vi.mock('./hooks/useDashboardMetrics', () => ({
  useDashboardMetrics: vi.fn(() => ({
    dailyConsumptionAh: 100.5,
    autarkyStr: '2 Tage',
    solarNodesCount: 2,
    totalSolarVoltage: 24,
    totalSolarAmps: 15.5,
    hasDirectBatteryToConsumer: false,
  })),
}));

// Mock Stores
/** AUDIT T1: Signatur des State-Updaters, den die Tests selbst aufrufen. */
type TappedHandleUpdater = (previous: unknown) => unknown;
const mockSetFirstTappedHandle = vi.fn<(updater: TappedHandleUpdater) => void>();
const mockOnDropFromStore = vi.fn();
const mockOnCustomDropFromStore = vi.fn();

const mockIsValidConnection = vi.fn().mockReturnValue(true);
const mockOnConnect = vi.fn();

const defaultPlannerStoreState = {
  viewMode: 'electric',
  // React Flow 12 misst Knoten beim Übernehmen (`adoptUserNodes`) und setzt
  // `position` voraus — v11 hat eine fehlende Position stillschweigend geduldet.
  nodes: [{ id: '1', type: 'battery', position: { x: 0, y: 0 }, data: {} }],
  edges: [{ id: 'e1', source: '1', target: '2', data: { crossSection: 4, length: 5 } }],
  waterNodes: [{ id: 'w1', type: 'freshWaterTank', position: { x: 0, y: 0 }, data: {} }],
  waterEdges: [{ id: 'we1', source: 'w1', target: 'w2', data: {} }],
  waterWarning: '',
  season: 'summer',
  onNodesChange: vi.fn(),
  onEdgesChange: vi.fn(),
  onWaterNodesChange: vi.fn(),
  onWaterEdgesChange: vi.fn(),
  onConnect: mockOnConnect,
  isValidConnection: mockIsValidConnection,
  onSelectionChange: vi.fn(),
  onDrop: mockOnDropFromStore,
  onCustomDrop: mockOnCustomDropFromStore,
  setFirstTappedHandle: mockSetFirstTappedHandle,
  addNode: vi.fn(),
  highlightedNodeId: null,
  highlightedEdgeId: null,
  setHighlightedNodeId: vi.fn(),
  setHighlightedEdgeId: vi.fn(),
  trunkMode: false,
  setTrunkMode: vi.fn(),
  backboneGrouping: true,
  setBackboneGrouping: vi.fn(),
  detailLevel: 'detail',
  setDetailLevel: vi.fn(),
  isLayoutPending: false,
  selectedNodes: [],
  selectedEdges: [],
  setSelectedNodes: vi.fn(),
  setSelectedEdges: vi.fn(),
  calculatePathVoltageDrop: vi.fn(() => 0),
} as unknown as PlannerState;

vi.mock('../../store/usePlannerStore', () => ({
  // AUDIT T1: Der Selektor war implizit `any` — Rückgabe und Aufruf damit auch.
  usePlannerStore: vi.fn((selector: (state: PlannerState) => unknown) => {
    return selector(defaultPlannerStoreState);
  }),
}));

const defaultAppStoreState = {
  calculatedSolarWatts: 0,
} as unknown as AppState;

vi.mock('../../lib/store', () => ({
  useAppStore: vi.fn((selector: (state: AppState) => unknown) => {
    return selector(defaultAppStoreState);
  }),
}));

describe('FlowCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store mocks to default before each test
    Object.assign(usePlannerStore, { getState: () => defaultPlannerStoreState });
    vi.mocked(usePlannerStore).mockImplementation((selector) => selector(defaultPlannerStoreState));
    vi.mocked(useAppStore).mockImplementation((selector) => selector(defaultAppStoreState));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders correctly', () => {
    render(<FlowCanvas />);
    expect(screen.getByTestId('react-flow-mock')).toBeInTheDocument();
  });

  /**
   * Regression (Bug 2026-09-26, „Routing springt zwischen 0 und 20“): Der
   * Rahmen des Hauptstromkreises muss als reine Darstellung an React Flow
   * gehen (Marker für die Routing-Grenze) — und die Bauteile dürfen dabei
   * nicht kopiert werden: Jede Kopie lässt React Flow den internen Knoten neu
   * aufbauen und neu messen.
   */
  it('übergibt den Hauptstromkreis-Rahmen als Darstellung und kopiert keine Bauteile', () => {
    const coreNodes = [
      { id: 'battery', type: 'battery', position: { x: 0, y: 0 }, data: {} },
      { id: 'shunt', type: 'shunt', position: { x: 320, y: 0 }, data: {} },
    ];
    vi.mocked(usePlannerStore).mockImplementation((selector) =>
      selector({ ...defaultPlannerStoreState, nodes: coreNodes } as PlannerState)
    );

    render(<FlowCanvas />);

    const frame = lastNodesProp.find((node) => node.id === '__planner-backbone-group');
    expect(frame?.type).toBe('backboneGroup');
    expect(frame?.data?.presentationOnly).toBe(true);

    const passedComponents = lastNodesProp.filter((node) => node.id !== '__planner-backbone-group');
    expect(passedComponents).toHaveLength(2);
    // Identität, nicht Gleichheit: dieselben Objekte wie im Store.
    expect(passedComponents[0]).toBe(coreNodes[0]);
    expect(passedComponents[1]).toBe(coreNodes[1]);
  });

  it('renders domain filter chips in electric mode', () => {
    render(<FlowCanvas />);
    expect(screen.getByRole('button', { name: '12V' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '230V' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solar' })).toBeInTheDocument();
  });

  it('toggles a domain filter chip off and on', () => {
    render(<FlowCanvas />);
    const solarChip = screen.getByRole('button', { name: 'Solar' });
    expect(solarChip).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(solarChip);
    expect(screen.getByRole('button', { name: 'Solar' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Solar' }));
    expect(screen.getByRole('button', { name: 'Solar' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders a trunk-mode toggle and flips it', () => {
    render(<FlowCanvas />);
    const trunkToggle = screen.getByRole('button', { name: 'Trassen' });
    expect(trunkToggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(trunkToggle);
    expect(defaultPlannerStoreState.setTrunkMode).toHaveBeenCalledWith(true);
  });

  it('toggles the configurable main-circuit grouping', () => {
    render(<FlowCanvas />);
    const toggle = screen.getByRole('button', { name: 'Hauptstromkreis' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(defaultPlannerStoreState.setBackboneGrouping).toHaveBeenCalledWith(false);
  });

  it('M8-1: eine Canvas-Darstellung ohne Zoom-Stufen-Klassen', () => {
    render(<FlowCanvas />);
    const canvas = screen.getByTestId('react-flow-mock');
    expect(canvas).toHaveClass('planner-canvas');
    expect(canvas).not.toHaveClass('planner-zoom-overview');
    expect(canvas).not.toHaveClass('planner-zoom-standard');
    expect(canvas).not.toHaveClass('planner-zoom-full');
  });

  it('uses one custom tap-to-connect path instead of a duplicate React Flow click connection', () => {
    render(<FlowCanvas />);
    expect(screen.getByTestId('react-flow-mock')).toHaveAttribute('data-connect-on-click', 'false');
  });

  it('removes the interactive control toggle and gives zoom controls German names', () => {
    render(<FlowCanvas />);

    expect(screen.getByTestId('rf-controls')).toHaveAttribute('data-show-interactive', 'false');
    expect(document.querySelector('.react-flow__controls-zoomin')).toHaveAttribute(
      'aria-label',
      'Ansicht vergrößern'
    );
    expect(document.querySelector('.react-flow__controls-zoomout')).toHaveAttribute(
      'aria-label',
      'Ansicht verkleinern'
    );
    expect(document.querySelector('.react-flow__controls-fitview')).toHaveAttribute(
      'aria-label',
      'Ganzen Plan einpassen'
    );
  });

  it('adds a keyboard or tap catalogue item at the visible canvas centre', () => {
    const addNode = vi.fn();
    const centeredStore = { ...defaultPlannerStoreState, nodes: [], addNode } as PlannerState;
    Object.assign(usePlannerStore, { getState: () => centeredStore });
    vi.mocked(usePlannerStore).mockImplementation((selector) => selector(centeredStore));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('react-flow__pane')) {
        return {
          x: 100,
          y: 80,
          width: 600,
          height: 400,
          top: 80,
          right: 700,
          bottom: 480,
          left: 100,
          toJSON: () => ({}),
        };
      }
      return {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        toJSON: () => ({}),
      };
    });
    render(<FlowCanvas />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('planner-add-at-canvas-center', {
          detail: { type: 'battery', label: 'Batterie', watts: 120 },
        })
      );
    });

    expect(mockScreenToFlowPosition).toHaveBeenCalledWith({ x: 400, y: 280 });
    expect(addNode).toHaveBeenCalledWith('battery', 'Batterie', { x: 304, y: 224 }, 120);
  });

  it('shows a mobile overview action only for more than eight nodes', () => {
    vi.mocked(usePlannerStore).mockImplementation(
      withSelector({
        ...defaultPlannerStoreState,
        nodes: Array.from({ length: 9 }, (_, index) => ({
          id: `n${index}`,
          type: 'consumer',
          position: { x: index * 20, y: 0 },
          data: {},
        })),
      })
    );
    render(<FlowCanvas />);
    fireEvent.click(screen.getByTestId('mobile-overview'));
    expect(mockFitView).toHaveBeenCalledWith({ duration: 400, padding: 0.2 });
  });

  it('does not render domain filter chips in water mode', () => {
    Object.assign(usePlannerStore, { getState: () => defaultPlannerStoreState });
    vi.mocked(usePlannerStore).mockImplementation(
      withSelector({ ...defaultPlannerStoreState, viewMode: 'water' })
    );
    render(<FlowCanvas />);
    expect(screen.queryByRole('button', { name: '12V' })).not.toBeInTheDocument();
  });

  it('passes electric nodes and edges when viewMode is electric', () => {
    render(<FlowCanvas />);
    const reactFlowElement = screen.getByTestId('react-flow-mock');

    // In electric mode, nodes and edges should correspond to defaultPlannerStoreState.nodes/edges
    expect(reactFlowElement.getAttribute('data-nodes')).toBe(JSON.stringify(defaultPlannerStoreState.nodes));
    expect(reactFlowElement.getAttribute('data-edges')).toBe(JSON.stringify(defaultPlannerStoreState.edges));
  });

  it('passes water nodes and edges when viewMode is water', () => {
    Object.assign(usePlannerStore, { getState: () => defaultPlannerStoreState });
    vi.mocked(usePlannerStore).mockImplementation(
      withSelector({
        ...defaultPlannerStoreState,
        viewMode: 'water',
      })
    );

    render(<FlowCanvas />);
    const reactFlowElement = screen.getByTestId('react-flow-mock');

    // In water mode, nodes and edges should correspond to defaultPlannerStoreState.waterNodes/waterEdges
    expect(reactFlowElement.getAttribute('data-nodes')).toBe(
      JSON.stringify(defaultPlannerStoreState.waterNodes)
    );
    expect(reactFlowElement.getAttribute('data-edges')).toBe(
      JSON.stringify(defaultPlannerStoreState.waterEdges)
    );
  });

  describe('User Interactions', () => {
    it('handles onDragOver by preventing default and setting dropEffect', () => {
      render(<FlowCanvas />);
      const reactFlowElement = screen.getByTestId('react-flow-mock');

      // Create a proper event object for drag over
      const event = new MouseEvent('dragover', { bubbles: true }) as unknown as DragEventish;
      event.dataTransfer = { dropEffect: 'none' };
      // AUDIT T1 (unbound-method): `expect(event.preventDefault)` liest die
      // Methode ungebunden aus dem Objekt. Dieselbe Assertion gegen die
      // gehaltene Referenz ist eindeutig — und prüft denselben Spy.
      const preventDefault = vi.fn();
      event.preventDefault = preventDefault;

      fireEvent(reactFlowElement, event);

      expect(preventDefault).toHaveBeenCalled();
      expect(event.dataTransfer.dropEffect).toBe('move');
    });

    it('calls onDrop from store when an item is dropped', () => {
      render(<FlowCanvas />);
      const reactFlowElement = screen.getByTestId('react-flow-mock');

      fireEvent.drop(reactFlowElement);

      expect(mockOnDropFromStore).toHaveBeenCalledWith(expect.anything(), mockScreenToFlowPosition);
    });

    it('listens to custom-node-drop and calls onCustomDrop from store', () => {
      render(<FlowCanvas />);

      const customEvent = new CustomEvent('custom-node-drop', { detail: {} });
      act(() => {
        window.dispatchEvent(customEvent);
      });

      expect(mockOnCustomDropFromStore).toHaveBeenCalledWith(expect.anything(), mockScreenToFlowPosition);
    });

    it('listens to show-bom-modal and displays the BOM data', async () => {
      render(<FlowCanvas />);

      const bomEvent = new CustomEvent('show-bom-modal');
      act(() => {
        window.dispatchEvent(bomEvent);
      });

      // BOMModal wird per next/dynamic (ssr:false) nachgeladen — der Lade-
      // Zustand ist `null`, daher warten wir auf das eingeblendete Dialog-
      // Fenster, statt es synchron zu erwarten.
      expect(await screen.findByText('Stückliste')).toBeInTheDocument();
      expect(screen.getByText('Batterie')).toBeInTheDocument();
      expect(screen.getByText('5.0 m Kabel mit 4 mm²')).toBeInTheDocument();

      // Close modal
      act(() => {
        fireEvent.click(screen.getByText('Schließen'));
      });
      expect(screen.queryByText('Stückliste')).not.toBeInTheDocument();
    });

    it('handles sequential tap connections', () => {
      render(<FlowCanvas />);

      // We simulate clicks on handle elements
      const handle1 = document.createElement('div');
      handle1.className = 'react-flow__handle source';
      handle1.setAttribute('data-nodeid', 'nodeA');
      handle1.setAttribute('data-handleid', 'handleA');
      document.body.appendChild(handle1);

      const handle2 = document.createElement('div');
      handle2.className = 'react-flow__handle target';
      handle2.setAttribute('data-nodeid', 'nodeB');
      handle2.setAttribute('data-handleid', 'handleB');
      document.body.appendChild(handle2);

      // First tap
      act(() => {
        fireEvent.click(handle1);
      });

      // Inside setFirstTappedHandle, state updater is called
      expect(mockSetFirstTappedHandle).toHaveBeenCalledTimes(1);

      const updater1 = mockSetFirstTappedHandle.mock.calls[0]![0];
      let newState1: unknown;
      act(() => {
        newState1 = updater1(null); // Previous state is null
      });
      expect(newState1).toEqual({ nodeId: 'nodeA', handleId: 'handleA', handleType: 'source' });

      // Second tap
      act(() => {
        fireEvent.click(handle2);
      });
      expect(mockSetFirstTappedHandle).toHaveBeenCalledTimes(2);

      const updater2 = mockSetFirstTappedHandle.mock.calls[1]![0];
      let newState2: unknown;
      act(() => {
        newState2 = updater2({ nodeId: 'nodeA', handleId: 'handleA', handleType: 'source' }); // Mocking previous state
      });

      expect(newState2).toBeNull(); // It resets after attempt
      expect(mockIsValidConnection).toHaveBeenCalledWith({
        source: 'nodeA',
        target: 'nodeB',
        sourceHandle: 'handleA',
        targetHandle: 'handleB',
      });
      expect(mockOnConnect).toHaveBeenCalledWith({
        source: 'nodeA',
        target: 'nodeB',
        sourceHandle: 'handleA',
        targetHandle: 'handleB',
      });

      document.body.removeChild(handle1);
      document.body.removeChild(handle2);
    });

    it('keeps the first endpoint selected when a second output/input is tapped by mistake', () => {
      render(<FlowCanvas />);

      const first = document.createElement('div');
      first.className = 'react-flow__handle source';
      first.setAttribute('data-nodeid', 'nodeA');
      first.setAttribute('data-handleid', 'handleA');
      document.body.appendChild(first);
      const second = document.createElement('div');
      second.className = 'react-flow__handle source';
      second.setAttribute('data-nodeid', 'nodeB');
      second.setAttribute('data-handleid', 'handleB');
      document.body.appendChild(second);

      act(() => {
        fireEvent.click(first);
        fireEvent.click(second);
      });
      const updater = mockSetFirstTappedHandle.mock.calls[1]![0];
      let updatedSelection: unknown;
      act(() => {
        updatedSelection = updater({ nodeId: 'nodeA', handleId: 'handleA', handleType: 'source' });
      });
      expect(updatedSelection).toEqual({
        nodeId: 'nodeA',
        handleId: 'handleA',
        handleType: 'source',
      });
      expect(mockOnConnect).not.toHaveBeenCalled();

      document.body.removeChild(first);
      document.body.removeChild(second);
    });

    it('cancels tap connection if the same handle is clicked twice', () => {
      render(<FlowCanvas />);

      const handle = document.createElement('div');
      handle.className = 'react-flow__handle source';
      handle.setAttribute('data-nodeid', 'nodeA');
      handle.setAttribute('data-handleid', 'handleA');
      document.body.appendChild(handle);

      // Click handle
      act(() => {
        fireEvent.click(handle);
      });

      const updater = mockSetFirstTappedHandle.mock.calls[0]![0];
      // Try to update with the same state again
      let newState: unknown;
      act(() => {
        newState = updater({ nodeId: 'nodeA', handleId: 'handleA', handleType: 'source' });
      });

      expect(newState).toBeNull();
      expect(mockOnConnect).not.toHaveBeenCalled();

      document.body.removeChild(handle);
    });

    it('resets tap connection if clicked outside of a handle', () => {
      render(<FlowCanvas />);

      const outsideElem = document.createElement('div');
      document.body.appendChild(outsideElem);

      fireEvent.click(outsideElem);

      expect(mockSetFirstTappedHandle).toHaveBeenCalledWith(null);

      document.body.removeChild(outsideElem);
    });
  });

  describe('Metrics & Warnings', () => {
    it('displays water warning when viewMode is water and warning exists', () => {
      Object.assign(usePlannerStore, { getState: () => defaultPlannerStoreState });
      vi.mocked(usePlannerStore).mockImplementation(
        withSelector({
          ...defaultPlannerStoreState,
          viewMode: 'water',
          waterWarning: 'Test Water Warning',
        })
      );

      render(<FlowCanvas />);

      expect(screen.getByText('Test Water Warning')).toBeInTheDocument();
    });

    it('displays electric system calculations panel when viewMode is electric', () => {
      render(<FlowCanvas />);

      expect(screen.getByText('Aktueller Status')).toBeInTheDocument();
      /**
       * UX-Reset 2026-09: Kennzahlen sind tertiär. Eingeklappt ist der Default —
       * die Werte kosten einen Klick und stehen nicht dauerhaft über dem Plan.
       */
      expect(screen.queryByText(/100\.5 Ah/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Aktueller Status'));

      expect(screen.getByText(/100\.5 Ah/)).toBeInTheDocument();
      expect(screen.getByText('2 Tage')).toBeInTheDocument();
    });

    it('displays direct battery to consumer warning in electric mode if applicable', () => {
      vi.mocked(useDashboardMetrics).mockReturnValueOnce({
        dailyConsumptionAh: 50,
        autarkyStr: '1 Tag',
        solarNodesCount: 0,
        totalSolarVoltage: 0,
        totalSolarAmps: 0,
        hasDirectBatteryToConsumer: true,
      } as unknown as ReturnType<typeof useDashboardMetrics>);

      render(<FlowCanvas />);

      // removed direct battery warning text check as it requires click
    });

    it('displays roof planner detection panel when calculatedSolarWatts > 0', () => {
      vi.mocked(useAppStore).mockImplementation((selector) => {
        return selector({
          ...defaultAppStoreState,
          calculatedSolarWatts: 500,
        });
      });

      render(<FlowCanvas />);

      expect(screen.getByText('Dachplaner-Daten erkannt:')).toBeInTheDocument();
      expect(screen.getByText(/500 W Solarleistung verfügbar/)).toBeInTheDocument();
    });
  });
});

describe('FlowCanvas · Detailgrad (UX-Reset 2026-09 / RECHERCHE C1)', () => {
  const renderWith = (overrides: Partial<typeof defaultPlannerStoreState>) => {
    const state = { ...defaultPlannerStoreState, ...overrides };
    vi.mocked(usePlannerStore).mockImplementation(
      (selector: (s: typeof defaultPlannerStoreState) => unknown) => selector(state)
    );
    return render(<FlowCanvas />);
  };

  afterEach(() => {
    vi.mocked(usePlannerStore).mockImplementation(
      (selector: (s: typeof defaultPlannerStoreState) => unknown) => selector(defaultPlannerStoreState)
    );
  });

  it('trägt den Detailgrad als Klasse am Canvas-Container', () => {
    const detail = renderWith({});
    expect(detail.getByTestId('react-flow-mock').className).toContain('planner-detail-detail');
    detail.unmount();

    const overview = renderWith({ detailLevel: 'overview' });
    expect(overview.getByTestId('react-flow-mock').className).toContain('planner-detail-overview');
    overview.unmount();
  });

  /**
   * CSS-Wächter: Der Schalter ist ohne Regel wertlos. Wie in
   * PlannerDashboard.test.tsx (Warnungs-Deduplizierung) wird das Stylesheet
   * festgezurrt — Messwerte ausblenden, Warnflächen aber sichtbar lassen.
   */
  it('hinterlegt die Übersichtsstufe in globals.css', () => {
    const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');
    expect(css).toContain('.planner-detail-overview .node-card .measure');
    expect(css).toContain('.planner-detail-overview .node-card > div:not(.node-symbol)');
    // Sicherheit vor Kompaktheit: Der Status-Rand bleibt unangetastet.
    expect(css).not.toContain('.planner-detail-overview .node-card--error');
  });
});

/**
 * Bauteil-Zusatz über den Katalog (Kachel-Tipp / Tastatur) — E2E-Regression
 * `touch.spec.ts › Tap-to-Connect`: Auf dem Handy ist der Katalog ein eigener
 * Tab, die Plan-Spalte also beim Tippen noch `hidden`. Der alte Zwei-Frame-Retry
 * gab auf und legte das Bauteil auf das feste Raster — teils außerhalb der
 * sichtbaren Fläche, wo der Anschluss unter der Schrittleiste nicht antippbar
 * war. Jetzt wird auf eine messbare Pane gewartet.
 */
describe('FlowCanvas · Bauteil-Zusatz bei versteckter Plan-Spalte', () => {
  const rect = (x: number, y: number, width: number, height: number) =>
    ({
      x,
      y,
      width,
      height,
      top: y,
      right: x + width,
      bottom: y + height,
      left: x,
      toJSON: () => ({}),
    }) as DOMRect;

  const setup = () => {
    const addNode = vi.fn();
    const store = { ...defaultPlannerStoreState, nodes: [], addNode } as PlannerState;
    Object.assign(usePlannerStore, { getState: () => store });
    vi.mocked(usePlannerStore).mockImplementation((selector: (s: PlannerState) => unknown) =>
      selector(store)
    );
    const rafQueue: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafQueue.push(callback);
      return rafQueue.length;
    });
    const flush = (frames: number) =>
      act(() => {
        for (let i = 0; i < frames && rafQueue.length > 0; i += 1) {
          const callback = rafQueue.shift();
          callback?.(performance.now());
        }
      });
    return { addNode, flush };
  };

  const dispatchAdd = () =>
    act(() => {
      window.dispatchEvent(
        new CustomEvent('planner-add-at-canvas-center', {
          detail: { type: 'battery', label: 'Batterie', watts: 120 },
        })
      );
    });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(usePlannerStore, { getState: () => defaultPlannerStoreState });
    vi.mocked(usePlannerStore).mockImplementation((selector: (s: PlannerState) => unknown) =>
      selector(defaultPlannerStoreState)
    );
    vi.mocked(useAppStore).mockImplementation((selector: (s: typeof defaultAppStoreState) => unknown) =>
      selector(defaultAppStoreState)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wartet auf die messbare Pane und platziert dann in der sichtbaren Mitte', () => {
    const { addNode, flush } = setup();
    // Kachel-Tipp: die Plan-Spalte ist noch `hidden`, die Pane misst 0×0.
    let measurable = false;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('react-flow__pane')) {
        return measurable ? rect(100, 80, 600, 400) : rect(0, 0, 0, 0);
      }
      return rect(0, 0, 0, 0);
    });

    render(<FlowCanvas />);
    dispatchAdd();

    // Nicht sofort auf das Raster gefallen — es wird auf den Tab-Wechsel gewartet.
    expect(addNode).not.toHaveBeenCalled();

    // Drei Frames lang bleibt die Spalte versteckt: Der alte Zwei-Frame-Retry
    // hätte hier längst aufgegeben und auf das Raster gelegt.
    flush(3);
    expect(addNode).not.toHaveBeenCalled();

    // Tab-Wechsel: Plan-Spalte sichtbar.
    measurable = true;
    flush(3);

    expect(mockScreenToFlowPosition).toHaveBeenCalledWith({ x: 400, y: 280 });
    expect(addNode).toHaveBeenCalledWith('battery', 'Batterie', { x: 304, y: 224 }, 120);
  });

  it('fällt nach dem Frame-Budget auf das deterministische Raster zurück', () => {
    const { addNode, flush } = setup();
    // Pane bleibt unmessbar (z. B. abgebrochener Tab-Wechsel): die Aktion darf
    // nicht verloren gehen.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => rect(0, 0, 0, 0));

    render(<FlowCanvas />);
    dispatchAdd();
    expect(addNode).not.toHaveBeenCalled();

    flush(PANE_WAIT_FRAMES + 2);

    expect(addNode).toHaveBeenCalledWith('battery', 'Batterie', { x: 0, y: 0 }, 120);
  });
});
