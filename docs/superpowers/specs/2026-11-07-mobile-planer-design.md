# Mobil-Planer — vier Ansichten, keine überdeckten Bedienelemente

Stand: 2026-11-07 · Bezugscommit: `1cd4f81d` (`main`) · Seite: https://12v-planer.de/planer/

**Status: nur Spezifikation.** Diese Datei ändert keine Anwendung. Umsetzung,
Merge und Deploy warten auf die schriftliche Durchsicht.

## 0. Wie diese Datei zu lesen ist

Zwei Klassen von Aussagen:

- **Freigabe** — von Jonas bestätigte Produktrichtung. Die Umsetzung hält sie
  ein und erfindet sie nicht neu.
- **Vorschlag** — technische Festlegung dieser Spezifikation, damit eine
  Umsetzung ohne zweite Deutung bauen kann. Sie gilt, sobald die Spezifikation
  durchgesehen ist. Abschnitt 13 nennt, was dabei bewusst verworfen wurde.

Nichts in dieser Datei ändert Strom, Querschnitt, Sicherung, Routing, AutoWire,
Validierung oder das Speicherformat. Die Hülle zeigt denselben Plan.

## 1. Freigabe

Auf dem Handy:

1. Der Planer öffnet mit einer lesbaren Bauteilliste, nicht mit der
   überlagerten Zeichenfläche.
2. Es gibt vier getrennte Ansichten: **Bauteile**, **Schaltplan**, **Prüfung**,
   **Mehr**.
3. Bearbeiten eines Bauteils oder einer Leitung füllt den Bildschirm.
4. Kopfzeile und Fußnavigation bleiben kompakt.
5. Der Desktop bleibt, wie er ist.

Erhalten bleiben: der Plan selbst, die Berechnungen, Verbindungen, Rückgängig,
Teilen und Export, Elektrik und Wasser.

## 2. Abgleich Seite und Repository

Die Screenshots (360/390 px, iframe, kein echtes Touch-Gerät) zeigen die
**ausgelieferte** Seite, nicht jeden Stand von `main`.

Gemessen am öffentlichen Bundle `455fnvrvg22jt.js` von
https://12v-planer.de/planer/ am 2026-11-07:

| Sichtbar auf der Seite und in den Screenshots            | Im Bundle                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| „Schritt N von 5 — …“                                    | `data-testid="guided-rail"`, Text `Schritt ${currentStep} von ${steps.length}` |
| Fußleiste Bauteile / Elektrik / Wasser / Details / Fokus | `planner-bottom-nav`                                                           |
| Menü „Fertiges Setup als Startpunkt“                     | `action-templates`, Label „Fertiges Setup als Startpunkt“                      |
| Meldung „Vorlage … geladen.“                             | `planner-action-feedback`                                                      |
| Kennzeichnung „Strompfad“                                | `circuit-trace-info`                                                           |
| Leerer Zustand „Fang mit deiner Batterie an“             | derselbe Text wie `FlowCanvas.tsx`                                             |

`main` (`1cd4f81d`) hat die Schrittleiste in `947bd7de` (2026-11-06) entfernt.
`GuidedPlanRail` kommt im Quelltext nicht mehr vor; `evaluateGuidedSteps`
bleibt eine reine Ableitung (`components/planner/utils/guidedSteps.ts`). Die
übrigen überdeckenden Schichten stehen auf `main` noch:

- Vorlagenmenü als Portal an `document.body`
  (`components/planner/ui/PlannerToolbar.tsx`, `TemplateMenuButton`)
- Aktionsmeldung `position: fixed` (`app/globals.css`, `.planner-action-feedback`)
- Zoom-Controls und Undo/Übersicht als schwebende Griffe
  (`FlowCanvas.tsx` `Controls`, `PlannerInner.tsx` `.planner-mobile-history`)
- Strompfad als schwebendes Panel (`FlowCanvas.tsx`, `circuit-trace-info`)
- Prüfbericht und Warnzentrale als `fixed`-Blätter über der Fußleiste
  (`VerificationSeal.tsx`, `WarningCenter.tsx`, `bottom: calc(9.5rem + safe-area)`)
- Moduszeile Plan / Lage / Prüf plus Erklärung und „Ansicht“ als Canvas-Panels
  (`PlannerModeSwitch`, `CanvasDisplayOptions`, `FloatingMetricsCard`)

Die Schrittleiste wird nicht wieder eingebaut. Ihr Verschwinden auf `main`
behebt die übrigen Überdeckungen nicht. Diese Spezifikation ersetzt auf dem
Handy die ganze schwebende Hülle, nicht nur die Leiste.

Beobachtung ist iframe-Rendering. Abnahme verlangt zusätzlich das
Playwright-Projekt `touch-pixel5` (`hasTouch`). Ein physisches Gerät ist keine
Voraussetzung für die hier definierten Tests und wird auch nicht behauptet.

## 3. Warum die Elemente sich überdecken

Die Handy-Hülle ist unter 768 px eine Zeichenfläche mit mehreren unabhängig
positionierten Schichten in demselben unteren Band:

| Befund                                                      | Mechanismus auf `main`                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vorlagenmenü liegt auf Zoom und Status                      | Unter 768 px ist `.planner-template-sheet` ein `position: fixed`-Blatt über der Fußleiste (`globals.css`, Medienabfrage `max-width: 767px`). Zoom (`.planner-controls`, `!bottom-32`) und die Statuszeile bleiben sichtbar. Die CSS-Regel blendet bei offenem Blatt nur `.planner-mobile-history` aus, nicht Zoom und Status. |
| Toast liegt auf Zoom und Rückgängig                         | `.planner-action-feedback` ist `position: fixed` und auf dem Handy `bottom: calc(Fußleiste + Statuszeile + 4.25rem)`. Das ist dieselbe Fläche wie Undo (`bottom-20`) und Zoom.                                                                                                                                                |
| Strompfad-Banner ist abgeschnitten und liegt auf der Fläche | Das Panel ist `max-w-[min(36rem,calc(100vw-6rem))]` und `bottom-left` im Canvas, neben den schwebenden Griffen. Es teilt sich keinen reservierten Streifen.                                                                                                                                                                   |
| Prüfpanel liegt auf Ablauf und Aktionsleiste                | `.planner-verification-panel` ist auf dem Handy `fixed` mit `max-h: 60dvh` über der Fußleiste, während Moduszeile, Werkzeugleiste und Canvas darunter stehen bleiben.                                                                                                                                                         |
| Werkzeugleisten und Hinweise drängen die Fläche             | Menüleiste, Werkzeugleiste, Moduszeile mit Erklärung, Ansicht, leere Karte, Zoom, Undo, Status und fünf Fußziele sind gleichzeitig montiert.                                                                                                                                                                                  |

Weitere `z-index`-Ausnahmen lösen das nicht. Auf dem Handy gibt es genau eine
bedienbare Fläche. Was nicht zu dieser Fläche gehört, wird nicht gezeichnet.

## 4. Grenze — Vorschlag

Die neue Hülle gilt genau für die Medienabfrage, die der Planer schon als
Handy-Chrome benutzt (`components/planner/PlannerDashboard.tsx`):

```css
(max-width: 767px), (max-height: 500px)
```

| Fenster                           | Hülle                                                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Breite ≤ 767 px                   | neue Vier-Ansichten-Hülle, auch im Hochformat                                                                                                                                              |
| Höhe ≤ 500 px                     | dieselbe Hülle, auch wenn die Breite ≥ 768 px ist (flaches Querformat, schon heute `phoneChrome`)                                                                                          |
| Breite ≥ 768 px und Höhe ≥ 501 px | unverändert: Tablet 768–1279 px Palette plus Canvas, Inspector als Slide-over; ab 1280 px drei Spalten (Palette 248 px, Canvas mindestens 600 px, Eigenschaften 288 px, ab 1536 px 320 px) |

`md:` in diesem Projekt ist 768 px. Die Fußleiste ist heute `md:hidden`. Die
neue Grenze führt keine zweite Breakpoint-Zahl ein.

Beim Überqueren der Grenze schließt die Handy-Ebene (Liste, Katalog, Detail,
Dialog). Der Store bleibt. Ab 768 px und 501 px Höhe gelten wieder die
bestehenden Spalten und der bestehende Inspector-Zustand. Zurück auf dem Handy
ist die Ansicht **Bauteile**, ohne hängende Ebene.

Solange `matchMedia` noch nicht gelaufen ist, bleibt der erste Client-Render
die Desktop-Hülle (`phoneChrome` startet als `false`). Das ist der bestehende
Vertrag der Unit-Tests und bleibt.

## 5. Hülle — Vorschlag

Eine Spalte, `100dvh`, `overflow: hidden`, Klasse `planner-root-active` wie
heute. Dokument und `body` scrollen nicht.

```
Kopfzeile          eine Zeile, 48 px, plus safe-area-inset-top
Ansicht            genau eine der vier Ansichten, füllt den Rest
Meldungsplatz      im Fluss, Höhe 0 wenn leer, sonst höchstens 4,5 rem
Fußnavigation      56 px plus safe-area-inset-bottom, vier Ziele
```

Die Zeichenfläche (`FlowCanvas` / React Flow) bleibt montiert und im Layout,
auch wenn eine andere Ansicht darüber liegt (`absolute`, volle Fläche, darunter,
`inert` und `aria-hidden`). Sie wird nicht mit `display: none` aus dem Layout
genommen: ein Aushängen verliert die gemessene Pane-Größe (Kommentar in
`PlannerInner.tsx`, früher `PANE_WAIT_FRAMES`). Schwebende Canvas-Chrome wird
trotzdem nur in der Ansicht **Schaltplan** erzeugt: Controls, MiniMap,
Modus-Panel, Ansicht-Panel, Messwertkarte, Strompfad-Panel,
`.planner-mobile-history`, Verbindungs-Toast im Canvas, Experten-FAB.

### 5.1 Kopfzeile

Eine Zeile:

- links der bestehende Home-Verweis, Ziel 44 × 44 px
- mittig der bestehende Projektname („Elektrikplan“ oder „Wasserplan“),
  eine Zeile, abgeschnitten
- rechts nur die bestehende `SaveIndicator`-Anzeige (Symbol, `role="status"`,
  kein Knopf, kein Menü)

Kein „Menü“, kein „Vorlage laden“, kein „⋯“, kein zweiter Teilen-Knopf, keine
Prüfplakette. Die Aktionen stehen in **Mehr**.

### 5.2 Fußnavigation

`nav`, `aria-label="Planerbereiche"`, vier Knöpfe, jeder mindestens 56 × 44 px
(Breite flexibel, Höhe 56 px im Hochformat):

| Sichtbares Label | Ansicht                    | `data-testid`        |
| ---------------- | -------------------------- | -------------------- |
| Bauteile         | gesetzte Bauteile          | `nav-tab-bauteile`   |
| Schaltplan       | Zeichenfläche              | `nav-tab-schaltplan` |
| Prüfung          | Prüfbericht                | `nav-tab-pruefung`   |
| Mehr             | Aktionen und Einstellungen | `nav-tab-mehr`       |

Der aktive Eintrag hat `aria-current="page"`. Die Knöpfe sind keine
`aria-expanded`-Blätter mehr. Elektrik/Wasser, Details und Fokus sind keine
Fußziele. Der Fußknopf **Prüfung** trägt, wenn die bestehende Zahl kritischer
Befunde größer als 0 ist, dieselbe Zahl als Badge und im `aria-label`. Das
ersetzt die Statuszeile, die es in der Handy-Hülle nicht mehr gibt.

Die Leiste bleibt sichtbar, außer ein Detailbildschirm, die Hilfe-Ebene oder
ein modaler Dialog ist offen (Abschnitt 7), oder der Fokusmodus auf dem
Schaltplan blendet sie aus. Dann ist sie `inert`. Der Fokusmodus blendet den
Meldungsplatz sichtbar aus; die Live-Region bleibt als 1-px-Bereich im
Zugänglichkeitsbaum, damit Ansagen nicht verloren gehen, und schneidet den
Beenden-Knopf nicht.

### 5.3 Meldungsplatz

Genau eine Meldung, im Fluss zwischen Ansicht und Fußleiste, nicht
`position: fixed`.

- Leer: Höhe 0, kein Abstand.
- Belegt: die Meldung schiebt die Ansicht nach oben. Sie schneidet Zoom,
  Rückgängig, Status, Fußleiste und Listenzeilen nicht.
- Höchstens 4,5 rem, danach scrollt der Text in der Meldung
  (`overscroll-behavior: contain`). Schließen-Knopf mindestens 44 × 44 px.
- Eine Live-Region: `role="status"` und `aria-live="polite"`, bei Fehlern
  `role="alert"` und `aria-live="assertive"`. Dieselbe Region, die heute
  `action-feedback` und die Einstiegsmeldung speisen.
- Während ein modaler Dialog offen ist, wird die Meldung nicht gezeichnet.
  Der Text bleibt gespeichert und erscheint im Platz, wenn der Dialog zu ist.
  Es gibt keine zweite Meldung und keine Warteschlange über eine hinaus; eine
  neue Meldung ersetzt die wartende.
- Der Platz nimmt keine Zeigerereignisse an, außer seinem Schließen-Knopf.

Verbindungshinweise („Erster Anschluss gewählt …“) benutzen denselben Platz.
Der Canvas-eigene Block `.planner-mobile-feedback` entfällt auf dem Handy.

## 6. Die vier Ansichten — Vorschlag

Gemeinsam: die aktive Ansicht füllt die Fläche unter dem Kopf. Ihre eigene
Scroll-Fläche hat `overscroll-behavior: contain` und `min-width: 0`. Kein
waagerechter Dokument-Scroll (`scrollWidth <= clientWidth + 1`).

Auswahl im Store (`selectedNodes`, `selectedEdges`, `focusElement`) bleibt die
einzige Auswahl. Die Ansichten lesen sie und schreiben sie. Sie führen keine
zweite Auswahl.

### 6.1 Bauteile — Startansicht

Erste Ansicht nach dem Laden, nach dem Schließen der Einführung und nach dem
Laden einer Vorlage.

Oben die **gesetzten** Bauteile des aktiven Planbereichs (`viewMode`):

- Zeile je Knoten: bestehende Kennung (dieselbe Bezeichnung wie auf der Karte)
  und der Typname. Keine neue Benennung, keine neu gerechneten Werte.
- Hat der Knoten einen Befund mit `focusType: "node"` und passender `focusId`,
  zeigt die Zeile nur die bestehende Stufe (kritisch / Warnung / Hinweis),
  nicht einen zweiten Warntext.
- Leitungen stehen in derselben Liste darunter, Zeile je Kante des Bereichs,
  Bezeichnung wie im bestehenden Leitungs-Inspektor.
- Die Zeile der Store-Auswahl ist markiert (`aria-selected`) und liegt im
  sichtbaren Scrollbereich, wenn die Ansicht geöffnet wird.
- Antippen oder Enter öffnet das Detail dieses Elements und lässt die Auswahl
  stehen.
- Leerer Plan: der bestehende Text „Fang mit deiner Batterie an“ und der Knopf
  „Batterie hinzufügen“. Der Knopf startet den Hinzufügen-Fluss mit dem
  Batterie-Typ, nicht die Zeichenfläche.

Darunter ein Knopf **Hinzufügen** (mindestens 44 px hoch). Er öffnet den
bestehenden Katalog (`Sidebar` / `useComponentCatalog`) als eigene volle
Ebene, gefiltert auf `viewMode`. Suche, Kategorien und Tastatur
(Pfeile, Enter) bleiben. Escape im Suchfeld mit Text leert nur die Suche
(`SidebarSearch`). Escape bei leerer Suche schließt den Katalog. Eine Katalogzeile fügt wie
heute am sichtbaren Mittelpunkt ein (`addAtVisibleCenter` /
`planner-add-at-canvas-center`). Danach:

1. Der neue Knoten ist ausgewählt.
2. Das Detail dieses Knotens ist offen.
3. Zurück aus dem Detail landet auf **Bauteile**, nicht auf dem Katalog und
   nicht auf dem Schaltplan.

Zurück aus dem Katalog ohne Hinzufügen landet auf **Bauteile**.

Der Katalog ist auf dem Handy keine zweite Spalte und kein Blatt über der
Zeichenfläche. Ab der Desktop-Grenze bleibt er die bestehende Spalte.

### 6.2 Schaltplan

Die bestehende Zeichenfläche, ohne schwebende Werkzeuge.

Werkzeugzone **im Fluss** über der Fläche, nicht darüber liegend:

- Hochformat, zwei Zeilen: (1) Rückgängig, Wiederholen, Zoom minus, Zoom-Prozent
  aus dem React-Flow-Transform, Zoom plus, Gesamtübersicht. (2) Elektrik |
  Wasser und Plan | Lage | Prüf (`PlannerModeSwitch`, bestehende Modi).
- Querformat mit Höhe ≤ 500 px: eine Zeile, waagerecht scrollbar, jedes Ziel
  mindestens 44 × 44 px. Die Zeile scrollt in sich. Ein Ziel darf außerhalb des
  ersten Blickfelds liegen, muss aber durch Scrollen der Zeile erreichbar sein
  und dann `elementFromPoint` bestehen.
- „Darstellung“ (Domänen, Stamm, Detailgrad — heute `CanvasDisplayOptions`) ist
  ein zugeklappter Bereich in dieser Zone. Aufklappen vergrößert die Zone im
  Fluss und verkleinert die Fläche. Es ist kein `fixed`-Popover.
- Die Modus-Erklärung (`planner-mode-caption`) ist eine Zeile in der
  Werkzeugzone, gekürzt mit `ellipsis`, der volle Satz im `title` und
  `aria-label`. Kein schwebendes Kärtchen.

Die React-Flow-`Controls` und die MiniMap werden unter der Handy-Grenze nicht
gerendert. Zoom und Übersicht sind die Knöpfe der Werkzeugzone
(`planner-fit-view`, bestehendes Ereignis). Der Fokusmodus ist ein Knopf in
dieser Zone, nicht in der Fußleiste: er blendet Kopf, Werkzeugzone und
Fußleiste aus und zeigt den bestehenden `focus-mode-exit`. Escape beendet ihn,
wie heute. Ein zweites Antippen im Fokusmodus öffnet das Detail und beendet
den Fokusmodus, damit Zurück eine sichtbare Kopfzeile hat.

Strompfad (`traceLabel`): eine Zeile im Fluss unter der Werkzeugzone, gekürzt.
„Weiter“ klappt bis vier Zeilen im Fluss auf. Kein Panel auf der Fläche.

Leerer Zustand bleibt die bestehende Karte **innerhalb** der Pane. Die Pane
endet über Meldungsplatz und Fußleiste.

Verbindungen auf dieser Ansicht, unverändert in der Logik:

- Tippen auf Anschlüsse über `useSequentialTapConnect` (zwei Schritte, Abbruch
  durch erneutes Tippen, Rückmeldung im Meldungsplatz).
- Ziehen eines Anschlusses bleibt für Zeiger mit Maus erlaubt; Touch benutzt
  den bestehenden Tap-Pfad (`connectOnClick` bleibt `false`).
- `isValidConnection` und `onConnect` bleiben die einzigen Prüfungen.
- Verlässt die Ansicht den Schaltplan, wird `firstTappedHandle` geleert, damit
  kein halber Verbindungszustand in der Liste weiter gilt.
- Antippen der Knoten- oder Kantenfläche wählt das Element und öffnet nicht
  das Detail. Ein zweites Antippen des bereits ausgewählten Elements öffnet
  das Detail mit `returnView` **Schaltplan**. Anschlüsse (`react-flow__handle`)
  starten weiterhin nur den Verbindungsschritt und öffnen kein Detail.

Wasser: der Segmentknopf schreibt `setViewMode('water' | 'electric')`. Dieselbe
Umschaltung filtert **Bauteile**. Auto-Verbinden bleibt im Elektrikplan; im
Wasserplan bleibt der bestehende Hinweis, dass Wasser von Hand verbunden wird.
Der Knopf dafür steht in **Mehr**, nicht als zweite Leiste auf der Fläche.

### 6.3 Prüfung

Volle Ansicht, kein Blatt über dem Schaltplan.

Inhalt aus den bestehenden Quellen, eine Rechnung:

- `verificationSummary` und `nextStepSummary` (dieselbe `useVerificationReport`-
  Ableitung wie das Dashboard)
- die Warnliste, die `WarningCenter` schon aus `useLiveValidation` baut,
  inklusive Trassenbefunde im Elektrikplan (`includeRouting`)
- Wasser: nur die bestehenden Wasser-Hinweise, keine Elektrik-Befunde
  (der Dashboard-Kommentar B-12 bleibt gültig)

„Im Schaltplan zeigen“ ruft das bestehende `focusElement(focusId, focusType)`
und wechselt danach auf **Schaltplan**. Befunde ohne `focusId` haben diesen
Knopf nicht. Die Ansicht rechnet nichts nach und formuliert keine Norm.

Der Anzeigemodus „Prüf“ (`plannerMode === 'pruefung'`) bleibt, was er ist: eine
Darstellung auf dem Schaltplan (markieren / abdunkeln), dokumentiert in
`PlannerModeSwitch.tsx`. Er ist nicht diese Ansicht. Die Fußansicht heißt
**Prüfung** und zeigt den Bericht. Der Segmentknopf auf dem Schaltplan behält
die kurzen Wörter Plan / Lage / Prüf.

### 6.4 Mehr

Die einzige Stelle für Plan-Aktionen. Quelle bleibt `usePlannerActions`
(dieselben Handler, dieselben `data-testid`s). Sichtbar ist auf dem Handy genau
ein Vorkommen jedes dieser Knöpfe, und zwar hier:

- Vorlage laden: die drei `PLANNER_TEMPLATES`, im Fluss, mit der bestehenden
  Rückfrage, wenn der Plan nicht leer ist. Nach dem Laden: Ansicht **Bauteile**
  und die bestehende Erfolgsmeldung im Meldungsplatz.
- Auto-verbinden (Vorschlag prüfen), Plan ordnen, Kabel optimieren, Plan prüfen
  (wechselt nach dem Lauf auf **Prüfung**), Aufräumen.
- Stückliste, PNG-Export, Link kopieren, Projekt speichern (.json), Projekt
  öffnen (.json), neuen leeren Plan starten.
- Jahreszeit, Hilfe und Fachwissen (bestehendes Experten-Panel als volle Ebene,
  nicht als FAB), Tastaturkürzel, Einführung erneut, Impressum, Datenschutz,
  Build-Kennung.

„Plan prüfen“ öffnet nicht zusätzlich die Warnzentrale als Blatt. Die
Warnzentrale ist diese Ansicht. `openWarnings` auf dem Handy setzt die Ansicht
**Prüfung**.

Stückliste, AutoWire-Rückfrage, Tastaturkürzel, Bestätigen und Einführung sind
modale Dialoge (bestehende Komponenten). Sie öffnen erst, wenn Katalog und
Detail zu sind. Danach ist der Dialog die einzige Ebene.

## 7. Ebenen — Vorschlag

Gleichzeitig ist genau eine Ebene sichtbar und bedienbar. Alles andere ist
ausgeblendet und `inert`.

| Ebene   | Wann                                                                                           | Zurück / Escape                                                                         |
| ------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| keine   | eine der vier Ansichten                                                                        | —                                                                                       |
| Katalog | Hinzufügen, oder „Batterie hinzufügen“ im leeren Plan                                          | Bauteile, Fokus auf dem Auslöser                                                        |
| Detail  | Zeile in Bauteile, Enter, zweites Antippen auf dem Schaltplan, oder direkt nach dem Hinzufügen | `returnView`: Bauteile nach Liste oder Hinzufügen, Schaltplan nach dem zweiten Antippen |
| Hilfe   | „Hilfe & Fachwissen“ in Mehr                                                                   | Mehr, Fokus auf dem Auslöser                                                            |
| Dialog  | Bestätigung, Stückliste, AutoWire-Prüfung, Kürzel, Einführung                                  | schließt nur den Dialog                                                                 |

„Im Schaltplan zeigen“ in **Prüfung** öffnet kein Detail. Es setzt die Auswahl
und wechselt auf **Schaltplan**.

Gleichzeitig ist nur eine Ebene bedienbar und sichtbar. Ein Dialog merkt sich
die Ebene darunter (Detail oder Ansicht), blendet sie aus und stellt sie bei
Abbruch wieder her. Zwei sichtbare Blätter übereinander gibt es nicht.

Die Vorlage-Rückfrage startet aus **Mehr**. Katalog und Detail sind dann
bereits zu.

Detail:

- Füllt den Bildschirm inklusive Kopf und Fuß. Eigener Kopf: Zurück (44 × 44 px,
  `aria-label="Zurück"`), Titel aus der bestehenden Inspektor-Überschrift.
- Inhalt ist `PlannerInspector` für die aktuelle Auswahl, unverändert in den
  Feldern. Elektrik- und Wasser-Inspektoren bleiben die bestehenden.
- Fokus springt auf Zurück. Escape und Zurück schließen, stellen den Fokus auf
  das auslösende Element und lassen die Store-Auswahl stehen.
- Ein Eingabefeld scrollt in der Detail-Fläche (`overscroll-behavior: contain`).
  Ist die visuelle Tastatur offen (`visualViewport.height` mindestens 80 px
  kleiner als `window.innerHeight`) und der Fokus liegt in einem Feld, wird die
  Fußleiste `inert` und die Scrollfläche um die verdeckte Höhe ergänzt, sodass
  das Feld über der Tastatur liegt. Nach dem Blur ist die Fußleiste wieder da.
- Löschen im Detail benutzt die bestehende Bestätigung. Der Dialog ersetzt das
  Detail für die Dauer der Frage. Abbruch kehrt zum Detail zurück. Bestätigung
  löscht, schließt das Detail und kehrt zu `returnView` zurück.

Auswahl über die Ansichten:

- Zeile in **Bauteile** setzt die Store-Auswahl.
- Knoten oder Kante auf dem Schaltplan setzt dieselbe Auswahl. Wechsel zu
  **Bauteile** markiert die Zeile und scrollt sie ins Blickfeld.
- Wechsel zu **Schaltplan** mit genau einem ausgewählten Element ruft
  `focusElement` erneut. Der Store markiert es und sendet das bestehende
  Ereignis `planner-focus-element`; `FlowCanvas` zentriert darauf mit
  `setCenter`. `planner-fit-view` bleibt die Gesamtübersicht und ist nicht
  dieser Schritt. Die Auswahl wird dabei nicht geleert.
- Klick auf die leere Pane leert die Auswahl, wie heute.
- **Prüfung** ändert die Auswahl nur über „Im Schaltplan zeigen“.

## 8. Safe Area, Scroll, Fokus

- Kopf: `padding-top: env(safe-area-inset-top)`, seitlich die seitlichen Insets.
- Fuß: `padding-bottom: max(0.25rem, env(safe-area-inset-bottom))`, wie die
  bestehende `.planner-bottom-nav`.
- Meldungsplatz und Werkzeugzone liegen oberhalb der Fußleiste, also oberhalb
  des Home-Indikators.
- Jede scrollende Ebene (Liste, Katalog, Detail, Prüfung, Mehr, Dialog,
  Meldung) hat `overscroll-behavior: contain`.
- Tab-Reihenfolge auf einer Ansicht: Kopf (Home), Inhalt, Meldungs-Schließen
  falls vorhanden, Fuß. Detail und Dialog haben ihre eigene Reihenfolge und
  eine Fokusfalle über `inert` auf dem Rest.
- Ziele mindestens 44 × 44 px, außer den bestehenden Desktop-Kontrollen
  außerhalb der Handy-Grenze. Die alte Ausnahme „Werkzeugleiste 34 px im
  flachen Querformat“ gilt für die neue Zeile nicht.
- `prefers-reduced-motion`: Ansichtswechsel ohne Verschiebung, nur Deckkraft,
  höchstens 150 ms. Die Ansicht ist auch ohne Animation erkennbar (aktiver
  Fußeintrag, Überschrift).
- Hover-Stile nur unter `@media (hover: hover)`.

## 9. Was sich am Desktop nicht ändert

Für Breite ≥ 768 px und Höhe ≥ 501 px bleiben Mount, Klassen und Sichtbarkeit:

- Menüleiste mit den sechs Menüs
- Werkzeugleiste inklusive Vorlage-Dropdown, Teilen, Auto-Verbinden, Prüfen,
  Stückliste, Export, Elektrik/Wasser ab `md`, `⋯`
- Palette als Spalte, Inspector als Slide-over bzw. ab 1280 px als Spalte
- Canvas-Controls, MiniMap ab `lg`, Modus-Panel, Ansicht-Panel
- keine Vier-Ansichten-Fußleiste (`md:hidden` bleibt das Mittel, sie nicht zu
  zeigen)
- `SaveIndicator`, Warnzentrale und Prüfsiegel an ihren heutigen Plätzen

Geteilte Komponenten dürfen verzweigen, aber der Zweig außerhalb der
Handy-Abfrage rendert das heutige Markup. Tests, die ohne `matchMedia`-Treffer
laufen, sehen die Desktop-Hülle.

## 10. Bewusst außerhalb

- Keine Änderung an `lib/electrical*`, `lib/vde-standards`, `lib/shortCircuit`,
  `lib/acProtection`, `lib/routing/**`, `lib/autoWire/**`, Validierung,
  `store/slices/persistence.ts`, `lib/nodeSchema.ts`.
- `evaluateGuidedSteps` bleibt. Die Schrittleiste kommt nicht zurück. Der
  nächste Schritt erscheint nur als der bestehende Satz aus `nextStepSummary`
  in **Prüfung**.
- Kein PWA, kein Multi-Plan, keine neue Berechnung, keine neue Normformulierung.
- Keine zweite Speicher- oder Teilen-Aktion im Kopf.
- Kein Refactor der Desktop-Leisten, der Token oder der z-Skala über das
  hinaus, was die Handy-Hülle braucht. Neue Schichten benutzen die bestehenden
  Stufen `--z-canvas` bis `--z-toast`.

## 11. Abnahme

Neu: `tests/e2e/mobile-views.spec.ts`. Bestehende Handy-Tests, die die fünf
Fußziele, das schwebende Vorlagenblatt oder die schwebenden Griffe festschreiben
(`mobile-geometry.spec.ts`, `ui-audit-overlaps.spec.ts`, `responsive.spec.ts`,
`PlannerInner.test.tsx`), werden auf diesen Vertrag umgeschrieben. Kein
`skip`, kein Löschen eines Asserts ohne Nachfolger.

Hilfsmittel in den Tests: `elementFromPoint` in der Mitte jedes sichtbaren
Bedienelements muss dieses Element oder sein Kind treffen. Zwei Bedienelemente
schneiden sich nicht, außer ein Element enthält das andere. `scrollWidth` des
Dokuments ist `clientWidth` (±1 px).

Fenster, alle in Chromium, zusätzlich einmal im Projekt `touch-pixel5`:

| Name          | Breite × Höhe |
| ------------- | ------------- |
| schmal        | 360 × 780     |
| mittel        | 390 × 844     |
| breit         | 430 × 932     |
| quer          | 844 × 390     |
| quer-gemessen | 852 × 393     |

Tastatur läuft auf 390 × 844 mit Fokus, ohne Mauszeiger, plus der bestehende
`planner-keyboard.spec.ts` auf dem Desktop unverändert.

| ID    | Prüfung                                                                                                                                                                                                                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AT-1  | Nach Laden und Schließen der Einführung ist **Bauteile** aktiv, die Liste der gesetzten Bauteile lesbar, Zeilen mindestens 44 px, kein waagerechter Überlauf.                                                                                                                                                                                                 |
| AT-2  | In jeder der vier Ansichten liegt höchstens eine bedienbare Fläche. Fuß und Kopf schneiden keine Zeile und keinen Canvas-Knopf.                                                                                                                                                                                                                               |
| AT-3  | Vorlage aus **Mehr** laden. Die Ansicht wechselt auf **Bauteile**. Es gibt kein schwebendes `role="menu"`. Die Erfolgsmeldung liegt im Meldungsplatz und schneidet keine Listenzeile und nicht die Fußleiste. Danach **Schaltplan**: `elementFromPoint` auf Zoom plus trifft Zoom plus, die Meldung schneidet die Werkzeugzone nicht.                         |
| AT-4  | Strompfad nach Auswahl eines Bauteils auf dem Schaltplan ist eine Zeile im Fluss, vollständig im Fenster, schneidet Zoom und Rückgängig nicht.                                                                                                                                                                                                                |
| AT-5  | **Prüfung** zeigt den Bericht in der Ansicht, nicht als `fixed`-Panel. Die Fußleiste bleibt treffbar. „Im Schaltplan zeigen“ setzt die Store-Auswahl und wechselt die Ansicht.                                                                                                                                                                                |
| AT-6  | Auswahl in **Bauteile**, Detail öffnet volle Fläche (Kopf und Fuß `inert`), Zurück kehrt zur Liste zurück, Auswahl bleibt, **Schaltplan** zeigt dasselbe Element zentriert.                                                                                                                                                                                   |
| AT-7  | Auf einem geleerten Plan „Batterie hinzufügen“: Katalog, neues Element ausgewählt, Detail offen. Zurück zeigt die Liste mit dieser Zeile. Einmal Rückgängig entfernt genau dieses Element, die Liste ist leer.                                                                                                                                                |
| AT-8  | Zwei Anschlüsse auf dem Schaltplan per Tap verbinden erzeugt eine Kante. Die Rückmeldung liegt im Meldungsplatz. Ungültige Verbindung erzeugt keine Kante und erklärt es im selben Platz.                                                                                                                                                                     |
| AT-9  | Elektrik/Wasser wechselt den Planbereich. Die Bauteilliste zeigt nur den aktiven Bereich. Auto-Verbinden im Wasserplan verändert den Elektrikplan nicht.                                                                                                                                                                                                      |
| AT-10 | Sichtbare Knöpfe für Teilen, JSON speichern, JSON öffnen, PNG und Stückliste: jeweils genau einer, alle in **Mehr**. Der Kopf enthält `save-indicator` und keinen dieser Knöpfe.                                                                                                                                                                              |
| AT-11 | Während ein Dialog offen ist, ist die Meldung nicht sichtbar und kein zweiter Dialog offen. Nach dem Schließen erscheint eine wartende Meldung im Platz.                                                                                                                                                                                                      |
| AT-12 | Tastatur: Tab läuft Kopf → Ansicht → Fuß. Enter auf einer Zeile öffnet das Detail. Escape schließt nur die oberste Ebene, außer im Katalog-Suchfeld mit Text: dort leert es nur die Suche. In einem Detail-Feld löscht Escape nicht das Element.                                                                                                              |
| AT-13 | Querformat 852 × 393: Werkzeugzeile scrollbar, jedes Ziel nach dem Scrollen treffbar, Canvas-Höhe größer als 96 px, kein Griff bei y < 0.                                                                                                                                                                                                                     |
| AT-14 | Touch-Projekt: die vier Fußziele und „Hinzufügen“ lassen sich mit Touch auslösen. `:hover` bleibt nicht als dauerhaft gedrückter Zustand stehen.                                                                                                                                                                                                              |
| AT-15 | Tastatur offen (Viewport-Höhe künstlich um ≥ 80 px verringert, Fokus im Detail-Feld): das Feld liegt oberhalb der verdeckten Zone, die Fußleiste ist `inert`.                                                                                                                                                                                                 |
| AT-16 | Desktop 1440 × 900 und Tablet 768 × 1024: keine Vier-Ansichten-Fußleiste, Menüleiste und Werkzeugleiste sichtbar, Inspector-Vertrag aus `PlannerInner.test.tsx` (Spalte ab 1280, Slide-over darunter) bleibt. Pixel-Lauf `visual.spec.ts` für `/planer/` wird nur neu aufgenommen, wenn sich am Desktop-Bild etwas ändert; die Erwartung ist: keine Änderung. |

`npm run check` bleibt das Gate der Umsetzung. Diese Spezifikation selbst fordert
keinen Routing-Audit und keinen Golden-Master-Recapture, weil Rechnung und
Geometrie der Leitungen nicht geändert werden. Ein Recapture wäre ein Befund,
dass die Umsetzung die Grenze verlassen hat.

## 12. Umsetzungshinweis, noch nicht beauftragt

Erst nach Durchsicht dieser Datei, in einem eigenen Änderungssatz, ohne
Nebenrefactors:

- `components/PlannerInner.tsx` — Handy-Ansicht und Ebenen
- `components/planner/PlannerDashboard.tsx` — unter der Handy-Abfrage die
  kompakte Kopfzeile statt Menü- und Werkzeugstapel; Meldungsplatz
- `components/planner/ui/PlannerToolbar.tsx` — unter der Abfrage nicht die
  schwebenden Menüs rendern
- `components/planner/FlowCanvas.tsx` — Canvas-Chrome nur im Schaltplan
- `app/globals.css` — Handy-Regeln der neuen Hülle; die Sonderfälle, die nur
  schwebende Griffe vor Blättern retten, entfallen mit den Griffen
- neue Ansichtsmodule nur als Zusammensetzung bestehender Teile (Katalog,
  Inspektor, Warnliste, Aktionsliste)
- E2E wie Abschnitt 11

Nicht anfassen: die in `AGENTS.md` §6 gesperrten Module.

## 13. Verworfene Alternativen

- **Nur die z-Reihenfolge der heutigen Blätter sortieren.** Verworfen. Die
  Screenshots sind die Folge mehrerer fester Schichten im selben Band. Eine
  weitere Ausnahme in `globals.css` rückt die nächste Schicht nach.
- **Die Vier-Ansichten-Hülle bis 1279 px.** Verworfen. Überdeckungen sind am
  Handy gemessen. Ab 768 px und 501 px Höhe ist die Hülle schon Spalte plus
  Slide-over. Die Freigabe lässt den Desktop unverändert; das Tablet hängt an
  derselben bestehenden Hülle.
- **Zeichenfläche auf dem Handy aushängen.** Verworfen. Die Pane-Messung geht
  verloren, Hinzufügen und Verbinden landen falsch.
- **Bauteile nur als Katalog der Typen.** Verworfen. Eine lesbare Liste der
  Anlage und eine gemeinsame Auswahl brauchen die gesetzten Knoten. Der Katalog
  bleibt der Hinzufügen-Schritt.
- **Fünftes Fußziel Wasser oder Fokus.** Verworfen. Vier Ansichten sind
  freigegeben. Wasser ist der Planbereich im Schaltplan und in der Liste. Fokus
  ist ein Knopf auf dem Schaltplan.

## 14. Offene Punkte

Keine offene Produktfrage blockiert die Durchsicht. Die Festlegungen der
Abschnitte 4 bis 8 sind die Vorschläge, die mit der Freigabe umgesetzt werden
sollen. Wer die Tablet-Grenze oder die Bedeutung des Wortes „Prüfung“ anders
will, widerspricht Abschnitt 4 bzw. 6.3 in der Durchsicht; still gilt der
Text hier.

## 15. Grobe Schätzung

**Grobe Schätzung, keine Zusage und keine Terminangabe.**

Eine Hüllen-Änderung: Ansichtszustand unter der bestehenden Medienabfrage,
kompakter Kopf, vier Fußziele, Detail und Katalog als volle Ebenen,
Meldungsplatz im Fluss, Canvas-Chrome nur im Schaltplan, E2E-Vertrag aus
Abschnitt 11. Keine Elektro-, Routing- oder Speicheränderung.

Der empfindliche Punkt ist die montierte, aber inerte Zeichenfläche: sie muss
ihre Größe behalten, ohne dass ihre alten Griffe Zeigerereignisse fangen.
