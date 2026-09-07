# ADR 0016 — Eine einzige elkjs-Anbindung

- **Status:** Angenommen
- **Datum:** 2026-09-07
- **Kontext:** Folgt auf ADR 0014 (Engine-Konsolidierung) und ADR 0015 (harte Final-Invariante)

## Kontext

Nach dem Zusammenführen der beiden Entwicklungslinien gab es im Projekt zwei
voneinander unabhängige Anbindungen an `elkjs`:

|                                | `lib/planner/layout-engine/elk.ts` | `lib/routing/elk/`                            |
| ------------------------------ | ---------------------------------- | --------------------------------------------- |
| Umfang                         | 117 Zeilen                         | 660 Zeilen                                    |
| Produktiv verwendet            | **ja**, über `applyAdvancedLayout` | nein, nur Benchmark und Tests                 |
| Import                         | `elkjs` → `lib/main.js`            | `elkjs/lib/elk.bundled.js`                    |
| ELK-Instanz                    | neu bei **jedem** Layout           | Lazy-Singleton                                |
| Timeout                        | keiner                             | `ELK_TIMEOUT_MS = 3000`, `ElkTimeoutError`    |
| Parallele Aufrufe              | Race möglich                       | „letzte Anfrage gewinnt“ (`createElkSession`) |
| Test-Injektion                 | keine                              | `setElkInstanceForTest`                       |
| Ports, Labels, Junction Points | nein                               | ja (`FIXED_ORDER`)                            |
| Layout-Optionen                | von Hand gepflegt                  | aus den Tokens generiert                      |

Das Muster ist exakt dasselbe wie bei ADR 0014: **Von zwei Implementierungen
war die schwächere die produktiv wirksame.** Die reifere Variante war durch
Tests gut abgedeckt — aber die Tests liefen an dem Pfad vorbei, den die
Anwendung tatsächlich nimmt. Grün heißt nicht benutzt.

Dazu kam ein handfester Defekt. Der ungebündelte Einstiegspunkt `elkjs` lädt
`lib/main.js`, und der verlangt zur Laufzeit das Paket `web-worker`, das nicht
installiert ist. Im Dev-Log stand deshalb beim Öffnen der Planer-Seite:

```
Module not found: Can't resolve 'web-worker'
```

Der Fehler war nicht theoretisch — er traf genau den Pfad, der als einziger
produktiv war. Die funktionierende Anbindung lag daneben und wurde nicht
aufgerufen.

## Entscheidung

**`lib/routing/elk/runner.ts` ist die einzige Stelle im Projekt, die `elkjs`
lädt, und sie lädt ausschließlich `elkjs/lib/elk.bundled.js`.**

`ElkLayoutEngine` bleibt als Adapter bestehen, enthält aber keine eigene
ELK-Anbindung mehr. Es übersetzt nur noch zwischen den beiden Verträgen:
`LayoutRequest`/`LayoutResult` der Layout-Schicht auf der einen Seite,
`ElkPlan`/`ElkLayoutResult` des Runners auf der anderen. Damit bleiben der
`PlannerLayoutEngine`-Vertrag und der Dagre-Fallback unverändert — die
Aufrufer merken vom Umbau nichts außer dem verschwundenen Fehler.

Zwei Details, die dabei zu klären waren:

1. **Layout-Richtung.** Der Runner kannte kein `LR`/`TB`, die alte Engine
   schon. `generateElkLayoutOptions(tokens, direction?)` hat dafür einen
   **optionalen** zweiten Parameter bekommen. Ohne Argument bleibt das
   Ergebnis Byte für Byte identisch — sonst hätten sich die Golden-Master der
   bestehenden Aufrufer verschoben, was den Umbau unlesbar gemacht hätte.
2. **Knotengrößen.** `ElkLayoutResult.nodes` liefert nur `x`/`y`. Breite und
   Höhe übernimmt der Adapter aus der Anfrage zurück in das Ergebnis; für
   Knoten ohne Angabe greifen `LAYOUT_TOKENS.defaultNodeWidth/Height`.

Gelöscht wurde `lib/planner/layout-engine/elkjs.d.ts` — die Typdeklaration
beschrieb ausschließlich das Modul `elkjs`, das niemand mehr importiert.

## Durchsetzung

Ein siebtes Gate in `scripts/routing/architecture.test.ts` prüft beides:

- **Genau eine** Nicht-Testdatei enthält eine Ladeanweisung für `elkjs`, und
  das ist `lib/routing/elk/runner.ts`.
- Diese Datei lädt die **gebündelte** Variante und nicht den nackten Namen.

Der zweite Teil ist kein Zierrat. Eine einzelne Anbindung nützt nichts, wenn
sie das Modul erwischt, das im Browser nicht lädt — genau das war der Zustand
vor diesem ADR.

Beide Hälften wurden per Sabotage geprüft: ein `import ELK from 'elkjs'` in
`dagre.ts` und ein Rückbau des Runners auf den ungebündelten Pfad. Jede
Änderung für sich lässt das Gate rot werden; nach dem Zurückspielen ist es
wieder grün.

## Konsequenzen

**Positiv**

- Der `web-worker`-Ladefehler auf der Planer-Seite ist weg.
- Das produktive Layout bekommt Timeout, Singleton und Race-Schutz geschenkt —
  Eigenschaften, die vorher zwar existierten, aber im toten Pfad lagen.
- `lib/planner/layout-engine/elk.ts` schrumpft von 117 auf rund 60 Zeilen
  reine Übersetzung, ohne eigene Nebenläufigkeitslogik.

**Negativ / Risiken**

- Der Runner ist jetzt ein echter Single Point of Failure: Ein Defekt dort
  trifft Layout **und** Routing-Benchmarks. Das ist der bewusst gezahlte Preis
  dafür, dass es nur noch eine Wahrheit gibt.
- `ElkTimeoutError` kann nun auch im Layout-Pfad auftreten, wo vorher
  unbegrenzt gewartet wurde. Der Dagre-Fallback fängt das ab; ein Layout, das
  über drei Sekunden braucht, ist ohnehin kein brauchbares Layout.

## Alternativen

- **Die alte Engine reparieren** (Import korrigieren, Singleton nachrüsten,
  Timeout ergänzen): Hätte den reiferen Code ein zweites Mal nachgebaut und
  die Doppelung zementiert. Genau diese Variante hat der Auftraggeber schon
  bei ADR 0014 ausdrücklich verworfen.
- **Den Adapter ganz entfernen** und Aufrufer direkt auf `layoutWithElk`
  umstellen: Hätte den Dagre-Fallback und den `PlannerLayoutEngine`-Vertrag
  mitgerissen — deutlich größerer Eingriff ohne zusätzlichen Nutzen.
