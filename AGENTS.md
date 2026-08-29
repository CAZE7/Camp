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
- Orthogonale Kabelführung: 16-px-Lanes, Kabeltyp-Gruppierung, Backbone-Hierarchie, Ausweichrouten.
- Keine neuen Features ohne Freigabe (kein PWA, kein Export/Import, keine Energiebilanz, kein Multi-Plan).
- Ein Commit pro Aufgabe; jeder Bugfix mit Regressionstest.
- Trade-offs aus PR #314 bleiben, bis ein reproduzierbarer Fehler sie widerlegt.

## Abgeschlossen

- M1–M4: Produktionsqualität (#314/#315), Engineering (#316), UI/UX, Audit (bis 21.08.2026).
- M5 Betrieb & Hygiene, M6 Industriestandard Code, M7 Dark Theme: PRs #346 + #348 (27./28.08.). Details: Git-Log, ADR 0005/0006.

## Mission 8: Bugfix-Runde (Nutzer-Feedback 28.08.)

- [ ] M8-1 Zoom-Stufen abschaffen: Symbole/Details ändern sich beim Zoomen nicht mehr. `PLANNER_OVERVIEW_ZOOM`/`PLANNER_FULL_DETAIL_ZOOM` (constants.ts), `isOverview`-Logik (FlowCanvas.tsx), Zoom-CSS-Klassen und Tier-Overlays (NodePresentation.tsx) entfernen; Nodes rendern immer Full-Detail. Abnahme: Zoom 0,25–2 identische Darstellung; Tests/Galerie angepasst.
- [ ] M8-2 Fachwissen-Panel (ExpertPanel.tsx): Schließen-Button unsichtbar seit Token-Umstellung (`text-paper/70` auf hellem Header). Auf Token-Farben umstellen; Panel als Slide-over mit sticky Header; Überlappung mit MiniMap / „Übersicht"-Button / Statuszeile beseitigen (Position + z-Index). Abnahme: X auf 375/768/1440 px sichtbar und klickbar, keine Control-Überlappung.
- [ ] M8-3 Schrift-Überlappungen: seit Inter-Umstellung (M7-2) breitere Glyphen → Texte in Node-Cards/Labels kollidieren. Fix: `min-width`/Overflow-Regeln in Node-Karten, Label-Kollision bei parallelen Kanten prüfen (`PARALLEL_LABEL_SPREAD`, pathUtils.ts). Abnahme: keine überlappenden Texte im Standardplan (25-Szenarien-Galerie visuell), inkl. 375 px.

## Mission 9: Repo & Release-Hygiene

- [ ] M9-1 Dependabot-Triage: dev-Gruppe #354 bei grünem CI mergen; Major-Bumps (#356 TS 7, #360 Tailwind 4, #357 lucide, #358 jsdom, #359 jest-dom, #361 knip) einzeln prüfen oder schließen — nie blind mergen. (Erledigt: #355 mit Next.js 16.3.3 Security-Fixes gemergt.)
- [ ] M9-2 Jules-PR-Triage: #332 + #345 nach PR #348 auf Überschneidungen prüfen, rebasen oder schließen. (Erledigt: #330 als Duplikat geschlossen.)
- [x] M9-3 CI-Patches aus `docs/patches/` in `.github/workflows/` anwenden (Quality Gate mit Lint/Format/Coverage, SHA-Pins, Smoke-Check integriert).
- [ ] M9-4 `main` zum Default-Branch machen, Feature-Branch einmergen; danach 254 verifiziert gemergte Branches löschen (`docs/merged-branch-candidates.txt`).
- [ ] M9-5 Visual Regression: Playwright-Screenshots für den Planner (hell+dunkel, 375 + 1280 px) gegen Baseline im CI.

## Kontext

- Details: `AUDIT.md`, `AUDIT-AUTOWIRE.md`, `docs/` (ADRs, CI-Referenzen unter `docs/ci/workflows/`). Historie: Git-Log.
