# Elektrikplaner — Agentenleitfaden

Next.js-App (TypeScript, Tailwind, React Flow, Zustand) zur Planung von Camper-Elektrik. Tests: Vitest (Unit) + Playwright (E2E).

## Befehle

- `npm run dev` · `npm run build` · `npm test` (Vitest) · `npm run typecheck`
- E2E: einmalig `npm run e2e:install`, dann `npm run e2e`
- Gate vor jedem Commit: `typecheck` + `test` grün.

## Harte Regeln

- Responsive: alles funktioniert auf 375 / 768 / 1440 px.
- Touch First-Class: was per Maus geht, geht auch per Finger (Drag-Handle, Long-Press, Tap-to-Connect).
- Inspector: Slide-over < 1280 px; Docking ≥ 1280 px (288 px bis 1535, 320 px ab 1536).
- Orthogonale Kabelführung: 16-px-Lanes, Kabeltyp-Gruppierung, Backbone-Hierarchie, Ausweichrouten.
- Keine neuen Features ohne Freigabe (kein PWA, kein Export/Import, keine Energiebilanz, kein Multi-Plan).
- Ein Commit pro Aufgabe; jeder Bugfix mit Regressionstest.
- Trade-offs aus PR #314 bleiben, bis ein reproduzierbarer Fehler sie widerlegt.

## Offene Aufgaben (Mission 5)

- **M5-1** Playwright verifizieren: 4 Specs × 4 Projekte lokal/CI grün (Nachzug zu K5).
- **M5-2** PR #316 (Mission 2, K1–K7) mergen oder schließen.
- **M5-3** Paketmanager festlegen: `package-lock.json` ODER `pnpm-lock.yaml` entfernen.
- **M5-4** Veraltete Branches löschen (`arena/*`, `add-*-tests-*`).
- **M5-5** Token-Budget: AGENTS.md ≤ 1.000 Tokens halten, bei jedem PR prüfen.

## Kontext

- Abgeschlossen: M1 Produktionsqualität (#314/#315), M3 UI/UX, M4 Audit (21.08.2026). Historie: Git-Log.
- Details: `AUDIT.md`, `AUDIT-AUTOWIRE.md`, `docs/` (ADRs, CI-Referenzen unter `docs/ci/workflows/`).
