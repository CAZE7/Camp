# Elektrikplaner — Agentenleitfaden

Next.js-App (TypeScript, Tailwind, React Flow, Zustand) zur Planung von Camper-Elektrik. Tests: Vitest (Unit) + Playwright (E2E).

## Befehle

- `npm run dev` · `npm run build` · `npm test` (Vitest) · `npm run typecheck` · `npm run lint`
- E2E: einmalig `npm run e2e:install`, dann `npm run e2e`
- Gate vor jedem Commit: `npm run check` (lint + format + typecheck + tests) grün.

## Arbeitsweise

- Aufgaben der Reihe nach abarbeiten; ein PR pro Aufgabe.
- Nach Merge das Häkchen `[x]` in dieser Datei setzen und mitcommitten.
- Neue Erkenntnisse als neue IDs unten anhängen, bestehende Texte nicht umschreiben.

## Harte Regeln

- Responsive: alles funktioniert auf 375 / 768 / 1440 px.
- Touch First-Class: was per Maus geht, geht auch per Finger (Drag-Handle, Long-Press, Tap-to-Connect).
- Inspector: Slide-over < 1280 px; Docking ≥ 1280 px (288 px bis 1535, 320 px ab 1536).
- Keine neuen Features ohne Freigabe (kein PWA, kein Export/Import, keine Energiebilanz, kein Multi-Plan).
- Ein Commit pro Aufgabe; jeder Bugfix mit Regressionstest.
- Trade-offs aus PR #314 bleiben, bis ein reproduzierbarer Fehler sie widerlegt.

## Abgeschlossen

- M1–M7 (Produktionsqualität #314/#315, Engineering #316, UI/UX, Audit, Hygiene, Industriestandard, Dark Theme): PRs #346/#348, 27./28.08. Details: Git-Log, ADR 0005/0006.
- M9-3 CI-Patches angewendet (29.08.); #330 als Duplikat geschlossen.

## Mission 8: Bugfix-Runde — OFFEN (Nutzer-Feedback 28./29.08.)

- [x] M8-1 Zoom-Stufen abschaffen: Beim Rauszoomen verschwinden Inhalte zu früh und Symbole wechseln ihr Aussehen — das endet. `PLANNER_OVERVIEW_ZOOM`/`PLANNER_FULL_DETAIL_ZOOM` (constants.ts), `isOverview`-Logik (FlowCanvas.tsx), Zoom-CSS-Klassen, Tier-Overlays (NodePresentation.tsx) entfernen. Abnahme: Zoom 0,25–2 zeigt identische Darstellung, nichts verschwindet; Viewport-Culling statt Verstecken erlaubt; Tests/Galerie angepasst.
- [x] M8-2 Fachwissen-Panel (ExpertPanel.tsx): Schließen-Button unsichtbar (`text-paper/70` auf hellem Header) → Token-Farben; Slide-over mit sticky Header; keine Überlappung mit MiniMap / Übersicht-Button / Statuszeile. Abnahme: X auf 375/768/1440 px sichtbar/klickbar.
- [x] M8-3 Schrift-Überlappungen: Seit Inter-Umstellung (M7-2) kollidieren Texte in Node-Cards/Labels. `min-width`/Overflow-Regeln; Label-Kollisionen bei parallelen Kanten (PARALLEL_LABEL_SPREAD, pathUtils.ts). Abnahme: 0 überlappende Texte im Standardplan, inkl. 375 px.

## Mission 9: Repo-Hygiene — Restposten

- [ ] M9-1 KORREKTUR + Security: PR #355 wurde UNGEMERGED geschlossen — zuerst prüfen, welche Next.js-Version in package.json steht; wenn < 16.3.3: Update sofort nachholen (kritische RCE-Fixes, GHSA-p293-qw3h-jr36 / GHSA-2xp9-vwfh-vxw4). Danach Dependabot-Triage: #354 (dev-Gruppe) bei grünem CI mergen; Majors (#356 TS 7, #360 Tailwind 4, #357 lucide, #358 jsdom, #359 jest-dom, #361 knip) einzeln prüfen oder schließen — nie blind mergen.
- [ ] M9-2 Jules-PRs #332 + #345 nach PR #348 auf Überschneidungen prüfen, rebasen oder schließen.
- [ ] M9-4 `main` zum Default-Branch machen, Feature-Branch einmergen; danach 254 verifiziert gemergte Branches löschen (`docs/merged-branch-candidates.txt`).

## Mission 10: Perfektion — Routing, Design, visuelles Gate

- [x] M10-1 Routing-Qualität (messbar): Clearance ≥ 12 px zu fremden Knoten, keine Kanten durch Knoten; parallele Lanes konstant 16 px, Bündelung nach Quelle/Ziel; ≤ 2 Kreuzungen pro Kante im Referenzplan, einheitlicher Hop-Stil; Labels kollisionsfrei (Test: Bounding-Boxes in der 25-Szenarien-Galerie = 0 Kollisionen); Backbone optisch dominant; Determinismus-Test (gleicher Plan → identisches Routing); ≤ 16 ms im Benchmark.
- [x] M10-2 Design-Feinschliff Planner: alle Abstände auf 4-px-Raster; eine Akzentfarbe (--accent-line), Rest neutral; Hover/Active/Focus/Disabled an jedem Control, hell + dunkel; Zahlen durchgängig IBM Plex Mono + tabular-nums; keine Control-Überlappungen (Statuszeile/MiniMap/FAB/Toolbar) bei 375/768/1440 px.
- [ ] M10-3 Visuelles Gate (übernimmt M9-5): Playwright-Screenshot-Baseline des Referenzplans (375 + 1280 px, hell + dunkel) mit Diff-Schwelle im CI; UI-PRs enthalten Pflicht-Vorher/Nachher-Bilder.
- Detail-Spezifikation mit Wellenplan (Baseline → Zoom → Routing → Design → Gate): siehe Perfektions-Prompt (elektroplaner-perfektion-prompt.md).

## Kontext

- Details: `AUDIT.md`, `AUDIT-AUTOWIRE.md`, `docs/` (ADRs, CI-Referenzen). Historie: Git-Log.
