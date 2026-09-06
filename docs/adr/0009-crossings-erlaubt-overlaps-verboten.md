# ADR 0009 — Crossings sind erlaubt, Overlaps verboten

**Status:** angenommen · **Datum:** 2026-09-06 · **Bezug:** WP-0c (#403), ROUTING-V2 §4

## Kontext

Zwei Fehlerbilder werden im Kabel-Routing regelmäßig verwechselt:

- **Overlap:** zwei Kabel laufen kollinear aufeinander — sie sehen aus wie
  **ein** Kabel. Für einen Elektroplan fatal: der Leser kann Stromkreise nicht
  mehr unterscheiden, Fehlersuche und Dimensionierung werden irreführend.
- **Crossing:** zwei Kabel kreuzen sich in einem Punkt. In realen Stromplänen
  topologisch oft unvermeidbar (zyklische Ladekreise, Busbar-Fan-Out) und bei
  klarer Darstellung (Hop) problemlos lesbar.

Ein Routing, das beides gleich behandelt, optimiert entweder zu aggressiv
(endlose Umwege zur Crossing-Vermeidung) oder zu lasch (Overlaps rutschen durch).

## Entscheidung

Das Kollisionsmodell (WP-3, #391) klassifiziert verbindlich:

| Kollision                     | Klasse       | Konsequenz                                      |
| ----------------------------- | ------------ | ----------------------------------------------- |
| Edge × Node                   | **HARD**     | verboten — garantiert unmöglich                 |
| Edge × Edge Overlap/kollinear | **HARD**     | verboten — garantiert unmöglich                 |
| Edge × Edge Crossing          | **SOFT**     | minimieren; unvermeidbar → Hop-Rendering (WP-7) |
| Clearance-Verletzung          | **WEIGHTED** | Kosten (A*) bzw. Spacing (ELK)                  |

Overlap-Freiheit und Clearance sind **Invarianten** (Testsuite WP-10, CI-Blocker).
Crossing-Anzahl ist eine **Metrik** (Regression-Suite WP-11: Delta ≤ 0 gegen
Baseline). Beide Router (ELK-Pass und A*-Pass) konsumieren dieselbe
Klassifikation — kein Router definiert eigene Kollisionsbegriffe.

## Konsequenzen

**Gut:** klares Optimierungsziel (Crossings minimieren) ohne unerfüllbare
Absolutforderung; Hop-Rendering macht verbleibende Kreuzungen eindeutig
(Kreuzung ≠ Verbindung); Tests können hart (Invariante) und weich (Metrik)
getrennt prüfen.

**Preis:** Hop-Rendering ist Zusatzaufwand (WP-7, Prioritätsregel); die
Crossing-Metrik braucht eine Baseline (Golden Master, WP-0b).

## Alternativen

- _Crossings ebenfalls verbieten:_ verworfen — bei zyklischen Camper-Topologien
  unerfüllbar, erzwingt groteske Umwege.
- _Overlaps nur „bestrafen“ statt verbieten:_ verworfen — ein einziger Overlap
  zerstört die Lesbarkeit des Plans; Kosten statt Verbot lässt Restfälle zu.
