import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
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

/**
 * Handy-Hülle: Die Hülle selbst hat ihre eigene Suite
 * (`PlannerPhoneShell.test.tsx`) — hier zählt nur, WANN sie erscheint und was
 * sie vom Arbeitsbereich fernhält. Kopf, Ansicht, Meldungsplatz und Fuß werden
 * deshalb durch Kennungen ersetzt.
 */
vi.mock('./planner/ui/PlannerPhoneShell', () => ({
  PHONE_CHROME_QUERY: '(max-width: 767px), (max-height: 500px)',
  PHONE_SHELL_ATTRIBUTE: 'data-phone-shell',
  PlannerPhoneHeader: ({ projectName }: { projectName: string }) => (
    <div data-testid="planner-phone-header">{projectName}</div>
  ),
  // Der Schaltplan ist die Fläche selbst — die echte Ebene rendert dafür
  // Der Schaltplan ist die Fläche selbst — die echte Ebene rendert dafür
  // keine Ansicht. Der Stub hält denselben Vertrag.
  PlannerPhoneLayer: ({ view, entryMessage }: { view: string; entryMessage: unknown }) => (
    <div data-testid="planner-phone-view" data-phone-view={view}>
      <div data-testid="planner-phone-message" data-entry={entryMessage ? 'yes' : 'no'} />
    </div>
  ),
  PlannerPhoneMessageBar: ({ entryMessage }: { entryMessage: unknown }) => (
    <div data-testid="planner-phone-message" data-entry={entryMessage ? 'yes' : 'no'} />
  ),
  PlannerPhoneNav: ({
    activeView,
    onSelectView,
  }: {
    activeView: string;
    onSelectView: (v: string) => void;
  }) => (
    <nav data-testid="planner-phone-nav" aria-label="Planerbereiche" data-active={activeView}>
      {['bauteile', 'schaltplan', 'pruefung', 'mehr'].map((view) => (
        <button key={view} type="button" onClick={() => onSelectView(view)}>
          {view}
        </button>
      ))}
    </nav>
  ),
}));
vi.mock('./planner/ui/PhoneCanvasTools', () => ({
  PhoneCanvasTools: () => <div data-testid="phone-canvas-tools" />,
}));

/**
 * Geräteklasse steuern: `viewportMock.phone` schaltet die MediaQueryList-Antwort.
 * Standard ist „Desktop“ — die Layout-Suiten prüfen die drei Spalten.
 */
const viewportMock = vi.hoisted(() => ({ phone: false }));

// Einstiegsmeldung: Der echte Hook würde den Beispielplan laden. Für die
// Layout-Suite genügt ein steuerbarer Zustand — der Dismiss-Aufruf ist der
// Regressionstest für „Meldung bleibt nach dem Leeren stehen“.
const entryPlanMock = vi.hoisted(() => ({
  notice: null as null | { type: string; message: string },
  dismissNotice: vi.fn(),
}));
vi.mock('./planner/hooks/usePlannerEntryPlan', () => ({
  usePlannerEntryPlan: () => ({ notice: entryPlanMock.notice, dismissNotice: entryPlanMock.dismissNotice }),
}));

// --- Stores -------------------------------------------------------------
const setInspectorOpen = vi.fn();
const setSidebarOpen = vi.fn();
const setSelectedNodes = vi.fn();
const setSelectedEdges = vi.fn();
const plannerState: Record<string, unknown> = {
  viewMode: 'electric',
  setViewMode: vi.fn(),
  isInspectorOpen: true,
  setInspectorOpen,
  isSidebarOpen: false,
  setSidebarOpen,
  selectedNodes: [],
  selectedEdges: [],
  // Die Statuszeile liest Umfang und Prüfstand direkt aus dem Store.
  nodes: [],
  edges: [],
  waterNodes: [],
  waterEdges: [],
  plannerErrors: [],
  setSelectedNodes,
  setSelectedEdges,
  undo: vi.fn(),
  redo: vi.fn(),
  canUndo: false,
  canRedo: false,
  deleteSelected: vi.fn(),
  // Meldungsplatz (Spezifikation §16.1): Der Einstiegstext schreibt in den
  // einen Meldungszustand des Stores, nicht mehr in ein absolutes Overlay.
  setPlannerMessage: vi.fn(),
  plannerMessage: null,
  // Befund-Synchronisation (Badge am Fuß, Warnzentrale, Prüfbericht): Die
  // Shell schreibt die Live-Warnungen in den Store. Ohne die Aktion würde
  // jeder Renderschritt mit „setPlannerErrors is not a function“ brechen.
  setPlannerErrors: vi.fn(),
  autoWireReport: null,
};

vi.mock('./planner/hooks/useLiveValidation', () => ({
  useLiveValidation: () => [],
  useVerificationReport: () => null,
}));

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
    plannerState.nodes = [];
    plannerState.waterNodes = [];
    plannerState.viewMode = 'electric';
    plannerState.canUndo = false;
    plannerState.canRedo = false;
    entryPlanMock.notice = null;
    entryPlanMock.dismissNotice.mockClear();
    viewportMock.phone = false;
    // Die Shell fragt `matchMedia(PHONE_CHROME_QUERY)`; der globale Stub in
    // `vitest.setup.ts` antwortet immer `false`. Hier wird die eine Abfrage
    // steuerbar, alle anderen bleiben beim Stub.
    window.matchMedia = ((query: string) => ({
      matches: viewportMock.phone && query.includes('max-width: 767px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  it('A1 (375 px): zeigt die Handy-Hülle statt der Chrome-Leiste', () => {
    viewportMock.phone = true;
    render(<PlannerInner />);

    expect(screen.getByTestId('planner-phone-header')).toHaveTextContent('Elektrikplan');
    expect(screen.getByTestId('planner-phone-nav')).toHaveAttribute('aria-label', 'Planerbereiche');
    expect(screen.getByTestId('planner-phone-view')).toHaveAttribute('data-phone-view', 'bauteile');
    expect(screen.getByTestId('planner-phone-message')).toHaveAttribute('data-entry', 'no');
    // Die Chrome-Leiste ist auf dem Handy nicht montiert — kein zweiter Weg
    // zu denselben Aktionen (AC-K1).
    expect(screen.queryByTestId('planner-dashboard')).not.toBeInTheDocument();
  });

  it('A1: die Fußleiste wechselt zwischen den vier Ansichten', () => {
    viewportMock.phone = true;
    render(<PlannerInner />);

    fireEvent.click(screen.getByRole('button', { name: 'pruefung' }));
    expect(screen.getByTestId('planner-phone-view')).toHaveAttribute('data-phone-view', 'pruefung');
    expect(screen.getByTestId('planner-phone-nav')).toHaveAttribute('data-active', 'pruefung');

    // Werkzeugzone nur auf dem Schaltplan (Spec §6.2).
    expect(screen.queryByTestId('phone-canvas-tools')).not.toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'schaltplan' }));
    });
    expect(screen.getByTestId('phone-canvas-tools')).toBeInTheDocument();
    // Der Schaltplan ist die Fläche selbst — keine Ebene darüber, aber der
    // Meldungsplatz bleibt im Fluss (Spec §5.3).
    expect(screen.queryByTestId('planner-phone-view')).not.toBeInTheDocument();
    expect(screen.getByTestId('planner-phone-message')).toBeInTheDocument();
    // Die Zeichenfläche bleibt in jeder Ansicht montiert (Spec §5).
    expect(screen.getByTestId('flow-canvas')).toBeInTheDocument();
  });

  /**
   * Regressionen aus dem ersten echten Browser-Lauf (2026-11-10). Jeder Test
   * hält einen Fehler fest, der auf dem Handy wirklich auftrat — nicht eine
   * Annahme über das Markup.
   */
  it('Handy: Kopf und Fuß bleiben bedienbar — die Ansicht liegt NUR über der Fläche', () => {
    viewportMock.phone = true;
    render(<PlannerInner />);

    const surface = screen.getByTestId('planner-canvas-surface');
    // Der Stub der Ebene trägt `planner-phone-view` (die echte trägt beides).
    const layer = screen.getByTestId('planner-phone-view');
    // Die Ebene ist Geschwister der Fläche, nicht der Shell: Läge sie in der
    // Shell mit `absolute inset-0`, fängt sie die Klicks auf die Fußleiste ab
    // (gemessen 390×844: `elementFromPoint` im Tab traf die Ebene).
    expect(surface.contains(layer)).toBe(false);
    expect(screen.getByTestId('planner-phone-header').contains(layer)).toBe(false);
    expect(screen.getByTestId('planner-phone-nav').contains(layer)).toBe(false);
    // Die Fläche ist unter der Ansicht gesperrt — und nur sie.
    expect(surface).toHaveAttribute('inert');
    expect(screen.getByTestId('planner-phone-header').closest('[inert]')).toBeNull();
    expect(screen.getByTestId('planner-phone-nav').closest('[inert]')).toBeNull();
  });

  it('Handy: auf dem Schaltplan ist die Fläche nicht gesperrt', () => {
    viewportMock.phone = true;
    render(<PlannerInner />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'schaltplan' }));
    });
    expect(screen.getByTestId('planner-canvas-surface')).not.toHaveAttribute('inert');
  });

  it('Handy: die Aktionsmeldung landet im Meldungsplatz (Kanal lebt in der Shell)', () => {
    viewportMock.phone = true;
    render(<PlannerInner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('planner-action-feedback', {
          detail: { type: 'info', message: 'Kabelführung verbessert.' },
        })
      );
    });

    // Vorher lauschte nur `PlannerDashboard` auf das Ereignis — und das ist auf
    // dem Handy nicht montiert. Die Meldung kam nie an. Nachweis über den
    // Store: Der Kanal hat geschrieben (die Anzeige selbst ist der echte
    // Meldungsplatz, im E2E geprüft).
    expect(plannerState.setPlannerMessage).toHaveBeenCalledWith({
      type: 'info',
      message: 'Kabelführung verbessert.',
    });
  });

  it('Desktop: derselbe Kanal funktioniert unverändert', () => {
    render(<PlannerInner />);
    (plannerState.setPlannerMessage as ReturnType<typeof vi.fn>).mockClear();

    act(() => {
      window.dispatchEvent(new CustomEvent('planner-save', { detail: {} }));
    });
    expect(plannerState.setPlannerMessage).toHaveBeenCalled();
  });

  it('A2/Desktop: Chrome-Leiste statt Handy-Hülle', () => {
    render(<PlannerInner />);
    expect(screen.getByTestId('planner-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('planner-phone-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('planner-phone-nav')).not.toBeInTheDocument();
  });

  it('A2 (768 px): Sidebar + Canvas nebeneinander, Inspector als Overlay', () => {
    render(<PlannerInner />);

    // Die Shell ist eine Spalte (Menüleiste, Werkzeugleiste, Arbeitsbereich,
    // Statuszeile) — die Zeilenrichtung trägt der Arbeitsbereich ab md.
    expect(shell().className).toContain('flex-col');
    expect(shell().className).toContain('h-dvh');
    expect(shell().className).toContain('overflow-hidden');
    const workspace = screen.getByTestId('planner-workspace');
    expect(workspace.className).toContain('md:flex-row');
    expect(workspace.className).toContain('min-h-0');
    expect(workspace.className).not.toContain('md:flex-rowdark');

    // Sidebar und Canvas sind ab md beide sichtbar. Die Zeichenfläche ist
    // seit M12 zusätzlich auf jeder Breite montiert (auf dem Handy liegt das
    // Blatt darüber) — deshalb prüft sie auf `flex` statt auf `md:flex`.
    expect(column('planner-sidebar').className).toContain('md:flex');
    expect(screen.getByTestId('planner-canvas-column').className).toContain('flex');

    // Inspector liegt zwischen 768 und 1279 px als Overlay über dem Canvas …
    const aside = screen.getByRole('complementary', { name: 'Eigenschaften' });
    expect(aside).toHaveAttribute('id', 'inspector-panel');
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
    const canvasColumn = screen.getByTestId('planner-canvas-column');

    // Inspector: 288 px ab 1280 px, 320 px ab 1536 px.
    expect(aside.className).toContain('xl:w-[288px]');
    expect(aside.className).toContain('2xl:w-[320px]');

    // Canvas: flex-1 mit 600 px Mindestbreite, kein w-auto.
    expect(canvasColumn.className).toContain('flex-1');
    expect(canvasColumn.className).toContain('xl:min-w-[600px]');
    expect(canvasColumn.className).not.toContain('w-auto');
    expect(column('planner-sidebar').className).not.toContain('w-auto');
  });

  it('hides a collapsed docked inspector from desktop focus and accessibility navigation', () => {
    plannerState.isInspectorOpen = false;
    render(<PlannerInner />);

    expect(screen.getByTestId('inspector-panel')).toHaveClass('xl:invisible');
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

  it('entfernt die Einstiegsmeldung, sobald der Plan leer ist — lässt sie bei Inhalt stehen', () => {
    entryPlanMock.notice = { type: 'example', message: 'Beispielplan geladen.' };
    const { rerender } = render(<PlannerInner />);
    expect(entryPlanMock.dismissNotice).toHaveBeenCalledTimes(1);

    // Mit einem Bauteil beschreibt die Meldung weiterhin die Fläche.
    entryPlanMock.dismissNotice.mockClear();
    plannerState.nodes = [{ id: 'battery-1' }];
    rerender(<PlannerInner />);
    expect(entryPlanMock.dismissNotice).not.toHaveBeenCalled();

    // Und der Text steht im Meldungsplatz — nicht mehr als absolute Karte
    // über der Zeichenfläche (Ist-Befund 2026-11-10: Streifen über den Karten).
    const setMessage = plannerState.setPlannerMessage as unknown as ReturnType<typeof vi.fn>;
    expect(setMessage).toHaveBeenCalledWith(expect.objectContaining({ message: 'Beispielplan geladen.' }));
    expect(document.querySelector('.planner-entry-notice')).toBeNull();
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

  /**
   * UX-Reset 2026-09: Die Schrittleiste sagt nicht nur „Bauteil fehlt", sie
   * bringt den Nutzer dorthin — auf dem Handy in den Katalog-Tab, ab 768 px
   * in die eingeklappte Spalte, jeweils mit Fokus auf der Bauteilsuche.
   */
  it('öffnet auf planner-open-catalog den Bauteilkatalog und fokussiert die Suche', async () => {
    const search = document.createElement('input');
    search.id = 'component-search';
    document.body.appendChild(search);
    const focusSpy = vi.spyOn(search, 'focus');

    render(<PlannerInner />);

    act(() => {
      window.dispatchEvent(new CustomEvent('planner-open-catalog'));
    });

    expect(setSidebarOpen).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('planner-sidebar')).toBeVisible();
    // Der Fokus liegt im nächsten Frame (der Tab-Bereich wird erst jetzt sichtbar).
    await waitFor(() => expect(focusSpy).toHaveBeenCalledTimes(1));

    focusSpy.mockRestore();
    search.remove();
  });
});
