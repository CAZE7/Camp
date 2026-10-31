# Abnahme Ladebooster-Vergleich — 2026-10-31

Vorher/Nachher-Belege für die optische Freigabe vor dem Merge (AGENTS.md M11-1 im
Stand `353efd5`; die gestraffte Fassung auf `main` führt die Pflicht nicht mehr —
die Zusage an den Betreiber bleibt). Aufgenommen aus den **gebauten Static
Exports**, nicht aus dem Dev-Server und nicht als Mockup: Chromium über Playwright,
ausgeliefert von `scripts/e2e/static-server.mjs` — demselben Server, den die
e2e-Tests benutzen.

| Satz    | Commit    | Export                                     |
| ------- | --------- | ------------------------------------------ |
| Vorher  | `ef7a679` | `main` mit den Inhaltskorrekturen aus #581 |
| Nachher | `53c961f` | Merge des Vergleichs-Templates in `main`   |

Die erste Aufnahme-Runde gegen `353efd5`/`642400e` ist durch diese ersetzt: `main`
hat inzwischen Kopf und Fuß über `components/brand/PageShell.tsx` neu gebaut, und
`SeoPage` trägt diese Hülle. Ein Vergleich gegen den alten Kopf wäre kein
Vergleich gegen den Stand, der gemergt wird.

## Dateien

- `*-375-<schema>-falte.png`, `*-768-…`, `*-1440-…` — der **erste Bildschirm**
  (Viewport 375×812, 768×1024, 1440×900), hell und dunkel, `deviceScaleFactor: 1`.
  Hier entscheidet sich die Zusage „Vergleich zuerst": Vorher steht im ersten
  Bildschirm nur Fließtext, nachher die Rangliste mit Filtern und den korrigierten
  Preisen (Orion 168 €, Renogy 210 €).
- `vorher-1440-light-uebersicht.png` / `nachher-1440-light-uebersicht.png` — die
  **ganze Seite** bei 1440 px in 35 % Auflösung, gleiche Skalierung in beiden
  Bildern. Nur als Längenbeleg; lesen kann man sie nicht.

## Gemessene Seitenhöhe (Chromium, `document.documentElement.scrollHeight`)

| Breite  | Vorher    | Nachher   | Veränderung |
| ------- | --------- | --------- | ----------- |
| 375 px  | 31.717 px | 16.596 px | −47,7 %     |
| 768 px  | 19.006 px | 11.377 px | −40,1 %     |
| 1440 px | 17.624 px | 10.291 px | −41,6 %     |

Hell und dunkel ergeben je Breite dieselbe Höhe. Sichtbarer Text ohne JavaScript
(`scripts/seo/measureExport.ts`): 5.964 → 3.408 Wörter (−42,9 %), `h1/h2` 1/12 → 1/11,
eingehende interne Verweise 3 → 6, JS 602 → 601 KB.

## Was hier bewusst nicht liegt

Die Ganzseiten-PNGs in voller Auflösung (bis 31.717 px hoch, zusammen rund 25 MB)
sind zu schwer für das Repository. Sie lagen während der Abnahme in
`abnahme-screenshots/` neben dem Repo und sind mit demselben Aufbau reproduzierbar:
Export bauen, `static-server.mjs` starten, `page.screenshot({ fullPage: true })`.

Die Pixel-Baselines der Visuell-Tests (`tests/e2e/visual*.spec.ts`) sind im Repo als
`-linux.png` eingefroren (zuletzt neu aufgenommen in #583). Auf Windows findet
Playwright sie nicht, schreibt beim ersten Lauf selbst `-win32.png` und besteht
danach gegen die eigene Datei — ein solcher Lauf ist kein Beleg. Die optische
Abnahme läuft deshalb über diese Aufnahmen und die Freigabe des Betreibers.
