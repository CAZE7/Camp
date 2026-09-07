# ARCHITECTURE-CHANGES — Change Ledger

> Revisionssicheres Verzeichnis aller Architekturentscheidungen und -änderungen
> von CAMP/Routing V2. **Konvention:** Architektur-Änderungen (Schichtenmodell,
> Contract-Prinzipien, eingefrorene Spec `docs/ROUTING-V2.md`, Routing-Regelwerk)
> nur mit Eintrag hier + ggf. neuer ADR in `docs/adr/`. PRs ohne Ledger-Eintrag,
> die den Contract berühren, werden abgelehnt (Review-Checkliste in
> `docs/ARCHITECTURE-V2.md` §2).

Format: neueste Einträge oben. Jeder Eintrag: Datum, Bezug (ADR/WP/Issue), Kurzbegründung.

---

## 2026-09-07 — Audit EXTREM 2026-09: Sicherheits-/Korrektheits-Fixes + Golden-Master-Neueinfrierung

Bezug: `AUDIT-EXTREM-2026-09.md` (Findings ELE-001…007, AC-001, AUTO-001…004, CRASH-001,
NORM-001…003, PERSIST-001, CACHE-001, PERF-001, ROUTE-001/002, UX-001…003, DOM-001/002, ELE-006).

**Elektrik (Single Source of Truth):**

- **ELE-001/NORM-002:** `FUSE_MAP` ist abgeleitet — größte Norm-Sicherung ≤ Tabellen-Belastbarkeit
  × 0,7 (`lib/electrical.ts`). Koordination I_B ≤ I_n ≤ I_z per Konstruktion; Invariant-Test hält
  sie fest. Vorher widersprach die Karte der eigenen Dimensionierung (1,5 mm²: 16 A-Sicherung bei
  11,55 A design-Belastbarkeit).
- **ELE-002:** Thermische Sättigung oberhalb 70 mm² erzeugt jetzt Fehler „Leitung thermisch
  überlastet" (`collectEdgeErrors`) statt stiller 70-mm²-Kappung ohne Warnung.
- **ELE-005:** Leistungsabhängige DC-Ströme rechnen mit der **Entladeschlussspannung**
  (12,8 V × 0,9375 = 12,0 V; `dischargeFloorVoltage`), und die Wechselrichter-Last ist
  **topologisch** begrenzt: mit Kantenliste zählt nur die 230-V-Insel des jeweiligen WR (BFS),
  ohne Kantenliste gilt die dokumentierte globale Summe als konservativer Fallback.
  `calculateEdgeCurrent` hat dazu den optionalen Parameter `edges`; alle Anzeige-/Dimensionierungs-
  Call-Sites (CableEdge, voltageDrop, BOMModal, ExpertPanel, sizing, pipeline) reichen ihn durch.
- **ELE-006/UX-002:** ExpertPanel-Inverter-Strom nutzt continuousPower zuerst und dieselbe
  Floor-Spannung wie die Engine; Fachtexte (DoD 90 %/50 %, Sicherungswerte, Batterie-Querschnitt)
  auf Engine-Werte gebracht.
- **AC-001:** Neue kritische Live-Regel für Wechselrichter-AC-Inseln ohne FI (≤ 30 mA);
  `hasRcd` am Inverter pflegbar (Inspector-Checkbox). Templates/Szenario-Fixtures führen den FI
  als Referenz-Best-Practice (analog shorePower).
- **CRASH-001:** `sizeAcEdges` normiert Alt-/Import-Querschnitte (95/0/NaN/3) statt RangeError;
  Regressionstest „wirft nie" in `lib/autoWire.test.ts`.
- **AUTO-001/002:** Länge-0-Guard in `crossSectionForDrop`; negative Längen fallen in Anzeige und
  Spannungsfall auf physikalische Ersatzwerte + Fehlermeldung.

**Norm-Historie (keine unbelegten Zitate mehr):** Leerrohr-Füllgrad 60 % → **40 %**
(DIN VDE 0100-520-Kontext dokumentiert, NORM-001); „VDE 0298-4"-Zitate durch ehrliche
Modellannahmen ersetzt (NORM-002/003).

**Routing (PERF-001/ROUTE-001/ROUTE-002):** A*-Hindernisfilter pro Kante (räumliche Umgebung,
PAD 240 px) statt globaler Scan — 500-Knoten-Pläne bleiben interaktiv; `crossingSegmentsNear`
nutzt den Identitäts-Index `itemBySegment` (O(Kandidaten) statt O(Kandidaten × E)); Fallback-Pfade
kennzeichnen Hindernis-Kollisionen jetzt explizit (`PathResult.fallbackHitsObstacles`).
**Dokumentierte Ausnahmen der harten Kollisionsgarantie (ROUTE-001):** (a) ungeprüfter
Fallback-Pfad bei Katalog+A*-Versagen — jetzt zählbar gekennzeichnet, nicht versteckt;
(b) Stub-Toleranz gegen entzerrte Boxen; (c) Rohbox+2px-Schrumpfung an handle-klebenden Nodes.
Der Verwurf endpoint-enthaltender Hindernis-Boxen in `relevantObstacles` bleibtvertragsgemäß
für Aufrufer, die die eigene Node mitgeben (Unit-Tests); der Produktionspfad schließt die eigene
Node vorher aus.

**Persistenz/Cache:** `migratePlannerPersisted` validiert Node-/Edge-Hüllen hart
(id/position/source/target, NaN-safe) und sanitisiert kaputte `data`-Objekte (PERSIST-001);
Spannungsfall-Cache-Signatur um continuousPower/capacity/hours/rating/hasRcd erweitert (CACHE-001).

**Golden Master neu eingefroren (`knownPlans/`)** — Begründung: Die ELE-001/ELE-005-Änderungen
sind bewusste Korrektheits-Fixes des Strommodells (höhere Ströme durch 12,0-V-Floor ⇒ teils
größere Sicherungen/Querschnitte, Insel- statt Global-Last am WR). Elektrisch konservativer,
nicht schwächer; Suite inkl. Invarianten grün.

**Bewusst NICHT geändert (Modellgrenzen, DOM-001/002/ROUTE-003):** 230-V-Seite bleibt
Single-Line-Approximation ohne PE/N-Modell; Kurzschlussstrom/Abschaltvermögen/Batterieinnen-
widerstand sind nicht modelliert; ELK-Pass ist vorbereitet, aber nicht im Produktivpfad
verdrahtet (s. ROUTING-V2-Statusnotiz). Der Planer ist ein Dimensionierungs-Werkzeug und
ersetzt keine Elektrofachkraft.

## 2026-09-06 (WP-7)

- **Kreuzungs-Hopping als Regel, nicht als Renderer-Trick** — `lib/routing/rules/hopping.ts` (`routingPriority`, `resolveHops`) beantwortet „wer hüpft?“ in Schicht 2/3 und liefert der UI nur noch Bogen-Mittelpunkte. Damit gilt dieselbe Antwort für ELK- und A\*-Pass, sie ist ohne Browser testbar (ADR 0007) und deterministisch (ADR 0010: Reihenfolge über sortierte IDs, Gleichstand über die lexikografisch größere ID). (WP-7, #395)
- **Prioritätsstaffelung festgelegt** — `manualLock` 10000 > `backbone` 1000 > `domain` 0…300 + `crossSection` 0…280. Die beiden strukturellen Terme können von den fachlichen nicht überstimmt werden (Trunk bleibt gerade); Domäne und Querschnitt liegen laut Spec-Formel (§8, reine Summe) bewusst auf einer Ebene. Zwei fixierte Leitungen erzeugen **keinen** Hop — eine stille Änderung an einem vom Nutzer festgelegten Verlauf wäre schlimmer als die ungeschmückte Kreuzung. Ein Lock-Feature existiert in der UI noch nicht; die Regel ist bereits umgesetzt. (WP-7, #395)
- **Kein neues Token** — der Bogenradius ist als `laneGrid / 2` (8 px) abgeleitet (`hopRadius()`), analog zu `alternativeRouteGap`. So bleibt der Bogen garantiert schmaler als der Lane-Abstand und die eingefrorene Token-Liste (ROUTING-V2.md §3) unverändert. Neues Geometrie-Primitiv `segmentIntersectionPoint` in `lib/routing/geometry/segments.ts`. (WP-7, #395)
- **Reine Darstellung** — Hops werden erst nach `alignSharedCorridors` + `nudgeOrthogonalPaths` bestimmt und ausschließlich in den SVG-Pfad geschrieben (`waypointsToPathWithHops`). Waypoints, Länge, Bends und Kreuzungszahl bleiben unberührt: Golden Master (13/13) und Routing-Regression (50/50) byte-identisch, Perf-Gate 2.35 ms Median. Ohne globale Route (Einzelpfad-Fallback in `CableEdge`) wird weiterhin ohne Bogen gezeichnet. (WP-7, #395)

## 2026-09-06 (S-1, Stack-Track)

- **ADR-0013** React Flow 12 (`@xyflow/react`) als Canvas-Paketlinie — Voraussetzung für WP-7 (#395) und WP-8 (#397) laut `docs/AGENT-PLAN-ROUTING-V2.md` (Stack-Track). Paketwechsel `reactflow@11` → `@xyflow/react@12`; **ADR 0002 dadurch erweitert** (v11-Bindung aufgehoben), ADR 0007 unberührt (RF bleibt UI-Adapter). (agent.md S-1)
- **Messgrenze zentralisiert** — `components/edges/utils/nodeGeometry.ts` ist die einzige Stelle, die gemessene Größe (`measured`), absolute Position (`internals.positionAbsolute`) und Handle-Rechtecke liest; die flache v11-Form bleibt gültige Eingabe, weil `knownPlans/`, Golden Layouts und gespeicherte Pläne Knoten so beschreiben. Verhalten unverändert: Golden Master + Routing-Regression byte-identisch. (ADR 0013)
- **Store-/UI-Typen geschärft** — v12 typisiert `Node['data']` als `Record<string, unknown>` (v11: `any`); Store und Inspektoren führen `PlannerFlowNode = Node<CommonNodeData>`, Kanten-Props laufen über den Kanten-Typ (`EdgeProps<CableEdgeType>`). Kein neuer `any`-Pfad. (ADR 0013)

## 2026-09-06 (WP-6, WP-9 … WP-11)

- **ADR-0012** Perf-Budget 16 ms Main-Thread/Frame am 100+-Kanten-Referenzplan — `npm run perf:edge-routing` ist jetzt ein hartes Gate (Median über 30 Läufe, Exit-Code 1 bei Überschreitung). Absorbiert agent.md P-7. In `quality.yml` (und dem Spiegel `docs/ci/workflows/quality.yml`) als blockierender Schritt direkt nach dem Coverage-Schritt eingetragen. (WP-11, #400)
- **Golden Layouts eingefroren** — `scripts/regression/goldenLayouts.json` + deterministische SVGs in `docs/routing-regression/`: 15 Szenarien (#400), Wegpunkt-genau + Metrik-Budget „Delta ≤ 0“ (Kreuzungen/Bends/Länge; Clearance-Verstöße = 0). Refresh nur via `npm run regression:capture` + PR-Begründung. (WP-11, #400)
- **Invarianten-Suite CI-blockierend** — `lib/routing/invariants.ts` prüft I1–I7 aus ROUTING-V2.md §12 für BEIDE Pässe; ELK strikt (I1–I4, I7 = 0), Bestandsrouter als Ratchet-Baseline (nur Abbau erlaubt, Behebung WP-7/WP-8 nach S-1). I9-Determinismus per Doppel-Lauf. (WP-10, #399)
- **Port-Fan-Out zentralisiert** — `lib/routing/rules/portFanOut.ts`: eine Sortierquelle für Stub-Reihenfolge am Port UND ELK-FIXED_ORDER-Portindizes; `routeAll.portOrderedLaneOffsets` delegiert (verhaltensidentisch, Golden Master byte-gleich). (WP-9, #398)
- **A\*-Kostenmodell aus Tokens** — `lib/routing/rules/costModel.ts`: alle Gewichte aus `laneGrid` generiert, Sync-Test gegen den Legacy-Wert (crossing = 120); `pathfinding.scorePath` konsumiert `COST_WEIGHTS.crossing`. Vollintegration in den A*-Pass folgt mit WP-8. (WP-6, #396)

## 2026-09-06 (WP-2 … WP-4)

- **ADR-0011** ELK Layered (elkjs) als globaler Layout-Pass — A/B-Gate bestanden (Kreuzungen 53→13, Bends 199→92 über die 6 Golden-Master-Pläne); Konfiguration aus Tokens generiert; Worker-Vertrag P-6 (letzte Anfrage gewinnt); bestehender Router bleibt Fallback. Erledigt agent.md S-5. (WP-4, #393)
- **ADR-0003 als „erweitert/überlagert“ markiert** — gilt weiter für Fallback-Router und inkrementellen Pass. (WP-4, #393)
- **Neue Abhängigkeit `elkjs`** (EPL-2.0) — Begründung und Nachweis in ADR 0011; nur via dynamischem Import geladen (Bundle-Budget M11-5). Issue-Kommentar war wegen fehlender Schreibrechte des CI-Tokens nicht möglich; Ankündigung dokumentiert hier + ADR.
- **Kollisionsmodell fixiert** — `classifyCollision()` / `RoutingConstraint` / `domainSeparationRules` in `lib/routing/rules/`; ELK- und A*-Pass konsumieren dasselbe Modell. (WP-3, #391)
- **Geometrie-Schicht eingezogen** — `lib/routing/geometry/` (pure Functions); Router re-exportieren, `segmentsIntersect` u. a. nicht mehr doppelt gepflegt. Verhalten unverändert (Golden Master grün). (WP-2, #392)

## 2026-09-06

- **ADR-0007** React Flow bleibt UI-Adapter — RF ist Canvas + Interaktion, keine Fachlogik. (WP-0c, #403)
- **ADR-0008** Domain Model wird unabhängig von React Flow — Planner Domain nutzt RF-Typen nur als Übergangs-Datentyp, langfristig eigenes Modell. (WP-0c, #403)
- **ADR-0009** Crossings sind erlaubt, Overlaps verboten — Kollisionsmodell-Kernregel: Overlap = HARD, Crossing = SOFT/Optimierungsziel. (WP-0c, #403)
- **ADR-0010** Routing ist deterministisch — gleicher Input ⇒ identischer Output, für beide Pässe (ELK + A*); Grundlage von Golden Master, Golden Layouts und LaneRegistry. (WP-0c, #403)
- **ADR-0003 Statusvermerk** — „Orthogonales Routing statt Wegfindung“ bleibt gültig für den inkrementellen Pass, wird aber im Zuge der ELK-Adoption (WP-4, #393) als **teilweise überlagert** markiert; die endgültige Markierung + neue ELK-ADR erfolgt in WP-4 (agent.md S-5).
- **Verworfen:** Negotiated Congestion / PathFinder als Routing-Verfahren — Overkill für die Graphgröße (100–300 Kanten); ELK Layered + Hanan-A* decken das Ziel ab (ROUTING-V2.md §1, Nicht-Ziel).
- **Architecture Contract fixiert** — `docs/ARCHITECTURE-V2.md` (WP-0a, #401): Schichtenmodell, 4 Prinzipien, Dependency Map, Datei-Katalog. Reviews prüfen dagegen.
- **Golden Master eingefroren** — `knownPlans/` (WP-0b, #402): 6 Pläne, Pipeline-Fixtures des Ist-Systems (Input → AutoWire → Electrical → Routing). V2-Ergebnisse müssen identisch oder bewusst besser sein (Begründung im PR + hier).
