# ROUTING-MIGRATION: Migrationsleitfaden und Betriebsdokumentation

**Datum:** 2026-10-14  
**Status:** Aktiv

---

## 1. Übersicht

Dieses Dokument beschreibt die Migration auf die konsolidierte Routing-Architektur, den sicheren Betrieb in der Benutzeroberfläche und die Schnittstellen zur elektrischen Validierung.

---

## 2. Architektur-Schnittstellen

### 2.1 UI-Integration (`FlowCanvas.tsx` / `CableRouteSync`)

Die Verbindung zwischen React Flow und der Routing-Engine erfolgt entkoppelt über den `CableRouteSync`:

- **Eingabe:** `nodeLayoutSignature(routableNodes)` + `edgeTopologySignature(edges)`.
- **Drosselung:** 100 ms Fenster während des Bauteil-Draggens (`createThrottledRunner`). Nach Loslassen wird sofort der Endzustand geroutet.
- **Konvergenzkontrolle:** `RouteGenerationTracker` wacht darüber, dass dieselbe Eingabe nicht in Endlosschleifen neu geroutet wird (`MAX_ROUTE_REVISIONS_PER_GRAPH`).

### 2.2 Reaktivität & Store

Kabel-Komponenten (`CableEdge.tsx`, `WaterPipeEdge.tsx`) greifen **ausschließlich** über den Hook:

```typescript
import { useCableRoute } from './utils/cableRouteStore';

const route = useCableRoute(edgeId);
```

auf die berechneten Wegpunkte zu. Es findet keine parallele Pfadberechnung innerhalb der Kanten-Komponente statt.

---

## 3. Umgang mit Routing-Zuständen

Die UI zeigt den Routing-Status über `RoutingStatusBadge.tsx` transparent an:

- **`VALID`:** Alle harten Invarianten (I1=0, I2=0, I3=0) sind erfüllt. Das Netz ist sauber verlegt.
- **`INVALID`:** Mindestens ein geometrischer oder elektrischer Konflikt liegt vor. Der Nutzer sieht Warnungen im `WarningCenter`.
- **`tightMarginUsed`:** Ein Kabel musste die Sicherheitsreserve (`OBSTACLE_MARGIN`) unterschreiten, hält aber weiterhin `cableClearance` ein.
- **`locked`:** Eine Route wurde vom Nutzer fixiert. Die Engine respektiert den gespeicherten Snapshot unverändert.

---

## 4. Testen und Verifikation

Vor jedem Release müssen folgende Prüfungen bestanden werden:

```bash
# 1. Alle Unit- und Regressionstests ausführen
npm test

# 2. Spezifisches Routing-Audit und Ratchet prüfen
npm run routing:audit
npx tsx scripts/routing/runRoutingBenchmark.ts

# 3. Invarianten und Golden-Master-Vergleich
npx vitest run scripts/routing/ scripts/goldenmaster/ scripts/regression/
```
