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
- Diese Datei ≤ 1.500 Tokens halten; Erledigtes zeitnah ins Git-Log verlagern.

## Harte Regeln

- Responsive: alles funktioniert auf 375 / 768 / 1440 px.
- Touch First-Class: was per Maus geht, geht auch per Finger (Drag-Handle, Long-Press, Tap-to-Connect).
- Inspector: Slide-over < 1280 px; Docking ≥ 1280 px (288 px bis 1535, 320 px ab 1536).
- Keine neuen Features ohne Freigabe (kein PWA, kein Export/Import, keine Energiebilanz, kein Multi-Plan).
- Ein Commit pro Aufgabe; jeder Bugfix mit Regressionstest.
- Trade-offs aus PR #314 bleiben, bis ein reproduzierbarer Fehler sie widerlegt.

## Abgeschlossen

- M1–M8 komplett, M9-1-Security (Next 16.3.3 gepinnt), M9-3, M10-1/M10-2: PRs #346/#348/#365 (27.–29.08.). Details: Git-Log, ADR 0005/0006.

## Restposten (aus M9/M10)

- [ ] R-1 Dependabot-Triage: #354 (dev-Gruppe) bei grünem CI mergen; Majors (#356 TS 7, #360 Tailwind 4, #357 lucide, #358 jsdom, #359 jest-dom, #361 knip) einzeln prüfen oder schließen — nie blind mergen.
- [ ] R-2 Jules-PRs #332 + #345 nach PR #348/#365 auf Überschneidungen prüfen, rebasen oder schließen.
- [ ] R-3 `main` zum Default-Branch machen, Feature-Branch einmergen; danach 254 verifiziert gemergte Branches löschen (`docs/merged-branch-candidates.txt`).
- [ ] R-4 Visuelles Gate (M10-3): Playwright-Screenshot-Baseline des Referenzplans (375 + 1280 px, hell+dunkel) mit Diff-Schwelle im CI — blockiert, bis PNG-Baselines existieren; UI-PRs mit Vorher/Nachher-Bildern.

## Mission 11: Profi-Niveau

- [ ] M11-1 DESIGN-SPRUNG (Top-Prio, Nutzer-Vorgabe): Planner visuell auf CAD-Niveau polieren — Node-Cards, Toolbar, Panels, Handles neu gestaltet (Token-basiert, hell+dunkel). PFLICHT: Vorher/Nachher-Screenshots (375/768/1440 px) im PR — Merge erst nach optischer Freigabe durch den Nutzer.
- [ ] M11-2 AutoWire-Platzierung: Bauteile werden aktuell ungünstig gesetzt → Kabel laufen Umwege. Fix: AutoWire platziert Knoten in Flussrichtung (Quellen → Verteilung → Verbraucher), auf dem 16-px-Grid, mit konsistenten Abständen; optional Auto-Layout (dagre) direkt nach dem Verdrahten. Metrik als Test: Gesamtkabellänge im Referenzplan ≤ 1,3× Manhattan-Optimum, keine Kante mit > 2 Richtungswechseln ohne Grund.
- [ ] M11-3 Tastatur-First wie CAD: Canvas komplett ohne Maus bedienbar (Bauteil bewegen/verbinden/löschen per Tastatur) + Shortcut-Overlay per `?`. Abnahme: E2E baut Mini-Plan nur per Tastatur.
- [ ] M11-4 `prefers-reduced-motion` global respektieren (tokenbasiert, nicht pro Komponente).
- [ ] M11-5 Performance-Gate: Lighthouse Performance ≥ 90 im CI + Bundle-Budget (ADR); React Compiler evaluieren (ADR).
- [ ] M11-6 Fonts: Inter + IBM Plex Mono subsetten (latin), kritische Schnitte preloaden; LCP vorher/nachher im PR.
- [ ] M11-7 Security-Headers fürs Static Hosting: CSP, X-Content-Type-Options, Referrer-Policy, frame-ancestors; CSP-Strategie als ADR.
- [ ] M11-8 Touch-E2E echt: Pinch-Zoom, Long-Press, Tap-to-Connect, Drag-Handle als Playwright-Gesten (bisher nur Unit-Ebene).
- [ ] M11-9 Stress-Budget: 100 Bauteile / 300 Kanten — Pan/Drag/Auto-Wire ≤ 16 ms/Frame; Benchmark-ADR.
- [ ] M11-10 Fehler-Monitoring-ADR: ErrorBoundary → Reporting evaluieren (privacy-konform) oder begründet ablehnen.

## Kontext

- Details: `AUDIT.md`, `AUDIT-AUTOWIRE.md`, `docs/` (ADRs, CI-Referenzen). Historie: Git-Log.
