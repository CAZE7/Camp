# Prüfkette zum Artefakt

Reproduziert die Zahlen, die im [Whitepaper](../WHITEPAPER.md) und in der
[README](../README.md) stehen. Kein Build-Schritt, kein Testframework — zwei
Node-Skripte, die das ausgelieferte `index.html` in `jsdom` laden und die
gerenderten SVG-Daten prüfen (nicht die Layout-Interna).

```bash
cd docs/research/kkt-routing-engine/verify
npm install          # einmalig: jsdom
node verify.mjs      # Geometrie, DOM, Selbsttest, Stresstest
node sweep.mjs       # Betriebsbereich (42 Läufe, WHITEPAPER §8.2)
```

Optional ein anderer Artefaktpfad: `node verify.mjs /pfad/zu/index.html`.

## Was `verify.mjs` prüft

| Block | Inhalt |
|---|---|
| 1. Szenarien | `viewBox` = Layoutmaß; Modell-Invarianten (`crossings`, `returnCrossings`, `labelFallbacks`, `cardOverlaps`), $T\ge\omega$; gerenderte Zuleitungen kreuzungsfrei; Karten- und Labelrechtecke disjunkt |
| 2. Rückleiter | Schalter `#toggleReturn` an; Rückleiter × Rückleiter, × fremde Zuleitung, × Knotenkarte |
| 3. Selbsttest | Klick auf `#selftestBtn`, Auswertung des Texts (200 Zufallsbäume, fester Seed) |
| 4. Stresstest | 144 Netze über `window.__route(net)`: kreuzungsfrei, rückleiterfrei, Labels/Karten frei |

## Was `sweep.mjs` prüft

14 Parametersätze (Budget 1/3/5 %, Umgebung 15/45/55 °C, Längen ×1,5/×2,
Kontakte ×0,5/×2, XLPE, drei Kombinationen) je Szenario. Ein Lauf gilt als
korrekt, wenn er zulässig ist **oder** die Unlösbarkeit zertifiziert wurde
(alle Kanten auf 120 mm² bzw. Kalt-Schranke über Budget, WHITEPAPER §2.8).
Alles andere ist ein Fehler und lässt das Skript mit Exit-Code 1 enden.

## Erwartete Ausgabe

```
ALLE PRÜFUNGEN BESTANDEN
Läufe 42 · zulässig 40 · zertifiziert unlösbar 2 · unerklärt 0 · langsamster 65 ms
```

Die Laufzeiten schwanken mit der Maschine; die Zählwerte nicht — der
Zufallsgenerator ist ein LCG mit festem Seed.
