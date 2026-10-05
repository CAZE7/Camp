# ADR 0035 — Auslaufkorridor fremder Anschlüsse (Versuch, **verworfen**)

**Status:** VERWORFEN · **Datum:** 2026-10-05 · **Bezug:** ADR 0010
(Determinismus), ADR 0015 (harte Final-Invariante), ADR 0027 (Port-Freigabe),
ADR 0032 (scoped Tube-Reparatur), ADR 0034 (Korridor nach Bündelgröße),
ROUTE-010 (`p11-zwangskreuzung`), AUDIT ROUTE-011/012

> **Warum steht ein verworfener Versuch im ADR-Register?**
> Weil er gebaut, gemessen und eingecheckt war — und weil die Messung zeigt,
> warum er wieder raus musste. Wer p11 als Nächstes angeht, soll nicht
> denselben Weg ein zweites Mal gehen. Der Befund besteht weiter
> (`p11-zwangskreuzung`: 1 × I2 + 2 × I3); er ist in
> `docs/ai/KNOWN-PROBLEMS.md` (ROUTE-010) geführt und in
> `scripts/regression/regression.test.ts` als `it.fails` verdrahtet: Der Test
> ist grün, solange der Befund besteht, und wird rot, sobald jemand ihn
> repariert — er zwingt dann, den Fall zurück in das harte Gate zu schieben.

## Kontext

`p11-zwangskreuzung` ist das kleinste Szenario des Werkzeugs: zwei Karten,
zwei Kanten, über Kreuz.

```
src-top    (40,  40) ──plus──► dst-bottom (720, 500)   → e-down
src-bottom (40, 500) ──plus──► dst-top    (720,  40)   → e-up
```

Beide Startpunkte liegen 24 px hinter der **rechten Kante der fremden Karte**
(`src-top` endet bei x = 232, `src-bottom` beginnt dort). Genau dort lief die
Haupttrasse von `e-down` entlang — auf der Linie, auf der `e-up` ihren Stub
braucht.

Danach gab es für `e-up` keinen Weg mehr (vollständig nachgerechnet, alle
Kombinationen der Katalog-Varianten `primary` / `late` / `midX` / `midY`,
jeweils mit und ohne A*-Seitenschritte):

* `e-down` L@256, `e-up` L@256 → **464 px kollineare Überdeckung** (I2)
* jede Z-Form einer Seite → die andere bleibt auf einer Linie, die durch die
  Tubes der ersten gesperrt ist
* Weg unter der Startlinie → schneidet die eigene Karte (I1)

Ergebnis: **1 × I2 + 2 × I3**.

Die Ursache ist nicht „die Kanten müssen sich kreuzen“ — eine Kreuzung ist
`soft` und erlaubt. Die Ursache ist: **Der Router darf eine Trasse in den
Auslaufkorridor eines fremden Anschlusses legen und nimmt der Kante damit den
einzigen Weg aus diesem Anschluss heraus.** Das ist ein Eingriff in die
Topologie der *anderen* Leitung, nicht in die eigene.

## Der Versuch

**Jeder belegte Anschluss bekommt einen Auslaufkorridor, der für fremde
Trassen Sperrfläche ist.**

```
Länge:  stubMin + cableClearance   (24 + 12 = 36 px)
Breite: 2 · cableClearance         (24 px)
```

Beide Maße aus `ROUTING_TOKENS` — keine neue Konstante. Nur **tatsächlich
belegte** Ports (aufgelöst mit demselben `resolveHandle`, den die Suche
nutzt); die eigene(n) Karte(n) der laufenden Kante ausgenommen. Die Korridore
gehen in die Hindernisse für **Katalog und A\*** ein, **nicht** aufgebläht
(`OBSTACLE_MARGIN`) — ihre Breite ist bereits die Freigabe.

## Messung — warum verworfen

### Was er gewinnt

|  | vorher | mit Versuch |
| --- | --- | --- |
| `p11-zwangskreuzung` I1 / I2 / I3 | 0 / 1 / 2 | **0 / 0 / 0** |
| Summe über p01–p15 | 0 / 1 / 2 | **0 / 0 / 0** |

### Was er kostet — der Ausschlussgrund

Das **Versatz-Gate** (`scripts/routing/shiftInvariance.test.ts`, 294 Läufe:
6 Pläne × 7×7-Translationsmatrix) bricht. Eine reine Plan-Translation darf
das Routing-Ergebnis nicht verändern; mit den Korridoren tut sie es:

|  | ohne Korridore | mit Korridoren |
| --- | --- | --- |
| I1 über alle Läufe | **0** | **2** (`simple`) |
| I2 / I3 `camper` | 6 / 22 | 8 / **41** |
| I2 / I3 `solar` | 0 / 0 | 0 / **17** |
| I2 / I3 `acdc` | 2 / 24 | 19 / **39** |

Ursache: ob eine fremde Trasse in einem Korridor liegt, hängt von der
absoluten Rasterlage ab. Verschiebt sich der Plan, fallen Korridore weg oder
kommen neue hinzu — und eine Sperrfläche mehr kann eine Route unmöglich
machen, worauf der Notfallpfad durch ein Bauteil fährt. Der Router wird damit
positionsabhängig in einer Weise, die ADR 0010 (Determinismus) und das P0-
Versatz-Gate nicht zulassen.

### Weitere Kosten

| Plan | Kreuzungen vorher | mit Versuch | Länge vorher | mit Versuch |
| --- | --- | --- | --- | --- |
| simple | 1 | 0 | 2665 | 2719 |
| camper | 4 | 1 | 3677 | 3672 |
| solar | 2 | 2 | 3200 | 3274 |
| inverter | 2 | 2 | 3710 | 3750 |
| acdc | 6 | 3 | 5646 | 5943 |
| complex | 25 | **30** | 8646 | 8799 |
| **Summe** | **40** | **38** | **27544** | **28157** |

Summe der Kreuzungen sinkt (40 → 38), Trassenlänge steigt um **+2,2 %**, und
`complex` wäre der einzige Ratchet-Eintrag im Gesamtwerk, der nach oben geht
(25 → 30).

## Was sonst versucht wurde (alles gemessen, alles verworfen)

| Ansatz | Ergebnis |
| --- | --- |
| Korridor als Kosten-Term statt harter Sperre (HARD/WEIGHTED im Kostenmodell) | greift zu spät: der Katalog-Pfad wird vor jeder Kosten-Bewertung gewählt |
| Reparatur nach der Wahl („Route liegt im Korridor ⇒ neu suchen“) | p11 unverändert; die Alternativen erzeugen wieder eine Überdeckung |
| Dieselbe Reparatur, aber nur bei **gleichachsiger** Belegung (Längs = tabu, Queren = erlaubt) | Referenzpläne unberührt (complex bleibt 25), aber p11 bleibt bei 1 × I2: `e-up` landet 16 px hinter dem Trassenanfang von `e-down` |
| Korridorlänge 28/32/36/40/44/52 px, Halbbreite 4/6/8/12 px gesweept | `complex` nie unter 26 Kreuzungen; bei 32/40/44 px zusätzlich I2/I3-Verstöße |
| Korridor nur für Anschlüsse von Karten mit ≤ 1…3 Kanten | `complex` bleibt bei 30 |
| Versuchsweise `midX`-Katalogvariante auch bei zugewandten Ports zulassen | ändert am Ergebnis nichts |

## Was daraus bleibt

* **ADR 0034 ist geblieben** und trägt den p02-Teil von ROUTE-010 allein:
  Der Port-Korridor skaliert mit der Bündelgröße. p02 6 → 0 I3, p03 1 → 0.
* **Die Domänenregel im Trenngang** kam mit diesem Versuch mit und ist
  geblieben (paarweise Freigabe, zweiter Durchgang, Veto gegen
  Basis-Freigabe-Verschlechterung): parallele Mischpaare unter 24 px
  **16 → 8**.
* **p11 bleibt offen.** Der nächste Versuch braucht etwas anderes als eine
  zusätzliche Sperrfläche: Der Router müsste die *Reihenfolge* der zu
  verlegenden Kanten wählen können (hintereinander statt `compareIds`) oder
  eine koordinierte Umplanung beider Kanten zulassen. Beides ist eine
  Änderung am Ablauf, nicht am Kostenmodell.

## Verwandt

* ADR 0034 — Korridor skaliert mit der Bündelgröße (bleibt, p02)
* ADR 0033 — Trenngang als Garantiepunkt
* ADR 0032 — scoped Tube-Reparatur (Sperrflächen gezielt weglassen — hier
  umgekehrt, und hier zu teuer)
