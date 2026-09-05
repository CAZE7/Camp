import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PlannerInner from './PlannerInner';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/elektrik-planung',
}));

vi.mock('./planner/PlannerSidebar', () => ({
  PlannerSidebar: () => <div data-testid="planner-sidebar">PlannerSidebar</div>,
}));
vi.mock('./planner/PlannerInspector', () => ({
  PlannerInspector: () => <div data-testid="planner-inspector">PlannerInspector</div>,
}));
vi.mock('./planner/PlannerDashboard', () => ({
  PlannerDashboard: () => <div data-testid="planner-dashboard">PlannerDashboard</div>,
}));
vi.mock('./planner/FlowCanvas', () => ({
  FlowCanvas: () => <div data-testid="flow-canvas">FlowCanvas</div>,
}));
vi.mock('./planner/ExpertPanel', () => ({
  ExpertPanel: () => <div data-testid="expert-panel">ExpertPanel</div>,
}));
vi.mock('./planner/OnboardingWizard', () => ({
  OnboardingWizard: () => <div data-testid="onboarding" />,
}));

// --- Stores -------------------------------------------------------------
const setInspectorOpen = vi.fn();
const setSelectedNodes = vi.fn();
const setSelectedEdges = vi.fn();
const plannerState: Record<string, unknown> = {
  viewMode: 'electric',
  setViewMode: vi.fn(),
  isInspectorOpen: true,
  setInspectorOpen,
  selectedNodes: [],
  selectedEdges: [],
  setSelectedNodes,
  setSelectedEdges,
  undo: vi.fn(),
  redo: vi.fn(),
  canUndo: false,
  canRedo: false,
  deleteSelected: vi.fn(),
};

vi.mock('../store/usePlannerStore', () => ({
  usePlannerStore: Object.assign(
    vi.fn((selector: (state: typeof plannerState) => unknown) => selector(plannerState)),
    { getState: () => plannerState }
  ),
}));

vi.mock('../lib/store', () => ({
  useAppStore: vi.fn((selector: (state: { hasOnboarded: boolean }) => unknown) =>
    selector({ hasOnboarded: true })
  ),
}));

const shell = () => document.querySelector('.planner-shell') as HTMLElement;
const column = (testId: string) => screen.getByTestId(testId).parentElement as HTMLElement;

describe('PlannerInner — responsives Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    plannerState.isInspectorOpen = true;
    plannerState.selectedNodes = [];
    plannerState.selectedEdges = [];
    plannerState.canUndo = false;
    plannerState.canRedo = false;
  });

  it('A1 (375 px): Bottom-Tabs mit ≥44 px Touch-Targets und Safe-Area', () => {
    render(<PlannerInner />);
    const nav = screen.getByRole('navigation', { name: 'Planerbereiche' });

    // Safe-Area-Klasse (padding-bottom: max(.25rem, env(safe-area-inset-bottom)))
    expect(nav).toHaveClass('planner-bottom-nav');
    // Ab 768 px verschwindet die Leiste — sie ist Flex-Geschwister, überlappt
    // den Canvas also nie.
    expect(nav).toHaveClass('md:hidden');

    const tabs = ['Bauteile', 'Elektrik', 'Wasser', 'Details', 'Heizung'];
    tabs.forEach((label) => {
      const button = screen.getByRole('button', { name: label });
      // min-h-14 / min-w-14 = 56 px, deutlich über den geforderten 44 px.
      expect(button.className).toContain('min-h-14');
      expect(button.className).toContain('min-w-14');
    });
  });

  it('M3.1 (375 px): bietet Touch-Undo/Redo mit sichtbarem Disabled-State', () => {
    const { rerender } = render(<PlannerInner />);
    const undoButton = screen.getByTestId('mobile-undo');
    const redoButton = screen.getByTestId('mobile-redo');
    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();
    expect(undoButton).toHaveClass('h-12', 'w-12');

    plannerState.canUndo = true;
    plannerState.canRedo = true;
    rerender(<PlannerInner />);
    fireEvent.click(screen.getByTestId('mobile-undo'));
    fireEvent.click(screen.getByTestId('mobile-redo'));
    expect(plannerState.undo).toHaveBeenCalledTimes(1);
    expect(plannerState.redo).toHaveBeenCalledTimes(1);
  });

  it('A1: der Canvas ist der Standard-Tab und lässt sich umschalten', () => {
    render(<PlannerInner />);
    expect(column('flow-canvas')).toBeTruthy();

    const canvasColumn = screen.getByTestId('planner-dashboard').parentElement as HTMLElement;
    expect(canvasColumn.className).toContain('flex');
    expect(canvasColumn.className).not.toContain('hidden');

    fireEvent.click(screen.getByRole('button', { name: 'Bauteile' }));
    const sidebarColumn = column('planner-sidebar');
    expect(sidebarColumn.className).toContain('flex');
    // Jetzt ist der Canvas auf dem Handy ausgeblendet …
    expect((screen.getByTestId('planner-dashboard').parentElement as HTMLElement).className).toContain(
      'hidden'
    );
    // … bleibt ab Tablet aber sichtbar.
    expect((screen.getByTestId('planner-dashboard').parentElement as HTMLElement).className).toContain(
      'md:flex'
    );
  });

  it('A2 (768 px): Sidebar + Canvas nebeneinander, Inspector als Overlay', () => {
    render(<PlannerInner />);

    // Zeilenrichtung ab md statt erst ab lg.
    expect(shell().className).toContain('md:flex-row');
    expect(shell().className).not.toContain('md:flex-rowdark');

    // Sidebar und Canvas sind ab md beide sichtbar.
    expect(column('planner-sidebar').className).toContain('md:flex');
    expect((screen.getByTestId('planner-dashboard').parentElement as HTMLElement).className).toContain(
      'md:flex'
    );

    // Inspector liegt zwischen 768 und 1279 px als Overlay über dem Canvas …
    const aside = screen.getByRole('complementary', { name: 'Eigenschaften' });
    expect(aside.className).toContain('md:fixed');
    expect(aside.className).toContain('md:w-80'); // 320 px Slide-over
    // … und dockt erst ab 1280 px als echte Spalte an.
    expect(aside.className).toContain('xl:static');

    // Backdrop nur im Overlay-Bereich, nie auf dem Desktop — und für
    // Screenreader unsichtbar, damit es kein zweites „Schließen“ gibt.
    const backdrop = screen.getByTestId('inspector-backdrop');
    expect(backdrop).toHaveClass('md:block', 'xl:hidden');
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
  });

  it('A3 (1440 px): drei Spalten mit festen Breiten und Canvas-Mindestbreite', () => {
    render(<PlannerInner />);
    const aside = screen.getByRole('complementary', { name: 'Eigenschaften' });
    const canvasColumn = screen.getByTestId('planner-dashboard').parentElement as HTMLElement;

    // Inspector: 288 px ab 1280 px, 320 px ab 1536 px.
    expect(aside.className).toContain('xl:w-[288px]');
    expect(aside.className).toContain('2xl:w-[320px]');

    // Canvas: flex-1 mit 600 px Mindestbreite, kein w-auto.
    expect(canvasColumn.className).toContain('flex-1');
    expect(canvasColumn.className).toContain('xl:min-w-[600px]');
    expect(canvasColumn.className).not.toContain('w-auto');
    expect(column('planner-sidebar').className).not.toContain('w-auto');
  });

  it('öffnet den Inspector bei jeder Auswahl und schließt ihn ohne Auswahl', () => {
    const { rerender } = render(<PlannerInner />);
    // Leere Auswahl beim Mount: das Overlay (Tablet/Handy) darf nicht ohne
    // Anlass mit Backdrop über dem Canvas stehen.
    expect(setInspectorOpen).toHaveBeenLastCalledWith(false);

    plannerState.selectedNodes = [{ id: 'battery-1' }];
    rerender(<PlannerInner />);
    expect(setInspectorOpen).toHaveBeenLastCalledWith(true);

    // Auswahl gegen ein anderes Element getauscht (1→1): der Inspector
    // folgt — früher blieb er bei manuellem Schließen „stecken".
    plannerState.selectedNodes = [{ id: 'inverter-1' }];
    rerender(<PlannerInner />);
    expect(setInspectorOpen).toHaveBeenLastCalledWith(true);

    // Auswahl aufheben: Overlay wieder zu — sonst blockiert es auf kleinen
    // Geräten dauerhaft den Toolbar-Zugriff (E2E-Persistenz-Flow).
    setInspectorOpen.mockClear();
    plannerState.selectedNodes = [];
    rerender(<PlannerInner />);
    expect(setInspectorOpen).toHaveBeenLastCalledWith(false);
  });

  it('schließt das Overlay per Backdrop und per Escape (inkl. Auswahl aufheben)', () => {
    render(<PlannerInner />);

    fireEvent.click(screen.getByTestId('inspector-backdrop'));
    expect(setInspectorOpen).toHaveBeenCalledWith(false);

    setInspectorOpen.mockClear();
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(setInspectorOpen).toHaveBeenCalledWith(false);
    // Escape hebt die Auswahl auf — der Inspector schließt dann über den
    // Auswahl-Effekt, statt am Desktop die Spalte als Ganzes einzuklappen.
    expect(setSelectedNodes).toHaveBeenCalledWith([]);
    expect(setSelectedEdges).toHaveBeenCalledWith([]);
  });

  it('blendet den Inspector aus, wenn er geschlossen ist — ohne Overflow zu erzeugen', () => {
    plannerState.isInspectorOpen = false;
    render(<PlannerInner />);
    const aside = screen.getByRole('complementary', { name: 'Eigenschaften' });

    // display:none statt „aus dem Viewport geschoben“: ein per translate
    // verschobenes fixed-Element würde am Tablet horizontales Scrollen erzeugen.
    expect(aside.className).toContain('md:hidden');
    expect(aside.className).toContain('xl:w-0');
  });

  it('fängt Strg+S ab und meldet stattdessen den Autosave-Status', () => {
    render(<PlannerInner />);
    const listener = vi.fn();
    window.addEventListener('planner-save', listener);

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true, bubbles: true });
    act(() => {
      document.dispatchEvent(event);
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    window.removeEventListener('planner-save', listener);
  });
});
