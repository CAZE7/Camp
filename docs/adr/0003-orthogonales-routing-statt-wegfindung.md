# ADR 0003 — Orthogonales Routing mit Ausweichverfahren statt Wegfindung

**Status:** angenommen · **Datum:** 2026-08 (verschärft in K3)

## Kontext

Kabel sollen wie in einem Schaltplan verlaufen: rechtwinklig, ohne durch
Bauteile zu laufen, parallele Leitungen ordentlich nebeneinander. Der Plan
wird bei jeder Mausbewegung neu gezeichnet — das Routing läuft also sehr oft.

## Entscheidung

Ein reines, deterministisches Verfahren in drei Schritten
(`components/edges/utils/orthogonalRouting.ts`):

1. **Basisroute** aus Austritts- und Eintrittsrichtung (Z-Weg, Schlaufe, Ecke).
2. **Ausweichen**: kreuzt ein Segment eine Bauteil-Box, wird ein Detour um die
   um 14 px aufgeblähte Box gelegt — iterativ, höchstens 12 Durchläufe.
3. **Lane-Versatz**: kreuzt die Route mehr als drei fremde Leitungen, werden
   Varianten mit ±32 px und ±64 px geprüft und die kreuzungsärmste gewählt.

Ausdrücklich **kein** A*/Dijkstra auf einem Gitter.

## Konsequenzen

**Gut**
- O(Segmente × Hindernisse) statt Graphsuche — schnell genug für jedes Frame.
- Deterministisch und rein: gleiche Eingabe, gleicher Pfad. Das macht die
  eingecheckte Routing-Galerie als Regressionsschutz überhaupt erst möglich.
- Die Invarianten R1–R7 sind prüfbar formuliert und getestet.

**Schlecht / Preis**
- **Keine Optimalität.** In dichten Szenen kann eine kürzere Route existieren.
  Garantiert werden Korrektheit (orthogonal, kollisionsfrei, begrenzt) und
  Stabilität, nicht die beste Lösung.
- Liegt ein Ziel *innerhalb* einer Box, gibt es keinen kollisionsfreien Pfad.
  Solche Hindernisse werden bewusst ignoriert statt endlos umfahren
  (Szenarien 20/21 der Galerie).
- Die Iterationsgrenze von 12 ist eine Sicherung gegen Endlosschleifen, kein
  bewiesenes Maximum.

## Alternativen

- **A\* auf einem Gitter:** bessere Wege, aber Gitterauflösung, Kosten pro
  Frame und nicht-deterministische Tie-Breaks bei gleichwertigen Pfaden.
- **Bézier-Kanten (React-Flow-Standard):** einfach, aber kein Schaltplan-Look
  und keine Hindernisvermeidung.
