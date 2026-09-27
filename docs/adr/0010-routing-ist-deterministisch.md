# ADR 0010 — Routing ist deterministisch

**Status:** angenommen · **Datum:** 2026-09-06 · **Bezug:** WP-0c (#403), ROUTING-V2 §7/§12

## Kontext

Der Plan wird ständig neu geroutet (Drag, Undo/Redo, Re-Layout, Import). Wenn
derselbe Input unterschiedliche Trassen liefern kann, entstehen drei Probleme:
visuelles „Springen“ für den Nutzer, unbrauchbare visuelle Regressionstests
(jede Baseline flackert) und ein nicht diffbarer Golden Master. Der bestehende
Router ist bereits weitgehend deterministisch (ADR 0003, eingecheckte
Routing-Galerie); V2 führt mit ELK, LaneRegistry und Worker neue potenzielle
Nichtdeterminismus-Quellen ein (Map-Iterationsreihenfolge, Race-Pfade bei
asynchronen Antworten, ID-Abhängigkeiten).

## Entscheidung

**Gleicher Input ⇒ identischer Output** — als prüfbare Invariante (Nr. 8/9 der
Invarianten-Suite, WP-10) für **beide** Pässe:

1. Keine Zufalls- oder Zeitquellen in der Routing Engine (`Math.random`,
   `Date.now` verboten; IDs kommen von außen).
2. Jede Sortierung hat einen totalen, stabilen Schlüssel — Lane-Vergabe über die
   3-Stufen-Sortierung der LaneRegistry (topologische Ordnung → Zielposition →
   stabile ID als letzter Tie-Breaker), Fan-Out analog (WP-9).
3. Asynchronität ändert nie das Ergebnis, nur den Zeitpunkt: beim
   ELK-/Routing-Worker gewinnt die letzte Anfrage (P-6-Vertrag, keine
   Race-Pfade); Fallback-Entscheidungen (Timeout) sind als solche im Ergebnis
   markiert und in Tests deterministisch erzwingbar.
4. Caches sind reine Beschleuniger: Cache-Hit und Cache-Miss liefern identische
   Ergebnisse.

Abgesichert durch: Doppellauf-Tests (zweimal routen, byte-identisch),
Golden Layouts (WP-11) und die eingecheckte Routing-Galerie.

## Konsequenzen

**Gut:** stabile visuelle Baselines und Golden-Master-Diffs; Undo/Redo stellt
exakt denselben Plan wieder her; Bug-Reproduktion wird trivial.

**Preis:** ELK-Konfiguration muss auf Determinismus geprüft werden (feste
Seeds/Strategien); Sortierschlüssel-Disziplin bei jedem neuen Vergleich;
Performance-Optimierungen dürfen Reihenfolgen nicht „opportunistisch“ ändern.

**Geltungsbereich (aktualisiert 2026-09-26):** „gleicher serialisierter
Eingabegraph ⇒ identischer AutoWire- und Routing-Output“ umfasst auch die IDs
neu erzeugter AutoWire-Knoten/-Kanten. AutoWire vergibt deterministische
Knoten-IDs aus Typ/Rolle und Label; neue Kanten-IDs werden in festen
AutoWire-Phasen mit einer kanonischen top-down/left-right/ID-Sortierung der
beteiligten Node-Kategorien vergeben, nicht in Eingabe-Array-Reihenfolge.
Bestehende Auto-Kanten-IDs werden über die Verbindungsidentität (Quelle, Ziel,
Handles, elektrische Domäne) für dieselbe Verbindung übernommen. Nutzer- und
historische Auto-IDs werden bei neuen Vergaben reserviert; Kollisionen werden
deterministisch übersprungen. IDs interaktiver
Nutzeraktionen bleiben sitzungs-eindeutige Zufalls-UUIDs und sind Eingaben,
keine Routing-Ausgabe. Doppellauf-Regressionen sichern die Byte-Identität bei
identischer serialisierter Eingabe; eine Permutationsprobe vergleicht
explizit die Zuordnung Auto-Edge-ID → Verbindung. Der Golden Master normalisiert
neue AutoWire-Knoten-IDs weiterhin (`auto:<i>:<slug>`), hält Auto-Edge-IDs aber
bewusst fest, damit ihre Stabilität und ihre Routing-Zuordnung regressionsgeprüft
werden.

## Alternativen

- _„Praktisch deterministisch reicht“:_ verworfen — genau die seltenen
  Abweichungen zerstören CI-Baselines und Nutzervertrauen beim Drag.
- _Determinismus nur für den A_-Pass:* verworfen — der Golden Master vergleicht
  die gesamte Pipeline; ein nichtdeterministischer ELK-Pass macht ihn wertlos.
