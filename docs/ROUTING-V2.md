# ROUTING-V2 — Spezifikation des Kabel-Routings

> **Status: SPEC-FIRST (eingefroren per Freeze-Gate).**
> Dieses Dokument ist die Spezifikation **vor** dem Programmieren, nicht die Dokumentation danach.
> Es wird in Phase 0 erstellt und vor Implementierungsbeginn eingefroren (siehe Epic #389).
> Änderungen nach dem Freeze nur noch via ADR (`docs/adr/`) + Eintrag im Change Ledger
> (`docs/ARCHITECTURE-CHANGES.md`).
> **Revision 2026-09-06:** Abgleich mit agent.md-Tracks S-1…S-5 / P-1…P-7 und M11-1
> (Token-Zwillinge, Handle-Geometrie) — Änderungen siehe Abschnitte 3, 5, 6.3, 10, 14, 16.

---

## 1. Zweck

Das Kabel-Routing des Camp-Planners auf Industriestandard heben. Zwei Pässe, ein Regelwerk:

- **ELK Layered (elkjs)** als globaler Layout-Pass — Crossing-Minimization, orthogonales
  Edge-Routing, Port-Constraints in einem Durchgang.
- **Eigener Hanan-A\* als inkrementeller Pass** für Nutzerinteraktionen — Knotenpositionen
  fixiert, nur betroffene Kanten neu routen (Drag-Interaktionen).

**Nicht-Ziel:** Negotiated Congestion / PathFinder — bewusst verworfen (Overkill für die
Graphgröße; dokumentiert im Change Ledger).

## 2. Architekturvertrag

### 2.1 Schichtenmodell (CAMP V2, Richtung)

```text
UI
 ↓
React Flow Adapter
 ↓
Planner Domain (AutoWire / Electrical / Validation)
 ↓
Routing Engine
 ↓
Layout / Rendering
```

### 2.2 Prinzipien (Architecture Contract)

1. React Flow kennt **keine** Elektrofachlogik.
2. AutoWire kennt **kein** React.
3. Routing kennt **keine** UI.
4. Validierung liefert strukturierte Regeln/Fehler.

### 2.3 Routing-interne Schichten

```text
1. Geometry      — pure Geometrie-Primitives, kein Domänenwissen
2. Routing Rules — Tokens, Kollisionsklassen, Lanes, Kostenmodell (router-agnostisch)
3. Domain Rules  — fachliche Trennregeln (domainSeparationRules)
```

ELK-Pass und A\*-Pass konsumieren **dieselben** Regeln aus Schicht 2/3. Kein Router
besitzt eine eigene Definition von Kollisionen, Abständen oder Lanes.

## 3. Design Tokens (Single Source of Truth)

Alle geometrischen Konstanten leben genau einmal im Token-Modell (`lib/designTokens.ts`
oder `lib/routing/tokens.ts`). ELK-Optionen und A\*-Straffunktion leiten ausschließlich
daraus ab (generiert, nicht gepflegt; Config-Sync-Test schlägt bei Hardcode fehl).

| Token                | Wert  | Verwendung                                             |
| -------------------- | ----- | ------------------------------------------------------ |
| `cableClearance`     | 12 px | Mindestabstand Kabel ↔ Kabel / Kabel ↔ Node            |
| `elkEdgeNodeSpacing` | 16    | ELK `spacing.edgeNode` / `edgeNodeBetweenLayers`       |
| `stubMin`            | 24 px | Mindestlänge vor erstem Bend; Mindestsegmentlänge      |
| `laneGrid`           | 16 px | Kanalabstand paralleler Trassen (≈ Node-Raster)        |
| `bendRadius`         | 8 px  | Einheitliche Rundungen; Bend-Merge-Schwelle 2×r        |
| `crossDomainSpacing` | 24 px | Wert für Domain-Trennung (Paar-Regel s. Abschnitt 4.2) |

**Integration ins bestehende Token-System (M11-1):** `lib/designTokens.ts` pflegt seit
M11-1 RGB-Triplet-Zwillinge (`--x-rgb`) mit Drift-Guard in `lib/designTokens.test.ts`;
D-1 gilt: `globals.css` bleibt einzige Farbquelle. Die Routing-Tokens **erweitern**
dieses System (gleiche Konventionen, gleiche Test-Disziplin) und ersetzen es nicht.
S-2 (Tailwind v4) überführt die Config später nach `@theme` — berührt die Routing-Tokens
nicht inhaltlich.

## 4. Kollisionsmodell

### 4.1 Kollisionsklassen

| Typ                             | Klasse       | Konsequenz                                     |
| ------------------------------- | ------------ | ---------------------------------------------- |
| Edge × Node                     | **HARD**     | verboten — garantiert unmöglich                |
| Edge × Edge — Overlap/kollinear | **HARD**     | verboten — garantiert unmöglich                |
| Edge × Edge — Crossing          | **SOFT**     | minimieren; falls unvermeidbar → Hop-Rendering |
| Clearance-Verletzung            | **WEIGHTED** | Kosten (A\*) bzw. Spacing (ELK)                |
| keine Kollision                 | **NONE**     | —                                              |

Kernregel: **Overlaps sind das Lesbarkeits-Desaster** (zwei Kabel sehen wie eines aus —
elektrisch fatal) und damit Invariante. **Crossings sind ein Optimierungsziel**, kein
Verstoß — topologisch bei echten Stromplänen teils unvermeidbar.

### 4.2 Domain Rules (Schicht 3)

```ts
domainSeparationRules = {
  electrical: {
    water: { minimumClearance: 24 }, // crossDomainSpacing
  },
};
```

Erweiterbar: 230V ↔ 12V DC, gas ↔ electrical, heat ↔ cable.
Die Werte kommen aus den Tokens; die **Paar-Regeln** sind Domänenlogik und liegen NICHT
in der Geometrie-Schicht.

## 5. Geometrie-Primitives (Schicht 1)

Pure Functions, kein Domänenwissen, Werte aus Tokens:

- `segmentsIntersect()` — echte Kreuzung vs. Touch
- `distanceSegmentToSegment()`
- `distanceSegmentToRect()`
- `areCollinear()` / `segmentsOverlap()`
- `inflateObstacle()` — Node-Rect + Clearance-Aufschlag
- Stub-Minimum-Check
- Bend-Merge — zwei Bends < 2 × `bendRadius` verschmelzen (kein „Zitter-Treppenmuster”)
- Lane-Berechnung — `laneIndex × laneGrid` vom Referenzsegment

Bestehende Geometrie aus `pathUtils.ts` / `segmentSpatialIndex.ts` wird hierher
migriert, nicht neu erfunden.

**Handle-Geometrie (M11-1):** Handles sitzen ±22 px **außerhalb** der Node-Karte
(`overflow: visible`). `inflateObstacle()` muss die Handle-Ausrisse einrechnen — sonst
verletzt der Stub die Clearance am eigenen Knoten.

## 6. ELK Global Layout

### 6.1 Konfiguration

- `algorithm: 'layered'`, `EdgeRouting: ORTHOGONAL`
- `spacing.edgeEdge`, `spacing.edgeNode`, `spacing.edgeNodeBetweenLayers` — aus Tokens
- `layered.mergeEdges: false` (parallele Kabel werden nicht zusammengelegt)
- `favorStraightEdges`
- Edge-Labels nativ (zentriert bevorzugt — INTERACTIVE + HEAD-Labels + FIXED_SIDE-Ports
  ist bekannt fehleranfällig)
- Junction Points aktiviert (Busbar-Abzweige)
- Port-Constraints `FIXED_ORDER` (Handle-Reihenfolge stabil: Plus oben, Minus unten)

### 6.2 Interaktiver Modus (Nutzerplatzierungen respektieren)

- `cycleBreaking.strategy: INTERACTIVE`
- `layering.strategy: INTERACTIVE`
- `crossingMinimization.semiInteractive: true`
- `considerModelOrder` — Nutzer-Anordnung nicht durch Crossing-Minimization zerlegen

### 6.3 Integration & Fallstricke

- elkjs asynchron: dynamischer Import + **Web Worker + Timeout** (Lighthouse-Gate ≥ 90)
- **Worker-Vertrag (P-6):** Übergabe strukturiert klonen oder als Flat-Arrays; bei
  schnellen Drag-Updates gewinnt die **letzte Anfrage** (keine Race-Pfade). Gilt für den
  ELK-Worker wie für die Routing-Pipeline.
- Child-Positionen kommen **relativ zum Parent** → absolute Koordinaten umrechnen
- Zyklen: Camper-Ladekreise sind zyklisch (Solar → MPPT → Batterie → Inverter → Landstrom)
  — Cycle-Breaking-Strategie bewusst wählen
- Bestehender Router bleibt **Fallback** bei Worker-Fail/Timeout

## 7. Deterministisches Lane-System

Ersetzt die ±40/±80-px-Heuristik:

```ts
LaneRegistry {
  corridor,    // gemeinsamer Referenzverlauf
  direction,   // Hauptrichtung des Korridors
  laneIndex,   // stabiler Index je Kante
  offset,      // laneIndex × laneGrid
}
```

Stabile Sortierung (3 Stufen):

1. topologische Reihenfolge
2. Zielposition
3. stabile Node-/Edge-ID als letzter Tie-Breaker

(ID-Stabilität gesichert: `newEntityId()` in `lib/id.ts` mit Fallback-Kette seit M11-1
auch im LAN-Dev über http:// robust.)

Garantie: Re-Layout, Undo/Redo und visuelle Regressionstests erzeugen **identische**
Lane-Zuordnung.

## 8. Kreuzungs-Hopping

```text
crossing detected → priority comparison → lower priority hops → render hop
```

```text
routingPriority =
    domainPriority
    + backboneWeight
    + crossSectionWeight
    + manualLockWeight
```

- Dickeres/Backbone-Kabel bleibt gerade, Abzweig hüpft (Halbkreis-Bogen)
- Manuell fixierte Kabel (Lock) hoppen nie
- `manualLockWeight` schützt später nutzerfixierte Trunks
- Hop-Rendering ist visuell eindeutig: Kreuzung ≠ Verbindung

## 9. A\*-Kostenmodell (inkrementeller Pass)

| Situation           | Kosten      |
| ------------------- | ----------- |
| overlap             | `Infinity`  |
| clearance violation | `VERY_HIGH` |
| crossing            | `HIGH`      |
| nearby lane         | `MEDIUM`    |
| preferred lane      | `BONUS`     |
| free space          | `LOW`       |

Werte aus Tokens/Config abgeleitet, nie hardcoded. Datenbasis: `segmentSpatialIndex`
(registriert geroutete Segmente als weiche Hindernisse). Konsistenz mit Abschnitt 4:
hard = Infinity/verboten, weighted = Kosten.

## 10. Inkrementeller Pass: Re-Routing & Drag-Performance

**Affected-Set (P-1):** Nur Kanten am gezogenen Knoten plus Kanten, deren
Pfad-Bounding-Box die alte oder neue Position schneiden.
Abnahme: **O(betroffene Kanten) statt O(E)** beim Drag; keine veralteten Pfade (R-9
bleibt erfüllt).

**Zwei-Qualitäts-Stufen (P-2):** Während des Ziehens schnelle Vorschau (Bestandspfad
bzw. L-Stub); voller `routeAll`-Pass mit Nudging erst beim Drag-Ende (gedrosselt,
100–150 ms). Abnahme: konstante Frame-Zeit im Drag-Bench; Endqualität identisch zur
Szenario-Gallery.

**Gescopedes Nudging (P-5):** `nudgeOrthogonalPaths` nur auf Lanes betroffener Trassen
(setzt P-1 voraus). Abnahme: routingGallery ohne Diff.

Danach **keine** globale Neuordnung. Basis: `cableRouteStore` (Subscriptions) +
Geometrie-Primitives. Vollständige Worker-Auslagerung der Pipeline gemäß P-6 erst nach
P-1/P-2/P-5.

## 11. Port Fan-Out

Mehrere Kanten an einem Handle: deterministische Sortierung nach **Zielposition**,
stabile ID als Tie-Breaker — kein Kreuzen direkt an der Quelle. Konsistent mit
Port-Constraints `FIXED_ORDER` (Abschnitt 6.1).

## 12. Invarianten (prüfbar, für BEIDE Pässe)

1. kein Edge-Node-Collision
2. kein Edge-Edge-Overlap
3. Clearance ≥ `cableClearance` überall
4. kein U-Turn direkt am Handle
5. Stub ≥ `stubMin`
6. Segment ≥ `stubMin`
7. kein unnötiges Treppenmuster (Bend-Merge greift)
8. deterministische Lanes (Lane-Registry stabil)
9. deterministisches Ergebnis (gleicher Input → identischer Output)
10. Crossing nur erlaubt, wenn kein konfliktfreier Weg existiert

## 13. Teststrategie (drei Ebenen)

| Ebene      | Beispiel                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Unit**   | `segmentsCross()`, Bend-Merge, Lane-Sortierung                                                                         |
| **Domain** | Batterie → Sicherung → Verbraucher (AutoWire + Sizing)                                                                 |
| **System** | Nutzer bewegt Batterie → Auto-Reroute → keine Kollision → Warnsystem aktuell → Undo stellt exakt den alten Zustand her |

Dazu **Golden Master** (`knownPlans/`): simple, camper, solar, inverter, acdc, complex —
Input → AutoWire-Result → Electrical-Result → Routing-Result des Altsystems als Fixtures.
V2 darf intern anders funktionieren, aber das Ergebnis muss **identisch oder bewusst
besser** sein (mit dokumentierter Begründung).

**Golden Layouts:** Für definierte Szenarien (15, siehe Regression-Suite #400) muss exakt
diese Topologie/Trassenstruktur herauskommen — nicht nur „kein Crash”.

## 14. Exit-Conditions

Routing V2 ist fertig wenn (nicht: „ich glaube, Routing funktioniert jetzt”):

- ✓ keine Edge-Node-Overlaps
- ✓ keine Edge-Edge-Overlaps
- ✓ Clearance ≥ `cableClearance` eingehalten
- ✓ deterministische Lanes
- ✓ Crossing-Hops gerendert
- ✓ 100 % Invariant-Tests grün (beide Pässe)
- ✓ Golden Layouts stabil
- ✓ Golden Master: identisch oder bewusst besser
- ✓ **Performance-Budget: Main-Thread ≤ 16 ms/Frame am 100+-Kanten-Referenzplan**
  (M11-9; Gate: `edgeRoutingPerf.bench.ts` in der Quality-Pipeline, Budget-Wert im
  Benchmark-ADR begründet — P-7)
- ✓ ELK-A/B auf Routing-Gallery: Kreuzungen/Bends besser oder gleich
- ✓ Lighthouse ≥ 90

## 15. Ticket-Referenzen

| Phase | Ticket                                              | Issue |
| ----- | --------------------------------------------------- | ----- |
| 0     | Architecture Contract & Dependency Map              | #401  |
| 0     | Golden Master absichern (knownPlans/)               | #402  |
| 0     | Change Ledger & ADR-Basis                           | #403  |
| 1     | Design Tokens (Single Source of Truth)              | #390  |
| 1     | Kollisionsmodell (CollisionClass/RoutingConstraint) | #391  |
| 1     | Geometrie-Primitives — **zuerst im Code**           | #392  |
| 2     | ELK Global Layout (elkjs)                           | #393  |
| 2     | Deterministisches Lane-System (LaneRegistry)        | #394  |
| 2     | Kreuzungs-Hopping (routingPriority)                 | #395  |
| 2     | A\*-Kostenmodell                                    | #396  |
| 2     | Lokales Re-Routing & Drag-Performance               | #397  |
| 2     | Port Fan-Out                                        | #398  |
| 2     | Routing-Invarianten (Testsuite)                     | #399  |
| 2     | Regression-Suite & Golden Layout Tests              | #400  |

Implementierung **bottom-up**: Geometry → Rules → Algorithms → Domain → Store → UI.
Jeder Schritt hält die bestehenden Tests grün; ein PR verändert genau eine
Verantwortung.

## 16. Verhältnis zu den agent.md-Tracks (S/P)

| agent.md                                  | Zuordnung in Routing V2                              |
| ----------------------------------------- | ---------------------------------------------------- |
| P-1 Affected-Set                          | → WP-8 / #397 (absorbiert, Abschnitt 10)             |
| P-2 Zwei-Stufen-Drag                      | → WP-8 / #397 (absorbiert, Abschnitt 10)             |
| P-5 Scoped Nudging                        | → WP-8 / #397 (absorbiert, Abschnitt 10)             |
| P-6 Routing-Worker                        | → WP-4 / #393 (Worker-Vertrag, Abschnitt 6.3) + WP-8 |
| P-7 Benchmark-Gate                        | → WP-11 / #400 + Exit-Condition (Abschnitt 14)       |
| S-5 ADR 0003 nachziehen                   | → WP-4 / #393 (ADR zur ELK-Adoption)                 |
| S-1 React Flow 12                         | **Sequenz-Entscheidung**, siehe unten                |
| S-2 Tailwind v4 / S-3 lucide / S-4 Export | unabhängig von Routing V2                            |

**S-1-Empfehlung (Sequenz):** React Flow 12 **vor** den UI-integrierenden Workpackages
(insbesondere WP-7 Hop-Rendering, WP-8 Drag) mergen — WP-4+ berühren die RF-API
(`CableEdge`, `nodeTypes`/`edgeTypes`, CSS), sonst doppelter Migrationsaufwand.
Akzeptanz aus agent.md S-1: `npm run check` grün; Drag, Auto-Wire und Undo/Redo
unverändert; Routing-Invarianten-Tests und visuelle Baselines ohne Diff.
