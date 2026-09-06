# Design-Relaunch „Werft“ — Umsetzungsstand (D-1 bis D-9)

Stand: 03.09.2026 · Ein Commit pro Aufgabe auf `arena/01a06672-camp`, PR öffnet
mit Vorher/Nachher-Bildern; **Merge erst nach optischer Freigabe durch den
Nutzer** (Vorgabe agent.md).

## Aufgaben & Commits

| Aufgabe                 | Commit    | Kerninhalt                                                                                                                                                                                                                                              |
| ----------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 Token-Fundament     | `9abaf1f` | `app/globals.css` als einzige Farbquelle: Surface-Skala (canvas/panel/raised/hover), `--rule`/`--rule-strong`, `--oxide`-Akzent, ok/warn/error, `.dark`-Variante; Tailwind mappt alle Tokens; Hygiene-Test verbietet Farbliterale außerhalb globals.css |
| D-2 Typo & Raster       | `bc7b8df` | Inter (UI) + Outfit (nur Display) + IBM Plex Mono (Werte); Type-Scale 12/13/14/16/20/24/32 in `tailwind.config.ts`; 4-px-Raster dokumentiert                                                                                                            |
| D-3 App-Shell           | `58f0beb` | Sticky Top-Bar h-12, aktiver Nav-Unterstrich in Akzentfarbe, Aktionen rechts („Planer öffnen“); `.container-page`/`.prose-measure` als Seitenrhythmus                                                                                                   |
| D-4 Planer-Canvas       | `5675be7` | `.node-card` (1-px-Border, Radius 4, 2-px-Statusleiste), Handles 12 px mit Hover, Kanten 2 px (Backbone 4 px), MiniMap im Werkzeug-Stil, Spec-Zeilen in Mono                                                                                            |
| D-5 Panel-System        | `976bf39` | `.panel-header` (h-10, 11-px-Mono-Uppercase), Sektionen mit Divider, Padding 12/16; Inspector-Breakpoints unverändert                                                                                                                                   |
| D-6 Toolbar & Shortcuts | `dfbbe6d` | Tooltips (`.tool-btn` + `data-tooltip`), Shortcut-Badges (`kbd.shortcut-key`), `?`-Overlay im Werft-Stil                                                                                                                                                |
| D-7 Startseite          | `9fb70bf` | Hero mit Nutzenversprechen + Zwei-CTA-Hierarchie, drei Tool-Karten im Card-System, Guide-Teaser, ein H1                                                                                                                                                 |
| D-8 Zustände & Micro-UX | `1af22ef` | Fokus-Ringe seitenweit in `--oxide`, 150-ms-Transitions, `.skeleton`/CanvasSkeleton, ErrorBoundary-Fallback gestaltet                                                                                                                                   |
| D-9 Visuelle Regression | `5c929cd` | 32 Pixel-Baselines (4 Routen × hell/dunkel × 375/768/1440/Touch, 2 %-Schwelle) als CI-Check; Kontrast-Fix `--warn-info`; Lighthouse-A11y-Nachweis                                                                                                       |

Screenshots: `docs/design/relaunch/before/` (Alt-Zustand), `after/` (Endstand),
Zwischenstände je Aufgabe (`d1-tokens/`, `d2-typo/`, `d3-shell/`, `d4-canvas/`,
`d7-home/`). Aufnahme-Werkzeug: `scripts/design/capture-screenshots.mjs`.

## Nachweise (lokal gelaufen, 03.09.2026)

- `npm run check`-Bausteine: Lint ✓, Format ✓, Typecheck ✓, Typecheck (Tests) ✓
- Vitest: **1328/1328** grün (inkl. D-1-Farb-/D-2-Font-Guards, Kontrastprüfungen hell+dunkel)
- Playwright E2E gegen Static Export: **46/46** grün (Desktop 1440 + Mobile 375)
- axe (critical/serious = 0): grün auf Desktop + Mobile
- Lighthouse Accessibility: **100/100** (Startseite + Planer; Reports unter
  `lighthouse-report/*-relaunch.report.json`)
- Visuelles Gate: 32/32 stabil über zwei aufeinanderfolgende Läufe
- Produktions-Build: ✓ (Next 16.3.3, Static Export)

## A-3 Schutzregeln — Befund (nicht abschließbar mit Agenten-Rechten)

- Default-Branch: `feature/react-flow-cable-editor-7322653268250495059`
- Branch-Protection-API: mit dem aktuellen App-Token **nicht lesbar**
  (403 „Resource not accessible by integration“ — keine Admin-Rechte)
- Rulesets-API: leere Liste (`[]`)
- Konsequenz: Pull Request, Pflicht-Review und Required Checks
  („Typecheck, Tests & Build“ + „End-to-End (Playwright)“ aus `quality.yml`)
  müssen von einem Repo-Admin unter _Settings → Branches → Add branch ruleset_
  gesetzt werden. Keine Regel wurde gelockert oder umgangen.

## Offen (blockiert)

1. **GitHub-Verbindung**: Der Sandbox-Token ist abgelaufen (`GH_TOKEN invalid`).
   Nach dem Reconnect in Arena: `git push origin arena/01a06672-camp` und PR
   mit den Vorher/Nachher-Bildern öffnen (Text liegt vor).
2. **Optische Freigabe** durch den Nutzer → danach Mergen.
3. Nach dem Merge: Häkchen D-1…D-9 in `agent.md` setzen und committen.
