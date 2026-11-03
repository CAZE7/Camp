# Eingearbeitete Anhänge — Stand 2026-11-03

Zwei am 2026-11-03 hochgeladene Anhänge sind in dieses Konzept eingearbeitet.
Es sind **exportierte Agenten-Sitzungen (Qoder)**, keine fertigen Reports: Sie
enthalten Denkprotokolle, Werkzeugaufrufe und Zwischenstände. Dieses Dokument
ist die verdichtete, auf unseren Checkout abgeglichene Fassung. Die Rohdateien
(3,9 MB + 3,6 MB, je ~59.000 Zeilen) liegen außerhalb des Repos und wurden
**nicht** eingecheckt — Begründung siehe §6.

## 1. Herkunft

|                    | Anhang A                                                         | Anhang B                                                                   |
| ------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Datei              | `Nischenforschung_und_Content-Ausbau_2026-11-03_12-15.md`        | `Ladebooster_Vergleichsplan_erstellen_2026-11-03_12-16.md`                 |
| Exportiert         | 2026-11-03T11:15:25Z                                             | 2026-11-03T11:16:43Z                                                       |
| Umfang             | 59.108 Zeilen / 3.910.650 Byte                                   | 58.595 Zeilen / 3.573.552 Byte                                             |
| Arbeitsverzeichnis | `C:\Users\MIA\Documents\Qoder\2026-10-26\b4e1686a`               | `C:\Users\MIA\Documents\Qoder\2026-10-26\544346d7`                         |
| Skills             | `deep-research`, `content-research-writer`                       | `frontend-design`, `humanizer`, `content-research-writer`, `brainstorming` |
| Repo-Stand dort    | Merge `353efd5`                                                  | eigener Klon von `CAZE7/Camp`, später gegen `main` verglichen              |
| Ende der Sitzung   | Kompaktierung / `> Failure: The request could not be completed.` | `> Failure: The request could not be completed.`                           |

**Auftrag A** (Originalton): den Content „nochmal massiv" erweitern, Bestehendes
„umfassend" prüfen, **pro Beitrag Bilder** und am Ende eine Liste der nötigen
Bilder, Nischen mit wenig Konkurrenz aber vielen Forenbeiträgen (auch englische
Foren), Ziel „so viel Traffic wie möglich", den neuesten Merge beachten.

**Auftrag B** (Originalton): der neue Ladebooster-Vergleich müsse „präsenter und
übersichtlicher" werden und zu einer „anständige[n] Übersicht" für **solche
Artikel** ausgebaut werden; Plan für SEO-optimierte Übersichtlichkeit, „nicht mit
so krank viel Text". Problem: „der vergleich ist unverständlich, deswegen kommen
die leute nicht wegen dem text drumherum". Später präzisiert: Vergleichsseiten
sollen **hauptsächlich Vergleich** sein, der SEO-Text darunter; „Vergleich und
die ersten 400 Wörter können gerne oben bleiben, der Rest darunter";
Ladestrom-Rechner dazu; „12v-planer.de ist meine neu url".

## 2. Was in Anhang A tatsächlich erarbeitet wurde

- **Deep Research** mit 40 Quellen. Vier Nischen mit schwacher Konkurrenz und
  Forennachfrage: **Wasser, Gas, Dach/Dämmung, Zulassung/Gewicht**; ein
  englisches Signal (GOV.UK conversion guidance) als Beleg für Forennachfrage.
  Rechtliche Schwerpunkte: G 607 / Gasprüfung, § 19 / § 21 / § 35a StVZO,
  TrinkwV, DIN 4108-3.
- **24 neue Beiträge**, drei neue Cluster-Hubs (`/camper-wasser/`,
  `/camper-gas/`, `/camper-dach/`) und ein ausgebauter Zulassungs-Hub mit sechs
  Spokes; sieben bislang ungenutzte SVG-Diagramme eingebunden; Bild- und
  CTA-Unterstützung im Content-Modell; SEO-Verdrahtung.
- Gemeldete Vorher-/Nachher-Werte **dieser fremden Sitzung**: 40 → 67 Seiten,
  35 → 62 indexierbare Seiten, 25 → 52 Inhaltsseiten, 21.578 → 61.114 Wörter im
  Content-Modell, 0 → 7 gerenderte Inhaltsbilder, 0 Waisen, 0 dünne Seiten,
  eingehende Verlinkung Ø 18,3. Gemeldete Gates: `npm run build` Exit 0 (67
  Seiten), `npm test` 289 Dateien / 3.775 Tests, Lint/Prettier Exit 0.
- **Bildliste:** 28 Seiten × (ein Hero + ein technisches Diagramm) =
  **56 neue Assets**, dazu **28 OG-Ableitungen**. Sieben bestehende SVGs sind
  bereits eingebunden. Die 28 Hero-/Diagramm-Briefings sind in
  [`FOTOMOTIV-ERGAENZUNG-2026-11-03.md`](FOTOMOTIV-ERGAENZUNG-2026-11-03.md)
  übernommen.
- **Rechtsaudit:** 5 von 5 Impressums-Pflichtangaben fehlen;
  `LEGAL_NOTICE_GATE=block` → Exit 1; Datenschutz nur Kurzfassung
  (Chat-Endpunkt mit OpenAI/Postgres, Hosting-Logs, Speicherdauer,
  Auftragsverarbeitung, Drittlandtransfer nicht beschrieben); keine
  anwaltliche Endfreigabe; visuelle Baselines veraltet. Korrigiert wurden u. a.
  falsche Aussagen zu § 19 Abs. 3 StVZO, § 35a / Sitzzahl, Achslast,
  Unterversicherung, Prüfstelle vs. Behörde, 230-V-„einfach"-Aussagen.
- **Vom Betreiber dort gelieferte Angaben** (Turn 14, Originalton):
  „impressum: jonas rieckhoff franzosenkoppel 46 22547 hamburg 2. weiß ich
  nicht was ich machen soll. erledige alles dann merge!" — Punkt 2
  (Datenschutz) blieb offen, eine E-Mail wurde dort **nicht** genannt.
- Ausdrücklich festgehalten: **„Ich habe nicht committet und nicht gepusht."**

## 3. Was in Anhang B tatsächlich erarbeitet wurde

**Bestandsaufnahme `/camper-elektrik/ladebooster/`** (gemessen, nicht geschätzt):
6.152 Wörter gesamt (Vergleichsblock 3.038 + Artikel 3.114). Neun Befunde:

1. Der Vergleich steht **unter** dem kompletten Artikeltext, nicht darüber.
2. Nur 1 von 8 H3-Sektionen im „Vergleich" ist ein Gerätevergleich.
3. 9 Geräte × 3 Darstellungen, alle hartcodiert im JSX, keine Datendatei.
4. Dieselbe Tatsache 3× fast wortgleich (Parallelbetrieb, Sterling, Renogy).
5. Die Entscheidungshilfe steht fast am Seitenende.
6. C-Rate wird benutzt (Zeile 48), bevor sie erklärt wird (Zeile 945).
7. Kein `Product`/`ItemList`-JSON-LD trotz 9 Produkten mit Preisen.
8. 1.036 Zeilen eigenes CSS global in `app/layout.tsx` — auf **jeder** Route.
9. Der Filter wirkt nur auf Karten, nicht auf die Tabelle; die Komponente
   entschuldigt sich dafür im Text.

Weiter: 61 externe, **0 interne** Links in der Vergleichszone; sichtbare
Platzhalter „Eigenes Foto folgt"; keine Sieger-Kennzeichnung; keine gemeinsame
Attribut-Matrix.

**Entscheidungen des Betreibers dort:** Template + Ladebooster (nicht nur
Einzelseite), Text „Kurz", Produktdaten „Daten + Gates", Vergleich plus die
ersten ~400 Wörter nach oben, Rest darunter.

**Empfohlener Ansatz A** (B = eigene Vergleichs-Route wurde wegen
Kannibalisierung verworfen, C = generische Komponente pro Route wegen
Route-Fragilität): `comparison?: ComparisonSpec` im Content-Modell, `SeoPage`
rendert die Vergleichszone über den vorhandenen `afterHeader`-Slot **vor**
`page.sections`. `lib/seo/comparisons/types.ts` + `ladebooster.ts` als eine
Wahrheit; vier kleine Komponenten statt einer 1.391-Zeilen-Datei; globales CSS
wird gelöscht.

**Zonen:** Rangliste → „Welcher passt zu mir" (4 Einsatzfälle) → Produktkarten
mit `<details>` → Ratgeber mit 4 H2 → FAQ + eingeklappte Quellen. Foren-Insights
und „Meine Rechnung" werden Callouts, keine eigenen Kapitel.

**SEO-Layer:** `StructuredDataType` um `ItemList` und `Product` erweitern, aber
**kein** `Offer`, `Review`, `aggregateRating`, kein `sameAs` auf Herstellerseiten
(das bestehende Gate `json-ld-adresse` verbietet fremde Ursprünge). Zwei falsche
Dateikopf-Zusagen korrigieren (`jsonLd.ts`: „keine Preise"; `ladebooster.ts`:
„Kein Markenvergleich"). Anker `#p-<id>`, interne Links, Sitemap über
`SITEMAP_ROUTES`.

**Gates G1–G10** (Auszug): kein Text ≥ 60 Zeichen doppelt; jedes Produkt trägt
jeden deklarierten Attributwert (`null` statt Lücke); Wortbudget Vergleichszone
≤ 700 / Ratgeber ≤ 1.600; Rangliste im DOM vor dem ersten Ratgeber-H2;
`priceChecked` älter 180 Tage → rot; Filter wirkt auf Tabelle **und** Karten;
keine `lb-*`-Klassen, kein Seiten-CSS-Import; `tabular-nums` statt Mono für
Zahlen; `ItemList`-Positionen == Produktanzahl; Playwright 375/768/1440.

**Bewusst nicht ändern:** keine Sterne/Noten, keine Affiliate-Links, kein
Review-Schema, Rechner-Formel bleibt, Schaltplan-SVG bleibt — und die
Foto-Platzhalter „Eigenes Foto folgt" fliegen raus; echte Bilder nur, wenn sie
geliefert werden.

**Abweichungen beim Bauen** (dort dokumentiert): Sticky-Tabellenkopf
weggelassen (Kopfzeile der Seite ist bereits sticky), `sortierbar` statt
`better`, `stromA` als Zahl, eigene `rangfolge.ts`, Quellen als `<details>`,
G1-Maß auf gemeinsame Wortfolge ab 6 Wörtern geschärft, Filterknöpfe
serverseitig mit `hidden` ausgeliefert.

## 4. Abgleich mit **diesem** Checkout

Dieser Branch liegt auf `af7f646` (Merge PR #595). `353efd5` ist hier **kein
bekanntes Objekt**. Die fremden Ergebnisse sind also nicht einfach übernehmbar.

| Prüfstein                                                                        | Anhang A/B (dort)               | Dieser Checkout (hier, gemessen)                        |
| -------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------- |
| Seiten im Build                                                                  | 67 geprüft / 62 indexierbar     | **42 geprüft**, 47 statische Routen                     |
| Inhaltsdateien                                                                   | 52 Seiten                       | **27 Dateien** in `lib/seo/content/`                    |
| Cluster Wasser/Gas/Dach                                                          | 3 neue Hubs                     | **nicht vorhanden**                                     |
| `lib/seo/comparisons/`                                                           | Spec + Umsetzung                | **nicht vorhanden**                                     |
| `docs/seo/BILDERLISTE-2026-10-26.md`, `CONTENT-AUDIT-*.md`, `DEEP_RESEARCH_*.md` | vorhanden                       | **nicht vorhanden**                                     |
| `LadeboosterVergleich.tsx`                                                       | 1.391 Zeilen „vorher"           | **1.624 Zeilen** vorhanden                              |
| `app/ladebooster-vergleich.css`                                                  | 1.036 Zeilen, global importiert | **1.036 Zeilen**, global importiert                     |
| Impressum                                                                        | 5/5 Platzhalter                 | **5/5 eingetragen** (2026-11-03, §6)                    |
| Gates                                                                            | `npm test` 3.775 Tests          | `npm run check` grün, `npm run build` grün (42 Seiten)  |
| Bilder                                                                           | 7 SVGs eingebunden              | **kein** Bild in `public/bilder/`; 50 Motive im Katalog |

Der Ladebooster-Befund aus Anhang B passt damit **auf unseren Bestand**: die
große Komponente und das globale CSS existieren hier genauso. Die
Content-Cluster aus Anhang A existieren hier **nicht**.

## 5. Was aus den Anhängen in dieses Konzept übernommen wird

1. **Bildbedarf erweitert.** Die 28 Hero-Motive und 28 Diagramm-Briefings aus A
   liegen als Ergänzung zum 50-Motive-Katalog in
   [`FOTOMOTIV-ERGAENZUNG-2026-11-03.md`](FOTOMOTIV-ERGAENZUNG-2026-11-03.md).
   Sie sind **bedingt**: die zugehörigen Seiten existieren in diesem Checkout
   noch nicht. Es bleibt bei „Fotos möchte ich einfach eigene machen" — die
   KI-Platzhalter aus dem Prototyp werden nicht ausgeliefert (Regel 5 in
   [`BILDRECHTE.md`](BILDRECHTE.md)).
2. **Vergleichsseiten sind Klasse C, nicht ein Foto.** Rangliste,
   Attribut-Matrix und Entscheidungsleiter sind HTML/SVG mit echtem Text —
   dieselbe Regel wie für Querschnittstabellen und Formeln in §4.1. Ein
   Vergleich braucht kein Hero-Foto, um zu funktionieren; er braucht Reihenfolge,
   gemeinsame Attribute und keine doppelten Fakten.
3. **Strukturprinzip „Vergleich zuerst".** Für jede künftige Vergleichsseite:
   unter H1 die Scan-Schicht (Rangliste + Einsatzfälle), danach der Ratgeber.
   Keine Textwand, keine mehrfach erzählte Tatsache, keine sichtbaren
   „Foto folgt"-Platzhalter, keine Sterne und keine Affiliate-Links.
4. **SEA-Messbarkeit statt Versprechen.** Die Suchintentionen aus A sind
   **Annahmen**; die Search Console ist nicht angebunden. Es gibt weiterhin
   kein Ranking- und kein CPA-Versprechen. Keyword → Anzeige → H1 →
   Bildunterschrift → CTA bleibt die Message-Match-Kette aus §7.
5. **Rechtslage: in diesem Baum vollständig.** Die in Anhang A und B genannten
   Betreiberangaben sind in §6 dokumentiert und nach Freigabe eingetragen;
   `main` hat dieselben Angaben mit PR #597 übernommen. Die Warnung aus den
   Anhängen („Datenschutz nur Kurzfassung") betraf einen anderen Repo-Stand:
   `app/datenschutz/page.tsx` ist hier vollständig, und ohne Cookies/Tracking
   ist kein CMP nötig. Offen sind Ads-Konto, Search Console und
   Conversion-Events als Setup/Messung, keine Rechtstexte.

## 6. Rechtliche Angaben aus den Anhängen — eingetragen (2026-11-03)

| Feld              | Wert laut Anhang                  | Quelle im Anhang                          |
| ----------------- | --------------------------------- | ----------------------------------------- |
| Name              | `Jonas Rieckhoff`                 | A, Turn 14                                |
| Straße/Hausnummer | `Franzosenkoppel 46`              | A, Turn 14                                |
| PLZ/Ort           | `22547 Hamburg`                   | A, Turn 14                                |
| E-Mail            | `kontakt@elektroplaner-camper.de` | B, Turn 26 („lass die und merge")         |
| Domain            | `12v-planer.de`                   | B, Turn 14 (deckt sich mit `lib/site.ts`) |

**Freigabe:** Der Betreiber hat am 2026-11-03 in dieser Sitzung ausdrücklich
bestätigt: „Ja das Impressum kannst du so übernehmen". Damit stehen alle fünf
Felder in `lib/siteLegal.ts`; `missingLegalFields()` ist leer, der Deploy-Wächter
läuft auf `LEGAL_NOTICE_GATE: block`, und die Tests pinnen den vollständigen
Zustand gegen einen Rückfall.

**Abgleich mit `main` (PR #597):** `main` hat dieselben Angaben inzwischen
ebenfalls eingetragen, mit `kontakt@12v-planer.de` als Kontaktadresse. Dieser
Branch übernimmt nach dem Abgleich genau den `main`-Stand der Rechtsdateien;
die E-Mail unten in der Tabelle ist die historische Angabe aus Anhang B, nicht
die ausgelieferte Adresse. Der Anbieter ist eine **natürliche
Person** — ein Rechtsformzusatz ist dafür nicht nötig; die Feldbezeichnung und
der Modulkommentar sagen das jetzt ausdrücklich. Für
`contentResponsible` (§ 18 Abs. 2 MStV) wurden Name und ladungsfähige Anschrift
derselben Person verwendet, nicht erfunden: Es ist die einzige aus den Anhängen
belegbare Person. Die Fixtures in den Tests („12V-Planer Ausbau GmbH, Bremen")
bleiben ausdrücklich Testdaten.

**Korrektur 2026-11-03 (Abgleich mit diesem Checkout):** Die Warnung „Punkt 2
offen" stammt aus dem Repo-Stand der Anhänge, nicht aus diesem Baum. Hier ist
`app/datenschutz/page.tsx` bereits eine vollständige Erklärung (130 Zeilen):
GitHub-Pages-Hosting und Server-Logs, Drittlandtransfer mit DPF/SCC,
localStorage nach § 25 Abs. 2 TDDDG, **keine Cookies, keine Analyse, keine
externen Schriften**, der Camper-Assistent ist in der Auslieferung inaktiv,
E-Mail-Kontakt, Betroffenenrechte, keine automatisierte Entscheidungsfindung.
Ein CMP ist bei dieser Datenlage nicht nötig; Consent Mode v2 wird erst mit
einem Analytics-/Ads-Tag relevant. Zusammen mit dem jetzt befüllten Impressum
und `LEGAL_NOTICE_GATE: block` sind die **Rechtstexte in diesem Baum vollständig**.
Offen bleiben keine Rechtsfragen, sondern Setup/Messung: Ads-Konto, Search
Console und Conversion-Events. Eine anwaltliche Endabnahme bleibt generell
empfehlenswert; dieser Text ist keine Rechtsberatung.

## 7. Bewusst **nicht** übernommen

- **Kein Code kopiert, kein Commit und kein Merge** aus den Anhängen. Was in
  §9 umgesetzt wurde, ist in diesem Repo neu gebaut und gegen die hiesigen
  Gates geprüft — nicht aus einem fremden Baum übernommen. Beide Sitzungen enden
  mit einem Fehler bzw. einer Kompaktierung; „nicht committet und nicht
  gepusht" steht in A ausdrücklich. Es gibt hier keine Grundlage anzunehmen,
  dass die 24 Beiträge, das Vergleichs-Template oder die Rechtskorrekturen in
  `main` angekommen sind.
- **Keine Gates fremder Bäume als eigene Belege.** „3.775 Tests grün" und
  „67 Seiten geprüft" gelten für den dortigen Stand, nicht für diesen. Unsere
  eigenen Gates sind `npm run check` (grün) und `npm run build` (grün, 42
  Seiten) aus der P1-Umsetzung.
- **Keine Roh-Transkripte im Repo.** 7,5 MB bestehen überwiegend aus
  `#### Thinking`- und `#### Tool:`-Blöcken, enthalten lokale Windows-Pfade und
  die Betreiberangaben aus §6. Die verdichtete Fassung hier ist die Quelle, die
  reviewt und diffbar ist. Auf Wunsch können die Rohdateien versioniert werden.
- **Kein generisches Template und keine neuen Inhaltsseiten.** Die
  Vergleichsseite selbst ist seit 2026-11-03 fertig ausgebaut (§10) — auf
  ausdrücklichen Wunsch des Betreibers als eine maßgeschneiderte Seite, nicht
  als Gerüst für künftige Artikel. Die 24 Inhaltsseiten aus Anhang A bleiben
  ungebaut; das wäre ein eigenes Feature mit eigener Freigabe.
- **Keine Ranking-, Traffic- oder CPA-Zusage** aus „so viel Traffic wie möglich".
  Das Ziel wird als Ausrichtung übernommen, nicht als messbares Versprechen.

## 8. Konsequenz für die Phasen (§9 des Konzepts)

| Phase | Ergänzung aus den Anhängen                                             | Status                                                   |
| ----- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| P0    | Betreiberangaben, Datenschutz, Fotorechte, Ads-Konto                   | **Rechtstexte erledigt** (§6); Fotos und Ads-Setup offen |
| P1    | Tokens, `ContentImage`, Bildvertrag                                    | **umgesetzt**, `npm run check` + `npm run build` grün    |
| P2    | Hero-Foto + 28 bedingte Zusatzmotive; Vergleichsseite **fertig** (§10) | Bilder **offen**, Rest umgesetzt                         |
| P3    | Content-Cluster Wasser/Gas/Dach/Zulassung, `ItemList`/`Product`-Schema | Kandidat, **nicht freigegeben**                          |
| P4    | Gates, Bild-Sitemap, E2E 375/768/1440, Lighthouse                      | **umgesetzt** (Konzept §9, Stand P4)                     |

## 9. In diesem Repo umgesetzt (2026-11-03)

Auf ausdrückliche Freigabe des Betreibers hin wurde das Wissen beider Sitzungen
in **diesem** Checkout angewandt — neu gebaut, nicht kopiert:

| Bereich    | Änderung                                                                                                                                                                    | Herkunft                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Impressum  | `lib/siteLegal.ts`: alle fünf Felder eingetragen; Modulkommentar und Feldbezeichnung für eine natürliche Person korrigiert                                                  | A Turn 14 + B Turn 26     |
| Wächter    | `scripts/ci/verifyLegalNotice.ts` und `.github/workflows/deploy.yml`: `LEGAL_NOTICE_GATE` von `warn` auf `block`                                                            | A, Rechtsaudit            |
| Tests      | `lib/siteLegal.test.ts`, `app/impressum/page.test.tsx`, `scripts/ci/verifyLegalNotice.test.ts`: Platzhalter-Zweig über eigene Fixture, Live-Zustand als vollständig gepinnt | A, Rechtsaudit            |
| Vergleich  | `app/camper-elektrik/[slug]/page.tsx` hängt den Vergleich über `afterHeader` **vor** die Ratgeber-Abschnitte; `SeoPage` dokumentiert den Slot dafür                         | B, Befund 1 + Ansatz A    |
| Vergleich  | Sichtbare „Eigenes Foto folgt"-Kacheln entfernt, Aussage als Text mit internem Verweis erhalten, tote `lb-photo-*`-CSS-Regeln gelöscht                                      | B, „bewusst nicht ändern" |
| Zusagen    | Dateiköpfe von `lib/seo/jsonLd.ts` („keine Preise") und `lib/seo/content/ladebooster.ts` („Kein Markenvergleich") an den tatsächlichen Zustand korrigiert                   | B, §8 SEO-Layer           |
| Regression | `SeoPage.test.tsx` (Slot-Reihenfolge), `app/camper-elektrik/[slug]/page.test.tsx` (Vergleich = erste H2), `LadeboosterVergleich.test.tsx` (keine Foto-Platzhalter)          | B, Gates G4 + Befund      |

**Nicht umgesetzt:** Die 24 neuen Inhaltsseiten aus Anhang A und ein
wiederverwendbares Vergleichs-Template für weitere Artikel — beides eigene
Features mit eigener Freigabe. Die eine Vergleichsseite ist dagegen fertig (§10).

**Baselines inzwischen erneuert (P4):** Die 22 auf `main` freigegebenen
Pixel-Baselines wurden übernommen; die visuellen Specs sind damit
**76/76 grün**. Sie wurden bewusst nicht mit dem Lambda-Chromium neu erzeugt.

## 10. Die fertige Vergleichsseite (2026-11-03)

Der Betreiber hat verlangt: „nicht ein template … gleich perfekt, komplett
durchdacht, immersiv und ohne Fehler". Umgesetzt wurde deshalb **eine**
maßgeschneiderte Seite, keine Abstraktion für künftige Vergleiche.

**Eine Wahrheit.** `lib/seo/ladeboosterGeraete.ts` beschreibt alle neun Geräte
mit acht Attributen, Klasse, Nennstrom als Zahl, Preis, Prüfdatum, „Passt für",
Einordnung, Haken und Belegen. Rangliste, neun Produktkarten und das
`ItemList`-Schema werden daraus erzeugt. Nicht belegte Werte sind `null` und
erscheinen als „nicht belegt" — nie als leere Zelle oder erfundene Zahl. Die
früheren drei handgepflegten Darstellungen und die fünf Kompaktkarten mit
doppelten Fakten sind weg; ein Test verbietet lange Sätze doppelt.

**Scan-Schicht zuerst.** Kurzentscheidung mit vier Einsatzfällen und Deeplink →
Rangliste mit einheitlichen Spalten, Zeilenköpfen, Badge-Legende und
Attribut-Legende → neun Karten in identischer Attribut-Reihenfolge mit
Ankern `#p-<id>` → Werkzeugleiste mit Filter, Sortierung und live Zähler →
interne Verweise auf Kabelquerschnitt, Sicherungen, LiFePO4 und Laden →
Rechner (Formel und Ausgaben bitidentisch) → fünf Fragen.

**Interaktion, ohne JavaScript vollständig.** Der Filter wirkt auf **Tabelle
und Karten** (früher nur Karten, mit einem Entschuldigungshinweis im Text).
Sortiert wird nach Nennstrom oder Preis; `null` sortiert immer ans Ende.
Anker in ein `<details>` öffnen es vor dem Scrollen; `<details>` bleibt natives
HTML und damit ohne Skript bedienbar. Eine IntersectionObserver-Markierung
setzt `aria-current` im Sprungmenü — reine Verschönerung. Press-Feedback
(0,96 / 150 ms), Hover-Zeilen und Fokus liegen hinter den globalen
`prefers-reduced-motion`- bzw. `@media (hover: hover)`-Regeln; keine zweite
klebende Ebene, weil die Seitenkopfzeile schon sticky ist.

**Keine Textwand.** Sieben Wege, Forenwissen, meine Rechnung (mit
Prinzipskizze und C-Rate-Balken) und das Quellenverzeichnis sind aufklappbare
Vertiefungen mit eigener Zusammenfassung. Der Inhalt bleibt im HTML, ohne
Skript lesbar, und ist nicht mehr beim ersten Blick eine Bleiwand.

**SEO.** Ein `ItemList`-Knoten mit neun verschachtelten `Product`-Einträgen aus
derselben Datenquelle; **keine** Preise, Bewertungen oder fremden Adressen im
Schema (`json-ld-adresse` meldet jede fremde Origin als Fehler). Das Inventar
kündigt `ItemList` genau einmal an; `json-ld-inventar` ist damit grün. Vier
interne Verweise direkt an der Rangliste statt null. Titel, H1, Canonical,
Sitemap und die eingefrorenen Rechner-Ausgaben bleiben unverändert.

**Kein globales CSS mehr.** `app/layout.tsx` importiert das 1.000-Zeilen-
Stylesheet nicht mehr; es hängt am Bauteil. Im Export hat die Vergleichsroute
genau einen CSS-Chunk mehr als die Startseite — nachgemessen, nicht angenommen.

**Gates.** `lib/seo/ladeboosterVergleich.test.ts` (13 Tests: Datenintegrität,
Preisfrische, Schema, Inventar) und `components/seo/LadeboosterVergleich.test.tsx`
(12 Tests: Filter auf Tabelle+Karten, Zähler, Sortierung, acht Attribute je
Karte, keine doppelten Sätze, kein globaler CSS-Import, externe Belege). Dazu
`npm run check` und `npm run build` inklusive Exportprüfung. Im gebauten HTML
nachgemessen: neun `ItemList`-Positionen, neun Karten, keine doppelten IDs,
keine Anker ohne Ziel, keine `aria-labelledby` ohne Ziel, genau eine H1, kein
„Eigenes Foto folgt".

**Nachgeprüft am 2026-11-03:** Ein Chromium-Binary aus dem npm-Registry wurde
selbst installiert; damit liefen die komplette E2E-Suite, axe, Lighthouse und
eine eigene Browser-Messreihe über 375/768/1440 in hell und dunkel. Alle
Ergebnisse, die zwei offenen Baseline-Gruppen und die Grenzen stehen in
[`VERIFIKATION-2026-11-03.md`](VERIFIKATION-2026-11-03.md). `main` hat mit PR
#597 bereits aktualisierte Baselines; dieser PR übernimmt sie beim Merge. Mit
dem hier verwendeten Lambda-Chromium wurden keine Baselines überschrieben.
Rechtstexte sind vollständig; offen bleiben Ads-Konto, Search Console und
Conversion-Events sowie die eigenen Fotos für P2. Kein Ranking- und kein
CPA-Versprechen.

---

Siehe auch: [`DESIGN-KONZEPT-2026-11.md`](../DESIGN-KONZEPT-2026-11.md) ·
[`FOTOMOTIV-KATALOG.pdf`](FOTOMOTIV-KATALOG.pdf) ·
[`FOTOMOTIV-ERGAENZUNG-2026-11-03.md`](FOTOMOTIV-ERGAENZUNG-2026-11-03.md) ·
[`BILDRECHTE.md`](BILDRECHTE.md)
