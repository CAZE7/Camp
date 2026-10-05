# ADR 0034 — Der Port-Korridor skaliert mit der Bündelgröße

**Status:** angenommen · **Datum:** 2026-10-05 · **Bezug:** ADR 0027
(Port-Freigabe = zwei Lane-Schritte), ADR 0025/0031 (Port-Bündel-Ausnahme,
eine Wahrheit), ADR 0033 (Trenngang, Korridor-Kapazität), ADR 0035
(Auslaufkorridor fremder Anschlüsse — verworfener Versuch zu p11), ROUTE-010
(p02, p11), AUDIT ROUTE-009

## Kontext

Zwei Regeln, die denselben Raum vor einem Anschluss beschreiben, gaben
verschiedene Antworten:

| Regel | Quelle | Wert |
| --- | --- | --- |
| Freigabe vor einem Port | `ROUTING_TOKENS.portFacingClearance` (ADR 0027) | **68 px**, fest |
| Fächerbreite für K Kanten | `requiredPortCorridor(K) = stubMin + (K−1)·laneGrid` | 24 / 40 / 56 / **72** / 88 px |

Bis `K = 3` ist 68 px mehr als der Fächer braucht. Ab `K = 4` fordert die
Fächerregel 72 px, die Freigabe gesteht aber weiter 68 px zu. Die Folge ist
kein geometrischer Fehler, sondern ein **Widerspruch im Regelwerk**: Der
Router legt den Fächer planmäßig so hin, wie die Fächerregel es verlangt —
und I3 meldet ihn anschließend als Verstoß.

Das ist in `p02-batterie-10-verbraucher` gemessen. Alle sechs Verstöße
lagen bei **Abstand 0.0 px**, zwischen `e-fuse-cons-1/4/5/9` — vier Kanten
auf einem Anschluss. Null Abstand heißt: Der Router hatte nicht „zu wenig
Abstand gehalten“, er hatte einen Fächer gelegt und dafür eine Ausnahme
bekommen, die an der falschen Stelle endete.

## Entscheidung

**Die Port-Bündel-Freigabe ist das Maximum aus beiden Regeln.**

```ts
bundleCorridor(bundleSize, tokens) =
  max(tokens.portFacingClearance, requiredPortCorridor(bundleSize, tokens))
```

* `K ≤ 3` → 68 px, unverändert. Das Token bleibt die Autorität; die Änderung
  ist hier die Identität.
* `K ≥ 4` → `stubMin + (K−1)·laneGrid`. Der Korridor wächst **genau so weit,
  wie der Fächer es braucht, und keinen Pixel weiter**.
* Jenseits des Korridors gilt die volle Freigabe unverändert.

`bundleSize` ist die Zahl der Kanten, die an dem gemeinsamen Anschluss
enden — `portBundleSizes()` zählt gerundete Endpunkte.

### Eine Wahrheit für beide Seiten

`isPortBundleProximity()` bekommt die Bündelgrößen als **optionalen** sechsten
Parameter. Ohne ihn bleibt das alte Verhalten (festes Token) — Bestandsaufrufe
ändern sich nicht stillschweigend. Mit ihm rechnen:

* `lib/routing/invariants.ts` → `checkClearance` (I3, das Gate) und
* `components/edges/utils/separation.ts` → der Trenngang (die Reparatur)

mit **demselben** Ergebnis. Beide bauen die Größen aus derselben Geometrie,
die sie prüfen bzw. bewegen. Damit kann die Reparatur nicht etwas für gut
erklären, das das Gate anschließend meldet (oder umgekehrt) — die
Voraussetzung dafür, dass der Trenngang überhaupt konvergiert.

## Warum nicht „Token erhöhen“

`portFacingClearance` pauschal auf 72 px zu setzen, hätte p02 ebenfalls
gedeckt — und gleichzeitig jeden drei- und zweikantigen Anschluss im
Werkzeug enger gemacht als nötig. Die Bündelgröße ist die Ursache, also
gehört sie in die Formel, nicht in eine neue Konstante.

## Messung

| Szenario | I3 vorher | I3 nachher |
| --- | --- | --- |
| `p02-batterie-10-verbraucher` | 6 | **0** |
| `p03-busbar-fanout` | 1 | **0** |
| `p11-zwangskreuzung` | 2 | 2 (Ursache ADR 0035) |
| **Summe über p01–p15** | **8** | **2** |

`npm run routing:audit`: unverändert grün (I1–I7 = 0 in allen sechs Plänen).
Referenz-Goldens unverändert — die Änderung ist für `K ≤ 3` die Identität und
greift nur dort, wo vorher ein Widerspruch gemeldet wurde.

## Konsequenzen

* Ein Anschluss mit vielen Kanten bekommt einen größeren Auslaufkorridor
  zugestanden. Das ist keine Aufweichung: Außerhalb des Korridors gilt die
  Freigabe unverändert, und der Korridor ist so kurz wie der Fächer es
  verlangt — nicht länger.
* `bundleCorridor` ist die einzige Stelle, die beide Regeln zusammenführt.
  Wer eine der beiden Quellen ändert, ändert automatisch beide Seiten
  (Gate und Trenngang).

## Verwandt

* ADR 0035 — Auslaufkorridor fremder Anschlüsse (verworfen; die andere Hälfte
  von ROUTE-010, `p11-zwangskreuzung`, bleibt offen)
* ADR 0033 — Trenngang als Garantiepunkt
* ADR 0027 — Herkunft von `portFacingClearance`
