/**
 * Overlay-Routen des Planers — EINE Quelle der Wahrheit darüber, welche Ebene
 * gerade offen ist.
 *
 * Warum ein eigenes Modul: Vorher hielten Menüleiste, Werkzeugleiste,
 * Warnzentrale, Experten-Panel, Vorlagen-Blatt und die Handy-Blätter jeweils
 * eigenen `useState`. Jede dieser Ebenen wusste nichts von den anderen — daher
 * lagen Blatt über Blatt, FAB über Dialog und Toast über Zoom (Ist-Befund
 * 2026-11-10). Hier steht nur, WER offen ist und WIE STARK er andere verdrängt;
 * gerendert wird in genau einer Host-Komponente bzw. an genau einem Ort je
 * Route.
 *
 * Die Stufen sind bewusst wenige und benannt (kein `z-index`-Poker):
 *
 *   menu      — Datei … Hilfe, Vorlage, ⋯, Ansicht, Darstellung.
 *               Ein Menü ist die schwächste Ebene: Es öffnet sich nur, wenn
 *               nichts anderes offen ist, und schließt beim nächsten Klick.
 *   report    — Prüfbericht (Warnzentrale) auf Desktop/Tablet.
 *   help      — Hilfe & Fachwissen (Experten-Panel).
 *   layer     — Handy-Ebene: Katalog, Detail, Prüfungsansicht als volle Ebene.
 *   dialog    — modale Dialoge (Stückliste, Bestätigung, AutoWire-Review,
 *               Kürzel, Einführung). Verdrängt alles andere.
 *
 * `overlayBlocksInteraction(route)` beantwortet die eine Frage, die die Hosts
 * brauchen: Muss der Inhalt darunter `inert` sein?
 */

export type PlannerOverlayId =
  'menu' | 'report' | 'help' | 'catalog' | 'detail' | 'warning-view' | 'more' | 'dialog';

export type PlannerOverlay = {
  id: PlannerOverlayId;
  /** Nur für `menu`: welche Menüleiste offen ist (Datei, Werkzeugzeuge, ⋯ …). */
  key?: string;
};

const PRIORITY: Record<PlannerOverlayId, number> = {
  menu: 10,
  report: 20,
  help: 30,
  more: 35,
  catalog: 40,
  detail: 45,
  'warning-view': 45,
  dialog: 100,
};

export function overlayPriority(route: PlannerOverlayId): number {
  return PRIORITY[route];
}

/**
 * Darf `next` die aktuell offene Route ersetzen? Ja, wenn sie mindestens
 * gleich stark ist. Eine schwächere Ebene öffnet sich nie über einer
 * stärkeren — sie würde sonst verdeckt aufgehen und den Fokus stehlen.
 * Gleiche Ebene ersetzt (z. B. Katalog → Detail, Menü → anderes Menü).
 */
export function canOpenOverlay(current: PlannerOverlay | null, next: PlannerOverlayId): boolean {
  if (!current) return true;
  return overlayPriority(next) >= overlayPriority(current.id);
}

/** Verlangt diese Ebene, dass der Inhalt darunter `inert` ist? */
export function overlayBlocksInteraction(route: PlannerOverlay | null): boolean {
  if (!route) return false;
  return route.id !== 'menu' && route.id !== 'report' && route.id !== 'more';
}

/** Ist diese Ebene sichtbar, solange `route` offen ist? */
export function overlayIsActive(route: PlannerOverlay | null, id: PlannerOverlayId): boolean {
  return route?.id === id;
}

/**
 * Die modalen Dialoge (AccessibleDialog/ConfirmDialog) melden sich NICHT über
 * die Route an: Sie öffnen aus jeder Ebene heraus (auch aus dem Detail) und
 * stellen ihre Vorgängerebene beim Schließen wieder her. Damit der Meldungsplatz
 * sie trotzdem erkennt, gilt: Ein sichtbarer `role="dialog"` blockiert den
 * Meldungsplatz.
 */
export const DIALOG_SELECTOR = '[role="dialog"]';
