# ADR 0031 — Port-Bündel-Ausnahme über die Locus-Regel (v2)

**Status:** angenommen (ersetzt v1 vom 2026-10-02) · **Datum:** 2026-10-03 ·
**Bezug:** ADR 0009 (Overlaps verboten, Bündel-Ausnahme), ADR 0015 (harte
Final-Invariante), ADR 0019 (Gate liest das Kollisionsmodell), ADR 0025
(Port-Bündel-Ausnahme, eine Wahrheit), ADR 0027 (`portFacingClearance`),
AUDIT ROUTE-012 (I3 Segment×Segment), ADR 0032 (Tube-Reparatur)

## Kontext

Zwei Kanten, die sich eine Anschlussstelle teilen, konvergieren zwangsläufig
auf gemeinsamen Stubs und Fan-Out-Jogs — das ist die seit ADR 0009/0025
dokumentierte, legitime Port-Bündelung. I2 (kollineare Überdeckung, **hard**)
stellt genau diese Geometrie über `isPortBundleOverlap` frei. Vor AUDIT
ROUTE-012 zählte die I3-Prüfung (Clearance, **weighted**) jede Abstands-
Unterschreitung inklusive dieser Bündel-Geometrie: 98 Verletzungen über die
sechs Referenzpläne, davon 69 strukturelle Bündel-Fälle — unerfüllbar by
construction, echte Verletzungen versteckt im Rauschen.

**v1 (2026-10-02)** führte die symmetrische Ausnahme für I3 ein — mit einem
**Segment-Fenster** als Korridor-Maß: „die ersten zwei bzw. letzten zwei
Segmente je Kante am gemeinsamen Port". Das Fenster war zu grob. Nachmessung
(2026-10-03): **8 Paare waren über-freigestellt**, die keine Bündelfälle
sind — darunter solar e-auto-1↔e-auto-10 (Berührung 0 px **ohne gemeinsamen
Port**) und complex e-busbar-fuse↔e-shore-inv (0,8 px, kein gemeinsamer
Port). Ein Segment-Fenster passt nicht auf Bündel mit rangskaletierten,
langen Stubs und Jogs, und es gibt Paaren mit vielen kurzen Segmenten eine
zu große Freistellungszone. Das Maß musste an der **fachlichen Frage**
ansetzen: _Wie weit vom gemeinsamen Port entfernt läuft die Kante noch in
Bündel-Zwang?_ — nicht: _der wievielte Stützpunkt ist es?_

## Entscheidung

1. **Korridor-Maß ist die Bogenlänge vom Port (Locus-Regel)** — das Token
   `portFacingClearance` (ADR 0027): 68 px = `stubMin` 24 + 2 × `laneGrid`
   32 + `cableClearance` 12. Die Freigabe greift genau dann, wenn

   - die Kanten eine **Anschlussstelle teilen** (identischer Endpunkt),
   - die **nächste Annäherung** der beiden Pfade — der Ort der gewichteten
     Unterschreitung — auf **beiden** Pfaden innerhalb der Bogenlänge 68 px
     vom gemeinsamen Port liegt (`arcAt`, bei Port am Pfad-Ende rückwärts
     akkumuliert, Parameter `portAtStart`), und
   - im Überdeckungsfall (I2) das parallele Überlappungsgebiet **vollständig**
     innerhalb beider Korridore liegt.

   Alles andere bleibt gemeldet: Paare ohne gemeinsamen Port und jede
   Unterschreitung an freien (gesuchten) Trassensegmenten — deren Nähe war
   Router-Entscheidungsraum, kein Bündel-Zwang.

2. **Eine Wahrheit in der Rules-Schicht** (`lib/routing/rules/portBundle.ts`):
   `isPortBundleProximity` (I3/Freigabe) neben `isPortBundleOverlap` (I2),
   beide mit demselben Locus-Maß; `portCorridor` ist entfallen (Fenster war
   keine Wahrheit). `checkClearance` konsumiert die Ausnahme und prüft über
   dieselbe **vereinfachte** Geometrie wie `checkEdgeEdgeOverlaps`
   (`routedPathGeometry`) — keine Doppelzählung durch Kollinear-Splits.

3. **Nicht geändert:** das Kollisionsmodell (Touch bleibt `weighted`), der
   Router (alle sechs Referenzpläne routen **byte-identisch** zum Stand der
   v1-Messung — verifiziert über `serializeRoutes` gegen Commit b9da1a5),
   I1 (hart 0), I2 (0), I4–I7 (0), Segment×Node-Clearance (0).

## Folgen

- **I3-Rest über die Referenzpläne: ehrlich 49 statt 41** (simple 2, camper 7,
  solar **1**, inverter 7, acdc 7, complex 25). Die 8 zusätzlichen Meldungen
  sind echte Befunde, die v1 zu Unrecht freistellte. Versatz-Matrix
  entsprechend: I3 +5/+46/+9/+12/+40/+98 bei unverändertem Router-Output —
  dieselben Trassen, ehrlichere Zählung.
- **Recapture-Ledger** (Ratchets dürfen nur sinken; Anstieg nur mit
  dokumentierter Begründung): `FINAL_VALIDATION_RATCHET` solar 0→1,
  inverter 6→7, acdc 3→7, complex 23→25 — reine Checker-Verschärfung, der
  Router-Output ist byte-identisch. Dasselbe für `SHIFT_RATCHET` (I3) und
  `LEGACY_BASELINE`. Beim Absenken geblieben: Kreuzungen-Basenlines acdc
  8→6 und complex 29→27 (Nachzug des Audit-Gates vom 2026-09-27).
- **Buchhaltungs-Test** (`scripts/routing/portBundleModel.test.ts`): I3 zählt
  je Kantenpaar genau die `weighted`-Segmentpaare, auf die die Ausnahme
  NICHT greift. Der frühere Test „solar ist vollständig I3-frei — Beweis,
  dass 0 erreichbar ist" behauptete ein Artefakt der Fenster-Regel; er
  sichert jetzt die exakte Identität des Restfalls (e-auto-1↔e-auto-10,
  kein gemeinsamer Port). Einheitstests in
  `lib/routing/rules/portBundle.test.ts` (19, davon 9 Locus-Fälle:
  Fan-Out-Jog 54 ≤ 68 erlaubt, Locus 84 > 68 zählt, Grenzfall 60 zählt,
  Parallellauf ganz im Korridor, Überlappung über Korridorende, Fan-In,
  freie Trasse, ohne gemeinsamen Port).
- **Der verbleibende Rest ist Arbeit am Port-Fan-Out/Platzierung** — die
  Hebel sind in ADR 0027 und ROUTE-002 Teil 2b/3 dokumentiert. Diese
  Entscheidung macht den Rest sichtbar und zählbar; sie löst ihn nicht.

## Alternativen (v2)

- _Beibehaltung des Segment-Fensters (v1):_ verworfen — das Fenster
  überstellt geometrisch, nicht fachlich; 8 nachgewiesene Fehlfreistellungen
  sind keine Basis für Ratchets, die „nur sinken" versprechen.
- _Korridor über Tokenschwelle ohne Bogenlängen-Messung:_ verworfen — dieselbe
  Argumentation wie in v1; die Locus-Regel nutzt das Token als Maßstab der
  Bogenlänge, nicht als pauschale Distanzschwelle.
- _Router ändern, um die 8 Fälle zu fixen:_ bewusst getrennt — der Router ist
  von der Checker-Frage entkoppelt (byte-identisch). Router-Arbeit läuft über
  ADR 0032 und das Recapture-Ledger, mit Messung statt Gefühlsentscheid.

## Historie

- **v1 (2026-10-02):** Symmetrische I2/I3-Ausnahme über Segment-Fenster
  („erste zwei bzw. letzte zwei Segmente"). I3-Rest 98 → 41 (Σ); solar 0.
  Die Fenster-Fassung stellte 8 Paare zu Unrecht frei (nachgemessen
  2026-10-03) — darunter die beiden Referenzfälle ohne gemeinsamen Port.
