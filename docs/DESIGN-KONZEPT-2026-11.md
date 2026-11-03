# Designkonzept 2026-11 — „Werkstattprotokoll“

> **Status: Konzept, keine Code-Änderung.** Geltung: alle Website-Seiten
> (`PageShell`-Varianten `article` und `tool`). Die Planer-App-Shell
> (`variant="app"`) bleibt beim [`DESIGN-KONZEPT-2026-10.md`](DESIGN-KONZEPT-2026-10.md).
> Stand 2026-11-02. Umsetzung braucht Freigabe (`AGENTS.md` §8: „Keine neuen
> Features ohne Freigabe“).
>
> Anschauung: [`docs/design-2026-11/index.html`](design-2026-11/index.html)
> (anklickbarer Prototyp) und [`docs/design-2026-11/bilder/`](design-2026-11/bilder/).
> Regelwerk für Oberflächen, Icons und Bewegung:
> [`.agents/skills/better-ui/`](../.agents/skills/better-ui/SKILL.md),
> installiert am 2026-11-02.

**In einem Satz:** Bilder sind Belege, Bewegung ist eine Bestätigung, Text ist der
Inhalt — und alles, was ein Crawler oder ein Anzeigenbesucher sieht, steht ohne
JavaScript im HTML.

---

## 1. Auftrag und Diagnose

| Wunsch                                     | Wird im Konzept zu                                                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| „besser passender“, nicht verspielt        | Dokumentarische Werkstatt-Sprache statt Software-Dashboard; Rhythmus aus Typografie und Bildausschnitt, nicht aus Dekoration  |
| „nicht so mega KI“                         | Harte Anti-Referenzliste (§3), echte Fotografie statt generierter Motive, keine `//`-Kicker, keine Icon-Kachelwüste           |
| „mehr Bilder“                              | §4: drei Bildklassen, Motivplan, ~40 Bildmotive, Auslieferung in AVIF, Bildrechte, Alt-Texte, Bild-Sitemap                    |
| „Micro-Interactions, vielleicht Animation“ | §6: zwölf exakt bezifferte Interaktionen, genau ein gestaffelter Auftritt pro Sitzung, ansonsten ≤ 150 ms                     |
| „nicht wie von einem 15-Jährigen“          | Erwachsene Zurückhaltung: ein Akzent, 4 px Radius, keine Bounces, keine Verläufe, keine erfundenen Siegel                     |
| „absolut SEO und SEA optimiert“            | §7 und §8: messbare Budgets, konkrete Dateipfade, Rechtsvoraussetzungen und verbleibende Setup-Schritte für bezahlten Traffic |

### Befunde am Ist-Zustand (belegt)

| Befund                                                                                                                   | Beleg                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Startseite ist **absichtlich bildfrei**: der Test verbietet jedes `<img>`                                                | `app/page.test.tsx:23`                                                                        |
| Startseite hat 242 Wörter ohne JavaScript, 1 H1 / 3 H2                                                                   | [`docs/seo/AUDIT.md`](seo/AUDIT.md)                                                           |
| „Echte Bilder“ ist seit Oktober ein offenes P1 (zwei `<img>` im Export)                                                  | [`docs/seo/CAMP-SEO-GROWTH-REPORT.md`](seo/CAMP-SEO-GROWTH-REPORT.md)                         |
| Visuell: vier gleich gebaute Tool-Karten mit Icons, HUD-Kicker mit `//`, rechts eine Platzhalter-Vorschau statt Realität | `app/page.tsx`, `components/brand/ToolCard.tsx`                                               |
| CSP erlaubt Bilder nur vom eigenen Host                                                                                  | `app/layout.tsx`, `public/_headers`: `img-src 'self' data: blob:`                             |
| `next/image` erzeugt **keine** optimierten Varianten (statischer Export)                                                 | `next.config.mjs`: `images.unoptimized: true`                                                 |
| Sockel aller Seiten: ~593 KB Skript (unkomprimiert); GSAP lag mit ~136 KB auf einer Textseite                            | `docs/seo/AUDIT.md`, `docs/seo/ANALYSE-UND-VISION.md`                                         |
| Keine SEA-Messstrecke: keine Tags, keine Zustimmung, keine Conversion-Events                                             | `app/layout.tsx`, `public/_headers`                                                           |
| Impressum und Datenschutz sind Platzhalter                                                                               | `lib/siteLegal.ts`, [`docs/impressum-datenschutz-befund.md`](impressum-datenschutz-befund.md) |

Die technische SEO-Basis ist **gut** und bleibt: 28 indexierbare Seiten, ein H1
je Seite, Inhalt ohne JavaScript, Canonical, Sitemap, Robots, strukturierte
Daten, keine Waisen, keine doppelten Metadaten (`docs/seo/AUDIT.md`). Das neue
Konzept ersetzt diese Basis nicht — es ergänzt die **visuelle Beweiskraft** und
die **bezahlbare Landestrecke**.

---

## 2. Leitidee: „Werkstattprotokoll“

Die Seite liest sich wie die Dokumentation einer echten Arbeit, nicht wie die
Landingpage eines Softwareprodukts. Sie zeigt, was man sonst erst nach dem
Kauf oder nach dem ersten Kabelbrand sieht: die Anlage, das Werkzeug, den Plan
auf der Werkbank.

Drei Säulen:

1. **Fotografie als Beleg.** Jedes Foto zeigt einen realen Handgriff oder ein
   reales Bauteil. Es illustriert nicht „Camper-Lifestyle“, sondern dieselbe
   Leitung, über die der Text rechnet.
2. **Der Plan als Gegenstück.** Neben dem Foto steht der Ausschnitt aus dem
   Schaltplan, der genau dieses Bauteil beschreibt. Foto und Plan tragen
   dieselbe Nummer. Das ist die Idee, die die Seite von einer generischen
   Tool-Seite unterscheidet.
3. **Text als Antwort.** Die Frage des Suchenden wird im HTML beantwortet — mit
   Formel, Annahme, Grenze und Beispiel. Bilder ergänzen, sie ersetzen nie Text.

**Zielgruppe:** Selbstausbauer zwischen 30 und 55, die eine 12-V-/230-V-Anlage
selbst planen, Werkzeug in der Hand haben und Marketing-Sprache misstrauen.
Daneben fachliche Leser, die eine Zahl nachrechnen wollen.

**Tonalität:** sachlich, konkret, keine Superlative, kein „in 3 Schritten“, kein
„revolutionär“, kein Ranking-Versprechen. Die in
[`docs/seo/ANALYSE-UND-VISION.md`](seo/ANALYSE-UND-VISION.md) festgelegten
Zusagen **Transparenz** und **Bescheidenheit** gelten auch für Bild und Bewegung.

**Vorbilder (Richtung, nicht Kopie):** Werkstatthandbuch, Dokumentation von
Messgeräten, technische Reportagefotografie, schweizerisches Editorial-Raster.

---

## 3. Anti-Referenz — was ausdrücklich nicht vorkommt

| Verbot                                                        | Warum                                                      | Stattdessen                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| Gradient-/Mesh-Hintergründe, Aurora-Blobs, Neon-Glow          | Liest sich wie eine Template-Demo                          | Papierfläche, 1 px Trenner, ein Oxid-Akzent          |
| Glasmorphismus, `backdrop-filter`, durchscheinende Karten     | Kostet GPU, senkt Kontrast, im Planer ohnehin untersagt    | Deckende Flächen                                     |
| 3D-/Isometric-Illustrationen, generierte „Tech“-Bilder        | Der „KI-Look“, den der Auftrag ausschließt                 | Echte Fotografie, SVG-Planausschnitte                |
| Emojis, Icon-Salat, sechs identische Karten mit je einem Icon | Wirkt zusammengeklickt                                     | Nummerierte Beweisstrecke, Tabellen, Typografie      |
| Dekorative `//`-Kicker in Versalien                           | Fülltext-Signal, keine Information                         | Strukturbezeichnung in Satzschreibung                |
| Bounce, Elastic, Spring mit Overshoot, `bounce > 0`           | Verspielt; das Produkt hat Sicherheitsbezug                | `ease-out`, 150 ms, `bounce: 0`                      |
| Parallax, Scroll-Hijacking, Animationen beim Scrollen         | INP, Seekrankheit, kein informativer Gewinn                | Ein Auftritt beim ersten Laden, sonst Ruhe           |
| Animierte Zähler, Count-up von Rechenwerten                   | Zahlen wirken geschätzt, nicht gerechnet                   | Wert sofort, 150 ms Deckkraft-Wechsel                |
| Autoplay-Video, Popups, Interstitials, Exit-Overlays          | LCP, Quality Score, Vertrauen                              | Keines                                               |
| „Trusted by“-Logos, Siegel, Sterne, `aggregateRating`         | Nicht belegbar; Risko einer manuellen Maßnahme             | Methodik, Quellen, Grenzen, Impressum                |
| Text, Zahlen oder Logos **im** Bild                           | Nicht indexierbar, nicht übersetzbar, nicht barrierefrei   | `<figcaption>`, HTML-Tabellen, Text nur in OG-Karten |
| Gestellte Stock-Fotos mit Lächeln, Sonnenuntergang, HDR       | Bricht die Werkstatt-Wirklichkeit                          | Verfügbares Licht, Hände, Material, Gebrauchsspuren  |
| Radius > 4 px, Pillen, weiche Schlagschatten als Struktur     | Bestehende Token-Regel (§5 des Vorgängers)                 | 4 px, 1 px Kante, transparente Schatten für Höhe     |
| Fade-in des Hero / `opacity: 0` in einer Base-Regel           | Verschlechtert LCP, kann Inhalt vor dem Crawler verstecken | Bild und Text sind sofort da                         |

„Nicht verspielt“ heißt nicht „leblos“. Spannung entsteht aus dem harten
Wechsel zwischen großem Foto und dichter Typografie, aus präzisen 150 ms
Rückmeldungen und aus Zahlen, die man nachrechnen kann.

---

## 4. Bildkonzept

### 4.1 Drei Bildklassen

| Klasse | Inhalt                                             | Format      | Regel                                                     |
| ------ | -------------------------------------------------- | ----------- | --------------------------------------------------------- |
| A      | Echte Fotografie: Einbau, Bauteil, Handgriff, Dach | AVIF + JPEG | Nur eigene oder lizenzierte Aufnahmen; kein Text im Bild  |
| B      | Planausschnitt aus dem Produkt                     | SVG, inline | Keine Rastergrafik; Beschriftung als echter Text          |
| C      | Diagramm, Tabelle, Formel                          | HTML / SVG  | Niemals als Bild — sonst für Crawler und Screenreader weg |

**Grundregel:** Ein Bild ist ein Beleg, keine Dekoration. Jedes Bild braucht eine
sichtbare Bildunterschrift mit **einer prüfbaren Aussage** und, wo passend,
einem internen Verweis. Das erzeugt indexierbaren Text und interne Verlinkung
zugleich.

**Vergleichsseiten gehören in Klasse C.** Eine Rangliste, eine Attribut-Matrix
oder eine Entscheidungsleiter ist HTML/SVG mit echtem Text, kein Hero-Foto:
Zahlen und Gerätenamen müssen crawlen, sortieren und vorlesen können. Das gilt
auch für den Ladebooster-Vergleich — siehe §11 und
[`ANHAENGE-INTEGRATION-2026-11-03.md`](design-2026-11/ANHAENGE-INTEGRATION-2026-11-03.md).

### 4.2 Motivplan

| Nr. | Motiv                             | Zielseite                                                    | Seite / Format | Aufgabe im Text                              | Alt-Text (Beispiel)                                                                          |
| --- | --------------------------------- | ------------------------------------------------------------ | -------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 01  | Kabelverlegung im Innenausbau     | `/` (LCP-Hero)                                               | 3:2, 1200 px   | Einstieg: worum es geht                      | „Hände verlegen rot-schwarze 12-V-Leitungen entlang einer Holzleiste im Camper-Innenausbau.“ |
| 02  | Sicherungsträger mit Beschriftung | `/camper-elektrik/sicherungen/`                              | 3:2            | `I_B ≤ I_n ≤ I_z` veranschaulichen           | „Sicherungshalter mit mehreren rot und schwarz angeschlossenen 12-V-Leitungen.“              |
| 03  | Crimpverbindung und Werkzeug      | `/camper-elektrik/kabelquerschnitt/`                         | 3:2            | Übergang vom Rechenwert zum realen Einbau    | „Crimpzange presst einen Kabelschuh auf eine rote 12-V-Leitung an der Werkbank.“             |
| 04  | Solarpanel auf dem Dach           | `/rechner/solaranlage/`, `/tools/dach/`                      | 3:2            | Fläche und Dachbelegung                      | „Zwei Hände richten ein Solarpanel auf dem Dachträger eines Wohnmobils aus.“                 |
| 05  | Gedruckter Plan auf Werkbank      | `/ueber-elektroplaner/`, `/camper-elektrik/schaltplan/`      | 3:2            | Brücke Plan ↔ Realität                       | „Ausgedruckter Schaltplan liegt neben Kabelresten und Maßband auf einer Werkbank.“           |
| 06  | Batteriekasten im Möbel           | `/camper-elektrik/batterie/`, `/rechner/batteriekapazitaet/` | 3:2            | Kapazität räumlich einordnen                 | „12-V-Batterie in einem Holzschrank, verkabelt über Sammelschiene und Sicherungshalter.“     |
| 07  | Querschnittstabelle               | `/camper-elektrik/spannungsabfall/`                          | HTML-Tabelle   | Klasse C — Zahlen bleiben Text               | — (Tabelle mit `<caption>`)                                                                  |
| 08  | Schaltplanausschnitt              | `/elektrik-planung/`, `/planer/`                             | inline SVG     | Klasse B — Produkt zeigt sich selbst         | „Ausschnitt aus dem 12-V-Schaltplan mit Batterie, Sicherung und zwei Verbrauchern.“          |
| 09  | OG-Karte je Intent                | jede Cluster- und Rechnerseite                               | 1200 × 630     | Einzige Ausnahme: Text **darf** ins Bild     | `og:image:alt` mit Seitentitel                                                               |
| —   | **Keine** Bilder                  | `/impressum/`, `/datenschutz/`, App-Shell                    | —              | Rechtliches und Werkzeug bleiben textgeführt | —                                                                                            |

**Umfang:** Startseite 4 Bilder, je Cluster 1 Foto + 1 Planausschnitt, je
Rechner 1 Diagramm, Vertrauensseite 2 Fotos, Guides 2–3 → **50 Fotomotive**,
dazu 8 Elemente, die als HTML/SVG entstehen und deshalb **nicht** fotografiert
werden. Die vollständige, druckbare Motivliste mit je einer Seite pro Motiv
steht in [`design-2026-11/FOTOMOTIV-KATALOG.pdf`](design-2026-11/FOTOMOTIV-KATALOG.pdf)
(70 Seiten, auch als [Markdown](design-2026-11/FOTOMOTIV-KATALOG.md)). Es
entsteht **keine** Bildergalerie ohne Text und **keine** neue Seite nur für
Bilder; die Zuordnung Anfrage → Seite bleibt in `lib/seo/inventory.ts`.

### 4.3 Fotografie-Briefing

- Verfügbares Licht, offene Tür oder Fenster; kein Blitz, kein Studio, kein
  Sonnenuntergang, keine künstliche Tiefenunschärfe auf Kosten der Lesbarkeit.
- 35 mm / 50 mm, f/4–f/8, leichte Körnung ok. Hände, Material, Werkzeug; keine
  Gesichter, kein Blick in die Kamera, keine inszenierte Zufriedenheit.
- Gebrauchsspuren bleiben: Sägespäne, schiefer Aufkleber, leicht schiefer
  Bildhorizont. Genau das unterscheidet ein Protokoll von einem Render.
- Keine Sterne, keine Logos, keine lesbaren Markennamen, keine Kennzeichen,
  kein Text im Bild. Kein Duotone, kein HDR, kein „Cinematic“-Grade.
- **Produktionsregel:** keine KI-generierten Fotos. Die sechs Bilder im Prototyp
  sind ausdrücklich gekennzeichnete Konzeptplatzhalter
  ([`BILDRECHTE.md`](design-2026-11/BILDRECHTE.md)) und werden vor Livegang
  durch eigene Aufnahmen ersetzt.
- Rechte: Fotograf, Datum, Freigabe, Lizenz und Dateiname je Motiv in
  `BILDRECHTE.md`. Kein Hotlinking — die CSP lässt nur `'self'` zu.

### 4.4 Auslieferung (auf diesen Repo-Stand zugeschnitten)

```
public/bilder/<motiv>-640.avif   public/bilder/<motiv>-1200.avif
public/bilder/<motiv>.jpg        (Fallback)
```

Weil `images.unoptimized: true` gilt, entstehen Varianten **nicht** zur Laufzeit;
sie sind Build-Artefakte. Muster:

```html
<picture>
  <source
    type="image/avif"
    srcset="/bilder/01-elektrik-einbau-640.avif 640w, /bilder/01-elektrik-einbau-1200.avif 1200w"
    sizes="(max-width: 760px) 100vw, 560px"
  />
  <img
    src="/bilder/01-elektrik-einbau.jpg"
    alt="Hände verlegen rot-schwarze 12-V-Leitungen entlang einer Holzleiste im Camper-Innenausbau."
    width="1200"
    height="804"
    fetchpriority="high"
    decoding="async"
  />
</picture>
```

| Regel                | Wert / Umsetzung                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LCP-Bild             | `<link rel="preload" as="image" imagesrcset … imagesizes …>`, `fetchpriority="high"`, **nie** `loading="lazy"`, nie Fade-in                                   |
| Alle weiteren Bilder | `loading="lazy"`, `decoding="async"`                                                                                                                          |
| Layoutstabilität     | `width`/`height` **und** CSS `aspect-ratio`; Ziel CLS = 0                                                                                                     |
| Dateigröße           | Hero ≤ 60 KB AVIF (Prototyp: 53 KB), Summe Bilder ≤ 250 KB AVIF je Seite, JPEG-Fallback ≤ 150 KB                                                              |
| Bildkante            | `outline: 1px solid var(--image-outline)`, `outline-offset: -1px`; hell `oklch(0 0 0 / 0.1)`, dunkel `oklch(1 0 0 / 0.1)` — nie ein getöntes Paletten-Schwarz |
| Dateinamen           | beschreibend, `kebab-case`, deutsch: `camper-elektrik-sicherungstraeger-12v.avif`                                                                             |
| Alt-Text             | beschreibt Sichtbares, ≤ 125 Zeichen, kein Keyword-Stuffing, dekorativ → `alt=""`, nie „Bild von …“                                                           |
| Bildunterschrift     | `<figure><figcaption>` mit einer Aussage + internem Verweis                                                                                                   |
| Strukturierte Daten  | `ImageObject` mit `contentUrl`, `caption`, `width`, `height`; **kein** `aggregateRating`                                                                      |
| Indexierung          | `images`-Feld in `app/sitemap.ts`, `og:image:alt` in `app/siteMetadata.ts`                                                                                    |

---

## 5. Layout, Typografie, Farbe

**Bleibt** (Wächter `lib/designTokens.test.ts`): `PageShell`-Varianten,
64-rem-Container, linksbündige Lesespalte 42 rem, Abstände 4/8/12/16/24 px,
Radius 4 px, Typo-Skala 12 · 13 · 14 · 16 · 20 · 26 · 32 px, Inter für UI,
Outfit nur für Display-Headlines, `tabular-nums`, genau **ein** Akzent
`--oxide #a34a24`, responsive 375 / 768 / 1440 px, Touch-Ziele ≥ 44 px.
Die H1 bleibt bei 32 px (26 px mobil): editoriale Wirkung entsteht aus
Weißraum und Bildausschnitt, nicht aus übergroßer Schrift oder `clamp()`-Sonderwegen.
Der Prototyp hält diese Skala ein.

**Neu auf der Website:**

- 12-Spalten-Editorial-Raster, asymmetrischer Hero 7/5: links Anspruch und
  Aktion, rechts das Foto — **kein** Text auf dem Bild.
- Full-bleed-Fotoband zwischen zwei Textabschnitten; danach wieder die enge
  Lesespalte. Der Wechsel ist der Rhythmus.
- „Beweisstrecke“ statt Kartengrid: dreimal `Nummer · Foto · Überschrift ·
eine Zahl · Verweis`.
- Strukturbezeichnungen in Satzschreibung (`„01 — Absicherung“`) statt
  dekorativer `//`-Kicker in Versalien.
- Tabellen mit `<caption>` statt Icon-Kacheln; H2 je Abschnitt, genau eine H1.
- Zeilenlänge ≤ 75 Zeichen, keine zentrierten Fließtexte.

**Oberflächen (Website, nicht Planer-Canvas):** Schatten nur für Höhe, Kanten
für Struktur, `border: 1px solid transparent` unter einem Schatten-Ring, damit
Forced-Colors-Modus eine Kante zeichnet. Konzentrische Radien:
`außen = innen + Padding + Rahmenstärke`; ab 24 px Padding gelten die Ebenen als
getrennte Flächen. Die im Planer geltende Regel „1 px Kante statt Schatten“
(`docs/DESIGN-GUIDELINES-DOS-DONTS.md`) bleibt dort unangetastet.

---

## 6. Micro-Interactions und Animation

**Grundsatz:** Bewegung bestätigt eine Zustandsänderung, sie unterhält nicht.
Jede animierte Änderung behält einen **statischen Anker** (Farbe, Icon oder
Label); Bewegung ist nie der einzige Informationskanal. Für SEA-Zielseiten und
den Above-the-fold-Bereich gilt: **keinerlei Auftrittsanimation**.

**Fundament:** nur `transform`, `opacity`, `filter`; immer explizites
`transition-property` (nie `all`); Transitions statt Keyframes für Zustände,
Keyframes nur für einmalige Auftritte; `will-change` erst nach gemessenem
Stottern und dann mit benannter Eigenschaft; Hover nur hinter
`@media (hover: hover)`; `overscroll-behavior: contain` in Dialogen/Sheets;
ein Icon-Set (lucide-react), `currentColor`, Strichstärche 1,5 px bei 400,
2 px bei 500–600, 2,5 px bei 700; kein GSAP auf Inhaltsseiten.

| #   | Interaktion                                        | Auslöser                            | Eigenschaft(en)                                                           | Dauer / Easing                                                               | Statischer Anker                                                             | Reduced Motion              |
| --- | -------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------- |
| 1   | Primärknopf gedrückt                               | `:active`                           | `scale: 0.96` (`:not(:disabled)`)                                         | 150 ms `ease-out`                                                            | gefüllte Oxid-Fläche, Label                                                  | nur Deckkraft 150 ms        |
| 2   | Zeile / Karte                                      | Hover, Fokus                        | `background-color`, `opacity`                                             | ≤ 150 ms `ease-out`, nur `hover: hover`                                      | Rahmen + Textfarbe                                                           | unverändert                 |
| 3   | Tab-Wechsel, Tastendruck, Zeilen-Hover             | Eingabe                             | `opacity` / `background-color`                                            | sofort oder ≤ 150 ms                                                         | aktiver Tab hat Rahmen und Label                                             | unverändert                 |
| 4   | Icon-Wechsel „Kopieren → Kopiert“                  | Klick                               | `scale 0,25 → 1`, `opacity 0 → 1`, `blur 4px → 0`                         | 300 ms `cubic-bezier(0.2, 0, 0, 1)` oder Spring `{duration: 0.3, bounce: 0}` | Label „Kopiert“, `aria-live`                                                 | Deckkraft-Cross-Fade 150 ms |
| 5   | FAQ auf/zuklappen                                  | Klick                               | `grid-template-rows`, `opacity` (Transition, keine Keyframes)             | auf 300 ms, zu 150 ms `ease-out`                                             | `aria-expanded`, Cheveron, Überschrift                                       | nur Deckkraft               |
| 6   | Rechenergebnis erscheint                           | Eingabe                             | Wert sofort, `opacity` 150 ms                                             | 150 ms                                                                       | Zahl + Einheit + Formel im Text                                              | Wert sofort, ohne Fade      |
| 7   | **Plan ↔ Foto** (Leitidee)                         | Hover/Fokus auf Leitung im SVG      | `border-color`, `opacity` des zugehörigen Fotos                           | ≤ 150 ms                                                                     | dieselbe Nummer `01/02/03` auf Plan **und** Foto, sichtbare Bildunterschrift | unverändert                 |
| 8   | Einmaliger Auftritt (nur `/`, unterhalb des Folds) | erster Load, `IntersectionObserver` | `opacity 0→1`, `translateY 12px→0`, `blur 4px→0`; Gruppen 100 ms versetzt | 300 ms `ease-out`                                                            | Inhalt bleibt sichtbar: versteckter Zustand steht im `from`-Keyframe         | nur Deckkraft-Keyframe      |
| 9   | Ausblenden / Schließen                             | Klick                               | `opacity`, `translateY -12px`, `blur 4px`                                 | 150 ms `ease-out`, nie volle Höhe                                            | Zustand bleibt am Trigger ablesbar                                           | nur Deckkraft               |
| 10  | Zustandswechsel nach dem Laden                     | diverse                             | —                                                                         | `initial={false}` bei `AnimatePresence`                                      | Default-Zustand animiert nicht ein                                           | —                           |
| 11  | Hell-/Dunkel-Wechsel                               | System/Theme                        | alle Transitions kurz sperren, Style-Flush, im nächsten Frame zurück      | —                                                                            | tokens, keine Zwischenfarben                                                 | —                           |
| 12  | Fokus                                              | Tastatur                            | `outline ≥ 2 px`                                                          | —                                                                            | nie `outline: none` ohne Ersatz (Wächter `lib/designTokens.test.ts`)         | —                           |

**Referenz-CSS** (aus `.agents/skills/better-ui/`, auf Website-Tokens übertragen):

```css
:root {
  --image-outline: oklch(0 0 0 / 0.1);
}
.dark {
  --image-outline: oklch(1 0 0 / 0.1);
}

.button-primary {
  transition-property: scale;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}
.button-primary:not(:disabled):active {
  scale: 0.96;
}

.content-image {
  outline: 1px solid var(--image-outline);
  outline-offset: -1px;
}

@media (hover: hover) {
  .beweis-row:hover {
    background-color: var(--surface-hover);
    transition: background-color 150ms ease-out;
  }
}

/* Einmaliger Auftritt: versteckter Zustand NUR im from-Keyframe. */
.stagger-item {
  animation: fade-in 300ms ease-out both;
}
@media (prefers-reduced-motion: no-preference) {
  .stagger-item {
    animation-name: fade-in-up;
  }
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
}
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(12px);
    filter: blur(4px);
  }
}
```

**Verifikation (aus der Skill übernommen):** Ohne Browser alle Zustände aus dem
Code lesen (hover, pressed, selected, loading, empty) samt Dauer und Easing; mit
Browser jede Bewegung bei 10 % Geschwindigkeit im Animations-Panel abspielen;
alles nicht Geprüfte als `Not verified` melden. Im CI: axe-Check plus ein
Playwright-Test mit `reducedMotion: 'reduce'`, der belegt, dass kein Element
Bewegung ausführt und alle Zustände trotzdem ablesbar sind.

---

## 7. SEO — Zusagen und Budgets

### Was bleibt (nicht antasten)

zentrale Metadaten in `app/siteMetadata.ts` · Canonical je Route ·
`robots: index, follow, max-image-preview:large` · `app/robots.ts` ·
`app/sitemap.ts` aus `lib/seo/inventory.ts` · 28 indexierbare Seiten · genau eine
H1 · vollständiger Inhalt ohne JavaScript · strukturierte Daten · keine dünnen
Seiten · keine doppelten Metadaten · 100 % interne Verlinkung · `noindex` für
Ansichten ohne Inhalt · Verzeichnisform der Adressen (`trailingSlash: true`).

### Was neu dazukommt

1. **Bilder indexierbar machen:** `images`-Einträge in `app/sitemap.ts`,
   `ImageObject` je Bild in `components/seo/PageStructuredData.tsx`,
   `og:image:alt` und je Intent eine eigene 1200 × 630 OG-Karte in
   `app/siteMetadata.ts`. Keine Bewertungen, keine Siegel.
2. **Kein `hreflang` ohne zweite Sprache.** Heute genügen `<html lang="de">`
   und `inLanguage: 'de-DE'` im JSON-LD; `app/layout.test.tsx:73` hält den
   Stand fest. Erst mit englischem Zweig `alternates.languages` **und**
   Rückverweise — ein einzelner Selbstverweis bringt nichts und erzeugt Pflege-
   Aufwand.
3. **Text bleibt Text:** Formeln, Tabellen und Zahlen in HTML, nie im Bild;
   Bildunterschriften mit einer Aussage und einem internen Verweis; keine
   `opacity: 0`-Basisklassen; keine JS-abhängigen Inhalte.
4. **Core Web Vitals als Abnahmebedingung:** LCP ≤ 2,5 s (Ziel ≤ 1,8 s mobil),
   CLS ≤ 0,05 (Ziel 0), INP ≤ 200 ms. Hebel: Hero-Preload, `width`/`height`,
   AVIF, Font-Subsetting (offen als M11-6), kein GSAP im Erstaufbau, komprimierte
   Bundle-Messung statt der 593 KB Rohzahl.
5. **Inhaltstiefe halten:** ≥ 700 Wörter je Cluster; `/tools/dach/` (207 Wörter,
   0 H2) und `/tools/heizung/` (436 Wörter, 0 H2) bekommen erklärende Abschnitte
   — das ist P1 aus `docs/seo/AUDIT.md`. Bilder ersetzen davon kein Wort.
6. **Prüfung erweitern:** `scripts/seo/auditExport.ts` um Bildregeln ergänzen
   (Alt-Text vorhanden, `width`/`height` gesetzt, ein `<figcaption>` je
   Inhaltsbild, keine neuen Seiten ohne Intent). `npm run build` führt die
   Exportprüfung bereits aus.
7. **Keine Ranking-Aussage.** Messbar sind technische Zusagen, nicht
   Positionen; `docs/seo/SEARCH-CONSOLE.md` bleibt die Quelle für echte Daten.

| Messgröße              | Ziel                  | Wie gemessen                                         |
| ---------------------- | --------------------- | ---------------------------------------------------- |
| LCP (mobil, 4G)        | ≤ 2,5 s, Ziel ≤ 1,8 s | Lighthouse CI (M11-5), CrUX/Search Console           |
| CLS                    | 0                     | Playwright `visual-de`, `layout-shift`               |
| INP                    | ≤ 200 ms              | Field-Daten / Web-Vitals                             |
| Lighthouse Performance | ≥ 90                  | CI-Gate M11-5 (offen)                                |
| Bilder je Seite        | ≤ 250 KB AVIF         | `du` über `public/bilder/`, Build-Skript             |
| Indexierbare Seiten    | ≥ 28, keine Waisen    | `npm run seo:audit`, `npx tsx scripts/seo/report.ts` |
| Wörter ohne JavaScript | Cluster ≥ 700         | `scripts/seo/measureExport.ts`                       |

---

## 8. SEA — die bezahlte Landestrecke

### Rechtliche Voraussetzungen — erledigt

`lib/siteLegal.ts` ist vollständig befüllt, der Deploy-Wächter steht auf
`LEGAL_NOTICE_GATE: block`, und `app/datenschutz/page.tsx` beschreibt Hosting
und Server-Logs, lokale Speicherung, Kontaktwege und Betroffenenrechte ohne
Platzhalter. Die Seite setzt **keine Cookies und kein Tracking** — deshalb ist
im aktuellen Zustand kein CMP nötig, und Consent Mode v2 wird erst mit einem
Ads-/Analytics-Tag relevant. Sobald GA4 oder Google Ads hinzukommen, sind
Einwilligung (CMP + Consent Mode v2) und die CSP-Änderung an **beiden** Stellen
Pflicht (siehe unten). **Ohne Einwilligung keine Kampagne** — das Risiko bleibt
Anzeigenablehnung oder Kontosperre, kein Designproblem.

Vor dem ersten Euro fehlen damit nur noch Setup und Messung: Ads-Konto,
Search Console und die definierten Conversion-Events. Das sind keine
Rechtsblocker.

### Grundsatz: kein bezahlter Klick auf die Startseite

Jede Anzeigengruppe landet auf der Seite, die ihre Suchanfrage beantwortet. Die
Kette muss in jedem Glied denselben Wortstamm tragen:

`Keyword → Anzeigenheadline → H1 → erstes Bild + Bildunterschrift → CTA`

| Anzeigengruppe | Beispiel-Keyword                        | Zielseite                            | H1 (Richtung)                           | Hero-Motiv | Primär-Event          |
| -------------- | --------------------------------------- | ------------------------------------ | --------------------------------------- | ---------- | --------------------- |
| Rechnen        | `12v kabelquerschnitt berechnen`        | `/camper-elektrik/kabelquerschnitt/` | Kabelquerschnitt für 12 V berechnen     | 03         | `rechner_ergebnis`    |
| Verstehen      | `spannungsabfall 12v formel`            | `/camper-elektrik/spannungsabfall/`  | Spannungsabfall verstehen und begrenzen | 07         | `rechner_ergebnis`    |
| Auslegen       | `batteriekapazität camper berechnen ah` | `/rechner/batteriekapazitaet/`       | Batteriekapazität in Ah auslegen        | 06         | `rechner_ergebnis`    |
| Vergleichen    | `lifepo4 oder agm camper`               | `/camper-elektrik/agm/`              | LiFePO₄ oder AGM im Camper              | 06         | `planer_start`        |
| Planen         | `schaltplan camper 12v`                 | `/camper-elektrik/schaltplan/`       | 12-V-Schaltplan zeichnen                | 05 + 08    | `stueckliste_erzeugt` |

**Quality Score** (drei Hebel, alle im Konzept adressiert): Anzeigenrelevanz
durch die Wortstamm-Kette; erwartete CTR durch Titelschärfung anhand echter
Search-Console-Daten statt Annahmen; Zielseiten-Erlebnis durch Ladezeit,
375-px-Parität, ≥ 700 Wörter, keine Interstitials, erreichbares Impressum,
offengelegte Methodik und **keine** unbelegten Versprechen.

**Conversion und Messung**

| Event                 | Auslöser                           | Hinweis                          |
| --------------------- | ---------------------------------- | -------------------------------- |
| `planer_start`        | Klick auf „Schaltplan öffnen“      | primär für „Planen“              |
| `rechner_ergebnis`    | Ergebnis wurde berechnet           | nur bei tatsächlicher Berechnung |
| `bauteil_gesetzt`     | erstes Bauteil im Planer platziert | Engagement, kein Primärziel      |
| `stueckliste_erzeugt` | Stückliste geöffnet                | stärkstes Intent-Signal          |
| `methodik_geoeffnet`  | Verweis auf Methodik/Quellen       | Trust-Signal                     |

- GA4 + Google Ads **ausschließlich nach Einwilligung** (Consent Mode v2, CMP
  vor jedem Tag). Keine Cookies, keine `gclid`-Speicherung ohne Rechtsgrundlage;
  anonymisierte, zustimmungsfreie Reichweitenmessung separat begründen.
- Statischer Export ⇒ clientseitiges Tagging, kein Server-Event, kein
  serverseitiger A/B-Test. `gclid` muss in der URL überleben: keine
  Redirect-Kette, Canonical mit Schrägstrich wie die tatsächliche Adresse
  (`trailingSlash: true`), UTM-Konvention `utm_source=google&utm_medium=cpc&utm_campaign=<gruppe>&utm_content=<variante>`.
- **CSP an zwei Stellen ändern:** `app/layout.tsx` (Meta-CSP) **und**
  `public/_headers` (ADR 0038). Nötig: `script-src` um
  `https://www.googletagmanager.com`, `connect-src`/`img-src` um die
  Google-Analytics-/Ads-Endpunkte. Beide Dateien müssen identisch bleiben, sonst
  greift im Produktionsbetrieb die strengere Regel.
- **Keine dünnen „SEA-Seiten“.** Die 28 vorhandenen Seiten sind die
  Zielseiten; eigene Kurz-Landingpages würden Duplicate Content und dünne Seiten
  erzeugen und den Quality Score senken.

**Anzeigenbeispiele** (Wortstamm, keine Superlative, keine Preisbehauptung):

- „12V Kabelquerschnitt berechnen · Formel, Annahmen, Beispiel“
- „Camper Schaltplan zeichnen · Querschnitt und Absicherung prüfen“
- „Spannungsabfall 12V · Rechenweg und Grenzen nachvollziehen“

**Experimente auf statischem Hosting:** getrennte Adressen mit `noindex` und
Canonical auf die Kontrollvariante oder Google-Ads-Experimente. Kein
JavaScript-Redirect, kein Overlay-Test — beides kostet LCP und Qualität.
Negative Keywords („kaufen“, „reparieren“, „gebraucht“, „Preis“, Marken fremder
Hersteller) gehören in jede Kampagne; Sitelinks auf Methodik, Rechner und
Guides. KPI-Zielwerte (CPA, Conversion Rate) erst nach 28 Tagen Baseline
festlegen, nicht im Konzept erfinden.

---

## 9. Umsetzung in Phasen

| Phase | Inhalt                                                                                             | Dateien / Gates                                                                                                                              |
| ----- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| P0    | Freigabe, Fototermin, Bildrechte, Ads-Konto — **Impressum und Datenschutz erledigt**               | `lib/siteLegal.ts` (befüllt), `app/datenschutz/page.tsx`, `design-2026-11/BILDRECHTE.md`                                                     |
| P1    | Tokens, Bildkomponente, Tests umstellen — **umgesetzt**                                            | `app/globals.css`, `lib/designTokens.test.ts`, `app/page.test.tsx` (Bildverbot → Bildvertrag), `components/brand/ContentImage.tsx` + Test    |
| P2    | Seiten: Hero mit **eigener Fotografie**, Beweisstrecke, Plan ↔ Foto, Bildunterschriften, OG-Karten | `app/page.tsx`, `components/seo/SeoPage.tsx`, `components/seo/PageStructuredData.tsx`, `app/siteMetadata.ts`, `app/sitemap.ts`               |
| P3    | CSP, Tags, Events, Bild-Sitemap                                                                    | `app/layout.tsx`, `public/_headers`, `app/robots.ts` (unverändert)                                                                           |
| P4    | Gates und Vermessung                                                                               | `npm run check`, `npm run build` (`seo:audit`), Lighthouse CI (M11-5), Playwright axe + `reducedMotion`, visuelle Baselines bewusst erneuern |

### Stand P1 (2026-11-02)

Umgesetzt ist ausschließlich das Fundament, noch keine sichtbare
Seitenänderung:

- Neue Tokens in `:root` **und** `.dark`: `--image-outline` (reines
  Schwarz/Weiß, 10 %), `--motion-press` (150 ms), `--motion-swap` (300 ms),
  `--motion-stagger` (100 ms), `--press-scale` (0,96), `--ease-out`,
  `--ease-swap` (`cubic-bezier(0.2, 0, 0, 1)`). Bewacht in
  `lib/designTokens.test.ts`; der Guard verlangt beide Themen und prüft
  `transition-property: scale` statt `all` sowie die Hover-Abfrage.
- `components/brand/ContentImage.tsx` ist die einzige erlaubte Stelle für
  `<img>` in `app/` und `components/`. Sie erzeugt `<picture>` mit zwei
  vorgefertigten AVIF-Varianten, `sizes`, JPEG-Fallback, `alt`, feste
  `width`/`height`, `<figcaption>` und priorisiertes Laden für das LCP-Bild.
  `ContentImage.test.tsx` prüft den Vertrag per RTL **und** verbietet rohe
  Bild-Tags statisch.
- `app/page.test.tsx` prüft statt des Bildverbots einen Bildvertrag: ein H1
  und – sobald Bilder auftauchen – Alt-Text, Maße und Bildunterschrift.
- Bewegungs-Primitives (`.press-scale`, `.hover-row`) liegen hinter
  `prefers-reduced-motion: no-preference` bzw. `@media (hover: hover)`; bei
  reduzierter Bewegung bleibt nur der statische Anker.

**Kein Bild in `public/bilder/`**. Die sechs Motive im Prototyp bleiben
Konzeptplatzhalter (Regel 5 in `BILDRECHTE.md`). Das Hero-Foto aus §4 wird in
P2 eingesetzt, sobald die eigenen Aufnahmen aus
`FOTOMOTIV-KATALOG.pdf` vorliegen und die Rechte dokumentiert sind. Damit
bleibt die Startseite in P1 unverändert rendertreu — die optischen Gates
(Screenshots 375/768/1440, LCP/CLS) gehören deshalb zu P2/P4, nicht zu P1.

### Abnahme-Checkliste

- [ ] Ein H1 je Seite, H2 je Abschnitt, Inhalt ohne JavaScript vollständig.
- [ ] Jedes Inhaltsbild: Alt-Text, `width`/`height`, `<figcaption>`, AVIF + Fallback, beschreibender Dateiname.
- [ ] Hero ist LCP, vorgeladen, ohne Animation; CLS = 0 bei 375 / 768 / 1440 px.
- [ ] Keine Bewegung ohne `prefers-reduced-motion`-Ersatz; kein `transition: all`; kein Bounce; kein GSAP auf Inhaltsseiten.
- [ ] Jeder Zustand hat einen statischen Anker; Fokus überall sichtbar.
- [x] `npm run check`, `npm run build`, `npm run seo:audit` grün; Lighthouse ≥ 90 (Vergleichsseite 99 mit gzip, siehe `design-2026-11/VERIFIKATION-2026-11-03.md`).
- [ ] Acht Impressum-Pixel-Baselines in Linux-CI neu ziehen und optisch freigeben.
- [ ] `ImageObject`, `og:image:alt`, Bild-Sitemap, Canonical, Robots geprüft.
- [x] Impressum eingetragen und `LEGAL_NOTICE_GATE` auf `block` (2026-11-03). **Acht:** Die acht eingefrorenen Pixel-Baselines für `/impressum/` zeigen noch die Platzhalter-Texte und müssen in CI neu gezogen werden.
- [x] Datenschutzerklärung vollständig, keine Cookies/Analyse → kein CMP nötig; Consent Mode v2 erst mit Ads-Tag (`app/datenschutz/page.tsx`, Stand 2026-10).
- [ ] Keyword → Anzeige → H1 → Bildunterschrift → Event je Anzeigengruppe dokumentiert.
- [ ] Prototyp-Platzhalter durch eigene Fotografie ersetzt; `BILDRECHTE.md` vollständig.

---

## 10. Grenzen und offene Entscheidungen

- Die **App-Shell des Planers** und alle elektrischen Regeln bleiben unberührt
  (`AGENTS.md` §5/§6). Dieses Konzept beschreibt die Website, nicht das Werkzeug.
- Bilder und Animationen sind **kein Feature** im Sinne von §8; die Umsetzung
  braucht eine eigene Freigabe und einen eigenen Commit/PR. Die Freigabe für
  P1 (Fundament) liegt vor. Für die sichtbaren Seitenänderungen in P2 fehlen
  noch die eigenen Fotografien; vor deren Commit ist erneut freizugeben.
- Die sechs Bilder im Prototyp sind KI-generierte **Konzeptplatzhalter**. Sie
  zeigen Bildausschnitt, Licht und Tonalität, sind aber ausdrücklich **nicht**
  für die Auslieferung gedacht — gerade weil die Vorgabe „nicht so mega KI“
  echte Fotografie verlangt.
- Zu entscheiden: wer fotografiert, welche Lizenz/Modellfreigabe gilt, welches
  Ads-Konto, ob ein englischer Zweig kommt. Ein CMP wird erst nötig, wenn
  tatsächlich Tracking-Tags gesetzt werden.

**Kein Ranking- und kein CPA-Versprechen.** Dieses Dokument beschreibt
technische und gestalterische Zusagen; Positionen und Kosten entscheidet die
Messung.

---

## 11. Eingearbeitete Anhänge (2026-11-03)

Zwei exportierte Agenten-Sitzungen zum selben Repo sind ausgewertet und auf
diesen Checkout (`af7f646`) abgeglichen worden. Die vollständige Verdichtung mit
Herkunft, Zahlen, Abgleich und den bewusst **nicht** übernommenen Punkten steht
in [`design-2026-11/ANHAENGE-INTEGRATION-2026-11-03.md`](design-2026-11/ANHAENGE-INTEGRATION-2026-11-03.md).

**Anhang A — Nischenforschung und Content-Ausbau.** Vier Nischen mit schwacher
Konkurrenz und Forennachfrage (Wasser, Gas, Dach/Dämmung, Zulassung/Gewicht),
24 Beiträge und drei Hubs in einem _anderen, neueren_ Repo-Stand. Für diese
Konzeptarbeit relevant ist vor allem der **Bildbedarf**: 28 Seiten mit je einem
Hero-Motiv und einem technischen Diagramm, plus 28 OG-Ableitungen. Die
Briefings sind in
[`FOTOMOTIV-ERGAENZUNG-2026-11-03.md`](design-2026-11/FOTOMOTIV-ERGAENZUNG-2026-11-03.md)
übernommen — **bedingt**, denn die Seiten existieren hier nicht. Eigene
Fotografie bleibt Pflicht; KI-Platzhalter werden nicht ausgeliefert.

**Anhang B — Ladebooster-Vergleichsplan.** Gemessener Befund: 6.152 Wörter auf
einer Seite, der Vergleich steht hinter dem Artikeltext, 9 Geräte dreifach
hartcodiert, 0 interne Links in der Vergleichszone, kein `ItemList`/`Product`-
Schema, 1.036 Zeilen CSS global auf jeder Route, sichtbare „Eigenes Foto
folgt"-Platzhalter. Das in §4.1 und §7 beschriebene Prinzip wird dadurch
geschärft: **Vergleich zuerst, Ratgeber darunter**, eine Datenquelle je Gerät,
keine doppelten Fakten, keine Sterne, keine Affiliate-Links, keine
Platzhalter-Bilder. **Umgesetzt am 2026-11-03:** Die Vergleichsseite ist jetzt
fertig ausgebaut — bewusst maßgeschneidert für diese eine Seite, **nicht** als
wiederverwendbares Template. Eine Datenquelle erzeugt Rangliste, neun Karten
und `ItemList`-Schema; Filter und Sortierung wirken auf Tabelle und Karten;
die langen Kapitel sind natives `<details>`; das Stylesheet lädt nur noch auf
dieser Route. Vollständige Aufstellung: `ANHAENGE-INTEGRATION-2026-11-03.md`
§10. Die 24 Inhaltsseiten aus Anhang A bleiben ungebaut.

**Rechtslage (Stand dieses Checkouts, 2026-11-03).** Die Betreiberangaben aus
den Anhängen sind nach Freigabe in `lib/siteLegal.ts` eingetragen, der
Deploy-Wächter steht auf `LEGAL_NOTICE_GATE: block`, und
`app/datenschutz/page.tsx` enthält eine vollständige Erklärung ohne Platzhalter.
Die Seite setzt keine Cookies und kein Tracking — ein CMP ist dafür nicht nötig;
Consent Mode v2 wird erst mit einem Ads-/Analytics-Tag relevant. Die früher
hier wiederholte Warnung „Datenschutz nur Kurzfassung, P0 blockiert" bezog sich
auf den **anderen** Repo-Stand der Anhänge und ist für diesen Baum falsch. Offen
sind Setup und Messung (Ads-Konto, Search Console, Conversion-Events), keine
Rechtstexte. Details: `ANHAENGE-INTEGRATION-2026-11-03.md` §6.

**Grenze der Übernahme.** Beide Sitzungen enden mit einem Fehler bzw. einer
Kompaktierung; in A steht ausdrücklich „nicht committet und nicht gepusht".
Fremde Gate-Ergebnisse („67 Seiten", „3.775 Tests") gelten für den dortigen
Baum, nicht für diesen. Die eigenen Gates aus P1 sind `npm run check` und
`npm run build` (42 geprüfte Seiten), beide grün. Es gibt weiterhin **kein
Ranking-, Traffic- und kein CPA-Versprechen**.

---

## Anhang

- Motivkatalog: [`design-2026-11/FOTOMOTIV-KATALOG.pdf`](design-2026-11/FOTOMOTIV-KATALOG.pdf) · [Markdown-Quelle](design-2026-11/FOTOMOTIV-KATALOG.md) · Erzeuger: `scripts/design/fotomotive.py`
- Anhänge 2026-11-03: [`design-2026-11/ANHAENGE-INTEGRATION-2026-11-03.md`](design-2026-11/ANHAENGE-INTEGRATION-2026-11-03.md) · [`design-2026-11/FOTOMOTIV-ERGAENZUNG-2026-11-03.md`](design-2026-11/FOTOMOTIV-ERGAENZUNG-2026-11-03.md)
- Prototyp: [`design-2026-11/index.html`](design-2026-11/index.html) · Bilder: [`design-2026-11/bilder/`](design-2026-11/bilder/) · Rechte-Vorlage: [`design-2026-11/BILDRECHTE.md`](design-2026-11/BILDRECHTE.md)
- Vorgänger: [`DESIGN-KONZEPT-2026-10.md`](DESIGN-KONZEPT-2026-10.md) · [`DESIGN-GUIDELINES-DOS-DONTS.md`](DESIGN-GUIDELINES-DOS-DONTS.md) · [`DARK-ENGINEERING-DESIGN-SYSTEM.md`](DARK-ENGINEERING-DESIGN-SYSTEM.md)
- SEO: [`seo/ANALYSE-UND-VISION.md`](seo/ANALYSE-UND-VISION.md) · [`seo/AUDIT.md`](seo/AUDIT.md) · [`seo/SEARCH-CONSOLE.md`](seo/SEARCH-CONSOLE.md)
- Skill (exakte Werte): [`.agents/skills/better-ui/SKILL.md`](../.agents/skills/better-ui/SKILL.md), `animations.md`, `surfaces.md`, `icons.md`, `enter-exit.md`, `icon-transitions.md`, `performance.md`
