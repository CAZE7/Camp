/**
 * Zentrale, explizite React-Flow-Interaktionskonfiguration.
 *
 * Warum eine eigene Datei? Die Touch-/Maus-Props von React Flow entscheiden
 * darüber, ob Pan, Zoom, Node-Drag und Verbinden sich gegenseitig blockieren.
 * Bisher waren sie teils implizit (Defaults) oder an `window.innerWidth`
 * gekoppelt — das ist falsch: ein 1024-px-iPad ist Touch, ein 800-px-Fenster
 * am Desktop nicht. Maßgeblich ist die Zeigergenauigkeit
 * (`matchMedia('(pointer: coarse)')`), nicht die Breite.
 *
 * Die Funktion ist pur und damit unit-testbar (siehe flowInteraction.test.ts).
 */

/** Zeigerklasse: grob = Finger/Stift, fein = Maus/Trackpad. */
export type PointerMode = 'coarse' | 'fine';

/** Fangradius beim Verbinden — Finger brauchen mehr Toleranz als ein Mauszeiger. */
export const TOUCH_CONNECTION_RADIUS = 40;
export const MOUSE_CONNECTION_RADIUS = 20;

/** CSS-Selektor des dedizierten Drag-Griffs (siehe BaseNode). */
export const NODE_DRAG_HANDLE_SELECTOR = '.node-drag-handle';

/**
 * Fallback-Dauer zum Entsperren des Node-Körpers. Das Touch-Kontextmenü öffnet
 * bereits nach 500 ms und bricht diesen Timer ab; Verschieben wird dort gezielt
 * gewählt oder direkt über den Griff ausgeführt.
 */
export const LONG_PRESS_MS = 750;

/** Wegstrecke, die einen langen Druck als Pan-Geste verwirft. */
export const LONG_PRESS_MOVE_TOLERANCE = 10;

export type FlowInteractionProps = {
  panOnDrag: boolean | number[];
  panOnScroll: boolean;
  zoomOnScroll: boolean;
  zoomOnPinch: boolean;
  zoomOnDoubleClick: boolean;
  preventScrolling: boolean;
  connectionRadius: number;
  nodesDraggable: boolean;
  nodeDragThreshold: number;
  selectionOnDrag: boolean;
  selectionKeyCode: string | null;
  multiSelectionKeyCode: string[] | null;
  deleteKeyCode: string[] | null;
  panActivationKeyCode: string | null;
  /** true = Node-Körper zieht nicht, nur der Griff (`dragHandle`). */
  requiresDragHandle: boolean;
};

/**
 * Liefert die vollständige Interaktions-Konfiguration für eine Zeigerklasse.
 * Jede Prop ist begründet — bitte Kommentare mitpflegen, wenn etwas geändert wird.
 */
export function getFlowInteractionProps(mode: PointerMode): FlowInteractionProps {
  if (mode === 'coarse') {
    return {
      // Ein Finger auf leerer Fläche = Pan. Das ist die häufigste Touch-Geste
      // und muss ohne Modifier funktionieren.
      panOnDrag: true,

      // Kein Scroll-Pan: Touch-Scroll-Events entstehen auf Mobilgeräten fast nur
      // durch Browser-Overscroll; sie würden die Karte unkontrolliert verschieben.
      panOnScroll: false,

      // Kein Scroll-Zoom: Auf Touch gibt es kein Mausrad. Würden wir Wheel-Zoom
      // aktivieren, zoomt ein an ein Tablet gestecktes Trackpad ungewollt.
      zoomOnScroll: false,

      // Zwei-Finger-Pinch ist die erwartete Zoom-Geste auf Touch.
      zoomOnPinch: true,

      // Doppeltipp-Zoom aus: kollidiert mit Tap-to-Connect (zwei schnelle Taps
      // auf zwei Anschlüsse) und löst sonst unerwartete Sprünge aus.
      zoomOnDoubleClick: false,

      // Verhindert, dass die Seite hinter dem Canvas mitscrollt, während man pannt.
      preventScrolling: true,

      // Große Fangzone: ein Finger ist ~10 mm breit, 20 px reichen nicht.
      connectionRadius: TOUCH_CONNECTION_RADIUS,

      // Nodes sind grundsätzlich beweglich …
      nodesDraggable: true,
      // … aber nur über den Griff (`dragHandle`), damit Wischen über einem Node
      // die Karte pannt statt das Bauteil zu verschieben. Das ist der Kern von A4.
      requiresDragHandle: true,

      // Kleine Totzone gegen Wackler beim Antippen des Griffs.
      nodeDragThreshold: 4,

      // Keine Rubberband-Auswahl auf Touch: sie würde das Pan überschreiben.
      selectionOnDrag: false,
      selectionKeyCode: null,
      multiSelectionKeyCode: null,

      // Kein Hardware-Keyboard vorausgesetzt; Löschen läuft über den Inspector.
      // Explizit `null`, damit eine angeschlossene Tastatur nicht ohne Rückfrage löscht.
      deleteKeyCode: null,
      panActivationKeyCode: null,
    };
  }

  return {
    // Maus: Linksziehen auf leerer Fläche pannt (klassisch, ohne Modifier),
    // mittlere Taste ebenfalls. Rechtsklick bleibt frei für das Kontextmenü.
    panOnDrag: [0, 1],

    // Wheel zoomt (siehe zoomOnScroll) — beides gleichzeitig geht nicht.
    panOnScroll: false,

    // Scroll-Zoom ist die erwartete Desktop-Geste.
    zoomOnScroll: true,

    // Trackpad-Pinch am Desktop soll ebenfalls zoomen.
    zoomOnPinch: true,

    // Doppelklick-Zoom ist am Desktop unproblematisch und hilfreich.
    zoomOnDoubleClick: true,

    // Am Desktop ist der Canvas kein Scroll-Container der Seite.
    preventScrolling: true,

    // Präziser Zeiger → kleinerer Fangradius, sonst „springen“ Verbindungen.
    connectionRadius: MOUSE_CONNECTION_RADIUS,

    // Maus: Node überall anfassen, kein Griff nötig (Drag-to-Connect via Handles).
    nodesDraggable: true,
    requiresDragHandle: false,
    nodeDragThreshold: 1,

    // Shift+Ziehen = Auswahlrahmen (Linksziehen pannt ja bereits).
    selectionOnDrag: false,
    selectionKeyCode: 'Shift',
    multiSelectionKeyCode: ['Meta', 'Control'],

    // Löschen läuft bewusst über den globalen Handler in PlannerInner
    // (mit Rückfrage + Undo). React Flow darf nicht zusätzlich löschen.
    deleteKeyCode: null,

    // Leertaste + Ziehen pannt zusätzlich (Figma-Konvention) — auch dann,
    // wenn der Zeiger über einem Node steht.
    panActivationKeyCode: 'Space',
  };
}

/** Bequemer Ableiter aus einem matchMedia-Ergebnis. */
export const pointerModeFromCoarse = (coarse: boolean): PointerMode => (coarse ? 'coarse' : 'fine');
