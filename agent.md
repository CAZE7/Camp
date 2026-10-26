# Übergabe: Admin-Aufgaben + offene Restposten

Verbindliche Regeln: [`AGENTS.md`](AGENTS.md) · Übergabe-Prompt:
`docs/ci/pages-deploy-handoff-prompt.md`
Diese Datei listet nur **Offenes**. Erledigtes steht im Git-Log; die IDs bleiben
unten als Zitatziel (Code-Kommentare/ADRs verweisen z. B. auf „agent.md R-1“).

## Offen

### Admin (GitHub-Settings, kein Code)

- [ ] **A-3** Branch-Protection für `main`: PR + Review + beide CI-Checks
      verpflichtend. Keine Regel lockern, nur damit ein roter Check grün wird.

### Stack (pro Aufgabe ein Commit; `npm run check` + visuelle Baselines ohne Diff)

- [ ] **S-2 (Rest)** Tailwind v4 läuft. Offen: Tokens von `tailwind.config.ts`
      nach `@theme` in `app/globals.css` überführen (`@config`-Brücke entfernen,
      globals.css bleibt einzige Farbquelle); `tailwindcss-animate` → `tw-animate-css`.
- [ ] **S-4** Bild-Export: `html-to-image` (lazy in
      `components/planner/utils/exportPlanImage.ts`) gegen SnapDOM/modern-screenshot
      prüfen. Abnahme: Export-E2E grün, Export-Zeit vorher/nachher, dynamischer
      Import bleibt (nichts in den Initial-Bundle-Pfad).

### Routing-Performance (Abnahme: `benchmarks/edgeRoutingPerf.bench.ts`, 100+-Kanten-Plan)

- [ ] **P-1** Affected-Set: Re-Route nur für Kanten am gezogenen Knoten plus
      Kanten, deren Pfad-BBox die alte/neue Node-BBox schneidet
      (`SegmentSpatialIndex`). Abnahme: Drag kostet O(betroffene Kanten) statt
      O(E), keine veralteten Pfade.
- [ ] **P-2** Drag in zwei Stufen: Vorschau währenddessen, voller
      `routeAll`-Pass erst am Drag-Ende (100–150 ms gedrosselt). Endqualität =
      Szenario-Gallery.
- [ ] **P-4** `useLiveValidation` an `edgeTopologySignature` koppeln statt an
      jede Mutation; nur der Spannungsfall folgt gedrosselt der Geometrie.
      Abnahme: Lauf-Zähler-Test — reines Verschieben validiert keine Topologie.
- [ ] **P-5** `nudgeOrthogonalPaths` nur auf betroffene Trassen scopen (setzt
      P-1 voraus). Abnahme: Gallery ohne Diff, Bench-Verbesserung notiert.
- [ ] **P-6** Routing-Worker verdrahten: `routing.worker.ts` +
      `routingWorkerClient.ts` existieren, haben aber keinen Produkt-Konsumenten.
      Abnahme: Main-Thread ≤ 16 ms/Frame am 100+-Kanten-Plan, Pfade identisch.

## Erledigt (nur IDs — Details im Git-Log)

- **A-1, A-2, A-4, A-5** Pages-Deploy-Übergabe.
- **D-1…D-9** Design-Relaunch. Weitergeltend aus D-1: `app/globals.css` ist die
  einzige Farbquelle.
- **R-1…R-11** Routing-Qualität. Weitergeltend aus R-1: kein „fertig“ ohne
  Metrik-Nachweis.
- **S-1** React Flow 12 (ADR 0013) · **S-3** lucide-react 1.x · **S-5** ADR 0003
  als erweitert markiert (ADR 0011).
- **P-3** Viewport-Culling aktiv (`FlowCanvas.tsx`) · **P-7** Benchmark-Gate im
  CI (ADR 0012/0030).
