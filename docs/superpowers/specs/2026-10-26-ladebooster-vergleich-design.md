# Vergleichs-Template und Umbau des Ladebooster-Vergleichs — Design

Datum: 2026-10-26 · Branch: `feat/vergleichs-template` · Stand des Fundes: `353efd5`

## 1. Ausgangslage, gemessen

Die Seite `/camper-elektrik/ladebooster/` trägt einen Produktvergleich, der am
2026-10-25 als Einzelbaustein ergänzt wurde (`908d344`). Er ist die mit Abstand
unübersichtlichste Seite des Auftritts. Befund mit Belegen:

| #   | Befund                                                                                                     | Beleg                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Der Vergleich steht **unter** dem gesamten Ratgebertext                                                    | `components/seo/SeoPage.tsx:115-119` rendert erst `page.sections`, dann `children`; eingehängt in `app/camper-elektrik/[slug]/page.tsx:50`            |
| 2   | Textvolumen: 3.038 Wörter im Vergleichsblock + 3.114 Wörter Artikelcontent (Quelltext-Zählung, Obergrenze) | `components/seo/LadeboosterVergleich.tsx`, `lib/seo/content/ladebooster.ts`                                                                           |
| 3   | Nur **1 von 8** `h3`-Sektionen des „Vergleichs" ist ein Gerätevergleich                                    | `LadeboosterVergleich.tsx:38, 88, 199, 628, 753, 1034, 1128, 1184`                                                                                    |
| 4   | 9 Geräte × **4 Darstellungen**, alle hartcodiert im JSX, keine Datendatei                                  | Leiter `97-194`, Tabelle `224-287`, Detailkarten `315-556`, Kompaktkarten `564-606`                                                                   |
| 5   | Dieselben Fakten stehen dreimal fast wortgleich                                                            | Parallelbetrieb `116/566/645`, Sterling-Widerspruch `172/592/733`, Renogy 25 A `186/584/699`                                                          |
| 6   | Die Entscheidungshilfe steht hinter Rechner und Foren, fast am Seitenende                                  | `h3` „Die Entscheidung in fünf Fragen" bei `1128`                                                                                                     |
| 7   | Die C-Rate wird verwendet, bevor sie erklärt wird                                                          | verwendet `48`, erklärt `945`                                                                                                                         |
| 8   | Der Filter wirkt nur auf die Karten, nicht auf die Tabelle — die Komponente weist selbst darauf hin        | Hinweis bei `311`                                                                                                                                     |
| 9   | Kein `Product`-, `ItemList`- oder `Review`-Schema, obwohl 9 Produkte mit Preisen sichtbar sind             | `components/seo/SeoPage.tsx:34-74`, `lib/seo/inventory.ts:328-333`                                                                                    |
| 10  | 19.846 Byte seiten-spezifisches CSS werden **global** geladen                                              | `app/ladebooster-vergleich.css`, importiert in `app/layout.tsx:2`                                                                                     |
| 11  | Zahlen stehen in Mono — das Designkonzept verbietet das                                                    | `app/ladebooster-vergleich.css` 30× `var(--font-mono)`, `LadeboosterVergleich.tsx` 17× `IBM Plex Mono`; Regel: `docs/DESIGN-KONZEPT-2026-10.md:57-58` |
| 12  | Sichtbare Unfertigkeit: Foto-Platzhalter „Eigenes Foto folgt"                                              | `LadeboosterVergleich.tsx:1009-1024`                                                                                                                  |
| 13  | Die Seite hat **2 eingehende** interne Verweise — Schlusslicht im Cluster                                  | `docs/seo/AUDIT.md:25` (Spalte `ein/aus` = `2/16`); Vergleich: `sicherungen` 15/15, `batterie` 11/17                                                  |

**Wichtig zur Zahlenlage:** `docs/seo/AUDIT.md` wurde zuletzt am 2026-10-15 erzeugt
(`1c185a3`), der Vergleichsblock landete am 2026-10-25. Die Auditzahlen
(2.371 Wörter, `H1/H2` = 1/11) beschreiben den Zustand **vor** dem Vergleich. Die
Tabelle ist veraltet, weil sie nicht beim Bau entsteht: `npm run build` führt
`scripts/seo/auditExport.ts` (prüft, schreibt aber keinen Bericht), die Zahlen
liefert `npx tsx scripts/seo/measureExport.ts`, und die Dokumente schreibt
`npx tsx scripts/seo/report.ts:569-574`. Der Kommentar in `report.ts:499`
(„Diese Zahlen entstehen bei jedem Bau neu") beschreibt das nicht korrekt —
dieselbe Klasse falscher Zusage, um die es in §8 geht.

## 2. Ziel und Nicht-Ziel

**Ziel**

1. Auf Vergleichsseiten steht der Vergleich zuerst; der Ratgebertext folgt darunter.
2. Ein Vergleich wird aus **einer** typisierten Datendatei gerendert — Tabelle,
   Karten und strukturierte Daten lesen dieselbe Quelle.
3. Die Seite wird kürzer und scanbarer: ~2.300 Wörter Autorentext in fünf klar
   getrennten Zonen, keine Aussage doppelt. Der sichtbare Gesamttext ohne
   JavaScript sinkt um mindestens 35 % gegenüber der Baseline aus Paket 0 (§11).
4. Die Regeln dafür sind maschinenprüfbar (Test oder Gate), nicht vereinbart.
5. Der Ladestrom-Rechner wird ein offizieller Rechner mit eigener Route.

**Nicht-Ziel**

- Keine Sterne, Noten, Testberichte oder Affiliate-Links (§14).
- Keine neue Vergleichs-Route für Ladebooster (§3).
- Kein zweiter Vergleich (Wechselrichter, LiFePO4) in diesem Auftrag — das Template
  muss ihn nur ermöglichen.
- Kein Umbau des Artikel-Gerüsts `SeoPage` über den neuen Slot hinaus.
- Keine Änderung elektrischer Semantik (AGENTS.md §5).

## 3. Entscheidung: Vergleich im Content-Modell, nicht als eigene Route

Gewählt: **Der Vergleich wird Teil des Content-Modells.** `SeoPageContent` bekommt
ein optionales Feld `comparison`, `SeoPage` rendert die Vergleichszone **vor** den
Abschnitten. Eine eigene Route `/vergleich/ladebooster/` wird nicht gebaut.

Begründung aus dem Bestand, nicht aus Präferenz:

1. `lib/seo/opportunities.ts:417-435` bindet beide Vergleichs-Intents
   („trennrelais oder ladebooster", „ladebooster 30a oder 50a") an
   `/camper-elektrik/ladebooster/` mit `action: 'keine'`. Der
   Wechselrichter-Vergleich (`:451-460`) bekommt `action: 'beispiel-ergaenzen'`.
   **Kein** Vergleichs-Intent im Inventar hat `action: 'neue-seite'`.
2. `docs/seo/ANALYSE-UND-VISION.md:84` nennt als Risiko „Überproduktion: Neue Seiten
   entstehen nur für belegte oder klar benannte Intentionen."
3. Die Seite hat 2 eingehende interne Verweise (`docs/seo/AUDIT.md:25`). Eine zweite
   URL teilt diese Verlinkung, statt sie zu stärken.
4. Die Anforderung lautet „Vergleich oben, Blogtext darunter" — eine Seite.

Die Datenstruktur deckt den Fall einer eigenständigen Vergleichsseite trotzdem ab:
Eine `ComparisonSpec` kann mit wenigen oder keinen `sections` die Hauptlast einer
Seite tragen. Es wird dafür **keine** zweite Route, kein Flag und keine
Kompatibilitätsschicht gebaut — es ist eine Eigenschaft des Datenmodells.

Als Architektur-Entscheidung während der Umsetzung zu dokumentieren: **ADR 0039**
(nächste freie Nummer, vgl. AGENTS.md §12; ADR 0026 ist bewusst ungenutzt).

## 4. Datenmodell

Neu in `lib/seo/comparisons/types.ts` — ohne React und ohne `app/`-Importe
(Schichtenregel A, wie `lib/seo/types.ts:14-15`):

```ts
/** Ein Vergleichsmerkmal. Die Reihenfolge ist die Spalten- und Kartenreihenfolge. */
export type ComparisonAttribute = {
  id: string;
  label: string;
  unit?: string;
  /** Spalte in der Rangliste? Sonst nur in der Produktkarte. */
  inTable: boolean;
  /** Erklärung des Merkmals — genau hier, nicht je Produkt wiederholt. */
  legend?: RichText;
  /** Sortierrichtung, falls sortierbar. */
  better?: 'higher' | 'lower';
};

/** Wert eines Merkmals. `null` heißt „belegt unbekannt" und wird als Strich gerendert. */
export type AttributeValue = string | number | null;

export type ComparisonProduct = {
  id: string; // Ankerziel: `#p-<id>`
  brand: string;
  name: string;
  classId: string; // Zuordnung zu `ComparisonSpec.classes`
  /** Muss jeden in `attributes` deklarierten `id` tragen (Gate G2). */
  specs: Readonly<Record<string, AttributeValue>>;
  /** „Passt für" — ein Chip, kein Urteil mit Note. */
  fit: { label: string; tone: 'pick' | 'plain' };
  /** „Haken" — Warnungen, die es nur hier gibt. */
  caveats: readonly { text: RichText; tone: 'warn' | 'block' }[];
  /** Beobachteter Straßenpreis in Euro; `null` = kein Preis belegt. */
  priceEur: number | null;
  /** ISO-Datum der Preisprüfung (Gate G5). */
  priceChecked: string;
  /** Langtext, eingeklappt gerendert. */
  detail: readonly RichText[];
  links: readonly { href: string; label: string; kind: 'datasheet' | 'price' | 'manual' }[];
};

export type ComparisonUseCase = {
  id: string;
  situation: RichText; // eine Zeile
  pickId: string; // muss ein Produkt-`id` sein (Gate G2)
  why: RichText; // ein Satz
};

export type ComparisonSpec = {
  id: string;
  /** `h2` der Vergleichszone. */
  heading: string;
  tableCaption: RichText;
  /** Sichtbarer Hinweis, dass nicht mit Sternen bewertet wird. */
  noRatingNote: RichText;
  attributes: readonly ComparisonAttribute[];
  classes: readonly { id: string; label: string }[];
  products: readonly ComparisonProduct[];
  useCases: readonly ComparisonUseCase[];
  /** Stand der Preise als lesbare Zeile — genau einmal auf der Seite. */
  priceAsOf: string;
};
```

Erweiterung in `lib/seo/types.ts`:

```ts
export type SeoPageContent = {
  // … bestehende Felder unverändert …
  /** Produktvergleich, der VOR den Abschnitten gerendert wird. */
  comparison?: ComparisonSpec;
};
```

Die Daten des Ladeboosters ziehen nach `lib/seo/comparisons/ladebooster.ts` —
eine Datei, neun Produkte, ein deklarierter Merkmals-Satz (welche Merkmale Spalten
der Rangliste sind und welche nur in der Karte stehen, entscheidet `inTable`), vier
Einsatzfälle. Die heutigen Quellen (`LadeboosterVergleich.tsx:224-287` für Tabelle,
`315-556` für Detailkarten, `564-606` für Kompaktkarten, `97-194` für die Leiter)
werden zusammengeführt; jede Tatsache steht einmal.

## 5. Komponenten und Datei-Layout

Deutsch benannt, wie die bestehenden Domänen-Bausteine (`RechnerLeiste.tsx`,
`KabelquerschnittRechner.tsx`, `FaqAkkordeon`):

| Datei                                        | Aufgabe                                                                                 | Zielgröße    |
| -------------------------------------------- | --------------------------------------------------------------------------------------- | ------------ |
| `components/vergleich/Vergleichszone.tsx`    | komponiert Rangliste, Einsatzfälle, Karten aus einer `ComparisonSpec`; Server Component | ≤ 120 Zeilen |
| `components/vergleich/Rangliste.tsx`         | Tabelle mit Sortierung, Filter und Chips                                                | ≤ 180        |
| `components/vergleich/Produktkarte.tsx`      | eine Karte; Attribut-Reihenfolge aus `attributes`                                       | ≤ 90         |
| `components/vergleich/Einsatzfaelle.tsx`     | Use-Case-Zeilen: Situation → Gerät → Grund                                              | ≤ 60         |
| `components/vergleich/vergleichBehavior.tsx` | `'use client'`: Filter + Sortierung über DOM, `aria-pressed`                            | ≤ 140        |

`components/seo/LadeboosterVergleich.tsx` (1.391 Zeilen),
`components/seo/LadeboosterVergleichBehavior.tsx` (186 Zeilen) und
`app/ladebooster-vergleich.css` (1.036 Zeilen, 19.846 Byte) werden **entfernt**,
der Import in `app/layout.tsx:2` ebenfalls.

**Rendering ohne JavaScript.** Die Route wird von `tests/e2e/seo-nojs.spec.ts:69-76`
geprüft. Deshalb: Rangliste, Chips, Einsatzfälle, Karten und alle `<details>` sind
serverseitig vollständig. Filter und Sortierung sind progressive Verbesserung —
ohne JavaScript gilt die Rangreihenfolge der Datendatei, und der Filterbereich wird
nicht angeboten (statt ihn anzubieten und nichts zu tun).

**Filtermechanik.** Ein clientseitiger Baustein setzt die Tailwind-Klasse `hidden`
auf Zeilen **und** Karten, gesteuert über dasselbe `data-vergleich-klasse`-Attribut
(Gate G6). Kein eigener CSS-Schalter wie das heutige `.is-hidden`, kein React-State
und damit keine Hydration-Differenz.

**Gestaltung.** Ausschließlich Design-Tokens und Tailwind-Utilities
(`container-page`, `prose-measure`, `node-card`, `panel-title`, `caption-xs`).
Zahlen in Inter mit `tabular-nums`, nie in Mono (`docs/DESIGN-KONZEPT-2026-10.md:57-58`,
Wächter `lib/designTokens.test.ts:392-469`). Ein Akzent `--oxide` (#a34a24) nur für
`fit.tone === 'pick'`; `warn` und `block` nutzen `--warn` (#8a5a0a) und `--error`
(#b3261e), zusätzlich formcodiert (Chip-Text), nie farbe-only
(`docs/DESIGN-KONZEPT-2026-10.md:31`, „Auswahl ≠ Farbe"). Schriftuntergrenze 12 px,
Trefferflächen ≥ 44 × 44 px.

**Breite.** Die Rangliste läuft auf die vollen 64 rem des `container-page`, der
Ratgebertext bleibt in der 42-rem-Lesespalte (`docs/DESIGN-KONZEPT-2026-10.md:100`).
Der Breitenwechsel ist die visuelle Zäsur zwischen „Vergleich" und „Ratgeber".

**Responsiv.** ≥ 768 px: Rangliste als Tabelle. < 768 px: dieselbe Datendatei als
Kartenstapel mit vier Kennzahlen, Einsatzfall-Chip und `<details>` für den Rest —
nicht die heutige Quetsch-Tabelle mit `min-width: 46rem`
(`app/ladebooster-vergleich.css:910-914`). Beide Darstellungen sind im DOM; welche
sichtbar ist, entscheidet eine Media Query, nicht JavaScript.

## 6. Seitenstruktur: fünf Zonen

Neue Reihenfolge in `components/seo/SeoPage.tsx`:

```
Kopf (H1 + Lead)
  → comparison        (neu: Vergleichszone, aus page.comparison)
  → afterHeader       (bestehend: RechnerLeiste)
  → page.sections     (Ratgeber)
  → children          (bestehend, bleibt frei)
  → FAQ → TrustBlock → Weiter im Thema → Planer-CTA
```

| Zone                     | Inhalt                                                                                               | Autorentext           |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------- |
| Kopf                     | H1, Lead: was verglichen wurde, Preisstand, kein Sternesystem                                        | ~50                   |
| 1 · Rangliste            | 9 Geräte, sortierbar nach Ladestrom und Preis, Chips „Passt für" und „Haken", Legende                | ~330                  |
| 2 · Welcher passt zu mir | 4 Einsatzfälle statt 7 „Wege": Situation → Gerät → ein Grund                                         | ~120                  |
| 3 · Geräte im Detail     | 9 Karten mit den übrigen Merkmalen, Langtext und Datenblatt-Links in `<details>`, desktop zugeklappt | ~250 sichtbar         |
| 4 · Ratgeber             | 4 `h2` statt 7 gemischter Artikel-Abschnitte plus 8 Vergleichs-Sektionen, siehe unten                | ~1.250 (Gate ≤ 1.300) |
| 5 · FAQ + Quellen        | 7 Fragen à ≤ 40 Wörter, 34 Quellen in `<details>`, TrustBlock, interne Verweise                      | ~300                  |

Die Summe ist 2.300 Wörter Autorentext. Gate G3 prüft die Teilbudgets: Zonen 1-3
zusammen ≤ 700 (330 + 120 + 250), Ratgeber ≤ 1.300, FAQ-Antwort ≤ 40.

**Zwei Schichten, keine Wiederholung.** Zone 1 ist die Schicht zum Scannen: nur
Merkmale mit `inTable: true`, Werte ohne Prosa. Zone 3 ist die Schicht zur Tiefe:
die übrigen Merkmale, `detail`-Text und `links`. Derselbe Wert darf in beiden
stehen (er ist eine Zahl, kein Text), dieselbe Aussage nicht — Gate G1 zieht die
Grenze bei 60 Zeichen. Heute gibt es vier Darstellungen derselben Geräte
(Leiter `97-194`, Tabelle `224-287`, Detailkarten `315-556`, Kompaktkarten
`564-606`); danach gibt es zwei mit getrennten Aufgaben.

Unter 768 px entfällt die Tabelle, und Zone 3 trägt die vier Scan-Werte mit — mobil
bleibt damit **eine** Darstellung.

**Zone 4, die vier Abschnitte** (zusammengeführt aus den heutigen 7
Artikel-Abschnitten `lib/seo/content/ladebooster.ts:110-297` und den
Vergleichs-Sektionen `LadeboosterVergleich.tsx:628-1181`):

1. **Ladebooster oder Trennrelais** — die Entscheidung, inkl. der heute in
   „Sieben Wege" verstreuten Alternativen als Liste.
2. **Welche Stromklasse: 30, 60 oder 90 A** — inkl. des Ladestrom-Rechners
   (`section.calculator`, §7) und der C-Rate-Erklärung **vor** ihrer ersten
   Verwendung (heute: verwendet `48`, erklärt `945`).
3. **Kabel, Sicherung, D+** — Zusammenlegung der heutigen Sektionen
   Kabelquerschnitt, Absicherung, Bauformen; das Schaltplan-SVG (`811-934`) wandert
   hierher, die inline wiederholten `fontFamily`-Attribute (17×) entfallen.
4. **Messen nach dem Einbau und typische Fehler** — beide heutigen Sektionen
   zusammen.

Die sechs Foren-Insights (`625-750`) und „Meine Rechnung" (`752-1031`) werden zu
Callouts (`ContentCallout`) im jeweils passenden Abschnitt — sie sind Belege, keine
Kapitel. Ihre Kernaussagen stehen damit einmal statt dreimal (Gate G1).

Die Foto-Platzhalter (`1009-1024`) entfallen ersatzlos; echte Bilder nur, wenn sie
geliefert werden.

## 7. Ladestrom-Rechner als offizieller Rechner

Der heute handgeschriebene Rechner (`LadeboosterVergleich.tsx:1033-1125` mit
`LadeboosterVergleichBehavior.tsx:89-183`) wird ein Rechner wie die vier bestehenden.

| Schritt       | Datei                                                                                                                     | Hinweis                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Domänenlogik  | neu `lib/boosterSizing.ts` + `lib/boosterSizing.test.ts`                                                                  | Rule D: UI rechnet nicht (`docs/ai/ARCHITECTURE-RULES.md:53`). Die Formel wird **zeichengetreu** aus `LadeboosterVergleichBehavior.tsx:112-127` übernommen, nicht neu erfunden                               |
| Golden Values | `lib/boosterSizing.test.ts`                                                                                               | pinnt die sechs heute per e2e eingefrorenen Ausgaben: 330 Ah / 5 h / 180 A → `79 A · 0,24 C`, `90-A-Klasse`, `130 A · 72 %`; 100 Ah / 5 h / 180 A → `24 A · 0,24 C`, `30-A-Klasse`, `53 A · 30 %`            |
| Kennung       | `lib/seo/types.ts:110`                                                                                                    | `CalculatorId` += `'ladestrom'`                                                                                                                                                                              |
| Komponente    | neu `components/rechner/LadestromRechner.tsx`                                                                             | `'use client'`, `lazy`, eindeutige Input-IDs als Bundle-Marker, Eingaben 16 px, `min-h-11`, feste Ergebnishöhe gegen CLS — Muster aus `components/elektrik/KabelquerschnittRechner.tsx:74-96`                |
| Zuordnung     | `components/rechner/CalculatorRenderer.tsx:8-29`                                                                          | `Record<CalculatorId, …>` ist erschöpfend, der Typecheck erzwingt den Eintrag                                                                                                                                |
| Kategorie     | `components/seo/SeoPage.tsx:62-68`                                                                                        | `subCategory`-Mapping ergänzen, sonst fällt `ladestrom` auf „Leitungsbemessung"                                                                                                                              |
| Bundle-Gate   | `scripts/seo/checks.ts:248-253`                                                                                           | neuer Eintrag in `CALCULATOR_BUNDLE_MARKERS`; **muss** `lazy` geladen werden, sonst landet der Code im SEO-Basischunk und jede Inhaltsseite wird rot (`rechner-bundle`, `severity: 'fehler'`)                |
| Route         | neu `app/rechner/ladestrom/page.tsx` + `lib/seo/content/ladestrom.ts` + Registrierung in `lib/seo/content/index.ts:36-62` | Muster: `app/rechner/batteriekapazitaet/page.tsx:8-12`; `kind: 'rechner'`, `changeFrequency: 'monthly'`, `sitemapPriority: 0.9` wie Hub, Batteriekapazität und Solaranlage (`spannungsabfall-12v` trägt 0,8) |
| Einbettung    | `lib/seo/content/ladebooster.ts`                                                                                          | `calculator: 'ladestrom'` in Zone-4-Abschnitt 2 — derselbe Rechner, dieselbe Logik                                                                                                                           |
| Verlinkung    | `components/seo/RechnerLeiste.tsx:38-64`                                                                                  | sechster Eintrag; der Kommentar „Die fünf Rechner" wird mitgezogen                                                                                                                                           |
| Pflicht-Link  | `lib/seo/content/ladebooster.ts` `related`                                                                                | Gate `rechner-ohne-planner-link` (`scripts/seo/linkGraph.ts:386-396`): jede Seite mit `calculators` braucht einen kontextuellen Verweis auf `/elektrik-planung/`                                             |

Der `<noscript>`-Hinweis (`LadeboosterVergleich.tsx:1115-1120`) entfällt: Rechner
sind im Bestand client-only, der No-JS-Inhalt kommt aus dem Seitentext
(`tests/e2e/seo-nojs.spec.ts:69-76` verlangt dort Text, keinen Rechner).

## 8. SEO-Layer

**Strukturierte Daten.** `StructuredDataType` (`lib/seo/types.ts:42-50`) += `'ItemList' | 'Product'`.
`structuredDataOf()` (`lib/seo/inventory.ts:328-333`) leitet beide aus
`page.comparison` ab — das Inventar kann dadurch nicht von der Seite abweichen.
Neue Bausteine in `lib/seo/jsonLd.ts`: `itemListNode()` und `productNode()`.

Harte Grenzen, die das bestehende Gate setzt:

- Keine fremde Adresse im Schema — `json-ld-adresse` meldet `severity: 'fehler'`
  für jede URL mit anderem Ursprung (`scripts/seo/checks.ts:576-578`). Also **kein**
  `sameAs` auf Herstellerseiten, **kein** `Offer` mit Händler-URL.
- Jeder im Markup vorhandene Seitentyp muss im Inventar angekündigt sein und
  umgekehrt: genau 1 Knoten je Typ (`json-ld-inventar`, `checks.ts:594-601`).

Deshalb: `Product` mit `name`, `brand` (nur Name), `category` und
`additionalProperty` aus denselben Daten wie die Tabelle. **Kein** `Offer`,
**kein** `Review`, **keine** `aggregateRating`, **kein** Autor.

**Präambel korrigieren.** `lib/seo/jsonLd.ts:11-16` behauptet „keine Bewertungen,
keine Autoren, keine Preise — es gibt sie in Camp nicht". Preise gibt es seit
`908d344` sichtbar auf der Seite. Der Kommentar wird zu: Preise sind sichtbar,
stehen aber bewusst nicht im Schema, weil ein beobachteter Straßenpreis mit
Stand-Datum als maschinelle Zusage veraltet. Eine Doku-Aussage, die den eigenen
Zustand nicht beschreibt, ist eine falsche Zusage an den nächsten Beitragenden
(vgl. AGENTS.md §3.8).

**Zweite falsche Zusage.** Der Dateikopf von `lib/seo/content/ladebooster.ts:13-16`
verspricht „Kein Markenvergleich. Die Seite nennt Bauformen, Ströme und
Anschlussbedingungen". Seit `908d344` nennt die Seite neun Marken mit Preisen. Der
Kommentar wird in Paket 3 an den tatsächlichen Zustand angepasst: Der Rechenteil
nennt keine Produkte, der Vergleichsteil schon — und beide Teile sind getrennt.

**Metadaten.** Titel und Beschreibung werden auf den Vergleichs-Intent geschärft,
innerhalb der Gates 15-65 bzw. 50-160 Zeichen (`scripts/seo/checks.ts:26-31`);
Eindeutigkeit gegen alle anderen Seiten prüft `lib/seo/inventory.test.ts`.

**Anker.** Jedes Produkt bekommt `#p-<id>` und `scroll-mt-20`; die Rangliste
verlinkt auf die Karten. Deeplink-fähig für Antwortsysteme.

**Interne Verlinkung.** Die Vergleichszone hat heute **null** interne Verweise
(61 externe). Neu: kontextuelle Verweise auf Kabelquerschnitt-Rechner,
`/camper-elektrik/lifepo4/`, `/camper-elektrik/sicherungen/`,
`/camper-elektrik/laden/`. Zusätzlich wird die Eingangsverlinkung der Seite
geprüft (Befund 13: nur 2 eingehende Verweise) — Kandidaten sind
`app/camper-elektrik/page.tsx`, `lib/seo/content/laden.ts`, `batterie.ts`,
`lifepo4.ts` über deren `related`.

**Sitemap.** Die neue Rechner-Route kommt automatisch über `SITEMAP_ROUTES`
(`lib/seo/inventory.ts:389-397`) in `app/sitemap.ts`; `app/sitemap.test.ts` prüft,
dass jede indexierbare Seite genau einmal und ohne `noindex` vorkommt.

## 9. Gates — erfüllbar heißt messbar

| #   | Regel                                                                                                                                     | Prüfung                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| G1  | Kein Text ≥ 60 Zeichen steht zweimal auf der Seite                                                                                        | Unit-Test über `ComparisonSpec` + `SeoPageContent.sections`                                      |
| G2  | Jedes Produkt trägt jeden deklarierten Merkmals-`id`; jede `pickId` und `fit`-Zuordnung zeigt auf ein existentes Produkt; `id`s eindeutig | Unit-Test                                                                                        |
| G3  | Autorentext: Vergleichszone ≤ 700, Ratgeber ≤ 1.300, FAQ-Antwort ≤ 40 Wörter                                                              | Unit-Test; Gegenstück zur Mindestschwelle `THIN_WORDS = 300` (`scripts/seo/measureExport.ts:30`) |
| G4  | Die Rangliste steht im DOM **vor** dem ersten Ratgeber-`h2`                                                                               | Render-Test gegen `SeoPage`                                                                      |
| G5  | `priceChecked` älter als 180 Tage → Fehler, kein Hinweis                                                                                  | Unit-Test                                                                                        |
| G6  | Ein Filter wirkt auf Rangliste **und** Produktkarten                                                                                      | Unit-Test gegen `vergleichBehavior`                                                              |
| G7  | Keine `lb-*`-Klasse, kein `app/ladebooster-vergleich.css`, kein CSS-Import in `app/layout.tsx` außer `globals.css` und Schriften          | Test + `npm run audit:dead-code`                                                                 |
| G8  | Kein `--font-mono`/`IBM Plex Mono` in `components/vergleich/**`; Zahlen mit `tabular-nums`                                                | Test, erweitert `lib/designTokens.test.ts:392-469`                                               |
| G9  | Anzahl `ListItem` == Anzahl Produkte; kein fremder Ursprung im Schema                                                                     | `npm run seo:audit` (bestehende Regeln `json-ld-inventar`, `json-ld-adresse`)                    |
| G10 | 375 / 768 / 1440 px: mobil Kartenstapel, desktop Tabelle, beides ohne horizontales Scrollen                                               | Playwright, erweitert `tests/e2e/responsive.spec.ts`                                             |
| G11 | Rechner `ladestrom` ist `lazy` und nur auf Seiten mit deklarierter Kennung im Bündel                                                      | bestehendes `checkCalculatorBundles`                                                             |
| G12 | Die sechs Golden Values des Rechners bleiben zeichenidentisch                                                                             | `lib/boosterSizing.test.ts`                                                                      |

Pflicht vor jedem Commit: `npm run check` (AGENTS.md §7). Vor dem Merge:
`npm run e2e` und `npm run seo:audit`.

## 10. Umgang mit bestehenden Tests

Bestehende Erwartungen werden **migriert, nicht gelöscht** — AGENTS.md §5 verbietet,
fehlgeschlagene Tests zu entfernen oder zu `skip`en, um CI grün zu bekommen.

| Test                                               | Erwartung heute                                                                  | Umgang                                                                                                                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/seo/LadeboosterVergleich.test.tsx`     | H2-Text, Tabellen-Name `/Geräteüberblick/`, Karten-Headings, Filter `.is-hidden` | zieht in neue Tests unter `components/vergleich/`; `.is-hidden` wird durch die Tailwind-Klasse `hidden` ersetzt (G6), die Änderung wird im PR begründet            |
| `tests/e2e/ladebooster-vergleich.spec.ts`          | Filter `60–70 A` mit `aria-pressed`, Rechnerwerte                                | bleibt als e2e; Rechner-Teil prüft dieselben sechs Werte nach dem Umzug (G12)                                                                                      |
| `tests/e2e/seo-nojs.spec.ts:69-76`                 | `Die Kurzentscheidung`, `Geräteüberblick` ohne JS                                | „Geräteüberblick" bleibt als zugänglicher Name der Tabelle. „Die Kurzentscheidung" wird zu „Welcher passt zu mir" — Erwartung wird mit dieser Begründung angepasst |
| `app/sitemap.test.ts`, `lib/seo/inventory.test.ts` | eindeutige Pfade, Titel, Beschreibungen; bekannte Themen                         | neue Rechner-Seite muss Titel/Beschreibung eindeutig und `topicId` existent halten                                                                                 |

Kein Pixel-Baseline-Blocker: `/camper-elektrik/ladebooster/` ist nicht in
`tests/e2e/visual.spec.ts:48-54` enthalten.

## 11. Arbeitspakete

Ein Commit pro Aufgabe (AGENTS.md §8). Pakete 1-4 sind der Kern, 5 ist die
Abnahme. Umgesetzt wird in der Reihenfolge **0, 1, 2, 4, 3, 5**: Paket 4 ist
nicht unabhängig kürzbar, sondern Voraussetzung für Paket 3 — dieses löscht die
Datei, in der der heutige Rechner steht (§12).

0. **Baseline messen.** Erledigt am 2026-10-26 auf `e1b02a3`: `npm run build`
   (40 Seiten geprüft, Export grün) und `npx tsx scripts/seo/measureExport.ts`.
   Gemessen für `/camper-elektrik/ladebooster/`: **5.828 Wörter** ohne JavaScript,
   `H1/H2` **1/12**, `ein/aus` **3/16**, Tiefe 2, **602 KB** JS. Zum Vergleich:
   die anderen Cluster liegen bei 944-1.445 Wörtern — die Seite ist das Vier- bis
   Sechsfache ihrer Geschwister. Die im Repo liegende `docs/seo/AUDIT.md` trägt den
   Stand vom 2026-10-15 (2.371 Wörter, 1/11) und beschreibt die Seite **vor** dem
   Vergleichsblock; sie darf nicht als Baseline verwendet werden.
   `npx tsx scripts/seo/report.ts` schreibt drei Dokumente samt PDF neu
   (`AUDIT`, `ANALYSE-UND-VISION`, `CAMP-SEO-GROWTH-REPORT`, `report.ts:569-574`)
   und gehört deshalb in einen eigenen Commit in Paket 5.
1. **Datenmodell + Gates.** `lib/seo/comparisons/types.ts`, `ladebooster.ts`,
   `comparisonGates.test.ts` (G1, G2, G3, G5). Kein UI. `npm run check` grün.
2. **Komponenten + Slot.** `components/vergleich/**`, `comparison?: ComparisonSpec`
   in `lib/seo/types.ts`, Slot-Reihenfolge in `SeoPage.tsx`, G4-Test, G6-Test.
3. **Migration Ladebooster.** Ratgeber auf vier Abschnitte verdichtet,
   Wiederholungen entfernt, alte Komponente und `app/ladebooster-vergleich.css`
   gelöscht, `layout.tsx`-Import entfernt, Tests migriert (§10), interne Verweise
   ergänzt, G7/G8/G10.
4. **Ladestrom-Rechner.** §7 vollständig: `lib/boosterSizing.ts` + Golden Test,
   `CalculatorId`, Komponente, Route, `RechnerLeiste`, Bundle-Marker, Planner-Link.
5. **Abnahme.** `npm run check` + `npm run e2e` + `npm run seo:audit`;
   `npm run build` und `npx tsx scripts/seo/report.ts` in einem **eigenen** Commit
   (schreibt `docs/seo/AUDIT.md`, `ANALYSE-UND-VISION.md` und
   `CAMP-SEO-GROWTH-REPORT.md` samt PDFs neu); Vorher/Nachher-Screenshots in
   375/768/1440 px, hell und dunkel (AGENTS.md M11-1 verlangt optische Freigabe);
   ADR 0039.

**Messbare Abnahmekriterien** — Bezug ist die am 2026-10-26 gemessene Baseline (Paket 0).

| Kennzahl                                          | Baseline, gemessen 2026-10-26 auf `e1b02a3`         | Ziel                                                                                                                                                                                                            |
| ------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autorentext der Seite                             | —                                                   | ≤ 2.300, geprüft durch G3 auf Datenebene                                                                                                                                                                        |
| Sichtbarer Text ohne JavaScript (`measureExport`) | **5.828** Wörter                                    | ≤ 3.500 Wörter, das sind −40 %                                                                                                                                                                                  |
| `H1/H2`                                           | **1/12**                                            | 1/11 (3 Vergleichs-`h2` + 4 Ratgeber-`h2` + 4 Gerüst-`h2`). Die `h2`-Anzahl ist **kein** Ziel an sich — Ziele sind Wortzahl, Reihenfolge und doppelte Aussagen; sie steht hier nur, weil das Audit sie ausweist |
| `ein/aus` interne Verweise                        | **3/16**                                            | eingehend ≥ 5                                                                                                                                                                                                   |
| `JS (KB)`                                         | **602**                                             | ≤ 602 — der Ladestrom-Rechner darf nur `lazy` dazukommen (G11)                                                                                                                                                  |
| Seiten-CSS                                        | `app/ladebooster-vergleich.css`, 19.846 Byte global | Datei existiert nicht; `app/layout.tsx` importiert nur `globals.css` und Schriften                                                                                                                              |
| Darstellungen desselben Geräts                    | 4                                                   | 2 mit getrennten Aufgaben (Scan / Tiefe), mobil 1                                                                                                                                                               |
| Gates                                             | `npm run check`, `npm run e2e`, `npm run seo:audit` | alle drei Exit-Code 0                                                                                                                                                                                           |
| Optische Abnahme                                  | —                                                   | Screenshots 375/768/1440 hell+dunkel im PR, Freigabe durch den Betreiber                                                                                                                                        |

**Gemessen nach Paket 3** — `npm run build` (inkl. `auditExport`), danach
`npx tsx scripts/seo/measureExport.ts`; Wortbudgets über
`lib/seo/comparisons/gates.test.ts`.

| Kennzahl                             | Ziel                  | Gemessen                                                          |
| ------------------------------------ | --------------------- | ----------------------------------------------------------------- |
| Autorentext (Zone + Ratgeber + FAQ)  | ≤ 2.300               | **1.995** (695 + 1.053 + 247, Antworten gezählt wie G3)           |
| Sichtbarer No-JS-Text                | ≤ 3.500               | **3.236** Wörter, −44,5 %                                         |
| `H1/H2`                              | 1/11                  | **1/11**                                                          |
| `h3/h4`                              | —                     | **15/0** (vorher 13/27 — die 27 `h4` der alten Karten sind weg)   |
| `ein/aus` interne Verweise           | eingehend ≥ 5         | **6/16** (neu: `/rechner/ladestrom/`, `lifepo4`, `batterie`)      |
| `JS (KB)`                            | ≤ 602                 | **601**                                                           |
| Seiten-CSS                           | Datei existiert nicht | gelöscht; G7 prüft Stylesheets, Layout-Importe und `lb-*`-Klassen |
| Darstellungen je Gerät               | 2, mobil 1            | **2 / 1**, geprüft bei 375/768/1440 und Pixel 5 (G10)             |
| `npm run check`                      | Exit 0                | **0** — 295 Dateien, 3.863 Tests                                  |
| `npm run seo:audit` (läuft im Build) | Exit 0                | **0** — 41 Seiten, „Export-Prüfung grün"                          |
| e2e Vergleich + No-JS + axe          | Exit 0                | **0** — 72 Tests, vier Breiten, hell und dunkel                   |
| Optische Abnahme                     | Freigabe Betreiber    | **offen** — Screenshots folgen in Paket 5                         |

Die visuellen Pixel-Gates (`visual.spec.ts`, `visual-de-pixel.spec.ts`) sind im
Repo mit `-linux.png` eingefroren und auf einem Windows-Rechner nicht auswertbar:
Playwright findet die `-win32`-Variante nicht, schreibt sie beim ersten Lauf
selbst und besteht danach gegen seine eigene Datei. Ein Lauf hat hier 88 solche
PNGs erzeugt; sie wurden gelöscht und nicht committet. Die optische Abnahme läuft
deshalb über Screenshots und den Betreiber, nicht über diese Baselines.

## 12. Abweichungen und Ergänzungen während der Umsetzung

Der Entwurf oben ist die Absicht; hier steht, was beim Bauen anders wurde und
warum. Eine Spec, die den gebauten Zustand nicht beschreibt, ist dieselbe Klasse
falscher Zusage wie der Kommentar in `jsonLd.ts`.

| Punkt                                  | Entwurf                                           | Umgesetzt                                                                                                               | Grund                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sticky Kopfzeile der Rangliste         | vorgesehen                                        | weggelassen                                                                                                             | Der Seitenkopf ist bereits `sticky top-0` (Designkonzept §4). Eine zweite klebende Ebene bräuchte dessen exakte Höhe als Versatz — eine Kopplung, die bei jeder Kopfänderung bricht. Bei neun Zeilen und einem Zeilenkopf (`th scope="row"`) je Gerät bringt sie nichts                                                   |
| Sortierbarkeit                         | `ComparisonAttribute.better: 'higher' \| 'lower'` | `sortierbar?: 'strom' \| 'preis'`                                                                                       | Der Anzeigewert ist Text („45 / 55 / 63 / 70 A") und damit nicht sortierbar. `better` beschrieb eine Richtung ohne Zahl; `sortierbar` verweist auf `stromA` bzw. `priceEur`                                                                                                                                               |
| Nennstrom als Zahl                     | nicht vorgesehen                                  | `ComparisonProduct.stromA: number \| null`                                                                              | Sortierschlüssel und Wert für `additionalProperty` im Schema. `null` sortiert ans Ende — das Importgerät mit „110–120 A (angeblich)" steht damit hinter den Geräten, deren Strom im Handbuch steht                                                                                                                        |
| Rangreihenfolge                        | Reihenfolge der Datendatei                        | `lib/seo/comparisons/rangfolge.ts`, aufsteigender Nennstrom, dann Preis, Gleichstand über die Kennung                   | Eine abgeleitete Ordnung kann nicht von der Sortierung im Browser abweichen; der dritte Schlüssel hält sie deterministisch (AGENTS.md §3.6)                                                                                                                                                                               |
| Quellenverzeichnis                     | Zone 5                                            | `<details>` am Ende von Zone 3                                                                                          | Die Belege gehören zum Vergleich, nicht zum Ratgeber. Eingeklappt, damit sie die Scan-Schicht nicht verlängern                                                                                                                                                                                                            |
| G1-Maß                                 | „kein Text ≥ 60 Zeichen doppelt"                  | identische Aussage **oder** gemeinsame Wortfolge ab 6 Wörtern                                                           | An den drei Wiederholungen des Bestands gemessen: Wortmengen-Ähnlichkeit (Jaccard) lag bei 0,43 und über 5er-Folgen bei 0,04 — beide unter jeder sinnvollen Schwelle. Die gemeinsame Wortfolge meldet alle drei; `gates.test.ts` prüft sie als Fixture                                                                    |
| Steuerknöpfe ohne JavaScript           | „Filterbereich wird nicht angeboten"              | serverseitig mit `hidden` ausgeliefert, Skript blendet ein                                                              | Dasselbe Verhalten, aber ohne zweiten Renderpfad: `renderToString` liefert die Knöpfe mit `hidden`, ein Unit-Test prüft das                                                                                                                                                                                               |
| Reihenfolge der Pakete                 | 3 (Migration) vor 4 (Rechner)                     | 4 vor 3                                                                                                                 | Paket 3 löscht `LadeboosterVergleich.tsx` und damit den Rechner. Ohne seinen Nachfolger wäre ein Commit ohne Rechner ausgeliefert und die eingefrorene e2e rot                                                                                                                                                            |
| Zahlen im Ladestrom-Rechner            | Muster `KabelquerschnittRechner.tsx`              | Inter mit `tabular-nums`, kein Mono                                                                                     | DESIGN-KONZEPT §2 reserviert Mono für Tastenkürzel und die CSV-Vorschau. Die vier älteren Rechner weichen davon ab; der neue sitzt auf derselben Seite neben der Vergleichszone, für die Gate G8 dasselbe verlangt                                                                                                        |
| `subCategory` der Anwendung            | Mapping ergänzen                                  | erschöpfendes `Record<CalculatorId, string>` in `components/seo/SeoPage.tsx`                                            | Die Verzweigung endete in einem `else`, das jedem neuen Rechner stillschweigend „Leitungsbemessung" vererbt. Das Record macht einen fehlenden Eintrag zum Typecheck-Fehler                                                                                                                                                |
| Berechnen-Knopf                        | Formular mit Submit (Bestand)                     | rechnet bei der Eingabe, kein Knopf                                                                                     | Die vier bestehenden Rechner tun dasselbe; ein Knopf wäre ein zweiter Weg zur selben Zahl. Die e2e streicht den Klick beim Umzug (Paket 3)                                                                                                                                                                                |
| Rechner-Übersicht `/rechner/`          | nicht vorgesehen                                  | siebtes Werkzeug: Abschnittstext, Definition und Verweis ergänzt                                                        | Die Seite erklärt abschließend, welche Rechner es gibt. Ein siebter ohne Eintrag wäre dieselbe Klasse falscher Zusage wie der Kommentar in `jsonLd.ts`                                                                                                                                                                    |
| Ergebnis im Roh-HTML                   | nicht vorgesehen                                  | `renderToString`-Test in `LadestromRechner.test.tsx`                                                                    | Der Rechner ist mit 330 Ah / 5 h / 180 A vorbelegt. Ohne Server-Rendering stünde im ersten Paint der Hinweistext und die Zahl käme erst nach der Hydration — die feste Mindesthöhe verhindert zwar Versatz, nicht aber den Inhaltswechsel                                                                                 |
| `Product` im Schema                    | `StructuredDataType` += `ItemList` \| `Product`   | nur `ItemList`; die neun `Product` stehen inline in den `ListItem`                                                      | `checkStructuredData` verlangt je angekündigtem Typ genau EINEN Knoten auf oberster Ebene (`json-ld-inventar`). Neun `Product`-Knoten wären neun; die Regel für `Product` zu lockern, würde sie auch für `WebPage`, `FAQPage` und `BreadcrumbList` schwächen. Inline ist schema.org-konform und hält das Gate unverändert |
| Schaltplan-SVG                         | „wandert in Zone-4-Abschnitt 3"                   | entfällt; seine drei Aussagen stehen als Text und Definition dort                                                       | `ContentSection` hat keinen Bild-Slot, das SVG hing an `lb-*`-CSS und 17 inline `fontFamily`-Attributen — beides verbietet G7. Ein neuer Bild-Slot wäre Architektur, die die Spec nicht verlangt. Die Kabeltabelle deckt dafür jetzt 30, 50 und 90 A ab                                                                   |
| Zwei Tabellen des Ratgebers            | Sicherungstabelle + „30/60/90 A"                  | beide entfallen                                                                                                         | Die Sicherungsspalte der Kabeltabelle und `/camper-elektrik/sicherungen/` tragen die Grenzströme je Querschnitt; Fahrzeit und Klasse beantwortet der Rechner für die eigene Batterie. Beide Tabellen erzählten, was schon dasteht — genau die Wiederholung, die G1 meldet                                                 |
| „Sieben Wege" und sechs Foren-Insights | als Liste bzw. als Callouts                       | verteilt: Relais → Abschnitt 1, Parallelbetrieb → FAQ, Geräte → Vergleich; Insights 04–06 stehen als `caveats` am Gerät | `ContentSection` erlaubt EIN Callout je Abschnitt. Die drei Geräte-Insights (Renogy geteilt, Votronic dünne Datenlage, Sterling widersprüchlich) stehen bereits in den Produktdaten — sie zu wiederholen wäre ein G1-Fund                                                                                                 |
| Typische Fehler                        | Teil von Abschnitt 4                              | die sechs Fehler stehen in den Abschnitten 1–3, Abschnitt 4 ist nur „Messen nach dem Einbau"                            | Ein Fehler ist neben der Regel nützlich, die er verletzt, nicht in einer Liste am Seitenende. Außerdem erlaubt `ContentSection` nur eine `list` — Messungen und Fehler zusammen wären ein Gemisch                                                                                                                         |
| `tableCaption` der Daten               | „Neun Ladebooster von 30 bis 120 A"               | „… von 30 bis 110 A"                                                                                                    | Beim Schreiben des Ratgebers aufgefallen: Die Bildunterschrift wiederholte die Herstellerseiten-Angabe, die die Daten bewusst NICHT verwenden (Handbuch Sterling: 110 A, `stromA: 110`). Eine Zahl, die der Vergleich selbst ablehnt, darf nicht in seiner Zusammenfassung stehen                                         |
| Ort von G10                            | `tests/e2e/responsive.spec.ts` erweitern          | eigener Test in `tests/e2e/ladebooster-vergleich.spec.ts`                                                               | Die Regel gilt für diese Seite, nicht für das Layout allgemein. Im Vergleichs-Spec steht sie neben G6 und G12 und läuft mit ihnen                                                                                                                                                                                         |
| G1-Reichweite                          | Vergleich + Quellen                               | Vergleich + Quellen + **Ratgeber**                                                                                      | Erst mit dem geschriebenen Ratgeber ist die Regel vollständig: Wiederholt wird zwischen den Schichten, nicht innerhalb einer. Gemessen: null Funde bei 695 + 1.053 Wörtern                                                                                                                                                |

## 13. Risiken

| Risiko                                                                 | Behandlung                                                                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Rechner-Code landet im SEO-Basischunk und färbt alle Inhaltsseiten rot | `lazy` + `CALCULATOR_BUNDLE_MARKERS` + Gate `checkCalculatorBundles` (G11); Budget `initial-js-budget` 700 KiB im Blick             |
| Preise veralten unsichtbar                                             | G5 macht `priceChecked` > 180 Tage zum Fehler                                                                                       |
| Wortbudget wird beim Schreiben verfehlt                                | G3 prüft die Datendatei, nicht die Absicht; Kürzen ist Teil von Paket 3                                                             |
| Die verdichteten Ratgebertexte verlieren Fachgenauigkeit               | Keine Norm- oder Grenzwert-Aussage wird umformuliert; Quellen bleiben verlinkt; `TrustBlock` (Annahmen, Grenzen) bleibt vollständig |
| Zweite Darstellung (Tabelle/Karten) driftet auseinander                | beide lesen dieselbe `ComparisonSpec`; G1 verbietet doppelte Texte                                                                  |

## 14. Bewusst nicht ändern

- Keine Sterne, keine Noten, kein „Testsieger". Der Satz „Die Tabelle bewertet keine
  Geräte mit Sternen" (`LadeboosterVergleich.tsx:290-294`) bleibt und wird
  sichtbarer platziert — er ist ein Vertrauensargument.
- Keine Affiliate-Links; es bleibt bei Hersteller-Datenblättern und neutralen
  Preisportalen (`LadeboosterVergleich.tsx:1188-1190`).
- Kein `Review`-, `Offer`- oder `aggregateRating`-Schema: nichts davon ist auf der
  Seite belegt, und `lib/seo/jsonLd.ts:11-16` verbietet Schema ohne sichtbaren Beleg.
- Die Rechenformel des Ladestrom-Rechners bleibt inhaltlich unverändert (G12).
- Das Schaltplan-SVG bleibt, nur ohne inline wiederholte `fontFamily`-Attribute.
- `SeoPage` behält seine bestehenden Slots `afterHeader` und `children`.
