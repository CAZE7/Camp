# ADR 0006 — Planer-Korrektheitskonventionen (Review-Kampagne 08/2026)

**Status:** angenommen · **Datum:** 2026-08

## Kontext

Die Review-Kampagne ("verbessere alles") fand eine Menge kleiner Fehler,
die sich für ein System hielten: Zentimeter-Pixel-Preziosen, die man als
Maßstab verkaufte; Selbstschleifen im Graphen, die die Physik brachen;
ohnmächtige Persistenz-Fehler, die den ganzen Plan löschten; und
TypeScript-Einstellungen, die Array-Unsicherheit unsichtbar machten.

Einige davon sind keine Bugs, sondern Konventionen — getroffen,
begründet, aber nirgendwo festgeschrieben. Diese werden hier gesammelt,
damit sie im Review nicht erneut „entdeckt" (und schlimmer: „behoben")
werden.

## Entscheidungen

### 1. Realistischer Maßstab: 100 px = 1 m (`PX_PER_METER`)

Der Conduit-Biegeradius und alle Längen-nahen Geometrien rechnen in
`PX_PER_METER = 100` (lib/units.ts:171). Ziel ist NICHT kartografische
Genauigkeit auf dem Bildschirm, sondern plausibles Verhältnis zwischen
Biegeradius, Leerrohr-Mindestmaßen nach DIN EN 61386 und typischem
Camper-Ausbau (1–3 m). Frühere feste Pixel-Krümmungen wirkten bei
kleinen Zoom-Stufen beliebig.

### 2. Selbstschleifen sind unphysikalisch und verboten

Eine Kante A→A ist weder Ladung noch Last. Der Guard steht im Graph-
Slice (`store/slices/graphSlice.ts:317` — `if (connection.source ===
connection.target) return;`) und wird im UI-Pfad ergänzt verhindert
(Verbindungsmodus). Wer ihn testweise entfernt, sieht Property-Tests
rot — bewusst.

### 3. Persistenz: lieber partiell retten als ehrlich löschen

Ein korruptes Slice im localStorage-Stand führt zu **Rescue-Befund**,
nicht zum Gesamt-Reset der gespeicherten Planung (store/slices/
persistence.ts). Der Planer ist Werkzeug: einen Tages-Plan wegen eines
defekten UI-Flags zu verlieren, wäre kontraproduktiv. Fenster:
korrupt → Slice zurücksetzen + konsumierbares Befund-Objekt;
total korrupt → sauberer Neustart mit Ereignis-Log statt Silent-Failure.

### 4. Heilungs-Semantik als Typ, nicht als Kommentar

Der `HealContext` (lib/autoWire/routing.ts:241) unterscheidet Domänen-
Heilung (konkrete Defekte im Graphen, die fachlich korrigiert werden)
von Typ-Heilung (Storage-Fehldeutung). Beides zu vermischen hatte dazu
geführt, dass Reparaturen unbemerkt stille Zustandsmutationen vornahmen.

### 5. `noUncheckedIndexedAccess`-Konventionen (TS-Config)

Das Flag steht in der Basis-`tsconfig.json` (nicht nur im Check-Profil),
damit Editor, Produktions- und Test-Build dieselbe Schärfe sehen.
Erlaubte Ausdrucksmuster im Code:

- destructure + Guard (`const [a, b] = arr; if (!a || !b) throw …`),
- `--`-Index-Zugriff nur hinter benannten Helfern mit Invariante
  (z. B. `at(arr, i)` mit RangeError),
- Regex-Matches: explizit getyptes Binding (`RegExpMatchArray | null`),
  destructure erst nach Guard.

Explizit UNERWÜNSCHT bleiben `as`-Casts, `any`-Schleifen und
Blanko-`!`-Assertionen in fachlichem Code.

### 6. Dead-Code wird laufend geprüft, nicht jährlich entrümpelt

`npm run audit:dead-code` (knip) liefert die Befundliste; bewusst
**nicht** als CI-Gate, weil ein Fund zuerst geprüft gehört (siehe
Block-12-Commit: der Erstlauf fand 20 echte tote Artefakte, darunter
versteckte Fehlkonfigurationen).

## Konsequenzen

- Reviews können diese Konventionen zitieren statt sie zu debattieren.
- Verletzungen sind testbar: Kontrast-Gate (ADR 0005), Property-Tests
  (Selbstschleifen, Routing-Invarianten), Rescue-Tests, Typecheck-Profil,
  knip-Befund.
- Zukünftige „warum ist das so?"-Fragen finden Antworten hier oder in
  den referenzierten Tests, nicht im Bauchgefühl des Tages.
