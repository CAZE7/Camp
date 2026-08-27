# Elektrikplaner — Agentenleitfaden

Next.js-App (TypeScript, Tailwind, React Flow, Zustand) zur Planung von Camper-Elektrik. Tests: Vitest (Unit) + Playwright (E2E).

## Befehle

- `npm run dev` · `npm run build` · `npm test` (Vitest) · `npm run typecheck`
- E2E: einmalig `npm run e2e:install`, dann `npm run e2e`
- Gate vor jedem Commit: `typecheck` + `test` grün.

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

## Mission 5: Betrieb & Hygiene

- [x] M5-1 Playwright verifizieren: 4 Specs × 4 Projekte lokal/CI grün (Nachzug zu K5).
- [x] M5-2 PR #316 (Mission 2, K1–K7) mergen oder schließen.
- [x] M5-3 Paketmanager festlegen: `package-lock.json` ODER `pnpm-lock.yaml` entfernen.
- [x] M5-4 Veraltete Branches löschen (`arena/*`, `add-*-tests-*`).
- [x] M5-5 Token-Budget: AGENTS.md ≤ 1.200 Tokens halten, bei jedem PR prüfen.

## Mission 6: Industriestandard Code

- [x] M6-1 ESLint + Prettier einrichten (`no-explicit-any`, `no-console`, `react-hooks`); in `check`-Script + CI einhängen.
- [x] M6-2 `useInlineNodeEditing`-Hook bauen; Copy-Paste-Edit-Block aus 11 Node-Komponenten migrieren (Battery, Inverter, Solar, Charger, Fuse, Busbar, Shunt, ShorePower, Consumer, Consumer230V, Ground).
- [x] M6-3 NodeData als Discriminated Union; `any` aus `Inspector.tsx`, `NodeInspectors.tsx` und Node-Props entfernen.
- [x] M6-4 Fehlerbehandlung: Result-Typ in `app/tools/heizung/page.tsx` (kein stiller `return 0`), Fehler-Feedback im BOMModal, `console.error` in PlannerDashboard ersetzen.
- [x] M6-5 `store/usePlannerStore.ts` in Zustand-Slices zerlegen (nodes / edges / ui / persist).
- [x] M6-6 `lib/autoWire.ts` modularisieren (sizing / routing / validation).
- [x] M6-7 Test-Mocks typisieren: `vi.mocked()` + typisierte Factories statt `as any` (19 Dateien).
- [x] M6-8 Audit-Reste: `NodeJS.Timeout` → `ReturnType<typeof setTimeout>` (RoadTripAnimation.tsx), stale Kommentare in WaterPipeEdge.test.tsx, 8 offene autoWire-Testgruppen (AUDIT-AUTOWIRE.md), ELEC-003 AC-Absicherung, CI-`skip_tests` restriktiv handhaben.

## Mission 7: Engineering Dark Theme (Planner)

- [x] M7-1 Design-Tokens: `.dark`-Block in globals.css (surface-0..2, border, text-high/med/low, accent, ok/warn/error, radius ≤ 4 px).
- [x] M7-2 Fonts: Planner auf Inter/IBM Plex Sans; Werte in IBM Plex Mono mit `tabular-nums`; Fraunces nur Marketing-Seiten.
- [x] M7-3 Canvas: Punkt-Raster, Statuszeile (Koordinaten/Zoom), Selektion 1 px in `--accent`.
- [x] M7-4 Density: 4-px-Spacing-Grid, Controls 28–32 px, Inspector-Werte rechtsbündig mit Einheit.
- [x] M7-5 Kontraste WCAG ≥ 4,5:1 prüfen; Lighthouse Accessibility 100 halten.

## Kontext

- Abgeschlossen: M1 Produktionsqualität (#314/#315), M3 UI/UX, M4 Audit (21.08.2026). Historie: Git-Log.
- Details: `AUDIT.md`, `AUDIT-AUTOWIRE.md`, `docs/` (ADRs, CI-Referenzen unter `docs/ci/workflows/`).
