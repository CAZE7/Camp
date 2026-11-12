# Prüfkette zum Artefakt

Reproduziert die Zahlen, die im [Whitepaper](../WHITEPAPER.md) und in der
[README](../README.md) stehen. Kein Build-Schritt, kein Testframework — vier
Node-Skripte, die das ausgelieferte `index.html` in `jsdom` laden und entweder
die gerenderten SVG-Daten prüfen (nicht die Layout-Interna) oder die Engine über
ihre öffentliche API (`CampEngine`) befragen.

```bash
cd docs/research/kkt-routing-engine/verify
npm install           # einmalig: jsdom
node verify.mjs       # Geometrie, DOM, Selbsttest, Stresstest
node sweep.mjs        # Betriebsbereich (42 Läufe, WHITEPAPER §8.2)
node bruteforce.mjs   # B&B gegen 12^m-Enumeration (WHITEPAPER §8.1)
node duality.mjs      # KKT-Residuum, schwache Dualität, Schattenpreis (§8.4)
```

Optional ein anderer Artefaktpfad: `node verify.mjs /pfad/zu/index.html`.

## Was `verify.mjs` prüft

| Block         | Inhalt                                                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Szenarien  | `viewBox` = Layoutmaß; Modell-Invarianten (`crossings`, `returnCrossings`, `labelFallbacks`, `cardOverlaps`), $T\ge\omega$; gerenderte Zuleitungen kreuzungsfrei; Karten- und Labelrechtecke disjunkt |
| 2. Rückleiter | Schalter `#toggleReturn` an; Rückleiter × Rückleiter, × fremde Zuleitung, × Knotenkarte                                                                                                               |
| 3. Selbsttest | Klick auf `#selftestBtn`, Auswertung des Texts (200 Zufallsbäume, fester Seed)                                                                                                                        |
| 4. Stresstest | 144 Netze über `window.__route(net)`: kreuzungsfrei, rückleiterfrei, Labels/Karten frei                                                                                                               |

## Was `bruteforce.mjs` prüft

100 Zufallsnetze mit 3–5 Kanten. Für jedes wird das eingefrorene lineare Problem
rekonstruiert (Kostenvektor, Spannungsvektor, Belastbarkeits-Untergrenzen, um
Kontaktabfälle reduziertes Budget) und das B&B-Ergebnis mit einer vollständigen
Enumeration aller 12^m Belegungen verglichen. Erwartung: **100/100 exakt**,
alle Optima bewiesen.

## Was `duality.mjs` prüft

Am selben eingefrorenen Problem, für alle drei Referenznetze: KKT-Stationarität
`c a²/(b Λ) = 1` auf inneren Kanten, schwache Dualität (Relaxation ≤ B&B) und
den Schattenpreis gegenüber einer zentralen Differenz des Budgets. Erwartung:
Residuum ≤ 5e-16, Dualitätslücke positiv, Σλ-Abweichung < 1 %.

## Was `sweep.mjs` prüft

14 Parametersätze (Budget 1/3/5 %, Umgebung 15/45/55 °C, Längen ×1,5/×2,
Kontakte ×0,5/×2, XLPE, drei Kombinationen) je Szenario. Ein Lauf gilt als
korrekt, wenn er zulässig ist **oder** die Unlösbarkeit zertifiziert wurde
(alle Kanten auf 120 mm² bzw. Kalt-Schranke über Budget, WHITEPAPER §2.8).
Alles andere ist ein Fehler und lässt das Skript mit Exit-Code 1 enden.

## Erwartete Ausgabe

```
ALLE PRÜFUNGEN BESTANDEN
Läufe 42 · zulässig 40 · zertifiziert unlösbar 2 · unerklärt 0
Netze 100 · exakt gleich 100/100 · B&B-Optimalität bewiesen 100/100
max. KKT-Residuum 4.4e-16 · schwache Dualität erfüllt · max. FD-Abweichung 0.94 %
```

Die Laufzeiten schwanken mit der Maschine; die Zählwerte nicht — der
Zufallsgenerator ist ein LCG mit festem Seed.
