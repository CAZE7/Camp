# Baseline-Refresh 2026-11-02 — Oberflächenbelege (vorher / nachher)

Pflicht aus `docs/UI-BASELINE.md` §4: „Vorher/Nachher-Bilder gehören in den
PR-Kommentar, wenn Pixel-Baselines geändert werden."

Jedes Bild zeigt **links die bisherige Baseline** (Stand `af7f646`) und **rechts die
neue Aufnahme** (`baselines.yml`, Lauf 41474593898, Ubuntu-Runner). Es sind keine
Neu-Aufnahmen im Browser, sondern Montage-Paare aus den beiden PNGs — damit ist das
Bild identisch mit dem, was das Gate vergleicht.

| Bild                                | Baseline-Gruppe                                             | Diff pro Bild | Befund                                                                                                                                                                                                                 |
| ----------------------------------- | ----------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-designsystem-ueberlauf-375.png` | `de-design-system-{light,dark}-mobile-375-*` (8 Bilder)     | 30,15–30,52 % | Die fullPage-Aufnahme war 400 px breit (im Pixel-5-Projekt 401 px). Die rote Marke ist der Viewport-Rand bei 375 px — die rechte Spalte der Trassen-Beispiele lag dahinter. Nach `50da85b` einkolonnig, 375 × 5536 px. |
| `02-node-karte-touch-pixel5.png`    | `de-node-{default,focus,hover,selected}-touch-pixel5-*` (4) | 29,00–41,52 % | Der Kartenrahmen begann bei Zeile 29 und endete mitten in der Karte: `ΔU` nur angeschnitten, der untere Abschluss fehlte. Jetzt sitzt der Rahmen bei 0 und 147/148.                                                    |
| `03-miniaturuebersicht.png`         | `route-planung-{light,dark}-desktop-1440-*` (2 Bilder)      | 1,18–1,19 %   | Der Hauptstromkreis-Rahmen war ein schwarzer Block. Nach `8a09104` Panel-Fläche mit 1 px Umriss und 6 px Innenabstand. Unter der 2-%-Schwelle, also kein Gate-Fehler — übernommen, weil die Änderung gewollt ist.      |

## Reproduzieren

```bash
# "vorher" = die versionierten PNGs, "nachher" = das Artefakt des Aufnahme-Laufs
git archive HEAD tests/e2e/visual.spec.ts-snapshots tests/e2e/visual-de-pixel.spec.ts-snapshots \
  | tar -x -C /tmp/oldfull
gh api repos/CAZE7/Camp/actions/runs/41474593898/artifacts   # pixel-baselines, 10,7 MB

python - <<'PY'
from PIL import Image
old = Image.open('/tmp/oldfull/tests/e2e/visual-de-pixel.spec.ts-snapshots/'
                 'de-design-system-light-mobile-375-mobile-375-linux.png')
new = Image.open('/tmp/baselines/visual-de-pixel.spec.ts-snapshots/'
                 'de-design-system-light-mobile-375-mobile-375-linux.png')
print(old.size, new.size)   # (400, 5609) gegen (375, 5536)
PY
```

Crop-Kästen der Paare: `01` = `(0, 2150, 400, 2450)`, `02` = ganzes Element
(224 × 149, 3-fach vergrößert), `03` = `(290, 640, 570, 830)`. Die Crop-Box wird je
Bild an die echte Breite begrenzt — PIL füllt eine Box außerhalb des Bildes sonst mit
Schwarz, was wie ein vorgetäuschter Rand aussieht.
