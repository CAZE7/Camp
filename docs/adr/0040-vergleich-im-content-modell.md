# ADR 0039: Vergleich im Content-Modell, Gates statt Redaktionsdisziplin

- **Status:** Angenommen
- **Datum:** 2026-10-31
- **Bezug:** `AGENTS.md` §5, §8 und M11-1 (Stand `353efd5`; die gestraffte Fassung
  auf `main` führt die Screenshot-Pflicht nicht mehr — die optische Freigabe bleibt
  Zusage an den Betreiber), `docs/ai/ARCHITECTURE-RULES.md` Regel D und M,
  `docs/superpowers/specs/2026-10-26-ladebooster-vergleich-design.md`,
  ADR 0001 (Static Export), ADR 0005 (geprüftes Token-System)

## Kontext

Der Ladebooster-Vergleich war eine Sonderkonstruktion: `app/camper-elektrik/[slug]/page.tsx`
verzweigte für genau einen Slug auf `components/seo/LadeboosterVergleich.tsx`
(1.391 Zeilen), das ein eigenes Stylesheet `app/ladebooster-vergleich.css`
(19.846 Byte) **global** über `app/layout.tsx` lud. Jede andere Inhaltsseite lief
durch `SeoPage`.

Gemessen mit `scripts/seo/measureExport.ts` am Export von `ef7a679` (main, Stand
2026-10-31, mit den Inhaltskorrekturen aus #581). Die Paket-0-Messung vom
2026-10-26 auf `353efd5` lag bei 5.828 Wörtern:

| Kennzahl                        | Vorher                                       |
| ------------------------------- | -------------------------------------------- |
| Sichtbarer Text ohne JavaScript | 5.964 Wörter                                 |
| `h1/h2/h3/h4`                   | 1/12/13/27                                   |
| Eingehende interne Verweise     | 3                                            |
| Darstellungen desselben Geräts  | 4 (Tabelle, Karte, Kurzentscheidung, Detail) |
| Erstes Vergleichs-`h2` im DOM   | nach dem Ratgebertext                        |
| JS der Seite                    | 602 KB                                       |

Dazu drei fachliche Befunde, die keine Stilfrage sind:

1. **Wiederholung.** Derselbe Satz stand bis zu dreimal auf der Seite
   (Parallelbetrieb, Lastverteilung, 180-€-Fund). Der Text war lang, ohne mehr zu sagen.
2. **Der Filter log.** Er blendete nur die Karten aus; die Tabelle zeigte weiter alle
   neun Geräte, und ein Hinweissatz erklärte diesen Zustand als Absicht.
3. **Zahlen in Mono.** Die Vergleichszone nutzte `--font-mono` für Messwerte. Das
   Design-Konzept (`docs/DESIGN-KONZEPT-2026-10.md` §2) reserviert Mono für
   Tastenkürzel und CSV-Vorschau; Zahlen gehören in Inter mit `tabular-nums`.

Die Anforderung des Betreibers: Vergleichsseiten sind **hauptsächlich Vergleich**,
der SEO-Ratgebertext steht darunter, und der Aufbau muss sich für die ganze
Artikelklasse wiederverwenden lassen — nicht nur für Ladebooster.

## Entscheidung

### 1. Der Vergleich ist ein Feld des Content-Modells, keine eigene Route

`SeoPageContent` bekommt `comparison?: ComparisonSpec` (`lib/seo/types.ts`).
`SeoPage` rendert die Vergleichszone **vor** `afterHeader` und `page.sections`.
Die Slug-Verzweigung in `app/camper-elektrik/[slug]/page.tsx` entfällt; jede
Inhaltsseite läuft wieder durch denselben Pfad.

Eine eigene URL `/vergleich/ladebooster/` wird **nicht** gebaut. Begründung aus dem
Bestand, nicht aus Präferenz: Kein Vergleichs-Intent in `lib/seo/opportunities.ts`
hat `action: 'neue-seite'` — beide Ladebooster-Vergleichs-Intents sind auf
`/camper-elektrik/ladebooster/` gebunden. Die einzige `neue-seite`-Aktion im Inventar
gehört zu `fahrzeug-spezifisch` (`intent: 'planung'`, P3), nicht zu einem Vergleich.
Eine zweite URL hätte die drei eingehenden Verweise geteilt statt gestärkt, und
`docs/seo/ANALYSE-UND-VISION.md` nennt „Überproduktion" ausdrücklich als Risiko.

Die Datenstruktur deckt den Fall einer eigenständigen Vergleichsseite trotzdem ab:
Eine `ComparisonSpec` mit wenigen oder keinen `sections` trägt die Hauptlast einer
Seite. Das ist eine Eigenschaft des Modells, kein Flag und keine Kompatibilitätsschicht.

### 2. Daten, Verhalten und Darstellung sind getrennt

- `lib/seo/comparisons/types.ts` + `ladebooster.ts` — Daten, ohne React und ohne `app/`-Importe.
- `lib/seo/comparisons/gates.ts` + `rangfolge.ts` — reine Funktionen (Wortbudget,
  Wiederholungserkennung, Preisstand, Sortierung).
- `components/vergleich/**` — Darstellung. Sie rechnet nichts Elektrisches
  (Regel D); der Filter ist eine Sichtbarkeitsentscheidung über Daten.
- `lib/boosterSizing.ts` — die einzige Stelle, die den Booster-Strom berechnet.

Die alte Komponente enthielt die Auslegungsformel inline. Sie steht jetzt in
`lib/boosterSizing.ts`, getestet mit sechs eingefrorenen Golden Values (G12), und
wird vom neuen Rechner `/rechner/ladestrom/` benutzt. Kein Commit durfte die Formel
verlieren: Deshalb lief Paket 4 (Rechner) **vor** Paket 3 (Löschen der alten Komponente).

### 3. Progressive Enhancement statt Client-Pflicht

Tabelle, Karten und Entscheidungshilfe stehen vollständig im statischen HTML.
Filter- und Sortierknöpfe werden mit der Tailwind-Klasse `hidden` ausgeliefert und
von `components/vergleich/Vergleichssteuerung.tsx` sichtbar gemacht — einer
Client-Komponente, die selbst `null` rendert und das vorhandene DOM überlagert,
statt es neu zu rendern. Ein Client-Status für neun Zeilen wäre eine zweite
Wahrheit über dieselben Daten. Ohne JavaScript ist die Seite vollständig lesbar
und der Filter nicht vorhanden — nicht kaputt. Der No-JS-Test prüft beides
(`includeHidden`).

### 4. `ItemList` mit **inline** `Product`-Knoten, ohne Preise und ohne fremde URL

`lib/seo/jsonLd.ts` bekommt `itemListNode`, `lib/seo/comparisons/schema.ts` bildet
die `ComparisonSpec` darauf ab. Neun `Product`-Knoten auf oberster Ebene würden die
bestehende Export-Regel `json-ld-inventar` reißen (genau ein Knoten je angekündigtem
Typ). Sie stehen deshalb **innerhalb** der `ListItem` und werden von der Regel nicht
als eigene Typen gezählt. Die Regel wird nicht aufgeweicht.

Bewusst **nicht** im Schema: `Offer`, `price`, `review`, `aggregateRating`, `sameAs`.
Preise stehen sichtbar auf der Seite, mit Stichtag — ein `Offer` im Schema wäre
ein Maschinenversprechen, das niemand pflegt. `sameAs` würde auf Herstellerseiten
zeigen und damit `json-ld-adresse` (Fehler bei jedem fremden Ursprung) verletzen.
`StructuredDataType` kennt `ItemList`, nicht `Product`.

### 5. Die Zusagen sind Gates, keine Redaktionsdisziplin

Zwölf Regeln G1–G12 sind als Tests hinterlegt (Spec §9). Vier davon sind die
eigentliche Entscheidung dieses ADR, weil sie einen Fehler verhindern, der im
Bestand **stand**:

| Gate | Regel                                       | Fundstelle im Bestand                        |
| ---- | ------------------------------------------- | -------------------------------------------- |
| G1   | keine doppelte Aussage auf einer Seite      | Parallelbetrieb dreifach, 180-€-Fund doppelt |
| G3   | Wortbudget Zone/Ratgeber/FAQ                | 5.964 Wörter                                 |
| G4   | Rangliste im DOM vor dem ersten Ratgeber    | Vergleich stand hinter dem Text              |
| G6   | ein Filter wirkt auf Tabelle **und** Karten | Filter blendete nur die Karten aus           |

Die Wiederholungserkennung arbeitet auf dem **längsten gemeinsamen Wortlauf**
(≥ 6 Wörter) und auf identischem normalisiertem Text (≥ 60 Zeichen). Die Fixtures
in `lib/seo/comparisons/gates.test.ts` sind die drei Wiederholungen, die tatsächlich
im alten Code standen — eine Regel, die den Fehler nicht meldet, den sie verhindern
soll, ist Dekoration.

G7 und G8 sichern die Stilentscheidung maschinenprüfbar ab: kein Stylesheet unter
`app/` außer `globals.css` und `dark-engineering.css`, kein `lb-*`-Präfix, kein Mono
in `components/vergleich/**`, `tabular-nums` in Rangliste und Produktkarte.

## Verworfene Alternativen

- **Eigene Route `/vergleich/ladebooster/`.** Teilt die Verlinkung, erzeugt eine
  zweite URL für dieselbe Suchabsicht und braucht eine Canonical-Entscheidung,
  die das Inventar nicht hergibt (§1).
- **Jaccard-Ähnlichkeit als Dublettenmaß.** An den drei echten Wiederholungen
  gemessen: Jaccard 0,43, gemeinsame 5er-Wortfolgen 0,04. Ein Schwellwert, der beide
  Fälle fangen soll, trifft entweder zu viel oder zu wenig. Der längste gemeinsame
  Wortlauf trifft beide exakt.
- **`Product`-Knoten auf oberster Ebene und Abschwächen von `json-ld-inventar`.**
  hätte ein bestehendes Export-Gate für einen neuen Anwendungsfall geopfert.
- **Ein Bild-Slot in `ContentSection` für das alte Schaltplan-SVG.** Das SVG hing an
  `lb-*`-Klassen und 17 inline `fontFamily`-Attributen, die G7 verbietet. Statt einen
  Slot für einen Einzelfall zu bauen, entfällt die Grafik. Ihre drei Aussagen stehen
  als Text und Definition im Abschnitt `leitung`; die Kabeltabelle deckt dafür jetzt
  30, 50 und 90 A bei 2, 4 und 6 m ab.
- **Pixel-Baselines als optische Abnahme.** Die Baselines im Repo sind `-linux.png`.
  Auf Windows schreibt Playwright beim ersten Lauf selbst `-win32.png` und besteht
  danach gegen die eigene Datei — das ist kein Beleg. Die optische Abnahme läuft
  über Vorher/Nachher-Screenshots und den Betreiber (M11-1 im Stand `353efd5`,
  auf `main` gestrichen; die Zusage bleibt).

## Konsequenzen

Gemessen nach dem Umbau (`npm run build` inklusive `auditExport`, danach
`measureExport`):

| Kennzahl                        | Vorher      | Nachher                    |
| ------------------------------- | ----------- | -------------------------- |
| Sichtbarer Text ohne JavaScript | 5.964       | **3.408** Wörter (−42,9 %) |
| `h1/h2/h3/h4`                   | 1/12/13/27  | **1/11/15/0**              |
| Eingehende interne Verweise     | 3           | **6**                      |
| Darstellungen je Gerät          | 4           | **2**, mobil **1**         |
| JS der Seite                    | 602 KB      | **601 KB**                 |
| Globales Sonder-Stylesheet      | 19.846 Byte | **entfällt**               |
| Reihenfolge                     | Text zuerst | **Rangliste zuerst**       |

- **Positiv:** Eine neue Vergleichsseite braucht eine `ComparisonSpec` und einen
  Eintrag im Content-Inventar — keine Route, keine Komponente, kein Stylesheet.
  Die Zusagen der Seite sind Tests und überleben den nächsten Redaktionsdurchgang.
- **Positiv:** Die Auslegungsformel hat einen einzigen Ort und einen Golden Test.
  Der Ladestrom-Rechner erweitert `CalculatorId` auf fünf elektrische Rechner; die
  Rechnerleiste führt ihn als sechsten Eintrag (neben Heizlast und Dachbelegung),
  der Rechner-Hub als siebtes Werkzeug. Er ist `lazy` gebündelt (G11) und über die
  Rechnerleiste, den Hub und die Ladebooster-Seite verlinkt.
- **Preis:** Zwei Darstellungen je Gerät statt vier sind eine bewusste
  Informationsreduktion. Die Tabelle scannt, die Karte trägt Tiefe und Caveats;
  was früher in „Kurzentscheidung" und „Detail" doppelt stand, steht jetzt einmal
  in `useCases` bzw. `caveats`.
- **Preis:** G1 verlangt beim Schreiben Umformulierung statt Kopieren. Das ist
  Arbeit, die vorher unsichtbar blieb und sich im Text als Länge zeigte.
- **Grenze:** G8 ist auf `components/vergleich/**` begrenzt. Die vier älteren
  Rechner nutzen weiter Mono; ihre Umstellung ist eine eigene Aufgabe und wird
  von diesem Gate nicht erzwungen.
- **Grenze:** Die visuellen Pixel-Gates bleiben auf Windows nicht auswertbar
  (siehe verworfene Alternativen). Wer sie hier „grün" meldet, hat gegen selbst
  erzeugte Dateien verglichen.
