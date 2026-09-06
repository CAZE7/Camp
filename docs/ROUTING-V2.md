# ROUTING-V2 — Spezifikation des Kabel-Routings

> **Status: SPEC-FIRST (eingefroren per Freeze-Gate).**
> Dieses Dokument ist die Spezifikation **vor** dem Programmieren, nicht die Dokumentation danach.
> Es wird in Phase 0 erstellt und vor Implementierungsbeginn eingefroren (siehe Epic #389).
> Änderungen nach dem Freeze nur noch via ADR (`docs/adr/`) + Eintrag im Change Ledger
> (`docs/ARCHITECTURE-CHANGES.md`).

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

| Token                | Wert   | Verwendung                                              |
|----------------------|--------|---------------------------------------------------------|
| `cableClearance`     | 12 px  | Mindestabstand Kabel ↔ Kabel / Kabel ↔ Node             |
| `elkEdgeNodeSpacing` | 16     | ELK `spacing.edgeNode` / `edgeNodeBetweenLayers`        |
| `stubMin`            | 24 px  | Mindestlänge vor erstem Bend; Mindestsegmentlänge       |
| `laneGrid`           | 16 px  | Kanalabstand paralleler Trassen (≈ Node-Raster)         |
| `bendRadius`         | 8 px   | Einheitliche Rundungen; Bend-Merge-Schwelle 2×r         |
| `crossDomainSpacing` | 24 px  | Wert für Domain-Trennung (Paar-Regel s. Abschnitt 4.2)  |

## 4. Kollisionsmodell

### 4.1 Kollisionsklassen

| Typ                        | Klasse     | Konsequenz                                  |
|----------------------------|------------|----------------------------------------------|
| Edge × Node                | **HARD**   | verboten — garantiert unmöglich              |
| Edge × Edge — Overlap/kollinear | **HARD** | verboten — garantiert unmöglich              |
| Edge × Edge — Crossing     | **SOFT**   | minimieren; falls unvermeidbar → Hop-Rendering |
| Clearance-Verletzung       | **WEIGHTED**| Kosten (A\*) bzw. Spacing (ELK)             |
| keine Kollision            | **NONE**   | —                                            |

Kernregel: **Overlaps sind das Lesbarkeits-Desaster** (zwei Kabel sehen wie eines aus —
elektrisch fatal) und damit Invariante. **Crossings sind ein Optimierungsziel**, kein
Verstoß — topologisch bei echten Stromplänen teils unvermeidbar.

### 4.2 Domain Rules (Schicht 3)

```ts
domainSeparationRules = {
  electrical: {
    water: { minimumClearance: 24 }, // crossDomainSpacing
  },
}
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
- Bend-Merge — zwei Bends < 2 × `bendRadius` verschmelzen (kein „Zitter-Treppenmuster“)
- Lane-Berechnung — `laneIndex × laneGrid` vom Referenzsegment

Bestehende Geometrie aus `pathUtils.ts` / `segmentSpatialIndex.ts` wird hierher
migriert, nicht neu erfunden.

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

| Situation             | Kosten      |
|-----------------------|-------------|
| overlap               | `Infinity`  |
| clearance violation   | `VERY_HIGH` |
| crossing              | `HIGH`      |
| nearby lane           | `MEDIUM`    |
| preferred lane        | `BONUS`     |
| free space            | `LOW`       |

Werte aus Tokens/Config abgeleitet, nie hardcoded. Datenbasis: `segmentSpatialIndex`
(registriert geroutete Segmente als weiche Hindernisse). Konsistenz mit Abschnitt 4:
hard = Infinity/verboten, weighted = Kosten.

## 10. Lokales Re-Routing

Nur betroffene Kanten neu berechnen — danach **keine** globale Neuordnung:

- Kanten des bewegten Nodes
- Kanten mit betroffenem **altem** Segment
- Kanten mit betroffenem **neuem** Segment

Basis: `cableRouteStore` (Subscriptions) + Geometrie-Primitives.

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

| Ebene | Beispiel |
|-------|----------|
| **Unit** | `segmentsCross()`, Bend-Merge, Lane-Sortierung |
| **Domain** | Batterie → Sicherung → Verbraucher (AutoWire + Sizing) |
| **System** | Nutzer bewegt Batterie → Auto-Reroute → keine Kollision → Warnsystem aktuell → Undo stellt exakt den alten Zustand her |

Dazu **Golden Master** (`knownPlans/`): simple, camper, solar, inverter, acdc, complex —
Input → AutoWire-Result → Electrical-Result → Routing-Result des Altsystems als Fixtures.
V2 darf intern anders funktionieren, aber das Ergebnis muss **identisch oder bewusst
besser** sein (mit dokumentierter Begründung).

**Golden Layouts:** Für definierte Szenarien (15, siehe Regression-Suite #400) muss exakt
diese Topologie/Trassenstruktur herauskommen — nicht nur „kein Crash“.

## 14. Exit-Conditions

Routing V2 ist fertig wenn (nicht: „ich glaube, Routing funktioniert jetzt“):

- ✓ keine Edge-Node-Overlaps
- ✓ keine Edge-Edge-Overlaps
- ✓ Clearance ≥ `cableClearance` eingehalten
- ✓ deterministische Lanes
- ✓ Crossing-Hops gerendert
- ✓ 100 % Invariant-Tests grün (beide Pässe)
- ✓ Golden Layouts stabil
- ✓ Golden Master: identisch oder bewusst besser
- ✓ Performance-Budget < X ms (X vom Nutzer festzulegen)
- ✓ ELK-A/B auf Routing-Gallery: Kreuzungen/Bends besser oder gleich
- ✓ Lighthouse ≥ 90

## 15. Ticket-Referenzen

| Phase | Ticket | Issue |
|-------|--------|-------|
| 0 | Architecture Contract & Dependency Map | #401 |
| 0 | Golden Master absichern (knownPlans/) | #402 |
| 0 | Change Ledger & ADR-Basis | #403 |
| 1 | Design Tokens (Single Source of Truth) | #390 |
| 1 | Kollisionsmodell (CollisionClass/RoutingConstraint) | #391 |
| 1 | Geometrie-Primitives — **zuerst im Code** | #392 |
| 2 | ELK Global Layout (elkjs) | #393 |
| 2 | Deterministisches Lane-System (LaneRegistry) | #394 |
| 2 | Kreuzungs-Hopping (routingPriority) | #395 |
| 2 | A\*-Kostenmodell | #396 |
| 2 | Lokales Re-Routing | #397 |
| 2 | Port Fan-Out | #398 |
| 2 | Routing-Invarianten (Testsuite) | #399 |
| 2 | Regression-Suite & Golden Layout Tests | #400 |

Implementierung **bottom-up**: Geometry → Rules → Algorithms → Domain → Store → UI.
Jeder Schritt hält die bestehenden Tests grün; ein PR verändert genau eine
Verantwortung.
