# Routing-Audit Elektroplaner — 2026-10-24

**Repository:** `caze7/camp`
**Basis:** `main` @ `343962d2d733882280b2688d39e15714816212b9` (Merge PR #560, 2026-10-23)
**Auditor:** Qoder
**Art:** Read-only-Audit — **keine Änderung am Produktivcode**
**Umfang:** Globale Kabeltrasse (`routeAllCables`), Pfadsuche (`findCablePath`),
Final-Validierung und Veröffentlichung, Routing-Regeln, Routing-Gates,
Performance-Pfad, betroffene UI-Anbindung.

---

## 0. Management Summary

Die sechs Referenzpläne sind aktuell vollständig grün: **I1–I7 = 0, Fallback = 0,
deterministisch**, Golden Master 13/13, Regression 68/68, Unit-Suite 3751/3752.
Das ist eine belastbare Rückfallsperre für die bekannten Pläne.

Dieses Audit zeigt aber, dass diese grüne Zahl **schmaler ist als sie wirkt**.
Drei Defekte sind im Produktivpfad reproduzierbar:

1. **Hängekanten** (ein Endpunkt fehlt oder hat keine Geometrie) werden nicht
   übersprungen, sondern zum Canvas-Ursprung `(0,0)` geroutet. Die Route ist
   geometrisch unsinnig, erzeugt Selbstüberdeckungen und beeinflusst als
   Phantom-Trasse die nachfolgenden Leitungen sowie die geschätzte Kabellänge.
2. **Unbekannte Handles** werden still auf das erste Handle der Gruppe gebogen.
   Die Leitung hängt damit an einem anderen elektrischen Anschluss als
   angefordert; der Live-Report meldet trotzdem `VALID`.
3. **Der Live-Report nutzt einen schwächeren Validator als CI und Optimierer.**
   `ROUTE-MISSING`, `ROUTE-SHAPE`, `ROUTE-INPUT` und `ROUTE-OWN-NODE` werden im
   normalen Routinglauf nicht veröffentlicht. Eine fehlende Route gilt dort
   sogar als `VALID`. Die UI-Anbindung für diese Befunde existiert bereits,
   bekommt aber nie Daten.

Dazu kommen eine **Qualitätslücke im Perf-Gate** (der 134-Kanten-Stressplan
liefert 37 × I1, 599 × I2 und 2.239 × I3, das Gate prüft nur die Zeit und ist
grün), eine **nicht an den gemeinsamen Port gebundene Port-Bündel-Ausnahme**
(I2 kann echte Überdeckungen übersehen) und der **Same-Point-Widerspruch**
(ein Ein-Punkt-Pfad ist in der Pfadsuche „valide“, im Final-Gate aber `INVALID`).

Die dokumentierten offenen Punkte **ROUTE-001, ROUTE-002, ROUTE-003, ROUTE-009,
ROUTE-013-Rest und ROUTE-006** wurden gegengeprüft; sie bestehen unverändert
bzw. im dokumentierten Teilstatus. Besonders relevant bleibt **ROUTE-003**:
Die 24-px-Domänenregel wirkt im Trenngang, aber nicht in der I3-Invariante und
nicht als CI-Gate; gemessen bleiben **8 parallele Mischpaare unter 24 px**
(engstes 12 px).

### Befundübersicht

| ID   | Schwere    | Kurzbefund                                                                    | Status                  |
| ---- | ---------- | ----------------------------------------------------------------------------- | ----------------------- |
| B-01 | **Hoch**   | Hängekanten/geometrielose Endpunkte routen nach `(0,0)`                       | bestätigt, reproduziert |
| B-02 | **Hoch**   | Unbekannter Handle fällt still auf erstes Handle; Live-Report `VALID`         | bestätigt, reproduziert |
| B-03 | **Hoch**   | Live-Validierung nutzt schwachen Validator; Vertragsverstöße fehlen           | bestätigt, reproduziert |
| B-04 | **Mittel** | Perf-Gate prüft nur Zeit, keine Routing-Qualität; Stressplan kollabiert       | bestätigt, reproduziert |
| B-05 | **Mittel** | Port-Bündel-Ausnahme ist nicht an den gemeinsamen Port gebunden               | bestätigt, reproduziert |
| B-06 | **Mittel** | Same-Point: „valide“ in der Suche, `INVALID` im Final-Gate                    | bestätigt               |
| B-07 | **Mittel** | Produktiv-Routing blockiert Main-Thread; Worker/strenger Publikationspfad tot | bestätigt (bekannt)     |
| B-08 | **Mittel** | Domänen-24-px nicht in I3/CI; 8 Restpaare, engstes 12 px                      | bekannt (ROUTE-003)     |
| B-09 | Niedrig    | Sanity-/Shape-Verstöße werden als I3 etikettiert                              | bestätigt               |
| B-10 | Niedrig    | Cache-Schlüssel ist nicht vollständig input-getrieben (latent)                | Risiko                  |
| B-11 | Niedrig    | Modulweites `baseClearance` macht Separation nicht reentrant                  | Risiko                  |
| B-12 | Niedrig    | Hop-Priorität liest nur persistierte `edgeDomain`                             | bestätigt               |
| B-13 | Niedrig    | Einzelkanten-Fallback nutzt Legacy-Hindernislogik                             | bestätigt (transient)   |
| B-14 | Info       | Überlappende Nodes können I1 prinzipiell nicht erfüllen                       | Grenzfall/Platzierung   |
| B-15 | Info       | Audit-IDs `ROUTE-014/015/017` nur im Code, nicht in der Doku                  | Dokumentationslücke     |

**Empfohlene Reihenfolge:** B-01 und B-02 beheben, dabei B-03 als gemeinsame
Ursache mitlösen (ein Validator, ein Report). Danach B-04 und B-05, die beide
die Aussagekraft der grünen Gates betreffen. B-06 ist eine
Vertragsentscheidung, B-07 eine Architektur-/Performance-Aufgabe.

---

## 1. Prüfgegenstand und Methode

### 1.1 Gelesener Produktivpfad

- `components/edges/utils/routeAll.ts` — globaler Pass, Port-Auflösung,
  Stubs, Tubes, Nudge, Bend-Merge, Separation, Hopping, Label-Platzierung.
- `components/edges/utils/pathfinding.ts` — Katalog → Hanan-A* → Fallback,
  Cache, Hindernisfenster, Reparaturen.
- `components/edges/utils/cableRouteStore.ts` — Signatur, Throttle,
  Veröffentlichung, Final-Report, Optimierungspfad.
- `components/edges/utils/routeValidation.ts` und
  `lib/routing/routeContract.ts` — strenger Ein-/Ausgabevertrag.
- `lib/routing/finalValidation.ts`, `lib/routing/invariants.ts` — I1–I7,
  Sanity, Kreuzungen.
- `lib/routing/rules/portBundle.ts`, `rules/collision.ts`, `rules/hopping.ts`,
  `components/edges/utils/separation.ts` — Bündel-, Domänen- und
  Prioritätsregeln.
- `components/edges/CableEdge.tsx` — globaler Pfad vs. Einzelkanten-Fallback.
- `benchmarks/edgeRoutingPerf.bench.ts`, `scripts/routing/*`,
  `.github/workflows/quality.yml` — Gates.

### 1.2 Methode

1. **Statische Prüfung** der oben genannten Dateien, inklusive Kommentaren,
   Tests und Gate-Konfiguration.
2. **Gezielte Laufzeit-Proben** mit `tsx` gegen den echten Produktivcode.
   Die Proben lagen außerhalb des Repos (keine Testartefakte im Baum); die
   relevanten Eingaben und Ausgaben sind in den Befunden dokumentiert.
3. **Bestehende Gates** ausgeführt: Unit-Suite, Golden Master, Regression,
   `routing:audit`, `routing:domain-probe`, `perf:edge-routing`, Typecheck.
4. **Querprüfung** der dokumentierten offenen Punkte aus
   `docs/ai/KNOWN-PROBLEMS.md` und `docs/ai/ROUTING-CONTEXT.md`.

### 1.3 Abgrenzung

Nicht geprüft wurden die elektrische Dimensionierung, die
Verifikations-Engine als Ganzes, das Wasser-Routing im Detail, die
Layout-/Platzierungsengine und die visuelle Darstellung. Wo Routenlänge oder
Anschlussfehler auf diese Bereiche wirken, ist es im Befund als Auswirkung
genannt.

---

## 2. Gemessene Baseline

### 2.1 Tests und statische Gates

| Gate                        | Ergebnis                                            |
| --------------------------- | --------------------------------------------------- |
| `npm test`                  | 287 Testdateien, **3751 bestanden**, 1 übersprungen |
| `npm run test:goldenmaster` | **13/13** bestanden                                 |
| `npm run test:regression`   | **68/68** bestanden                                 |
| `npm run typecheck`         | ohne Befund                                         |

### 2.2 Routing-Audit (`npm run routing:audit`)

Alle sechs Referenzpläne: **I1 = I2 = I3 = I4 = I5 = I6 = I7 = 0**,
Fallback = 0, deterministisch = `true`.

| Plan     | Kanten | I1–I7 | Fallback | Kreuzungen | Kabelweg |
| -------- | -----: | ----: | -------: | ---------: | -------: |
| simple   |      9 |     0 |        0 |          1 | 2.665 px |
| camper   |     12 |     0 |        0 |          4 | 3.677 px |
| solar    |     11 |     0 |        0 |          2 | 3.200 px |
| inverter |     10 |     0 |        0 |          2 | 3.710 px |
| acdc     |     14 |     0 |        0 |          5 | 5.591 px |
| complex  |     23 |     0 |        0 |         25 | 8.646 px |

### 2.3 Domänen-Probe (`npm run routing:domain-probe`)

| Plan      | gemischte Paare | davon kreuzend | parallel < 24 px |
| --------- | --------------: | -------------: | ---------------: |
| simple    |               0 |              0 |                0 |
| camper    |               0 |              0 |                0 |
| solar     |               0 |              0 |                0 |
| inverter  |               9 |              0 |                0 |
| acdc      |              33 |              1 |                0 |
| complex   |              38 |             10 |            **8** |
| **Summe** |          **80** |         **11** |            **8** |

Engstes Paar: `e-shore-inv × e-auto-2` = **12 px** (gefordert: 24 px).
Die Probe ist **kein CI-Gate** (siehe B-08).

### 2.4 Performance-Gate (`npm run perf:edge-routing`)

| Gate                                    |    Median |       p90 | Budget                      | Status |
| --------------------------------------- | --------: | --------: | --------------------------- | ------ |
| Legacy-Einzelkante (16-ms-Ziel)         |   2,16 ms |   2,48 ms | 16 ms/Frame                 | OK     |
| Live-Pfad `routeAllCables` (N=36/E=134) | 201,89 ms | 243,17 ms | 300 ms Ratchet (Ziel 16 ms) | OK     |

Wiederholungen lagen bei 203,70/241,16 ms und 204,38/236,83 ms — die Streuung
ist stabil, der Median ist aber **rund 12,6× über dem 16-ms-Ziel**. Der
Live-Pfad ist im Gate ausdrücklich als „ungelöster Zielkonflikt“ dokumentiert
(ADR 0012/0030); das Audit bestätigt diesen Zustand.

---

## 3. Befunde

### B-01 — Hängekanten und geometrielose Endpunkte routen zum Canvas-Ursprung

**Schwere:** Hoch
**Status:** bestätigt, reproduziert
**Ort:** `components/edges/utils/routeAll.ts:970–976`,
`components/edges/utils/routeAll.ts:182–184` (über `resolveHandlePoint`)

**Ursache.** Der globale Pass prüft nur, ob **beide** Endpunkte fehlen:

```ts
const srcNode = nodeById.get(edge.source);
const tgtNode = nodeById.get(edge.target);
if (!srcNode && !tgtNode) continue;
```

Fehlt genau ein Knoten, läuft die Kante weiter. `resolveHandlePoint(undefined, …)`
liefert dann `{x: 0, y: 0}`; die Kante wird zum Ursprung geroutet. Derselbe
Effekt tritt auf, wenn ein Knoten zwar existiert, aber keine nutzbare
Geometrie hat (`routableNodeHasGeometry` = `nodePositionAvailable`): Die
Handle-Auflösung filtert ihn intern weg, die Existenzprüfung oben sieht ihn
aber als vorhanden.

Bemerkenswert ist die **Inkonsistenz innerhalb derselben Funktion**: Die
Bündelgrößen-Berechnung verwendet bereits die richtige Bedingung:

```ts
// routeAll.ts:903
if (!locked && (!nodeById.has(edge.source) || !nodeById.has(edge.target))) return [];
```

Der Kommentar an der fehlerhaften Stelle (`AUDIT ROUTE-017`) beschreibt
sogar genau das gewünschte Verhalten („Quelle oder Ziel … fehlt … Besser:
überspringen“), der Code setzt es aber nicht um.

**Reproduktion.** Zwei Knoten, eine gültige Kante, eine Kante mit fehlendem
Ziel:

```ts
const nodes = [node('a', 100, 100), node('b', 500, 100)];
const edges = [
  { id: 'e1', source: 'a', target: 'b' },
  { id: 'e2', source: 'a', target: 'ghost' },
];
routeAllCables(nodes, edges);
// e2: 292,160 → 316,160 → 316,0 → -24,0 → 0,0
```

Der Weg enthält am Ende eine **Selbstüberdeckung** (`-24,0 → 0,0` liegt
rückwärts auf `316,0 → -24,0`). Die schwache Final-Validierung meldet deshalb
`edgeEdgeOverlaps: 1`; die eigentliche Ursache (fehlender Endpunkt) wird aber
nicht benannt.

Derselbe Effekt mit einem existierenden, aber positionslosen Knoten:

```ts
const nodes = [
  node('a', 100, 100),
  { id: 'b', width: 192, height: 120, type: 'fuse', data: {} }, // keine position
];
// e1: 292,160 → 364,160 → 364,0 → -24,0 → 0,0
```

**Auswirkung.**

- Die Phantom-Route liegt auf dem Canvas und kann von der UI als Kabel
  dargestellt werden.
- `addTubes` registriert die Trasse; nachfolgende Leitungen werden um ein
  Kabel herumgeplant, das gar nicht existiert.
- `CableEdge` verwendet `routeLengthPx` als Schätzung der Kabellänge
  (`resolveCableLength`, `CableEdge.tsx:614–619`). Der Phantom-Weg kann
  Spannungsfall, Querschnittsempfehlung und BOM-Anzeige verfälschen.
- Bei **beiden** fehlenden Endpunkten wird die Kante übersprungen; der
  schwache Report meldet dann `VALID` (siehe B-03). Das Kabel verschwindet
  still, statt als nicht routbar gemeldet zu werden.

**Empfehlung.**

1. `nodeById` nur aus Knoten mit nutzbarer Geometrie bilden **oder** beide
   Endpunkte mit `routableNodeHasGeometry` prüfen.
2. Bei fehlendem/ungültigem Endpunkt die Kante **überspringen und explizit
   als nicht routbar veröffentlichen** (z. B. `ROUTE-INPUT`/`ROUTE-MISSING`
   im Report, Edge-Flag `unroutable`), nicht still weglassen.
3. `resolveHandlePoint` sollte für „nicht auflösbar“ ein diskriminiertes
   Ergebnis zurückgeben (z. B. `{kind: 'unresolved', reason}`), statt
   `(0,0)` zu erfinden; Aufrufer müssen den Fall behandeln.
4. Tests: Quelle fehlt, Ziel fehlt, beide fehlen, Knoten ohne Position,
   Knoten ohne gemessene Handles. Erwartung: keine Route zum Ursprung, keine
   Tube, klarer Report.

---

### B-02 — Unbekannter Handle wird still auf das erste Handle gebogen

**Schwere:** Hoch
**Status:** bestätigt, reproduziert
**Ort:** `components/edges/utils/routeAll.ts:188–190`

**Ursache.**

```ts
const group = bounds?.[kind] ?? bounds?.[kind === 'source' ? 'target' : 'source'];
const wanted = handleId ?? null;
const hb = group?.find((h) => (h.id ?? null) === wanted) ?? group?.[0];
```

Ist `handleId` gesetzt, aber im gemessenen Handle-Satz nicht vorhanden, wird
**ohne Fehler** das erste Handle der Gruppe verwendet. Ist die angeforderte
Gruppe leer, wird sogar die Gruppe der **anderen Richtung** verwendet
(`source` → `target`). Beides ist ein stiller Fallback auf einen elektrisch
anderen Anschluss.

Der strenge Validator erkennt nur den ersten Fall und nur, wenn die
Handle-Bounds bereits gemessen sind (`routeValidation.ts:50–65`,
`ROUTE-INPUT`). Der Live-Pfad ruft ihn nicht auf (B-03).

**Reproduktion.** Batterie mit gemessenen Handles `plus` (y = 140) und
`minus`; Kante fordert `sourceHandle: 'ac_out'`:

```ts
handleBounds: {
  source: [{ id: 'plus', x: 192, y: 40, width: 0, height: 0, position: 'right' }],
  target: [{ id: 'minus', x: 0, y: 40, width: 0, height: 0, position: 'left' }],
}
// Kante: { sourceHandle: 'ac_out', targetHandle: 'minus' }
// Route beginnt bei 292,140 — also am plus-Handle.
```

Validierung:

```text
unknown weak   VALID
unknown strict INVALID
               ROUTE-INPUT: Der gemessene Anschluss a/ac_out fehlt.
```

**Auswirkung.**

- Die Leitung hängt an einem anderen Pol/Anschluss als angefordert. Das kann
  Domäne, Polarität, Strombelastung und Querschnittsempfehlung verändern —
  fachlich ein sicherheitsrelevanter Planungsfehler.
- Der Nutzer sieht „Routing verifiziert“ (schwacher Report), obwohl der
  strenge Vertrag die Route ablehnt.
- Die Verifikations-Engine meldet zwar ggf. `SYN-003-unknown-port`; das ist
  aber eine zweite, unabhängige Anzeige. Der Routing-Status widerspricht ihr.
- Der Fallback auf die **andere Handle-Gruppe** wird von keinem der beiden
  Validatoren erkannt.

**Empfehlung.**

1. Bei gesetztem `handleId` und vorhandenen Handle-Bounds ist ein fehlendes
   Handle ein **harter Fehler** (kein Routing, `ROUTE-INPUT`).
2. Bei noch nicht gemessenen Bounds ist „nicht messbar“ ein **eigener
   Zustand** („warten auf Messung“), nicht „unbekannt“; die Kante darf nicht
   auf gut Glück geroutet werden. Nach der Messung muss die Signatur neu
   routen.
3. Den Fallback auf die andere Handle-Gruppe entfernen oder nur mit
   expliziter Warnung und nur für `handleId == null` zulassen.
4. Test mit gemessenen Handles, in denen die angeforderte ID fehlt; Erwartung
   `INVALID` + `ROUTE-INPUT`, keine Route.

---

### B-03 — Live-Report nutzt den schwachen Validator; Vertragsverstöße erreichen die UI nicht

**Schwere:** Hoch
**Status:** bestätigt, reproduziert
**Ort:** `components/edges/utils/cableRouteStore.ts:295–317` (schwacher
Validator), `:602–606` (Live-Veröffentlichung), `:45` (Import des strengen
Validators), `:482/487/678/685` (strenge Nutzung nur im Optimierungspfad);
`components/edges/utils/routeValidation.ts:16–84`;
`lib/routing/routeContract.ts:25–60`;
`components/planner/hooks/useLiveValidation.ts:949–963`.

**Ursache.** Es gibt zwei fast identische Implementierungen von
`computeCableRouteFinalValidation`:

- **streng** (`routeValidation.ts`): `validateFinalRouting` **plus**
  `validateRouteContract` (`ROUTE-MISSING`, `ROUTE-SHAPE`, `ROUTE-ENDPOINT`,
  `ROUTE-DIRECTION`), `ROUTE-INPUT` für unbekannte Handles und
  `ROUTE-OWN-NODE` für Innensegmente durch das eigene Anschlussgerät.
- **schwach** (`cableRouteStore.ts`): nur `validateFinalRouting` (I1/I2/I3 +
  Sanity) und Lock-Prüfungen. Die Route-Contract-Prüfungen fehlen.

Der normale Live-Lauf verwendet die **schwache** Variante:

```ts
const routes = routeAllCables(nodes, edgeRefs);
const report = computeCableRouteFinalValidation(nodes, edgeRefs, routes);
publishCableRoutes(routes);
publishCableRouteFinalValidation(report);
```

Der strenge Import ist vorhanden, wird aber nur in
`completeCableRouteGeneration` und im Optimierungspfad verwendet. Ein
Produktionsaufrufer von `completeCableRouteGeneration` ist nicht vorhanden
(nur `routingPublication.test.ts`); der Live-Pfad publiziert direkt.

**Reproduktion.** Vier Fälle, gleiche Knoten, gleiche Kanten, nur der Report
unterscheidet sich:

| Fall                                   | schwach                  | streng  | Contract-Code    |
| -------------------------------------- | ------------------------ | ------- | ---------------- |
| Route fehlt vollständig                | **VALID**                | INVALID | `ROUTE-MISSING`  |
| Unbekannter Handle                     | **VALID**                | INVALID | `ROUTE-INPUT`    |
| Innensegment durch eigenen Source-Node | **VALID**                | INVALID | `ROUTE-OWN-NODE` |
| Ein-Punkt-/Diagonalroute               | INVALID (Sanity, als I3) | INVALID | `ROUTE-SHAPE`    |

Der Fall „Route fehlt“ ist besonders kritisch: `computeCableRouteFinalValidation`
(schwach) iteriert nur über vorhandene Routen (`if (route) routed.push(...)`);
eine fehlende Route wird schlicht nicht geprüft. `validateFinalRouting` sieht
dann null Kanten und meldet `VALID`. Die UI zeigt „Routing verifiziert“.

Der Fall „Innensegment durch eigenen Node“ ist mit einem orthogonalen
Testpfad reproduzierbar, der den Source-Node innen durchquert:

```text
292,160 → 316,160 → 316,300 → 180,300 → 180,80 → 500,80 → 500,160 → 700,160
weak   VALID
strict INVALID, ROUTE-OWN-NODE „Innensegment schneidet das Anschlussgerät a.“
```

**Auswirkung.**

- Der zentrale Routing-Status (`RoutingStatusBadge`) und die Warn-Zentrale
  stützen sich auf einen Report, der die Existenz und die Form der Route
  nicht prüft.
- `useLiveValidation` enthält bereits einen Zweig für
  `routingReport.contractViolations` (`useLiveValidation.ts:949–963`), der im
  Live-Betrieb **nie** ausgeführt wird. Die UI ist vorbereitet, der Publisher
  liefert die Daten nicht.
- Die doppelte Implementierung ist ein Wartungsrisiko: Änderungen an
  `routeValidation.ts` erreichen den Live-Pfad nicht automatisch.
- `totalViolations` zählt `contractViolations` bereits mit; das Report-Schema
  unterstützt sie. Es fehlt nur die Erzeugung.

**Empfehlung.**

1. **Eine** Validator-Implementierung: die strenge aus `routeValidation.ts`.
   Die schwache Kopie löschen oder als dünnen Wrapper auf die strenge
   umstellen.
2. `CableRouteSync` muss den strengen Report veröffentlichen;
   `contractViolations` müssen in Badge, Warn-Zentrale und Debug-Log
   erscheinen.
3. Den toten `completeCableRouteGeneration`-Pfad entweder an den Worker
   anschließen (B-07) oder entfernen; solange er nur in Tests läuft, darf er
   nicht als „die“ Publikationsgarantie dokumentiert werden.
4. Regressionstests für die vier Fälle; diese Tests müssen vor dem Fix rot
   sein. Zusätzlich ein Test, der prüft, dass der **publizierte** Report (nicht
   nur der streng berechnete) `contractViolations` enthält.

---

### B-04 — Perf-Gate prüft nur Zeit, keine Routing-Qualität; der Stressplan kollabiert

**Schwere:** Mittel
**Status:** bestätigt, reproduziert
**Ort:** `benchmarks/edgeRoutingPerf.bench.ts:32–58` (Plan),
`:238–288` (Live-Gate); `.github/workflows/quality.yml:126–138`

**Ursache.** Das Live-Gate baut einen 36-Knoten-/134-Kanten-Plan, ruft
`routeAllCables` 15-mal auf und prüft ausschließlich:

- Median ≤ 300 ms,
- p90/Median ≤ 2.

Es gibt **keine** Prüfung von `usedSearch`, `fallbackHitsObstacles`,
`tightMarginUsed`, I1/I2/I3 oder der Zahl der tatsächlich gerouteten Kanten.
Der 16-ms-Block misst außerdem den **Legacy-Einzelkantenpfad**
(`buildOrthogonalPath`), nicht den globalen Produktivpfad.

**Reproduktion.** Derselbe Plan, Qualität statt Zeit gemessen:

| Kennzahl                  |  Wert |
| ------------------------- | ----: |
| Routen                    |   134 |
| Katalog                   |    11 |
| A*                        |   102 |
| Fallback                  |    21 |
| Fallback trifft Hindernis |    21 |
| Tight Margin              |    82 |
| I1                        |    37 |
| I2                        |   599 |
| I3                        | 2.239 |
| I4 / I5 / I6 / I7         |     0 |

Das Gate meldet bei derselben Ausführung:

```text
Perf-Gate Live-Pfad: N=36 E=134  Median 201,89 ms  p90 243,17 ms
Ratchet 300 ms  ·  Streuung p90/Median 1,20 ≤ 2  → OK
```

**Einordnung.** Der Plan ist synthetisch, sehr dicht und nicht mit den
Referenzplänen vergleichbar; die 37/599/2.239 sind **kein** Produktionsregress
und kein Beweis, dass reale Pläne schlecht geroutet werden. Der Befund ist die
**Gate-Lücke**: Eine Änderung, die alle 134 Kanten in den Fallback zwingt oder
I1 explodieren lässt, würde weiterhin „OK“ melden, solange sie schnell genug
ist. Das Gate kann die Qualität, die es schützen soll, nicht sehen.

**Auswirkung.**

- Grüne Perf-Gates sind kein Beleg für funktionierendes Routing.
- Der einzige Live-Pfad-Test mit > 100 Kanten ist blind für den
  Qualitätskollaps; die Referenzpläne haben nur 9–23 Kanten.
- Der 16-ms-Gate-Block deckt den Produktivpfad nicht ab; die Aussage
  „16 ms/Frame“ gilt nur für den Legacy-Einzelpfad.

**Empfehlung.**

1. Qualitätsassertions an den Live-Gate-Block hängen: z. B.
   `fallbackHitsObstacles === 0`, `I1 === 0`, `I2/I3` unter einer
   dokumentierten Ratchet, `routes.size === edges.length`. Für den dichten
   Stressplan ggf. eigene, begründete Schwellen oder einen realistischen
   Plan verwenden.
2. Einen separaten `routing:stress`-Gate-Block einführen, der einen
   **realistischen** großen Plan (z. B. 60–100 Knoten, nicht überlappend,
   gemessene Handles) routet und I1–I7 prüft.
3. Im Gate-Output immer die Qualitätskennzahlen mitschreiben, auch wenn sie
   nicht hart fehlschlagen — damit ein Kollaps sichtbar wird.
4. Klarstellen, dass der 16-ms-Block den Legacy-Pfad und der 300-ms-Block den
   globalen Pfad misst; die ADR-0012-Zielmarke für den Produktivpfad bleibt
   offen (B-07).

---

### B-05 — Port-Bündel-Ausnahme ist nicht an den gemeinsamen Port gebunden

**Schwere:** Mittel
**Status:** bestätigt, reproduziert
**Ort:** `lib/routing/rules/portBundle.ts:102–120` (`isPortBundleOverlap`),
`:47–51` (`routedPathGeometry`); Verbraucher:
`lib/routing/invariants.ts:145–153` (I2), `lib/routing/rules/costModel.ts`
(`segmentExtraCost`).

**Ursache.** Die Ausnahme prüft, ob ein Paar kollinearer Segmente innerhalb
**irgendeines** ersten oder letzten Segments („Stub“) beider Pfade liegt:

```ts
const withinStub = (stubs: readonly Segment[]): boolean =>
  stubs.some((stub) => {
    if (!sameAxis(stub, s1)) return false;
    const coords = stubCoords(stub);
    const lo = Math.min(coords[0], coords[1]);
    const hi = Math.max(coords[0], coords[1]);
    return interval.lo >= lo - EPS && interval.hi <= hi + EPS;
  });
return withinStub(a.stubs) && withinStub(b.stubs);
```

`sharesPort` stellt nur fest, dass **irgendein** Endpunktpaar übereinstimmt.
Es wird nicht geprüft, ob der überlappende Abschnitt an genau diesem
gemeinsamen Port liegt. Die Ausnahme darf laut Dokumentation nur die
gemeinsame Strecke **beim Verlassen des gemeinsamen Ports** freistellen.

**Reproduktion.**

```ts
const a = routedPathGeometry([
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 },
  { x: 20, y: 50 },
]);
const b = routedPathGeometry([
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 50 },
  { x: 50, y: 50 },
]);
isPortBundleOverlap(a, b, a.segments.at(-1)!, b.segments.at(-1)!); // true
```

Beide Pfade teilen den Port `(0,0)`. Die überlappende Strecke
`x = 20…50, y = 50` liegt aber am **gegenüberliegenden Ende**; sie ist kein
gemeinsamer Stub. Die Funktion liefert trotzdem `true`, weil beide letzten
Segmente kollinear sind und die x-Intervalle die Überlappung enthalten.

**Auswirkung.**

- I2 kann eine echte kollineare Überdeckung übersehen, wenn die Geometrie
  zufällig in den Koordinatenbereich eines anderen Stubs fällt.
- Das Kostenmodell (`segmentExtraCost`) verwendet dieselbe Ausnahme und
  könnte eine unzulässige Überdeckung als „legitim“ bepreisen.
- Der Befund ist geometrisch eng, aber die Invariante ist binär; ein
  Freispruch an der falschen Stelle ist ein Korrektheitsfehler.

**Empfehlung.**

1. Den gemeinsamen Port bestimmen (Start/Start, Start/Ende, Ende/Start,
   Ende/Ende) und je Pfad **nur den zugehörigen Stub** zulassen:
   - gemeinsamer Start → erster Stub,
   - gemeinsames Ende → letzter Stub.
2. Zusätzlich prüfen, dass der Stub tatsächlich auf der Geraden des
   überlappenden Segments liegt (nicht nur gleiche Achse und
   Koordinatenintervall).
3. Test mit der obigen Geometrie; Erwartung `false`. Zusätzlich ein
   Positivtest mit echtem gemeinsamen Stub; Erwartung `true`.

---

### B-06 — Same-Point: „valide“ in der Pfadsuche, `INVALID` im Final-Gate

**Schwere:** Mittel
**Status:** bestätigt
**Ort:** `components/edges/utils/pathfinding.ts:2249–2259`;
`lib/routing/finalValidation.ts:156–161`;
`components/edges/utils/pathfinding.test.ts:287–291`;
`components/edges/utils/orthogonalRouting.invariants.test.ts:165–171`;
`components/edges/utils/routingScenarios.ts:324–336`.

**Ursache.** `searchOnce` bricht bei identischen Source-/Target-Koordinaten
früh ab und liefert einen **Ein-Punkt-Pfad**:

```ts
if (Math.abs(input.sourceX - input.targetX) <= EPS && Math.abs(input.sourceY - input.targetY) <= EPS) {
  return { waypoints: [{ x: input.sourceX, y: input.sourceY }], usedSearch: 'catalog', tight: false };
}
```

Der Test nennt das „degenerate but valid path“; der Invarianten-Test erlaubt
ausdrücklich `waypoints.length >= 1` für diesen Fall. Das Final-Gate zählt
`waypoints.length < 2` dagegen als **Sanity-Verstoß** und etikettiert ihn als
`invariant: 'I3'`; der strenge Vertrag meldet `ROUTE-SHAPE`. Damit ist
derselbe Pfad in einer Schicht „valide“ und in einer anderen `INVALID`.

**Reproduktion.**

```text
Route: [{ x: 100, y: 136 }]
Final: INVALID { sanityViolations: 1 }
Detail: „Unvollständige oder nicht orthogonale Route.“ (invariant: I3)
```

**Auswirkung.**

- Bei zwei Knoten mit identischem Anschlusspunkt (überlappende Nodes,
  importierte Pläne) zeigt der Planer eine ungültige Route an, obwohl die
  Pfadsuche den Fall bewusst als degeneriert akzeptiert.
- Die Diagnose nennt I3 (Abstand), obwohl es um Form/Existenz geht.
- Je nach UI-Pfad kann ein leerer Pfad gezeichnet werden; der Nutzer sieht
  keinen sinnvollen Hinweis.

**Empfehlung.**

1. Eine **einzige** Semantik festlegen:
   - **(a) Verbindung ablehnen:** Bei identischen Anschlusspunkten keine
     Kante anlegen bzw. `ROUTE-SHAPE`/`ROUTE-INPUT` melden; der Nutzer erhält
     eine klare Meldung („Quelle und Ziel liegen am selben Punkt“).
   - **(b) Als No-op akzeptieren:** Ein-Punkt-Routen aus dem Routing und der
     Final-Validierung ausnehmen und als „keine Leitung“ markieren.
2. Die gewählte Semantik in `routeContract.ts`, `finalValidation.ts` und den
   Tests synchronisieren; den Widerspruch zwischen `pathfinding.test.ts` und
   `validateFinalRouting` beseitigen.
3. Sanity-/Shape-Verstöße nicht als I3 etikettieren (B-09).

---

### B-07 — Produktiv-Routing blockiert den Main-Thread; Worker und strenger Publikationspfad sind ungenutzt

**Schwere:** Mittel (bekannt, aber UX-relevant)
**Status:** bestätigt
**Ort:** `components/edges/utils/cableRouteStore.ts:602` (synchroner Aufruf),
`:219` (`ROUTE_THROTTLE_MS = 100`); `components/edges/utils/routingWorkerClient.ts`
(81 Zeilen), `routingJob.ts` (18), `routing.worker.ts` (11);
`completeCableRouteGeneration` (nur Testaufrufer).

**Ursache.** `CableRouteSync` ruft `routeAllCables` direkt im Layout-Effekt
auf. Die vorhandene Worker-Infrastruktur wird nur von ihrem eigenen Test
importiert; es gibt keinen Produktionskonsumenten. Dasselbe gilt für
`completeCableRouteGeneration`/`selectRoutingPublication`: Die Funktion ist
implementiert und getestet, aber der Live-Pfad publiziert direkt.

**Messung.**

- 134 Kanten: Median **201,89–204,38 ms**, p90 **236,83–243,17 ms** pro Lauf.
- Throttle: **100 ms**; ein Lauf blockiert also länger als das Intervall, in
  dem er geplant wird.
- Der Kommentar im Benchmark nennt für das 500-Knoten-Spannkanten-Szenario
  **~5,7 s** (Median).
- Das 16-ms-Ziel aus ADR 0012 gilt nur für den Legacy-Einzelpfad; der
  Produktivpfad hat einen 300-ms-Ratchet.

**Auswirkung.**

- Beim Verschieben von Knoten, Layout-Wechseln und Auto-Wire kann die UI
  mehrere Hundert Millisekunden bis Sekunden einfrieren; auf Mobilgeräten
  ist der Effekt größer.
- Solange der Worker nicht angebunden ist, laufen alle Proben und
  Optimierungen im Main-Thread.
- Der strengere Publikationspfad („ungültiger Kandidat ersetzt keinen
  gültigen Stand“) ist im Live-Pfad nicht aktiv; die Zusicherung gilt nur
  für den ungenutzten Pfad.

**Empfehlung.**

1. Worker anbinden (`routingWorkerClient` + `routingJob` + `routing.worker`)
   und die Generationen-/Hash-Prüfung aus `completeCableRouteGeneration`
   verwenden; Main-Thread erhält nur das Ergebnis.
2. Vorher B-11 (reentrante Separation) beheben, damit ein Worker keine
   modulweiten Zustände teilt.
3. Falls der Worker kurzfristig nicht kommt: Routing inkrementell/lokal
   ausführen (nur betroffene Kanten) oder zumindest die Laufzeit auf
   mobilen Profile messen und ein p95-Budget dokumentieren.
4. Ein UI-Responsiveness-Gate ergänzen (z. B. Long-Task-Messung), nicht nur
   den Router-Median.

---

### B-08 — Domänen-24-px ist nicht in I3/CI verankert; 8 Restpaare

**Schwere:** Mittel
**Status:** bekannt (ROUTE-003, teilweise behoben) — Messung bestätigt
**Ort:** `lib/routing/rules/collision.ts:262–272`
(`requiredClearanceBetween`), `lib/routing/invariants.ts:203–264`
(`checkClearance`), `components/edges/utils/routeAll.ts:1403–1436`
(Trenngang), `scripts/routing/domainProbe.ts`.

**Ursache.** `checkClearance` verwendet für **jedes** Segmentpaar
`tokens.cableClearance` (12 px):

```ts
const clearance = tokens.cableClearance;
```

Die paarweise Domänenregel (`electrical ↔ water`, `ac230 ↔ dc12` → 24 px)
existiert in `requiredClearanceBetween` und wird im zweiten Trenngang
verwendet, aber nicht in der Final-Invariante. Damit kann ein Plan
`I3 = 0` melden, obwohl gemischte Leitungen 12 px statt 24 px auseinander
liegen.

**Messung.** `routing:domain-probe` (nicht CI): **8** parallele Mischpaare
unter 24 px, alle in `complex`; engstes `e-shore-inv × e-auto-2` = **12 px**.
Die übrigen fünf Pläne sind bei 0. Der Trenngang hat die Zahl bereits von
16 auf 8 gesenkt (ROUTE-003-Status); die verbleibenden Paare liegen in Stubs
und dichten Bündeln, die der Trenngang nicht ohne Verletzung einer anderen
Regel bewegen kann.

**Auswirkung.**

- Die ausgewiesene Domänentrennung ist eine Messung, kein Gate. Ein
  Rückschritt von 8 auf 16 Paare würde nicht fehlschlagen.
- Ein grünes I3-Gate bedeutet nicht, dass die dokumentierte 24-px-Regel
  eingehalten ist.
- Elektrisch/fachlich bleibt die Trennung AC/DC bzw. Wasser/Strom ein
  Qualitäts- und Sicherheitsmerkmal; die Restpaare sind dokumentiert, aber
  nicht erzwungen.

**Empfehlung.**

1. `checkClearance` um eine optionale Domänen-Karte erweitern und pro Paar
   `requiredClearanceBetween` verwenden; die Basis-12-px-Prüfung bleibt
   separat (Veto).
2. `routing:domain-probe` als **Ratchet-Gate** in CI aufnehmen:
   Start bei 8, Ziel 0; Verbesserungen ziehen die Ratchet nach.
3. Für die verbleibenden Stubs getrennte AC-/DC-Port-Lanes prüfen
   (`portFanOut.ts`), wie in ROUTE-003 dokumentiert.
4. In der UI/Diagnose klar unterscheiden: „I3 (Basis)“ vs.
   „Domänenfreigabe (24 px)“.

---

### B-09 — Sanity-/Shape-Verstöße werden als I3 etikettiert

**Schwere:** Niedrig
**Status:** bestätigt
**Ort:** `lib/routing/finalValidation.ts:156–181`

**Ursache.** Für `< 2` Wegpunkte, nicht-orthogonale Pfade, NaN/Infinity und
Koordinaten außerhalb ±1.000.000 px wird ein `InvariantViolation` mit
`invariant: 'I3'` erzeugt. Die Meldung landet in `violations`, während
`counts.sanityViolations` separat gezählt wird.

**Auswirkung.**

- Tooltips und Warn-Regeln (`ROUTE-LOCK-I3`) sprechen von „Mindestabstand“,
  obwohl die Route fehlt oder diagonal ist.
- `formatFinalValidation` trennt `sanity` korrekt, aber die strukturierten
  Einzelbefunde tragen die falsche Invariante.
- Ein Ein-Punkt-Pfad wird als I3-Problem klassifiziert (siehe B-06).

**Empfehlung.** Eine eigene Invariante/ Kategorie `SHAPE`/`SANITY` einführen,
Typ und UI-Mapping erweitern, Tests anpassen. `totalViolations` bleibt
unverändert.

---

### B-10 — Cache-Schlüssel ist nicht vollständig input-getrieben (latent)

**Schwere:** Niedrig
**Status:** Risiko, kein aktuell beobachteter Fehler
**Ort:** `components/edges/utils/pathfinding.ts:1989–2014`
(`requestKey`), `:2566–2573` (`capped` vs. `key`)

**Ursache.** `requestKey` enthält:

- `stubCapRank`/`stubCapRankTarget`, `stubTie`/`stubTieTarget`,
- aber **nicht** die numerischen `stubCap`/`stubCapTarget`,
- von `ownObstacles` nur die **Anzahl**, nicht die Geometrie.

Der Aufruf verwendet `requestKey(input, obstacles)`, obwohl die Suche mit
`capped` läuft (Stub-Kappen aus `stubCapFor`). Die Kappen sind heute eine
deterministische Funktion aus Start/Ziel/Positionen und den relevanten
Hindernissen — alle im Schlüssel — und der einzige explizite `stubCap`-Aufrufer
(`routeAll.ts:1179`) setzt einen konstanten Token. Deshalb ist **aktuell**
kein falsches Cache-Ergebnis nachgewiesen. Sobald ein Aufrufer variable
Kappen übergibt oder die eigene Box-Geometrie relevant wird, kann der Cache
eine Route für eine andere Eingabe zurückgeben.

**Auswirkung.** Latente Fehlroute, die ohne Test schwer zu finden wäre; die
Determinismus-Zusicherung („gleiche Eingabe ⇒ gleiche Ausgabe“) würde für
unterschiedliche Eingaben verletzt.

**Empfehlung.** Den Schlüssel aus dem **tatsächlich verwendeten** `capped`
bilden und `ownObstacles` vollständig (oder als gehashte Geometrie)
aufnehmen. Ein Cache-Kollisionstest mit zwei Anfragen, die sich nur in
`stubCap` bzw. der eigenen Box-Geometrie unterscheiden, sollte
unterschiedliche Ergebnisse erzwingen.

---

### B-11 — Modulweites `baseClearance` macht die Separation nicht reentrant

**Schwere:** Niedrig
**Status:** Risiko (aktuell single-threaded)
**Ort:** `components/edges/utils/separation.ts:231`, `:304`, `:631`

**Ursache.**

```ts
let baseClearance = ROUTING_TOKENS.cableClearance; // Modulzustand
// ...
baseClearance = clearance; // bei jedem Aufruf gesetzt
// ...
const base = baseClearance; // in measureBetween gelesen
```

Die Funktion ist als reine Funktion dokumentiert, benutzt aber einen
modulweiten veränderlichen Zustand. Bei verschachtelten oder parallelen
Aufrufen (z. B. nach Worker-Anbindung, B-07) kann `measureBetween` die
Basis-Freigabe des falschen Aufrufs lesen.

**Auswirkung.** Latente Fehlentscheidung im Trenngang; der Basis-Veto
(„kein Zug darf die Basis-Freigabe verschlechtern“) wäre nicht mehr
verlässlich. Heute, im synchronen Main-Thread, tritt der Fall nicht auf.

**Empfehlung.** `base` als Parameter durch `measureBetween`/`candidateImproves`
reichen oder in einem lokalen Kontextobjekt führen. Vor der Worker-Anbindung
zwingend beheben.

---

### B-12 — Hop-Priorität liest nur die persistierte `edgeDomain`

**Schwere:** Niedrig
**Status:** bestätigt
**Ort:** `components/edges/utils/routeAll.ts:1492–1507`;
`lib/routing/rules/hopping.ts:109–118`; `lib/routing/rules/collision.ts:241–252`

**Ursache.** Die Kreuzungsanalyse baut `HopEdge` mit:

```ts
domain: edge?.data?.edgeDomain,
```

Die Domäne wird an anderer Stelle bereits autoritativ aus
`data.edgeDomain` **oder** Knotentyp/Handles abgeleitet (`domainById`,
`routeAll.ts:944–945`, `routingDomainOfEdge`). AutoWire-Kanten setzen
`edgeDomain` inzwischen selbst (`lib/autoWire/routing.ts:112/142`), aber
importierte/ältere Kanten ohne Feld erhalten in der Hop-Priorität
`unknown` (Gewicht 0), obwohl ihre Domäne aus den Knoten bestimmbar wäre.
Der Kommentar in `collision.ts:230–238` („AutoWire-Kanten tragen das Feld
nicht“) ist an dieser Stelle veraltet.

**Auswirkung.** Bei solchen Kanten kann die falsche Leitung hüpfen: Der
Backbone bleibt nicht bevorzugt gerade, weil sein Domänenrang fehlt. Kein
Sicherheitsfehler, aber ein visuelles/Qualitätsproblem und eine zweite
Domänen-Wahrheit.

**Empfehlung.** `domain: domainById.get(id)` verwenden; den veralteten
Kommentar korrigieren; einen Test mit einer Kante ohne `data.edgeDomain`
zwischen Inverter und Verbraucher ergänzen.

---

### B-13 — Einzelkanten-Fallback nutzt Legacy-Hindernislogik (transient)

**Schwere:** Niedrig
**Status:** bestätigt (nur bis zur globalen Route)
**Ort:** `components/edges/CableEdge.tsx:521–543`;
`components/edges/utils/pathfinding.ts:2033–2056` (`relevantObstacles`)

**Ursache.** Der Einzelkanten-Fallback ruft `findCablePath` ohne
`ownObstacles` auf:

```ts
const obstacles = nodesToObstacles(allNodes, new Set([source, target]));
const routed = findCablePath({ ...obstacles, crossingSegments });
```

Im Legacy-Modus verwirft `relevantObstacles` **jede** Box, die Start oder
Ziel enthält. Eine fremde Node, die den eigenen Anschluss überlappt, wird
damit still aus den Hindernissen entfernt. Der globale Pass reicht dagegen
`ownObstacles` (nur die eigenen Boxen) und behält fremde, klebende Boxen als
Hindernis.

**Auswirkung.** Für die wenigen Frames, bis der globale Pass publiziert
(Throttle 100 ms; Laufzeit ~200 ms), kann die Einzelkante durch eine fremde
Node schneiden, die den Anschluss überlappt. Danach korrigiert der globale
Pass die Route (oder meldet I1, wenn die Überlappung unvermeidbar ist).
Transient, aber sichtbar.

**Empfehlung.** Im Fallback die eigenen Source-/Target-Boxen als
`ownObstacles` übergeben (statt Legacy-Modus) oder die Filterung auf
Identität statt „enthält Start/Ziel“ umstellen. Test mit einer fremden Node,
die den Quellanschluss überlappt.

---

### B-14 — Überlappende Nodes können I1 prinzipiell nicht erfüllen

**Schwere:** Info / Grenzfall
**Status:** bestätigt (Platzierung, nicht Router)
**Ort:** `components/edges/utils/routeAll.ts` (eigene Boxen werden aus den
Hindernissen entfernt), `lib/routing/invariants.ts:87–109` (I1)

**Beobachtung.** Liegt der Quellanschluss selbst innerhalb einer fremden
Node (weil zwei Nodes überlappen), kann keine Route I1 erfüllen: Der Start
liegt bereits im Hindernis. Probe:

```text
nodes: a(100,100), b(700,100), overlap(250,80) — overlap enthält den Port 292,160
Route: 292,160 → 700,160
I1: 1 (Segment schneidet overlap)
```

**Einordnung.** Das ist ein **Platzierungsproblem** (ROUTE-006), kein Fehler
der Pfadsuche. Der Router hält fremde, überlappende Boxen korrekt als
Hindernis; er kann die Startposition nicht verlassen, ohne die Box zu
schneiden.

**Empfehlung.** Eine Platzierungs-/Überlappungsprüfung vor dem Routing
(Warnung im WarningCenter, `nodeOverlap`-Regel), nicht eine Routeränderung.
Die finale INVALID-Meldung ist in diesem Fall korrekt und sollte den
Platzierungskonflikt als Ursache nennen.

---

### B-15 — Audit-IDs nur im Code, nicht in der Dokumentation

**Schwere:** Info
**Status:** Dokumentationslücke
**Ort:** `components/edges/utils/routeAll.ts:970` (`ROUTE-017`),
`pathfinding.ts` (`ROUTE-014`, `ROUTE-015`); Suche in `docs/` liefert keine
Einträge.

**Beobachtung.** Die Kommentare referenzieren Audit-IDs, die in
`docs/ai/KNOWN-PROBLEMS.md` bzw. den ADRs nicht auffindbar sind. Besonders
ungünstig ist `ROUTE-017`: Der Kommentar beschreibt die richtige Absicht,
der Code darunter ist aber falsch (B-01).

**Empfehlung.** Entweder die IDs in `KNOWN-PROBLEMS.md` aufnehmen oder aus
den Kommentaren entfernen; bei B-01 den Kommentar und den Code synchron
korrigieren.

---

## 4. Querprüfung der dokumentierten offenen Punkte

| ID / Thema                 | Dokumentierter Stand                                 | Prüfung in diesem Audit                                                                        |
| -------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| ROUTE-001 LaneRegistry     | getestet, ohne Produktivkonsument                    | bestätigt: nur `laneProbe`/Tests/Kommentare; `portFanOut` bleibt wirksam                       |
| ROUTE-002 Kostenmodell     | `segmentExtraCost`/`preferredLaneBonus` nur Tests    | bestätigt: `scorePath` nutzt Länge, Bends, `COST_WEIGHTS.crossing`; keine gewichtete Clearance |
| ROUTE-003 Domänenregel     | teilweise behoben, 8 Restpaare, I3 prüft 24 px nicht | bestätigt: 8 Paare, engstes 12 px; `checkClearance` nur 12 px; Probe nicht CI                  |
| ROUTE-009 Kreuzungsauswahl | blind für gewichtete Clearance                       | bestätigt: `scorePath` enthält keine gewichteten Clearance-Verstöße; p02-Ratchet bleibt        |
| ROUTE-013 Rest             | Diagnose-Clearance ignoriert Port-Bündel-Ausnahme    | nicht erneut gemessen; Code/Doku unverändert, keine Regression in den Gates                    |
| ROUTE-006 Platzierung      | Restfehler außerhalb der Referenzkoordinaten         | bestätigt als Grenzfall B-14 (überlappende Nodes/Port im Fremdnode)                            |
| ROUTE-008/010 (gelöst)     | I3 = 0, Ratchet geschlossen                          | bestätigt: Referenzpläne I1–I7 = 0; Golden/Regression grün                                     |

---

## 5. Test- und Gate-Lücken

1. **Keine Tests für Hängekanten, unbekannte Handles, fehlende Routen oder
   `ROUTE-OWN-NODE`** im Produktivpfad. `routeAll.test.ts` verwendet für
   seine Statusassertions den **schwachen** Validator (Import aus
   `cableRouteStore.ts`); die Lücke bleibt dadurch unsichtbar.
2. **Perf-Gate ohne Qualitätsassertion** (B-04); der einzige >100-Kanten-Lauf
   prüft nur Zeit.
3. **Domänen-Probe nicht in CI** (B-08); 24-px-Regel ist nur eine Messung.
4. **Port-Bündel-Ausnahme** hat keinen Test für die Bindung an den
   gemeinsamen Port (B-05).
5. **`completeCableRouteGeneration`/Worker** sind getestet, aber nicht
   produktiv angebunden (B-07); die Tests suggerieren eine Zusicherung, die
   im Live-Pfad nicht gilt.
6. **Cache-Schlüssel** hat keinen Kollisionstest (B-10).
7. **Same-Point** ist in zwei Tests unterschiedlich definiert (B-06).

---

## 6. Empfohlenes Vorgehen

### P0 — Korrektheit und Statuswahrheit

1. **B-01:** Endpunktprüfung auf `routableNodeHasGeometry` umstellen,
   `&&` → `||`, nicht routbare Kanten explizit melden; `resolveHandlePoint`
   ohne `(0,0)`-Erfindung.
2. **B-02/B-03 gemeinsam:** Einen strengen Validator im Live-Pfad
   veröffentlichen; unbekannte Handles als `ROUTE-INPUT` behandeln; die
   schwache Kopie entfernen.
3. Regressionstests für die vier Contract-Fälle; diese müssen vor dem Fix
   rot sein.

**Abnahmekriterien:**

- Keine Route mit einem Waypoint bei `(0,0)` aus einer Kante mit fehlendem
  Endpunkt.
- `publishCableRouteFinalValidation` enthält bei fehlender Route
  `ROUTE-MISSING`, bei unbekanntem Handle `ROUTE-INPUT`, bei
  Innensegmenten `ROUTE-OWN-NODE`.
- `RoutingStatusBadge` und `useLiveValidation` zeigen diese Befunde.
- `npm test`, `routing:audit`, Golden/Regression unverändert grün.

### P1 — Aussagekraft der Gates und Invarianten

4. **B-04:** Qualitätsassertions im Live-Gate, realistischer großer Plan,
   Qualitätskennzahlen im Output.
5. **B-05:** Port-Bündel-Ausnahme an den gemeinsamen Port binden; Positiv-
   und Negativtest.
6. **B-06:** Same-Point-Semantik festlegen und in Vertrag, Final-Gate und
   Tests vereinheitlichen.
7. **B-07:** Worker anbinden oder Laufzeitbudget dokumentieren; vorher B-11
   beheben.

### P2 — Fachliche Restpunkte und Hygiene

8. **B-08:** Domänenbewusste I3-Prüfung + `routing:domain-probe` als
   Ratchet-Gate (8 → 0).
9. **B-09:** Sanity/Shape als eigene Invariante etikettieren.
10. **B-10:** Cache-Schlüssel aus `capped` bilden; `ownObstacles`-Geometrie
    aufnehmen.
11. **B-11:** `baseClearance` lokal halten.
12. **B-12:** Hop-Domäne aus `domainById`; stale Kommentar korrigieren.
13. **B-13:** Einzelkanten-Fallback mit `ownObstacles`; Test mit
    überlappendem Fremdnode.
14. **B-15:** Audit-IDs dokumentieren.

### P3 — Grenzfälle

15. **B-14:** Platzierungs-/Überlappungswarnung vor dem Routing; keine
    Routeränderung.
16. Doppelte Fallback-Maße `192/120` in `routeAll.ts:172–173` durch die
    exportierten `NODE_FALLBACK_WIDTH/HEIGHT` ersetzen (Driftgefahr).

---

## 7. Anhang

### A. Ausgeführte Befehle

```bash
npm test
npm run test:goldenmaster
npm run test:regression
npm run typecheck
npm run routing:audit
npm run routing:domain-probe
npm run perf:edge-routing
```

### B. Datei-/Zeilenregister

| Befund | Datei                                                         | Zeilen                                   |
| ------ | ------------------------------------------------------------- | ---------------------------------------- |
| B-01   | `components/edges/utils/routeAll.ts`                          | 182–184, 903, 970–976                    |
| B-02   | `components/edges/utils/routeAll.ts`                          | 188–190                                  |
| B-02   | `components/edges/utils/routeValidation.ts`                   | 50–65                                    |
| B-03   | `components/edges/utils/cableRouteStore.ts`                   | 45, 295–317, 482, 487, 602–606, 678, 685 |
| B-03   | `components/edges/utils/routeValidation.ts`                   | 16–84                                    |
| B-03   | `components/planner/hooks/useLiveValidation.ts`               | 949–963                                  |
| B-04   | `benchmarks/edgeRoutingPerf.bench.ts`                         | 32–58, 238–288                           |
| B-04   | `.github/workflows/quality.yml`                               | 126–138                                  |
| B-05   | `lib/routing/rules/portBundle.ts`                             | 47–51, 102–120                           |
| B-05   | `lib/routing/invariants.ts`                                   | 145–153                                  |
| B-06   | `components/edges/utils/pathfinding.ts`                       | 2249–2259                                |
| B-06   | `lib/routing/finalValidation.ts`                              | 156–161                                  |
| B-06   | `components/edges/utils/pathfinding.test.ts`                  | 287–291                                  |
| B-06   | `components/edges/utils/orthogonalRouting.invariants.test.ts` | 165–171                                  |
| B-07   | `components/edges/utils/cableRouteStore.ts`                   | 219, 602                                 |
| B-07   | `components/edges/utils/routingWorkerClient.ts`               | 1–81 (nur Testkonsument)                 |
| B-08   | `lib/routing/invariants.ts`                                   | 203–264                                  |
| B-08   | `lib/routing/rules/collision.ts`                              | 262–272                                  |
| B-08   | `components/edges/utils/routeAll.ts`                          | 1403–1436                                |
| B-09   | `lib/routing/finalValidation.ts`                              | 156–181                                  |
| B-10   | `components/edges/utils/pathfinding.ts`                       | 1989–2014, 2566–2573                     |
| B-11   | `components/edges/utils/separation.ts`                        | 231, 304, 631                            |
| B-12   | `components/edges/utils/routeAll.ts`                          | 944–945, 1492–1507                       |
| B-12   | `lib/routing/rules/hopping.ts`                                | 109–118                                  |
| B-13   | `components/edges/CableEdge.tsx`                              | 521–543                                  |
| B-13   | `components/edges/utils/pathfinding.ts`                       | 2033–2056                                |
| B-14   | `lib/routing/invariants.ts`                                   | 87–109                                   |
| B-15   | `components/edges/utils/routeAll.ts`                          | 970                                      |

### C. Reproduktionshinweise

Die Proben wurden mit `NODE_ENV=production npx tsx` gegen den echten
Produktivcode ausgeführt. Für eine dauerhafte Absicherung sollten die Fälle
als Vitest-Tests in `components/edges/utils/routeAll.test.ts` bzw.
`components/edges/utils/cableRouteStore.test.ts` landen:

- **Hängekante:** Knoten `a`, `b`; Kanten `a→b` und `a→ghost`; erwartet:
  keine Route für `a→ghost`, Report `ROUTE-INPUT`/`ROUTE-MISSING`.
- **Geometrieloser Knoten:** `b` ohne `position`; erwartet: keine Route,
  Report `ROUTE-INPUT`.
- **Unbekannter Handle:** gemessene Handles `plus`/`minus`, Kante mit
  `ac_out`; erwartet: keine Route, `ROUTE-INPUT`, Startpunkt nicht `plus`.
- **Fehlende Route:** `computeCableRouteFinalValidation` mit leerer
  Routen-Map; erwartet: `INVALID`, `ROUTE-MISSING` (nicht `VALID`).
- **Eigener Node:** orthogonaler Pfad, der den Source-Node innen durchquert;
  erwartet: `INVALID`, `ROUTE-OWN-NODE`.
- **Port-Bündel:** die Geometrie aus B-05; erwartet: `isPortBundleOverlap`
  = `false`.
- **Same-Point:** ein Punkt; erwartet: die in B-06 festgelegte Semantik.

### D. Einschränkungen

- Die Stressplan-Zahlen aus B-04 sind ein synthetischer, absichtlich dichter
  Plan; sie sind kein Nachweis eines Produktionsregresses.
- Die Domänen-Probe misst parallele Segmentpaare; sie ist keine Aussage über
  kreuzende Paare (die als `soft` zulässig sind).
- Die elektrische Bewertung der Auswirkungen (Spannungsfall, Querschnitt)
  wurde nicht neu gerechnet; die Route-Length-Kopplung ist im Code belegt.
- Es wurden keine Produktivdateien geändert; dieses Dokument ist der einzige
  neue Inhalt.

---

**Fazit.** Die Routing-Engine ist auf den sechs Referenzplänen und in den
bestehenden Goldens stabil und deterministisch. Die größte Schwachstelle ist
nicht die Geometrie auf diesen Plänen, sondern die **Kette aus stillen
Eingabefehlern und schwacher Live-Validierung**: fehlende Endpunkte und
unbekannte Handles erzeugen Routen, die der Live-Report als `VALID` ausgibt,
weil ihm die Vertragsprüfungen fehlen. Diese Kette ist mit wenigen,
gezielten Änderungen schließbar; die Empfehlungen P0 sind dafür der
kleinste zusammenhängende Schnitt.
