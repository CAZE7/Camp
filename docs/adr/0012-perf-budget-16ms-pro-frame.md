# ADR 0012: Perf-Budget 16 ms Main-Thread pro Frame am 100+-Kanten-Referenzplan

Status: Akzeptiert (2026-09-06, WP-11 / #400, absorbiert agent.md P-7)

## Kontext

Der Planer routet jede Kante im Render-Pfad des Main-Threads (`CableEdge`
→ `buildOrthogonalPath`, mit Frame-Cache aus PERF-01/02/05). Wächst ein
Plan, wächst dieser Aufwand — und ab einer Grenze ruckelt jede
Interaktion (Drag, Zoom, Verbinden), weil das Routing den Frame
blockiert. Bisher wurde `benchmarks/edgeRoutingPerf.bench.ts` nur manuell
aufgerufen und verglich lediglich „vorher/nachher“ der Cache-Optimierung;
es gab kein hartes Budget und keinen CI-Fail bei Verschlechterung.

## Entscheidung

`npm run perf:edge-routing` enthält ein **Gate mit hartem Budget**:

- **Budget: 16 ms Main-Thread pro vollständigem Render-Durchlauf.**
- **Referenzplan: 36 Nodes / 134 Kanten** — mehr als 100 Kanten (Vorgabe
  aus #400) und oberhalb von `CROSSING_SCAN_EDGE_LIMIT` (120), also exakt
  der Produktionsmodus großer Pläne (Frame-Cache aktiv, Kreuzungsscan
  abgeschaltet).
- **Messwert: Median über 30 Durchläufe** nach einem Warmup-Lauf.
- Überschreitung ⇒ Exit-Code 1 ⇒ Quality-Pipeline schlägt fehl.

### Warum genau 16 ms?

- 16,67 ms ist die Frame-Dauer bei 60 Hz — der M11-9-Maßstab („flüssig
  auf üblicher Hardware“). Wer den ganzen Frame fürs Routing verbraucht,
  hat für React-Commit, Layout und Paint nichts mehr übrig; das Budget
  ist also bewusst die OBERGRENZE des Vertretbaren, kein Zielwert.
- Der Worst Case im Produkt ist ein Drag, bei dem JEDER Frame alle
  Kanten neu routet. 16 ms Routing bedeutet dort bereits sichtbares
  Ruckeln — jede Regression über dieses Budget hinaus ist ein echter,
  spürbarer Qualitätsverlust und kein Messartefakt.
- Ist-Zustand bei Einführung: Median ≈ 3 ms auf dem CI-Klasse-Runner
  (gemessen 2,8 ms, Sandbox ≙ ubuntu-latest). Das Budget lässt also
  ≈ 5× Luft — es fängt strukturelle Regressionen (algorithmische
  Verschlechterung, versehentlich entfernter Cache), nicht
  Runner-Rauschen.
- Median statt Mittelwert/Maximum, weil CI-Runner einzelne
  Scheduler-Ausreißer produzieren; ein flackerndes Gate würde nur
  abgeschaltet werden und wäre damit wertlos.

## Konsequenzen

- **CI-Verdrahtung (manueller Schritt für Maintainer):** der Session-Token
  darf `.github/workflows/` nicht ändern. In `quality.yml` (und dem
  eingecheckten Spiegel `docs/ci/workflows/quality.yml`) gehört direkt
  nach dem Coverage-Schritt:

  ```yaml
  - name: Perf-Gate Kanten-Routing (WP-11 / #400)
    # Harter Budget-Check: Median ≤ 16 ms Main-Thread pro Frame am
    # 100+-Kanten-Referenzplan (Begründung: dieser ADR).
    # Überschreitung ⇒ Exit-Code 1 ⇒ Gate rot.
    run: npm run perf:edge-routing
  ```

- Jede Änderung am Routing-Pfad (Pathfinding, Kostenmodell, Caches,
  später ELK-Integration im Worker) läuft gegen ein hartes, dokumentiertes
  Budget. „Schneller Rechner des Autors“ ist kein Maßstab mehr.
- Der ELK-Pass (WP-4) läuft asynchron außerhalb des Frames und ist vom
  Budget nicht betroffen; das Gate misst bewusst nur den synchronen
  Bestands-/A\*-Pfad, der den Main-Thread blockieren kann.
- Wird der Referenzplan verändert (Größe, Topologie), ist das eine
  bewusste Budget-Änderung und gehört mit Begründung in diesen ADR und
  ins Change Ledger.

## Alternativen

- **Kein Budget, nur Beobachtung** (Status quo): Regressionen fallen erst
  im Produkt auf; abgelehnt — genau das ist vor PERF-01 passiert.
- **Strengeres Budget (z. B. 8 ms):** attraktiver Zielwert, aber auf
  geteilten CI-Runnern zu nah am Rauschen kleiner Läufe; das Gate würde
  flackern. Verschärfung bleibt möglich, sobald Messreihen aus CI
  vorliegen.
- **Benchmark im Browser (Playwright) statt Node:** realistischeres
  Rendering, aber um Größenordnungen langsamer und flakiger; die reine
  Routing-Rechnung ist in Node identisch und deterministisch messbar.
- **`vitest bench`:** misst Durchsatz relativ, kennt aber kein absolutes
  Budget mit Exit-Code — ein eigenes Gate im bestehenden Benchmark-Skript
  ist die kleinste Lösung ohne neue Abhängigkeit.
