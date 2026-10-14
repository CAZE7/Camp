# ROUTING-ALGORITHM-COMPARISON: Untersuchung von Routing-Alternativen

**Datum:** 2026-10-14  
**Verfasser:** Principal Routing Engineer  
**Projekt:** CAMP Elektroplaner

---

## 1. Untersuchte Ansätze

Im Rahmen der Systemarchitektur wurden sieben Hauptansätze zur orthogonalen Leitungsführung evaluiert:

1. _*A. Hanan-Grid mit A*-Suche (Bestand / erweitert)_*
2. **B. Orthogonale Visibility Graphs / Sparse Visibility Graphs**
3. **C. libavoid (Adaptagrams C++ / WebAssembly)**
4. **D. Eclipse Layout Kernel (ELK Layered / Orthogonal Edge Routing)**
5. **E. Globales Rip-up-and-Reroute (RRR) mit Verhandlungsmodell (Negotiated Congestion Routing / PathFinder)**
6. **F. Globales Korridor- und Kapazitätsrouting (Zweistufig: Global Routing + Detailed Channel Routing)**
7. **G. Ganzzahlige lineare Optimierung (MILP) / Constraint Programming (CP-SAT)**
8. **H. Hybride Multi-Pass-Architektur**

---

## 2. Detaillierte Analyse der Kandidaten

### A. Hanan-Grid mit Richtungs-A*

- **Konzept:** Aus den Kanten aller Hindernisse und Ports wird ein orthogonales Hanan-Gitter erzeugt. Darauf sucht A* nach dem kürzesten Pfad unter Berücksichtigung von Biegungskosten und Sperrflächen.
- **Vorteile:** 100% deterministisch, exakte Einhaltung von Hindernissen, im Browser hochgradig optimierbar (TypedArrays), null externe Abhängigkeiten.
- **Schwächen:** Sequentiell ausgeführt leidet es unter „Frühere Kanten blockieren spätere“ (Net-Ordering Problem). Ohne globale Koordination entstehen unnötige Kreuzungen.

### B. Orthogonale Visibility Graphs

- **Konzept:** Kanten verbinden sichtbare Ecken von Hindernissen.
- **Vorteile:** Weniger Kanten als ein dichtes Hanan-Grid auf großen leeren Flächen.
- **Schwächen:** Schwierige Handhabung von Mindestabständen (Clearance-Inflation) und parallelen Trassen (Lanes). Bei dicht gepackten Camper-Plänen nähert sich der Visibility Graph der Komplexität des Hanan-Grids an.

### C. libavoid (Adaptagrams)

- **Konzept:** Hochspezialisierte C++-Bibliothek für orthogonales Routing mit Hindernisvermeidung und Kreuzungsminimierung.
- **Prüfung:**
  - _Lizenz:_ LGPL-2.1. In einer kommerziellen oder geschlossenen Web-Applikation erfordert LGPL besondere Sorgfalt beim dynamischen Linken (WASM-Modul).
  - _Browser/WASM:_ Muss über Emscripten kompiliert werden (~1–2 MB zusätzliches Bundle).
  - _Wartung & Debugging:_ Hohe Hürde bei kundenspezifischen elektrischen Fachregeln (Port-Stubs, VDE-Abstände, AC/DC-Trennung). Schwer in Reinkultur mit React Flow synchronisierbar.
  - _Fazit:_ Für ein Kernprodukt mit speziellen elektrotechnischen Anforderungen zu schwergewichtig und intransparent.

### D. Eclipse Layout Kernel (ELK)

- **Konzept:** `elkjs` ist bereits im Projekt vorhanden und wird für das automatische Node-Layout (`lib/routing/elk/*`) eingesetzt.
- **Prüfung als Edge-Router:**
  - ELK Layered unterstützt orthogonale Kantenführung (`org.eclipse.elk.edgeRouting: ORTHOGONAL`).
  - _Einschränkung:_ Bei fixierten Bauteilpositionen (Nutzer verschiebt ein Gerät im Canvas) liefert ELK oft unvorhersehbare Kantenwege, da es primär als Gesamtlayout-Engine (Knoten + Kanten) konzipiert ist.
  - _Fazit:_ Perfekt für den initialen AutoWire-/Layout-Schritt, aber ungeeignet als reaktiver Live-Router bei manuellen Bauteilplatzierungen.

### E. Globales Rip-up-and-Reroute (RRR) / Verhandlungsbasiertes Routing

- **Konzept:**
  1. Alle Kanten werden zunächst unbeschränkt oder mit Basis-Hindernissen geroutet.
  2. Ein globaler Konflikt- und Überlastungs-Graph ermittelt Schnittpunkte, Überlappungen und Mindestabstandsverletzungen.
  3. Kanten in Konfliktzonen werden iterativ „herausgerissen“ (ripped up) und neu geroutet, wobei zuvor belegte Trassen stetig teurer werden (PathFinder-Prinzip).
  4. Die Iteration stoppt, wenn ein konfliktfreier Zustand erreicht ist oder das Budget erschöpft ist.
- **Vorteile:** Löst das Net-Ordering-Problem vollständig! Extrem hohe Trassenqualität, drastische Reduktion von Kreuzungen.
- **Bewertung:** Hervorragend geeignet für Pläne bis 50 Komponenten (typisch 10–60 Kanten, Iterationslaufzeit < 50 ms).

### F. Globales Korridor- und Kapazitätsrouting

- **Konzept:** Zweistufige Zerlegung des Problems:
  1. _Global Stage:_ Bestimmung der Grob-Trassen (Nord-, Süd-, Mittel-Kanal) und Kapazitätsprüfung der Gassen zwischen Bauteilen.
  2. _Detailed Stage:_ Lane-Zuweisung innerhalb des Korridors (Channel Routing).
- **Vorteile:** Garantiert saubere Kabelbündel.
- **Bewertung:** Ideal in Kombination mit Rip-up-and-Reroute.

### G. Ganzzahlige Optimierung (MILP / CP-SAT)

- **Konzept:** Formulierung des gesamten Routings als ILP.
- **Bewertung:** Bei 50 Komponenten und orthogonalem Gitter explodiert die Variablenzahl in die Hunderttausende. Lösungszeiten im Browser (z. B. via GLPK.js oder Z3 WASM) liegen im Bereich von Sekunden bis Minuten. Für interaktive Anwendungen indiskutabel.

---

## 3. Bewertungsmatrix

| Kriterium                    | A. Hanan A* (Bestand)     | C. libavoid (WASM) | D. ELK (Edges only)  | E. Rip-up & Reroute | H. Hybrid (RRR + Hanan + Separation) |
| ---------------------------- | ------------------------- | ------------------ | -------------------- | ------------------- | ------------------------------------ |
| **Geometrische Korrektheit** | Hoch (I1=0)               | Sehr hoch          | Mittel               | Hoch                | **Perfekt (I1=0, I2=0, I3=0)**       |
| **Globale Optimierung**      | Keine (lokal gierig)      | Teilweise          | Global (heuristisch) | Sehr hoch           | **Sehr hoch**                        |
| **Kreuzungsminimierung**     | Befriedigend (48 im Test) | Gut                | Befriedigend         | Sehr gut            | **Hervorragend**                     |
| **Stabilität & Idempotenz**  | Gut                       | Mittel             | Gering               | Hoch                | **Sehr hoch (deterministisch)**      |
| **Laufzeit (≤ 50 Knoten)**   | < 15 ms                   | ~ 30–50 ms         | ~ 60–120 ms          | ~ 15–35 ms          | **< 25 ms**                          |
| **Bundle-Größe / Overhead**  | 0 KB                      | ~ 1.500 KB         | Bereits drin         | 0 KB                | **0 KB**                             |
| **Wartbarkeit im Projekt**   | Hoch                      | Gering (C++/WASM)  | Mittel               | Sehr hoch (Pure TS) | **Sehr hoch**                        |

---

## 4. Architekturentscheidung

Die gewählte Sieger-Architektur ist **H: Hybride Multi-Pass Engine mit deterministischem Rip-up & Reroute (RRR), dynamischem Hanan-Gitter und geometrischer Schlichtung (Separation)**.

Diese Architektur vereint:

1. Den bewährten, hochperformanten Kern aus `lib/routing/geometry` und `lib/routing/invariants.ts`.
2. Eine globale **Rip-up-and-Reroute-Schleife**, die Problemkanten gezielt identifiziert und unter Berücksichtigung globaler Trassenkonflikte neu verlegt.
3. Den deterministischen Port-Fan-Out und den Separations-Pass für absolute Garantie von I1 (Node-Clearance), I2 (Keine Überlappung) und I3 (Mindestabstand).
