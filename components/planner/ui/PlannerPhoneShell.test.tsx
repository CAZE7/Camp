import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Handy-Hülle — Vertrag aus Spezifikation §5–§8.
 *
 * Geprüft wird, was der Auftrag verlangt und was in einer Unit-Suite prüfbar
 * ist: vier Ansichten, genau eine Meldung, ein Meldungsplatz, die Fußleiste
 * als einziger Wechsel, „Mehr“ als einzige Stelle für Aktionen. Geometrie und
 * Sichtbarkeit bei echten Viewports sind Aufgabe der E2E-Suite
 * (`tests/e2e/mobile-views.spec.ts`).
 */

const planState = vi.hoisted(() => ({
  nodes: [] as Array<{ id: string; type?: string; data?: Record<string, unknown> }>,
  edges: [] as Array<{ id: string }>,
  waterNodes: [] as Array<{ id: string; type?: string; data?: Record<string, unknown> }>,
  waterEdges: [] as Array<{ id: string }>,
  viewMode: 'electric' as 'electric' | 'water',
  selectedNodes: [] as Array<{ id: string }>,
  selectedEdges: [] as Array<{ id: string }>,
  plannerMessage: null as null | { type: 'success' | 'error' | 'info'; message: string },
  plannerErrors: [] as Array<{ severity: string }>,
  autoWireReport: null,
  detailLevel: 'detail' as 'detail' | 'overview',
  season: 'summer' as 'summer' | 'winter',
  focusMode: false,
  plannerMode: 'planung' as 'planung' | 'physisch' | 'pruefung',
  trunkMode: false,
  backboneGrouping: true,
  activeDomains: ['DC_12V', 'AC_230V', 'Solar'] as string[],
  canUndo: false,
  canRedo: false,
}));

const spies = vi.hoisted(() => ({
  setPlannerMessage: vi.fn(),
  setSelectedNodes: vi.fn(),
  setSelectedEdges: vi.fn(),
  focusElement: vi.fn(),
  toggleDomain: vi.fn(),
  setDetailLevel: vi.fn(),
  setSeason: vi.fn(),
  setFocusMode: vi.fn(),
  clearPlan: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
}));

vi.mock('../../../store/usePlannerStore', () => {
  const state = () => ({
    ...planState,
    ...spies,
    setViewMode: vi.fn(),
    setPlannerMode: vi.fn(),
    setTrunkMode: vi.fn(),
    setBackboneGrouping: vi.fn(),
  });
  return {
    usePlannerStore: Object.assign(
      vi.fn((selector: (value: ReturnType<typeof state>) => unknown) => selector(state())),
      { getState: state }
    ),
  };
});

vi.mock('../../../lib/store', () => ({
  useAppStore: Object.assign(
    vi.fn((selector: (value: { hasOnboarded: boolean; setHasOnboarded: () => void }) => unknown) =>
      selector({ hasOnboarded: true, setHasOnboarded: vi.fn() })
    ),
    { getState: () => ({ setHasOnboarded: vi.fn() }) }
  ),
}));

// Prüf-Engine: Die Suite interessiert der AUFBAU der Ansicht, nicht die Zahl
// der Befunde. Ein Befund genügt, um Liste und „Im Schaltplan zeigen“ zu prüfen.
const warning = vi.hoisted(() => ({
  id: 'w1',
  category: 'safety',
  type: 'critical',
  title: 'Sicherung zu klein',
  message: 'Der Nennstrom liegt über der Sicherung.',
  focusId: 'battery-1',
  focusType: 'node',
}));
vi.mock('../hooks/useLiveValidation', () => ({
  useLiveValidation: () => [warning],
  useVerificationReport: () => ({ verdict: 'ok', coverage: [], findings: [] }),
}));
vi.mock('../utils/verificationWarnings', () => ({
  verificationSummary: () => ({ label: 'Alles geprüft', tone: 'good' }),
}));
vi.mock('../utils/verificationActions', () => ({
  nextStepSummary: () => 'Als Nächstes: Verbraucher ergänzen.',
}));

// Aktionen der Hülle: dieselben testids, hier als Stubs mit Zähler.
const actionSpies = vi.hoisted(() => ({
  runAutoWire: vi.fn(),
  runLayoutV2: vi.fn().mockResolvedValue({ applied: true }),
  runOptimizeRouting: vi.fn(),
  runCheck: vi.fn(),
  runGridLayout: vi.fn(),
  openBom: vi.fn(),
  exportImage: vi.fn().mockResolvedValue(undefined),
  sharePlan: vi.fn().mockResolvedValue(undefined),
  saveProject: vi.fn(),
  openProject: vi.fn().mockResolvedValue(undefined),
  openShortcuts: vi.fn(),
  loadTemplate: vi.fn(),
}));
vi.mock('../hooks/usePlannerActions', () => ({
  usePlannerActions: () => ({
    menus: { datei: [], bearbeiten: [], ansicht: [], werkzeuge: [], planung: [], hilfe: [] },
    overflow: [],
    busy: null,
    ...actionSpies,
    openWarnings: actionSpies.runCheck,
    openCatalog: vi.fn(),
    requestReset: vi.fn(),
  }),
}));

vi.mock('./SaveIndicator', () => ({ SaveIndicator: () => <span data-testid="save-indicator" /> }));

import {
  PlannerPhoneHeader,
  PlannerPhoneLayer,
  PlannerPhoneMessageBar,
  PlannerPhoneNav,
} from './PlannerPhoneShell';
import { PHONE_CHROME_QUERY, PHONE_VIEW_TESTIDS } from './PlannerPhoneShell';
import { PHONE_CHROME_QUERY as QUERY_FROM_BREAKPOINTS } from './breakpoints';

describe('PlannerPhoneShell — Handy-Hülle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planState.nodes = [];
    planState.edges = [];
    planState.waterNodes = [];
    planState.waterEdges = [];
    planState.viewMode = 'electric';
    planState.selectedNodes = [];
    planState.selectedEdges = [];
    planState.plannerMessage = null;
    planState.plannerErrors = [];
    planState.detailLevel = 'detail';
    planState.season = 'summer';
    planState.focusMode = false;
  });

  it('nutzt für CSS und JS dieselbe Gerätegrenze', () => {
    expect(PHONE_CHROME_QUERY).toBe(QUERY_FROM_BREAKPOINTS);
    expect(PHONE_CHROME_QUERY).toContain('(max-width: 767px)');
    expect(PHONE_CHROME_QUERY).toContain('(max-height: 500px)');
  });

  it('Kopf: Home-Verweis, Projektname und Speicherzustand — sonst nichts', () => {
    render(<PlannerPhoneHeader projectName="Elektrikplan" />);
    const header = screen.getByTestId('planner-phone-header');
    expect(within(header).getByRole('link', { name: 'Zur Startseite' })).toHaveAttribute('href', '/');
    expect(within(header).getByText('Elektrikplan')).toBeInTheDocument();
    expect(within(header).getByTestId('save-indicator')).toBeInTheDocument();
    // Keine Menü-Auslöser in der Kopfzeile (Spec §5.1).
    expect(within(header).queryByRole('button')).not.toBeInTheDocument();
  });

  it('Fuß: vier Ziele mit den vereinbarten Kennungen und `aria-current`', () => {
    const onSelect = vi.fn();
    render(<PlannerPhoneNav activeView="bauteile" onSelectView={onSelect} />);

    const nav = screen.getByRole('navigation', { name: 'Planerbereiche' });
    expect(nav).toHaveClass('planner-bottom-nav');
    for (const [view, testId] of Object.entries(PHONE_VIEW_TESTIDS)) {
      expect(within(nav).getByTestId(testId)).toBeInTheDocument();
      void view;
    }
    expect(within(nav).getByTestId('nav-tab-bauteile')).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByTestId('nav-tab-mehr')).not.toHaveAttribute('aria-current');

    fireEvent.click(within(nav).getByTestId('nav-tab-pruefung'));
    expect(onSelect).toHaveBeenCalledWith('pruefung');
  });

  it('Fuß: die Zahl kritischer Befunde steht am Prüf-Ziel, nicht nur als Farbe', () => {
    planState.plannerErrors = [{ severity: 'critical' }, { severity: 'critical' }, { severity: 'warning' }];
    render(<PlannerPhoneNav activeView="bauteile" onSelectView={vi.fn()} />);
    const tab = screen.getByTestId('nav-tab-pruefung');
    expect(tab).toHaveAccessibleName('Prüfung, 2 kritisch');
    expect(tab).toHaveTextContent('2');
  });

  it('Bauteile: leerer Plan zeigt den Einstieg „Fang mit deiner Batterie an“', () => {
    render(
      <PlannerPhoneLayer
        view="bauteile"
        onSelectView={vi.fn()}
        onOpenCatalog={vi.fn()}
        onOpenDetail={vi.fn()}
        entryMessage={null}
      />
    );
    expect(screen.getByRole('heading', { name: 'Fang mit deiner Batterie an' })).toBeInTheDocument();
    expect(screen.getByTestId('phone-add-battery')).toBeInTheDocument();
  });

  it('Bauteile: Zeilen sind die gesetzten Bauteile; Antippen setzt die Auswahl und öffnet das Detail', () => {
    planState.nodes = [
      { id: 'battery-1', type: 'battery', data: { label: '12V Batterie' } },
      { id: 'fuse-1', type: 'fuse', data: { label: 'Sicherungskasten' } },
    ];
    planState.edges = [{ id: 'e1' }];
    const onOpenDetail = vi.fn();
    render(
      <PlannerPhoneLayer
        view="bauteile"
        onSelectView={vi.fn()}
        onOpenCatalog={vi.fn()}
        onOpenDetail={onOpenDetail}
        entryMessage={null}
      />
    );

    const list = screen.getByTestId('phone-parts-list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('phone-part-battery-1'));

    // EINE Auswahl im Store — die Ansicht führt keine zweite (Spec §6).
    expect(spies.setSelectedNodes).toHaveBeenCalledWith([planState.nodes[0]]);
    expect(spies.setSelectedEdges).toHaveBeenCalledWith([]);
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
  });

  it('Bauteile: im Wasserplan zeigt die Liste die Wasser-Bauteile', () => {
    planState.viewMode = 'water';
    planState.nodes = [{ id: 'battery-1', type: 'battery', data: { label: '12V Batterie' } }];
    planState.waterNodes = [{ id: 'tank-1', type: 'freshWaterTank', data: { label: 'Frischwassertank' } }];
    render(
      <PlannerPhoneLayer
        view="bauteile"
        onSelectView={vi.fn()}
        onOpenCatalog={vi.fn()}
        onOpenDetail={vi.fn()}
        entryMessage={null}
      />
    );
    expect(screen.getByTestId('phone-part-tank-1')).toBeInTheDocument();
    expect(screen.queryByTestId('phone-part-battery-1')).not.toBeInTheDocument();
  });

  it('Prüfung: zeigt Befunde und springt über „Im Schaltplan zeigen“ zur Fläche', () => {
    const onSelectView = vi.fn();
    render(
      <PlannerPhoneLayer
        view="pruefung"
        onSelectView={onSelectView}
        onOpenCatalog={vi.fn()}
        onOpenDetail={vi.fn()}
        entryMessage={null}
      />
    );

    expect(screen.getByTestId('phone-check-list')).toBeInTheDocument();
    expect(screen.getByText('Sicherung zu klein')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Im Schaltplan zeigen' }));
    // Derselbe Weg wie am Desktop: Store-Auswahl fokussieren, dann Ansicht wechseln.
    expect(spies.focusElement).toHaveBeenCalledWith('battery-1', 'node');
    expect(onSelectView).toHaveBeenCalledWith('schaltplan');
  });

  it('Mehr: jede Aktion genau einmal, mit den Kennungen des Desktops', () => {
    render(
      <PlannerPhoneLayer
        view="mehr"
        onSelectView={vi.fn()}
        onOpenCatalog={vi.fn()}
        onOpenDetail={vi.fn()}
        entryMessage={null}
      />
    );

    const expected = [
      'action-autowire',
      'action-layout-v2-menu',
      'action-optimize-routing',
      'action-check',
      'action-layout',
      'action-bom',
      'action-export-image',
      'action-share-plan',
      'action-project-save',
      'action-project-open',
    ];
    for (const testId of expected) {
      expect(screen.getAllByTestId(testId)).toHaveLength(1);
    }

    fireEvent.click(screen.getByTestId('action-autowire'));
    expect(actionSpies.runAutoWire).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('action-check'));
    expect(actionSpies.runCheck).toHaveBeenCalledTimes(1);
  });

  it('Mehr: nennt die Desktop-Funktionen, die hier fehlen („Am Desktop verfügbar“)', () => {
    render(
      <PlannerPhoneLayer
        view="mehr"
        onSelectView={vi.fn()}
        onOpenCatalog={vi.fn()}
        onOpenDetail={vi.fn()}
        entryMessage={null}
      />
    );
    const section = screen.getByRole('region', { name: 'Am Desktop verfügbar' });
    expect(section).toHaveTextContent('MiniMap');
    expect(section).toHaveTextContent('Menüleiste');
  });

  it('Meldungsplatz: eine Meldung, Aktionsmeldung vor Einstiegstext (AC-O2)', () => {
    planState.plannerMessage = { type: 'success', message: 'Vorlage geladen und automatisch verbunden.' };
    render(<PlannerPhoneMessageBar entryMessage={{ type: 'info', message: 'Beispielplan geladen.' }} />);

    const slot = screen.getByTestId('planner-message-slot');
    expect(slot).toHaveAttribute('data-empty', 'false');
    expect(slot).toHaveTextContent('Vorlage geladen und automatisch verbunden.');
    expect(slot).not.toHaveTextContent('Beispielplan geladen.');
    expect(screen.getAllByTestId('action-feedback')).toHaveLength(1);
  });

  it('Meldungsplatz: leer heißt Höhe 0 — der Platz bleibt als Live-Region im DOM', () => {
    render(<PlannerPhoneMessageBar entryMessage={null} />);
    const slot = screen.getByTestId('planner-message-slot');
    expect(slot).toHaveAttribute('data-empty', 'true');
    expect(slot).toHaveClass('planner-message-slot--empty');
    expect(slot).toHaveAttribute('role', 'status');
  });

  it('Meldungsplatz: ein offener Dialog gewinnt — die Meldung bleibt gespeichert', () => {
    planState.plannerMessage = { type: 'error', message: 'Export fehlgeschlagen.' };
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);

    render(<PlannerPhoneMessageBar entryMessage={null} />);
    expect(screen.getByTestId('planner-message-slot')).toHaveAttribute('data-empty', 'true');

    dialog.remove();
  });
});
