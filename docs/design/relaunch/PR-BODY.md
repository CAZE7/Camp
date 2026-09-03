# Design-Relaunch „Werft“ (agent.md D-1 bis D-9)

Umsetzung des CAD-Relaunchs laut `agent.md`: ruhige, präzise Optik — neutrale
Flächen, 1-px-Linien, ein Akzent (`--oxide`), technische Typo (Inter + IBM Plex
Mono), **hell und dunkel**. Ein Commit pro Aufgabe; Screenshots (375/768/1440 px)
liegen im Repo unter `docs/design/relaunch/`.

> ⚠️ **Merge erst nach optischer Freigabe durch den Nutzer** (Vorgabe agent.md).

## Vorher / Nachher (Kernrouten)

| Route                 | Vorher                                                                                                                      | Nachher                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Startseite 1440 hell  | [before](https://raw.githubusercontent.com/CAZE7/Camp/arena/01a06672-camp/docs/design/relaunch/before/start-1440-light.png) | [after](https://raw.githubusercontent.com/CAZE7/Camp/arena/01a06672-camp/docs/design/relaunch/after/start-1440-light.png) |
| Planer 1440 dunkel    | [before](https://raw.githubusercontent.com/CAZE7/Camp/arena/01a06672-camp/docs/design/relaunch/before/planer-1440-dark.png) | [after](https://raw.githubusercontent.com/CAZE7/Camp/arena/01a06672-camp/docs/design/relaunch/after/planer-1440-dark.png) |
| Planer 375 hell       | [before](https://raw.githubusercontent.com/CAZE7/Camp/arena/01a06672-camp/docs/design/relaunch/before/planer-375-light.png) | [after](https://raw.githubusercontent.com/CAZE7/Camp/arena/01a06672-camp/docs/design/relaunch/after/planer-375-light.png) |
| Startseite 375 dunkel | [before](https://raw.githubusercontent.com/CAZE7/Camp/arena/01a06672-camp/docs/design/relaunch/before/start-375-dark.png)   | [after](https://raw.githubusercontent.com/CAZE7/Camp/arena/01a06672-camp/docs/design/relaunch/after/start-375-dark.png)   |

Vollständige Sätze (jede Route, jede Größe, hell+dunkel): `docs/design/relaunch/before/` und `after/`.

## Umsetzung (1 Commit je Aufgabe)

- **D-1 Token-Fundament** (`9abaf1f`): `app/globals.css` als einzige Farbquelle — Surface-Skala (canvas/panel/raised/hover), `--rule`/`--rule-strong`, `--oxide`, Semantik (ok/warn/error), `.dark`-Variante; Tailwind mappt alle Tokens; **Hygiene-Test verbietet Hex-/rgb-Werte, Tailwind-Palettenklassen und CSS-Farbnamen außerhalb globals.css**; Dark Mode seitenweit via `prefers-color-scheme` (Inline-Skript, kein Flash).
- **D-2 Typo & Raster** (`bc7b8df`): Inter für UI, Outfit nur für Display-Headlines, IBM Plex Mono für Werte; Type-Scale 12/13/14/16/20/24/32; 4-px-Abstandsraster in `tailwind.config.ts` dokumentiert; Fraunces/Source Sans entfernt.
- **D-3 App-Shell** (`58f0beb`): sticky Top-Bar (h-12), Mark + Nav mit aktivem Unterstrich in Akzentfarbe, Aktionen rechts; einheitlicher Container/Seitenrhythmus über `/`, `/tools/*`, `/guides/*`, Impressum, Datenschutz.
- **D-4 Planer-Canvas** (`5675be7`): dunkle neutrale Zeichenfläche mit Punktraster; Node-Cards neu (1-px-Border, Radius 4, Icon + Titel + Mono-Spec-Zeile, Status als 2-px-Akzentleiste); Handles 12 px mit Hover; Kanten 2 px, Backbone 4 px; Selektion in Akzent; MiniMap/Controls im gleichen Stil.
- **D-5 Panel-System** (`976bf39`): `.panel`/`.panel-header` (h-10, 11-px-Mono-Uppercase)/`.panel-section` (Divider, Padding 12/16); Inspector-Breakpoints unverändert (Slide-over < 1280 px, Dock 288/320 px).
- **D-6 Toolbar & Shortcuts** (`dfbbe6d`): Tooltips + Shortcut-Badges; `?`-Overlay im Werft-Stil (Escape/Schleier/Button schließen).
- **D-7 Startseite** (`9fb70bf`): Hero mit Nutzenversprechen und klarer CTA-Hierarchie, drei Tool-Karten im selben Card-System, Guide-Teaser; ein H1.
- **D-8 Zustände & Micro-UX** (`1af22ef`): focus-visible-Ringe in Akzentfarbe (seitenweit), 150-ms-Transitions, Skeletons (Canvas), gestalteter ErrorBoundary-Fallback.
- **D-9 Visuelle Regression** (`5c929cd`): 32 Playwright-Baselines (Kernrouten, hell+dunkel, 375/768/1440/Touch, 2 %-Schwelle) als CI-Check; eigener Kontrast-Bug aus dem Gate behoben (`--warn-info` 4,44:1 → ≥ 4,5:1); Lighthouse-A11y-Nachweis.

## Nachweise

- Vitest **1328/1328** grün · Lint/Format/Typecheck grün
- Playwright E2E **46/46** grün (Static Export, Desktop + Mobile)
- axe critical/serious = 0 (Desktop + Mobile)
- **Lighthouse Accessibility 100/100** (Startseite + Planer) — Reports: `lighthouse-report/*-relaunch.report.json`
- Produktions-Build ✓

## A-3 Schutzregeln (aus `agent.md`) — Befund

- Branch-Protection für den Default-Branch ist mit Agenten-Rechten **nicht lesbar** (403); Rulesets-Liste leer.
- Setting (PR + Review + beide CI-Checks verpflichtend) muss ein Repo-Admin unter _Settings → Rules → Branch ruleset_ setzen. Nichts wurde gelockert.
