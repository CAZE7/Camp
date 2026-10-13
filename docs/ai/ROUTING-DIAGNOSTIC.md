# Routing-Diagnostic-System

## Übersicht

Das Routing-Diagnostic-System ist eine Instrumentierungs-Infrastruktur für den CAMP Elektroplaner, die es ermöglicht, den vollständigen Optimierungsprozess eines Plans über **fünf definierte Zustände** zu verfolgen und zu analysieren.

### Ziel

Die Diagnose beantwortet die Frage: **Warum wird ein Plan nach dem initialen Erstellen, „Automatisch verbinden" und anschließendem Optimieren unübersichtlicher?**

Anstatt den Routing-Algorithmus zu verbessern (was außerhalb des Auftrags liegt), schafft die Diagnose eine **belastbare Messgrundlage** für spätere Optimierungen.

### Die fünf Zustände

| State | Zeitpunkt | Beschreibung |
|-------|-----------|--------------|
| **A** | Nach Assistent | Initialer Plan direkt nach dem Erstellungsassistenten, vor AutoWire |
| **B** | Nach AutoWire | Plan nach AutoWire + Bauteilplatzierung, vor dem Routing |
| **C** | Nach Routing | Plan nach dem eigentlichen Routing (Roh-Wegpunkte), vor Postprocessing |
| **D** | Nach Postprocessing | Plan nach Nudge, Bend-Merge, Clearance-Separation, vor Hopping |
| **E** | Final | Plan nach Hopping, Label-Platzierung und Final-Validation |

## Architektur

### Module

```
lib/routing/diagnostic/
├── types.ts          # Typdefinitionen für alle Diagnose-Strukturen
├── snapshot.ts       # Snapshot-Erfassung (unveränderliche Kopien)
├── metrics.ts        # Metrik-Evaluator (Geometrie, Kreuzungen, Clearance)
├── compare.ts        # Vergleichs-Engine (Übergangsberichte)
├── session.ts        # Session-Verwaltung (sammelt Snapshots über die Zeit)
├── hooks.ts          # Instrumentierungs-Hooks (Aufruforte im Produktivcode)
├── index.ts          # Öffentliche API
└── diagnostic.test.ts # Umfassende Tests
```

### Instrumentierungs-Punkte

Die Hooks sind an folgenden Stellen im Produktivcode eingefügt:

| Hook | Datei | Funktion |
|------|-------|----------|
| `recordInitialState` | `store/slices/graphSlice.ts` | Vor `performAutoWiring` in `previewAutoWire` |
| `recordPostAutoWireState` | `store/slices/graphSlice.ts` | Nach `applyAutoWirePreview` |
| `recordPostRoutingState` | `components/edges/utils/routeAll.ts` | Nach Roh-Routing, vor `nudgeOrthogonalPaths` |
| `recordPostPostprocessingState` | `components/edges/utils/routeAll.ts` | Nach Nudge/BendMerge/Separation, vor `analyzeRouteCrossings` |
| `recordFinalState` | `components/edges/utils/cableRouteStore.ts` | Nach `publishCableRoutes` und `computeCableRouteFinalValidation` |

### Aktivierung

Die Diagnose ist **standardmäßig deaktiviert** und hat im Normalbetrieb **keine Seiteneffekte**:

```typescript
import { enableRoutingDiagnostics } from 'lib/routing/diagnostic';

// Aktivieren
enableRoutingDiagnostics(true);

// Session erstellen
const session = createDiagnosticSession('plan-id', 0, config);

// ... Plan optimieren (Hooks erfassen automatisch) ...

// Export erstellen
const export_ = session.export();
```

## Metrik-Katalog

### Geometrie

- **totalCableLength**: Gesamte orthogonale Kabellänge (px)
- **meanCableLength**: Mittlere Länge pro Kante
- **medianCableLength**: Median der Kantenlängen
- **maxCableLength**: Maximale Kantenlänge
- **totalBends**: Gesamtzahl der Richtungswechsel
- **meanBendsPerEdge**: Mittlere Biegungen pro Kante
- **totalUTurns**: Anzahl der 180°-Kehren
- **totalShortSegments**: Segmente unter 16 px (SEGMENT_MIN)
- **totalRedundantWaypoints**: Kollineare Wegpunkte auf derselben Achse

### Kreuzungen und Überdeckungen

- **geometricCrossings**: Echte geometrische Kreuzungen (innerer Schnittpunkt)
- **portSharedCrossings**: Kreuzungen an gemeinsamen Anschlüssen
- **collinearOverlaps**: Kollineare Überdeckungen (hart verboten, außer Port-Bündel)
- **partialOverlaps**: Teilweise überdeckte Segmente
- **endpointTouches**: Berührungen an Segmentenden
- **totalCrossingPairs**: Anzahl der kreuzenden Kantenpaare

### Abstände und Kollisionen

- **edgeNodeViolations**: Edge-Node-Kollisionen (I1)
- **edgeEdgeOverlapViolations**: Edge-Edge-Überdeckungen (I2)
- **clearanceViolations**: Clearance-Verletzungen < 12 px (I3)
- **minClearance**: Minimaler Abstand zwischen Kanten
- **invalidSegments**: Segmente mit Länge ≈ 0

### Stabilität

- **changedNodePositions**: Anzahl geänderter Bauteilpositionen
- **changedEdges**: Anzahl geänderter Kanten (Daten)
- **changedWaypoints**: Anzahl geänderter Wegpunkte
- **changedLocks**: Anzahl geänderter Sperren
- **newElements**: Neu hinzugefügte Elemente
- **removedElements**: Entfernte Elemente
- **fallbackRoutes**: Anzahl der Fallback-Routen

## Übergangsberichte

Für jeden Übergang (A→B, B→C, C→D, D→E) wird ein detaillierter Bericht erstellt:

```typescript
interface TransitionReport {
  from: DiagnosticStateId;
  to: DiagnosticStateId;
  label: string;
  metricsBefore: RoutingMetrics;
  metricsAfter: RoutingMetrics;
  deltas: MetricDeltas;
  newViolations: DiagnosticViolation[];
  resolvedViolations: DiagnosticViolation[];
  affectedEntities: { nodes: string[]; edges: string[] };
  topDegradations: DiagnosticChange[];
  topImprovements: DiagnosticChange[];
  stableInvariants: string[];
  notMeasurable: string[];
  investigationCandidates: string[];
}
```

### Beispiel-Bericht

```
C → D: Einfluss der geometrischen Nachbearbeitung

Metrik-Deltas:
  Kabellänge: +4,8 % (25.129 → 26.335 px)
  Biegungen: -12 (290 → 278)
  Kreuzungen: +3 (39 → 42)
  Clearance-Verletzungen: +2 (0 → 2)

Neue Verletzungen:
  - I3: 2 Clearance-Verletzung(e)

Top-Verschlechterungen:
  - e-fuse-cons-1: Kabellänge +48 px
  - e-fuse-cons-4: Kabellänge +32 px

Untersuchungskandidaten:
  - Kreuzungen gestiegen: 39 → 42
  - Clearance-Verletzungen gestiegen: 0 → 2
```

## Qualitätsverluste

Die Diagnose erstellt eine **automatisch priorisierte Liste** der größten Qualitätsverluste:

1. **Hard Violations**: Neue harte Regelverletzungen (I1, I2)
2. **Lock Violations**: Geänderte Sperren oder fixierte Leitungen
3. **Geometric Degradation**: Geometrische Verschlechterungen (Länge, Biegungen, Kreuzungen)

```typescript
interface QualityLoss {
  rank: number;
  transition: string; // z. B. 'C→D'
  severity: 'hard-violation' | 'lock-violation' | 'geometric-degradation';
  description: string;
  affectedEdges: string[];
  metricDelta: { metric: string; before: number; after: number } | null;
}
```

## JSON-Export

Der vollständige Export ist als JSON serialisierbar und enthält:

```typescript
interface RoutingDiagnosticExport {
  meta: DiagnosticSessionMeta;
  configuration: {
    routingTokens: Record<string, number>;
    costWeights: Record<string, number>;
    gates: Record<string, number>;
  };
  snapshots: Record<DiagnosticStateId, DiagnosticStateSnapshot | null>;
  metrics: Record<DiagnosticStateId, RoutingMetrics | null>;
  transitions: TransitionReport[];
  validations: DiagnosticValidationResult[];
  timings: {
    snapshotCaptureMs: Record<DiagnosticStateId, number>;
    metricsEvalMs: Record<DiagnosticStateId, number>;
    compareMs: number;
    totalMs: number;
  };
  unresolvedDiscrepancies: string[];
  captureErrors: string[];
  qualityLosses: QualityLoss[];
}
```

### Schema-Version

Die Schema-Version (`DIAGNOSTIC_SCHEMA_VERSION = '1.0.0'`) wird bei Breaking Changes inkrementiert.

## Verwendung

### Demo-Skript

```bash
npx tsx scripts/routing/diagnosticDemo.ts
```

Das Demo-Skript lädt einen Beispielplan, führt AutoWire und Routing aus, und zeigt die vollständige Diagnose mit allen Übergangsberichten.

### Integration in Tests

```typescript
import { createDiagnosticSession, enableRoutingDiagnostics } from 'lib/routing/diagnostic';

test('Routing-Qualität verbessert sich nach Fix', () => {
  enableRoutingDiagnostics(true);
  const session = createDiagnosticSession('test-plan', 0, config);
  
  // ... Plan optimieren ...
  
  const export_ = session.export();
  
  // Prüfe, dass keine neuen harten Verletzungen entstanden sind
  const hardViolations = export_.qualityLosses.filter(
    (l) => l.severity === 'hard-violation'
  );
  expect(hardViolations).toHaveLength(0);
  
  // Prüfe, dass die Kabellänge nicht um mehr als 10% gestiegen ist
  const cableLengthDelta = export_.transitions[2].deltas.totalCableLength;
  expect(cableLengthDelta.percent).toBeLessThan(10);
});
```

### Debug-Ansicht

Für die visuelle Analyse kann der Export in eine Debug-Ansicht geladen werden:

```typescript
const export_ = session.export();
const json = JSON.stringify(export_, null, 2);

// In eine Datei speichern
writeFileSync('diagnostic-export.json', json);

// In einer Debug-UI laden (z. B. React-Komponente)
<DiagnosticViewer export={export_} />
```

## Performance

### Overhead

Die Diagnose ist bewusst **minimal-invasiv** designed:

- **Deaktiviert**: Kein Overhead (Hooks kehren sofort zurück)
- **Aktiviert**: 
  - Snapshot-Erfassung: ~1-5 ms pro State
  - Metrik-Berechnung: ~2-10 ms pro State
  - Vergleich: ~5-15 ms für alle 4 Übergänge
  - **Gesamt**: ~20-50 ms für einen vollständigen Lauf

### Speicher

- Snapshots sind unveränderlich und werden deep-gecloned
- Maximale Anzahl Sessions: konfigurierbar (default: 5)
- Ältere Sessions werden automatisch entfernt

### Best Practices

1. **Diagnose nur bei Bedarf aktivieren**: Im Normalbetrieb deaktiviert lassen
2. **Sessions begrenzen**: `maxSessions` auf 5-10 setzen
3. **Export nur auf Anforderung**: Nicht automatisch nach jedem Lauf exportieren
4. **Metriken nach Phasenende berechnen**: Nicht während des Renderings

## Tests

Das System umfasst 16 umfassende Tests:

1. ✓ Alle fünf Zustände werden in der korrekten Reihenfolge erfasst
2. ✓ Jeder Snapshot bleibt nach späteren Store-Änderungen unverändert
3. ✓ Die Instrumentierung verändert weder Bauteilpositionen noch Kanten oder Wegpunkte
4. ✓ Die Instrumentierung verändert keine Routing-Ergebnisse und keine Routing-Reihenfolge
5. ✓ Zwei Läufe mit identischem Input liefern dieselben Geometrie-Metriken
6. ✓ Das Sortieren von Diagnoseausgaben verändert nicht das Routing
7. ✓ Fehlende Metriken werden nicht als fehlerfreie Ergebnisse interpretiert
8. ✓ Gemeinsame Anschlüsse werden nicht fälschlich als Kreuzungen gewertet
9. ✓ Kreuzungen und kollineare Überdeckungen werden getrennt gezählt
10. ✓ Sperren und fixierte Leitungen werden vor und nach dem Optimieren verglichen
11. ✓ Änderungen zwischen D und E werden zuverlässig erkannt
12. ✓ Diagnosefehler beeinträchtigen die eigentliche Planung nicht
13. ✓ Bei deaktivierter Diagnose bleibt das bestehende Produktverhalten unverändert
14. ✓ Mehrfaches Auslesen eines Snapshots verändert keine Daten
15. ✓ Der JSON-Export entspricht dem definierten Schema
16. ✓ Session-Verwaltung funktioniert korrekt

### Tests ausführen

```bash
npx vitest run lib/routing/diagnostic/diagnostic.test.ts
```

## Bekannte Einschränkungen

### Messlücken

1. **State A/B-Routen**: In States A und B sind keine Routen vorhanden (leer)
2. **Handle-Bounds**: Werden nur erfasst, wenn sie zum Zeitpunkt der Aufnahme gemessen sind
3. **Domänen-Trennung**: Domänen-spezifische Clearance (24 px für AC/DC) wird nicht separat ausgewiesen
4. **Thermische Bündel**: VDE-0298-4-Häufungsfaktoren sind nicht Teil der Metriken

### Ungeklärte Abweichungen

Wenn State D und State E unterschiedliche Metriken aufweisen (z. B. verschiedene Kabellängen), wird dies als **ungeklärte Abweichung** dokumentiert:

```
D→E: Kabellänge unterscheidet sich (26.335 → 26.412 px) — Validierung oder 
Store-Update könnte Geometrie verändert haben.
```

Diese Abweichungen erfordern eine manuelle Untersuchung.

## Nächste Schritte

Nach der Diagnose-Implementierung können gezielte Routing-Optimierungen durchgeführt werden:

1. **Analyse der Übergangsberichte**: Identifiziere, welcher Schritt die größten Qualitätsverluste verursacht
2. **Priorisierte Fixes**: Beginne mit harten Verletzungen (I1, I2), dann Sperrverletzungen, dann geometrische Verschlechterungen
3. **A/B-Vergleiche**: Vergleiche Metriken vor/nach Routing-Änderungen, um Verbesserungen zu messen
4. **Regressionstests**: Nutze die Diagnose-Metriken als Regressionstests für zukünftige Änderungen

## Verwandte Dokumente

- `docs/ai/ROUTING-CONTEXT.md` — Routing-Architektur und Invarianten
- `docs/ROUTING-V2.md` — Routing-Spezifikation
- `docs/ROUTING-INVARIANTS.md` — Invarianten I1-I7
- `docs/ai/KNOWN-PROBLEMS.md` — Bekannte Routing-Probleme

## Autor

Implementiert im Rahmen des Auftrags „Vollständige 5-State-Diagnostik für den CAMP Elektroplaner" (2026-10-12).
