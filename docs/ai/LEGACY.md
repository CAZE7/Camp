# LEGACY

Was Altbestand ist, **warum** er noch existiert, wer ihn benutzt und ob er entfernt werden kann.
Zweck: verhindern, dass ein Agent eine alte und eine neue Implementierung vermischt.

---

## L-1 — Iterativer Router `orthogonalRouting.ts`

- **Was:** `components/edges/utils/orthogonalRouting.ts` (628 Zeilen) mit
  `buildOrthogonalPath`, `orthogonalWaypoints`, `routeWaypoints`, `avoidObstacles`.
  Invariantensystem **R1–R7** (`docs/ROUTING-INVARIANTS.md`).
- **Warum existiert er:** Er war der erste Router des Projekts (vor A*). Er blieb, weil die
  Routing-Galerie und ihre Referenzdaten auf ihm aufbauen.
- **Wer benutzt ihn:** `scripts/routing/generate-gallery.ts`,
  `components/edges/utils/routingQuality.ts`, sowie
  `orthogonalRouting.test.ts`, `orthogonalRouting.invariants.test.ts`,
  `routingGallery.test.ts`, `routeAll.test.ts`.
- **Produktivpfad?** **Nein.** Der Canvas rendert ausschließlich über
  `routePlan` → `findCablePath` (Hanan-A* + Katalog). Das Architektur-Gate prüft, dass
  `app/`, `components/`, `lib/` und `store/` den Legacy-Router nicht importieren.
- **Entfernbar?** Nur mit der Galerie. Vorher entscheiden, ob `docs/routing-gallery/` als
  Geometrie-Referenz erhalten bleibt; bis dahin ist die Isolation der verbindliche Zustand.
- **Gefahr:** R1–R7 sagen nichts über das, was der Nutzer sieht. Änderungen hier sind
  **keine** Routing-Verhaltensänderung am Planer.

---

## L-2 — `LaneRegistry` (Korridor-Lanes)

- **Was:** `lib/routing/rules/laneRegistry.ts` — deterministische Lane-Vergabe je Korridor
  inkl. 3-Stufen-Sortierung (Topologie → Zielposition → Edge-ID).
- **Warum:** Routing-V2-Mechanik für stabile Korridorpräferenzen.
- **Wer benutzt sie:** `routePlan()` über `buildPreferredLanes()` sowie die Tests.
- **Produktivpfad?** **Ja.** Die Registry beeinflusst den Kandidaten-Tie-Break; Port-Fan-Out
  bleibt davon getrennt die lokale Anschlussregel.
- **Entfernbar?** Nein — sie ist Teil der Produktionswahrheit.

---

## L-3 — Kostenmodell-Funktionen ohne Konsument

- **Was:** `segmentExtraCost`, `preferredLaneBonus`, `buildCostWeights` in
  `lib/routing/rules/costModel.ts`.
- **Warum:** vollständige Kostenmatrix des Produktionspasses.
- **Wer:** `routePlan()`/`findCablePath()` und `costModel.test.ts`. Im Produktionsvergleich
  wirken hard/soft/weighted/nearby; die geometrische Primärkostenfunktion bleibt zur
  Golden-Master-Stabilität der erste Rang, das vollständige Modell der zweite.
- **Entfernbar?** Nein — Änderungen am Modell ändern reales Kandidatenverhalten und brauchen
  Golden-/Regression-Nachweis.

---

## L-4 — Domänen-Trennregeln produktiv verdrahtet

- **Was:** `buildDomainSeparationRules`, `requiredClearanceBetween`,
  `classifyDomainAwareSegments` in `lib/routing/rules/collision.ts`.
- **Warum:** Paarregeln (Elektrik ↔ Wasser, AC 230 ↔ DC 12 → 24 px) der Spec §4.2.
- **Wer:** `routePlan()`/`findCablePath()`, Final Validation und `collision.test.ts`.
- **Produktivpfad?** **Ja.** `routeAll` übergibt Domain-Metadaten; Port-Stubs sind die
  dokumentierte Ausnahme, Crossings bleiben erlaubt.
- **Entfernbar?** Nein — sie ist Teil der gemeinsamen Collision Engine.

---

## L-5 — Server-Code im statischen Export

- **Was:** `app/api/chat/route.ts` (422 Zeilen, AI-SDK + Postgres), `lib/db.ts` (`pg.Pool`).
- **Warum:** übernommener Altbestand eines KI-Assistenten mit Server-Backend.
- **Wer:** `app/ki-assistent/page.tsx` → `components/Chat.tsx` (postet per Default gegen
  `/api/chat`); Tests mocken `pg` vollständig.
- **Funktioniert im Export?** **Nein** — `next.config.ts` setzt `output: 'export'`
  ([KNOWN-PROBLEMS ARCH-001](./KNOWN-PROBLEMS.md#arch-001--server-route-und-postgres-pool-im-statischen-export)).
- **Entfernbar?** Ja, wenn der KI-Assistent kein Produktziel ist. Nicht ohne Produktentscheidung.

---

## L-6 — Totes Datenfeld `CableEdgeData.geometry`

- **Was:** `geometry?: { points: {x,y}[] }` in `lib/domain/cableEdgeData.ts`.
- **Warum:** Einfallstor der entfernten zweiten Routing-Engine (ADR 0014).
- **Wer:** niemand — Lesen ist per Test verboten (`scripts/routing/architecture.test.ts`).
- **Entfernbar?** Ja (mit Persistenz-Kompatibilität: unbekannte Felder bleiben beim Laden
  ohnehin erhalten).

---

## L-7 — Forschung / Prototyp

- **`docs/planer-uebersicht/prototyp/index.html`** (2639 Zeilen, eine HTML-Datei) — Recherche-
  Prototyp der Planer-Übersicht. Kein Build, kein Test, nicht Teil der App.
- **`docs/planer-uebersicht/RECHERCHE.md`** — die zugehörige Untersuchung.
- **Entfernbar?** Ja, wenn die Recherche abgeschlossen ist. Vorher nicht anfassen.

---

## L-8 — Benchmarks ohne npm-Script

`benchmarks/` enthält acht Dateien; nur zwei sind verdrahtet:

| Verdrahtet (`package.json`)                                           | Nicht verdrahtet               |
| --------------------------------------------------------------------- | ------------------------------ |
| `edgeRoutingPerf.bench.ts` (`npm run perf:edge-routing`, **CI-Gate**) | `conduitOptimization.bench.ts` |
| `routeAllScaling.probe.ts` (`npm run perf:route-scaling`)             | `conduit_node_benchmark.ts`    |
|                                                                       | `filter_vs_map.bench.ts`       |
|                                                                       | `solarCalculations.bench.ts`   |
|                                                                       | `solarFinal10.bench.ts`        |

Die nicht verdrahteten Sonden sind historische Messungen. Sie laufen nicht im CI und sind
kein Gate.

---

## L-9 — Archivierte Audits

`AUDIT.md`, `AUDIT-AUTOWIRE.md`, `AUDIT-CAMP-ELEKTROPLANER.md`, `AUDIT-EXTREM-2026-09.md`
sind **Momentaufnahmen** (Baseline 2026-09-06, Nachträge 2026-09-07). Ihr Statusblock
(`NOT SAFE` / `NOT READY`) beschreibt die **damals auditierte Baseline**, nicht den heutigen
Stand: alle vier BLOCKING ISSUES sind behoben und im Dokument selbst als behoben markiert.

**Regel:** Audit-Aussagen nie ohne Gegenprüfung in den Code übernehmen. Der aktuelle Stand
steht in `docs/ai/*`.
