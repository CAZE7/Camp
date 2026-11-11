/**
 * Gerätegrenzen des Planers — EINE Quelle für CSS-Klassen und MediaQueryList.
 *
 * Die Grenze „Handy“ ist nicht nur eine Breite: Ein flaches Fenster (Höhe
 * ≤ 500 px) zeigt dieselbe Hülle, weil dort keine Zeile Chrome über der
 * Zeichenfläche Platz hat. Die Abfrage stand vorher an zwei Stellen
 * (`PlannerDashboard`, `PlannerPhoneShell`) — hier ist sie einmal notiert und
 * wird von beiden importiert.
 *
 * CSS führt dieselben Werte in `app/globals.css` (`@media (max-width: 767px)`,
 * `@media (max-height: 500px)`); `md:`-Klassen entsprechen `min-width: 768px`.
 */
export const PHONE_CHROME_QUERY = '(max-width: 767px), (max-height: 500px)';

/** Tailwind-`md`-Grenze in Pixeln — Kataloggrenze, Sidebar-Spalte, Inspector. */
export const MD_BREAKPOINT = 768;

/** Kurzform für Kommentare und Tests. */
export const PHONE_BREAKPOINT = { maxWidth: 767, maxHeight: 500 } as const;

/**
 * DOM-Merkmal des offenen Expertenblatts (`ExpertPanel`).
 *
 * Auf dem Handy ist „Hilfe & Fachwissen“ eine eigene volle Ebene (Spec §7):
 * Solange sie offen ist, schweigt die Ansicht darunter. Das Merkmal steht am
 * Panel selbst, weil dessen `isOpen` lokaler Zustand ist — die Shell liest es
 * über einen Selektor, statt denselben Zustand ein zweites Mal zu halten.
 */
export const PHONE_EXPERT_OPEN_ATTRIBUTE = 'data-phone-expert-open';
