# ROUTING-MULTIPHYSICS — Orthogonales Routing & Multi-Physics-Netzwerk-Engine

Stand: 2026-09-28 · Status: **Architekturentwurf & Mathematische Ausarbeitung** (kein Produktivcode)
Grundlage: Master-Prompt „Industrial-Grade Orthogonal Routing & Multi-Physics Network Engine"
Verwandte Spezifikationen: `docs/ROUTING-V2.md` (Frozen Spec) · `docs/ROUTING-INVARIANTS.md` (Legacy-Vertrag) ·
`docs/PERFORMANCE.md` · `AGENTS.md` (Gate-Disziplin)

> **LESER-HINWEIS:** Dieses Dokument beschreibt (a) die **mathematischen Fundamente** des
> bestehenden Produktivroutings mit exakten Verweisen auf den Code, (b) die **Kernteil-
> Architektur** als prüfbaren Pseudocode/TypeScript-Schnitt und (c) die **Lücken** gegenüber
> dem Master-Prompt mit einem Gate-konformen Umsetzungspfad. Wo Formeln _Zielzustand_ sind
> und noch keinen Produktivkonsumen haben, ist das jedes Mal ausdrücklich markiert —
> genauso wie es die Zitierdisziplin des Projekts (VERIFIED/UNVERIFIED, ADR-Ratchet)
> verlangt. Zahlwerte stammen aus `lib/routing/tokens.ts`, `lib/routing/rules/costModel.ts`
> und `lib/electrical.ts`; nichts davon ist in diesem Dokument neu „bestimmt" worden.

---

## 0. Executive Summary & Ist-Analyse

Der Bestand ist keine Skizze, sondern eine lauffähige, gate-gesicherte Engine: Der
Produktivpfad `routeAllCables` (Katalog → Hanan-A\* → Nudging → Hopping → Final Gate)
liefert deterministische 90°-Trassen, deren Invarianten I1–I7 vor jedem Rendering binär
abgeprüft werden (`lib/routing/finalValidation.ts` → `RoutingStatusBadge`). Die
mathematischen Bausteine des Master-Prompts — Hanan-Grid, richtungsabhängige Kosten,
zulässige Heuristik, Spatial Index, Overlap-Verbot bei erlaubten Crossings, Lane-Registry,
Nudging — **sind implementiert und testgesichert**. Die Multi-Physics-Seite ist dagegen
teilweise separat (Spannungsfall, thermische Dimensionierung) und **nicht in die
Routenkosten eingekoppelt**; die VDE-0298-4-Häufung (Bündelungsderating) fehlt als
Modell vollständig.

### 0.1 Anforderungsmatrix (Master-Prompt → Ist)

| #   | Anforderung                                          | Status      | Stelle(n) im Code                                                                         |
| --- | ---------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| 1   | Deterministisches 90°-Routing, Bend-Minimierung      | ✅          | `components/edges/utils/pathfinding.ts` (Katalog + `hananAStar`, `turnCost`)              |
| 2   | Hanan-Grid, Sichtbarkeitsdiskretisierung, RSMT-Bezug | ✅ / ⚠️     | `buildHananGridMasks`, `hananAStar`; RSMT-Trunk-Pass nur Roadmap (§5.3)                   |
| 3   | Richtungsabhängiges Kostenmodell $f=g+h$             | ✅          | `lib/routing/rules/costModel.ts` (Token-abgeleitet), `remainingCostLowerBound`            |
| 4   | Zulässige, monotone Heuristik                        | ✅          | `remainingCostLowerBound` (Beweis §1.5)                                                   |
| 5   | Spatial Index für Segment-Schnitte                   | ✅          | `lib/routing/geometry/segmentSpatialIndex.ts` (Hash-Grid, Zelle 160 px)                   |
| 6   | Overlaps strikt verboten, Crossings erlaubt          | ✅          | `lib/routing/rules/collision.ts` (hard/soft), `invariants.ts` I1/I2, `finalValidation.ts` |
| 7   | Nudge/Lane-Registry (äquidistante Trassen-Lanes)     | ✅          | `components/edges/utils/nudge.ts`, `lib/routing/rules/laneRegistry.ts`                    |
| 8   | $P=I^2R$, $R(T)$, $I_z(A)$, Derating                 | ⚠️ getrennt | `lib/electrical.ts`, `lib/materials.ts` — **keine Einkopplung in die Routenkosten**       |
| 9   | Bündelung/Häufung nach VDE 0298-4 aus der Geometrie  | ❌          | `DERATE_FACTOR = 0.7` ist pauschal („Bündelung nicht modelliert", `electrical.ts` Z. 32)  |
| 10  | Spannungsfall $\Delta U\%$ aktiv optimieren          | ⚠️          | Prüfung existiert (`voltageDrop.ts`), Optimierung im A\* nicht eingekoppelt               |
| 11  | Strömungsverluste Medienleitungen                    | ❌          | `WaterPipeEdge` ohne Druckverlustmodell (Entwurf §3.5)                                    |
| 12  | 16 ms Frame-Budget, inkrementell, Spatial Index      | ✅          | `npm run perf:edge-routing`, `routingCache.ts`, `MAX_EXPANSIONS`, Fensterung              |
| 13  | State Separation Domain ↔ UI                         | ✅          | ADR 0007/0008/0014: `lib/routing/*` framework-frei, Adapter in `components/edges`         |
| 14  | 5-stufige Pipeline                                   | ✅          | §4.2 (Ist-Ablauf von `routeAllCables`)                                                    |
| 15  | Dense-Grid-Problem                                   | ⚠️          | Mechanismen da (Fan-Out, Lanes, Spacing-Tokens); Kapazitäts-/RnR-Formalismus fehlt (§5)   |

**Die drei wesentlichen Lücken** (detailliert in §6):

1. **Häufung fehlt:** Die Geometrie weiß ab jetzt, _wo_ Leitungen parallel laufen
   (Lane-Registry, Spatial Index) — das Elektromodell nutzt diese Information nicht.
   `I_z` wird mit einem pauschalen Faktor 0,7 statt mit $k_B(n)$ je Bündel gebildet.
2. **Physik ≠ Pfadkosten:** $\Delta U$ und $I^2R$ werden _nach_ dem Routing bewertet,
   nicht _währenddessen_. Ein stromintensiver DC-Pfad bekommt dieselbe Längenkosten wie
   ein Signalkabel.
3. **Kapazität als harter Constraint:** Das Dense-Grid-Problem wird durch
   Platzierungstokens _vorgebeugt_ (gut), aber der Router besitzt keine explizite
   Korridorkapazität $n_{\max}(W)$ und keinen deterministischen Rip-up-&-Reroute-Loop
   für den Fall $n > n_{\max}$.

---

## 1. Modul 1 — Topologische & Mathematische Fundierung

### 1.1 Gitter-Diskretisierung: Hanan-Grid und RSMT

**Satz (Hanan 1966).** Für eine Punktmenge $P$ existiert ein rectilinear Steiner
Minimum Tree (RSMT), dessen Kanten vollständig auf dem _Hanan-Grid_

$$
H(P) \;=\; \Big\{ (x,y) \;\Big|\; x \in \{p_x : p \in P\},\; y \in \{p_y : p \in P\} \Big\}
$$

liegen. Beweisidee: Jede Kante eines beliebigen RSMT kann ohne Längenzunahme auf die
durch ihre Endpunkte gespannten Gitterlinien projiziert werden; Kollisionen dabei lassen
sich durch lokale Umformungen (Steiner- punkt-Verschiebung entlang der Gitterlinien)
auflösen, ohne die Länge zu erhöhen. (RSMT ist im Allgemeinen NP-schwer — Garey, Graham
& Johnson 1977; der Satz sichert nur die **Optimalitätslage**, nicht die Berechenbarkeit.)

Für das Routing bedeutet das: Der A\*-Suchraum muss nicht alle Punkte der Ebene
enthalten — es genügt das Hanan-Grid der relevanten Koordinaten, und **jeder
kürzeste rechtwinklige Pfad ist auf ihm darstellbar**. Der Produktiv-Router baut es in
`hananAStar` (`pathfinding.ts` Z. 1091 ff.):

```ts
// Ist-Form (gekürzt): xs/ys = Hanan-Achsen aus Start, Ziel, Hindernis-Kanten,
// plus Zusatzachsen (extraXs/extraYs) — exactXs/exactYs haben Vorrang.
const xs = uniqueSorted(
  [start.x, goal.x, ...extraXs, ...obstacles.flatMap((r) => [r.x, r.x + r.width])],
  exactXs
);
```

**Adaptive Hanan-Erweiterung um Clearance-Masken.** Der Master-Prompt fragt ein Grid,
das Sicherheits-Offsets dynamisch mitführt. Die Ist-Lösung erreicht das nicht über
verdoppelte Achsen, sondern über _Aufblähung + Maske_ — mathematisch äquivalent und
billiger:

1. **Hindernis-Inflation:** $R' = R \oplus B_\infty(c)$, Minkowski-Summe mit der
   $\ell_\infty$-Kugel der Clearance $c$ (im Legacy-Pfad `OBSTACLE_MARGIN = 14`,
   im V2-Modell `cableClearance = 12` getrennt von der Härte-Prüfung).
2. **Maskenbau** (`buildHananGridMasks`): Für jedes Solids $R'$ werden die
   Gitterzeilen/-spalten mit $y \in (R'.y+\varepsilon,\; R'.y+h-\varepsilon)$
   binär gesucht (`firstIndexGreater` / `firstIndexGreaterEqual`) und als Intervall
   markiert — dreifach `blocked` (Punkte), `hClosed`/`vClosed` (Kanten). Kosten sind
   $\propto$ abgedeckte Zellen statt $\propto$ alle Zellen × alle Solids
   (AUDIT PERF-001: von $O(|X|\!\cdot\!|Y|\!\cdot\!|O|)$ auf $O(\sum_o \text{Zellen}(o))$).
3. **Domänen-Clearance:** Unterschiedliche Mindestabstände (Elektro↔Wasser:
   `crossDomainSpacing = 24`) werden nicht als eigene Grid-Achse geführt, sondern als
   Paarregel im Kollisionsmodell (`domainSeparationRules`, Schicht 3) — die Achsen
   bleiben domäneneutral, die _Bewertung_ kennt die Domäne.

**Regel für adaptive Masken (Zielvorschlag):** Die exakte Äquivalenz
„Inflation + Masking ≡ erweiterte Hanan-Achsen $\{x_e\!-\!c, x_e, x_e\!+\!c\}$" gilt nur,
solange die Clearance raumkonstant ist. Sobald sie segmentsweise variiert (z. B.
Bündel-Derating-Abstände), ist Variante 2 nicht mehr äquivalent — dann sind pro
Hindernis die **drei verschobenen Achsen** in `xs`/`ys` aufzunehmen und die Maske mit
der lokalen Clearance zu bewerten. Kosten: $|X|,|Y|$ wachsen um $O(|O|)$, die Masken-
Markierung bleibt Intervall-basiert.

### 1.2 Rasterkonflikte bei ungeraden bzw. nah beieinander liegenden Koordinaten

Das Problem: Pixelgeometrien erzeugen Koordinaten, die kleiner als die
Unterscheidungsschwelle $\varepsilon$ auseinanderliegen oder nach Rundung
zusammenfallen — dann kollabieren Gitterzellen, und Entscheidungen hängen von der
Fließkomma-Reihenfolge ab (Nichtdeterminismus).

**Drei Regeln, im Code umgesetzt und testgesichert:**

1. **Exakte Menge hat Vorrang vor Menge mit Toleranz.**
   `uniqueSorted(values, exact)` führt Start-/Zielkoordinaten als _exakt_ geführt:
   Sie werden nie mit Nachbarn verschmolzen, nur die Hindernisachsen werden unter
   Toleranz dedupliziert. Formell: $x \sim x' \iff |x-x'| \le \varepsilon$ ist eine
   Äquivalenzrelation nur auf der Menge der _Nicht-Exakt-Werte_; die Exakt-Werte bilden
   eigene Klassen.
2. **Rundung trifft nie die Geometrie — nur Cache-Schlüssel.** Die echte
   Rasterkonflikt-Geschichte des Codes ist die umgekehrte: _Früher_ rundete `quantize`
   jede Gitterlinie auf das 0,5-px-Raster — ein Handle auf $x = 437{,}6$ landete bei
   $437{,}5$, und `stitchOrthogonal` musste 0,1 px als Mini-Segment am Handle
   ausgleichen (ROUTE-BUG-1: Kehre am Handle, I4/I6-Verstöße). Heute bleiben
   Start/Ziel **exakt** (`exactXs/exactYs` haben in `uniqueSorted` Vorrang);
   `quantize(n) = round(n·QUANT)/QUANT` mit `QUANT = 2` dient ausschließlich den
   **Cache-Schlüsseln** (`findCablePath`-Hash) — dort ist Toleranz erwünscht, damit
   Layout-Jitter denselben Treffer liefert. Zusätzlich entfallen Hindernislinien,
   die näher als `GRID_MIN_GAP = segmentMin` (16 px) an Pflicht-Linien liegen —
   keine Mini-Zellen unterhalb der I6-Mindestlänge (ROUTE-BUG-14).
3. **Streng-Innen-Prädikate mit $\varepsilon$-Rand.** Blockierung ist
   $x \in (R.x+\varepsilon,\; R.x+w-\varepsilon)$ — eine Gitterlinie _auf_ der
   Hinderniskante ist frei. Damit ist die Zerlegung „Punkt auf der Kante gehört zu
   keinem Solid" wohldefiniert und bitweise deterministisch (Äquivalenz-Fuzz in
   `hananGridMasks.test.ts`).

Zusammen ergeben sie die **Diskretisierungs-Invariante**: Pflicht-Linien
(Start/Ziel/Stub) tragen ihre exakten Werte, jede andere Achse liegt mindestens
`GRID_MIN_GAP` davon entfernt (Toleranz $\varepsilon$ nur für identische Werte).
Damit entstehen keine Zellen unterhalb `segmentMin` (I6) und keine Rundungs-Stummel
am Handle (I4/I5); eine Segmentlänge $<\varepsilon$ kann nicht werden
(`segmentHitsRect` wechselt nie den Ast der Fallunterscheidung), und die Maske ist
bitweise stabil gegen die Reihenfolge der Solids (`hananGridMasks.test.ts`).

### 1.3 Suchraum und Zustand

$$
S \;=\; X \times Y \times D, \qquad D = \{\text{E},\text{N},\text{W},\text{S}\} \cong \{0,1,2,3\}
$$

Der Zustand trägt die **Richtung** (Heading), weil Biegungen nur richtungsabhängig
bewertbar sind. Packung im Code: `key = (iy·nx + ix)·4 + hd` (vollständig-injektiv,
`Map<number, number>` für `gScore`/`parent`). Nachfolger:

$$
\text{succ}\big((x,y,d)\big) = \{(x',y,d') : d' \in D,\; \text{Kante frei}\} \cup \{(x,y',d')\}
$$

wobei „Kante frei" über die `hOpen`/`vOpen`-Masken geprüft wird (bewegliche Kante nur
wenn **beide** Endzellen frei und nicht `closed`). Start-/Zielrichtung kommen aus der
Handle-Normale (`sourceExitVector`/`portNormal`), der Stub-Frame (`portFrame`)
garantiert $\text{stub} \ge \texttt{stubMin} = 24$ px vor der ersten Richtungsänderung
(Port-Zwang, R-7).

**Erweiterung für Bündel-Lanes (Ziel):** $S' = X \times Y \times D \times L$ mit
$L \in \mathbb{Z}$ (Lane-Index). Ein Lane-Wechsel kostet $c_{\text{laneHop}}$ und ist
nur als Quersegment der Länge `segmentMin = laneGrid = 16` zulässig (Token-Invariante
aus `tokens.ts`: I6 wäre sonst unerfüllbar). Dieser Zustand existiert als Entwurf in
`ROUTING-V2.md` §5; der Produktivpfad realisiert Lanes derzeit als
**Parametervarianten** (lane/laneStep in `PathRequest`) statt als Suchraumdimension —
bewusst, weil jede Suchraumdimension die expansionsbasierte Obergrenze belastet.

### 1.4 Kostenmodell $f(n) = g(n) + h(n)$

**Pfadkosten** für einen Pfad $\pi = (s_0, s_1, \dots, s_m)$ (Segmente) mit Richtungen
$d_i$:

$$
\boxed{\;
G(\pi) \;=\; \underbrace{\sum_{i=1}^{m} \ell_i}_{\text{Länge}}
\;+\; \underbrace{c_b \cdot B(\pi) + c_u \cdot U(\pi)}_{\text{Biegungen}}
\;+\; \underbrace{\sum_{i=1}^{m} \Phi\big(s_i,\; \mathcal{I}\big)}_{\text{Umgebung}}
\;+\; \underbrace{\mu_e \sum_{i=1}^{m} \ell_i}_{\text{physikalisch gewichtete Länge (Ziel, §3.4)}}
\;}
$$

mit

$$
B(\pi) = \big|\{i : d_i \perp d_{i+1}\}\big|, \qquad
U(\pi) = \big|\{i : d_{i+1} = -d_i\}\big|
$$

$$
\ell_i = \| s_{i+1} - s_i \|_1 \quad(\text{Manhattan, da achsenparallell} \equiv \text{euklidisch})
$$

**Umgebungsbeitrag** $\Phi$ — streng deterministisch aus dem `SegmentSpatialIndex`
$\mathcal{I}$, Klassifikation ausschließlich über `rules/collision.ts`:

$$
\Phi(s, \mathcal{I}) =
\begin{cases}
+\infty & \text{Overlap (kollinear, Maß} > 0\text{)} \wedge \neg\,\text{PortBundle}\\[4pt]
c_x \cdot X(s) + c_c \cdot C(s) + c_n \cdot N(s) & \text{sonst}
\end{cases}
$$

$$
c_{\text{turn}}(d \to d') =
\begin{cases}
0 & d' = d\\
c_b & |d' - d| = 1 \ (\text{mod } 4)\\
c_u & d' = -d
\end{cases}
$$

**Ist-Werte** (abgeleitet: `COST_FACTORS` × `laneGrid = 16` — Quelle
`lib/routing/rules/costModel.ts`, wertgleich eingefroren via Sync-Test):

| Term                 | Symbol            | Faktor                   | Wert [px-äquiv.] | Bedeutung                                  |
| -------------------- | ----------------- | ------------------------ | ---------------- | ------------------------------------------ |
| Overlap              | —                 | $\infty$                 | $\infty$         | **hart verboten** (ADR 0009)               |
| Clearance-Verletzung | $c_c$             | $25 \times$ laneGrid     | 400              | gewichtet, aber schlimmer als jede Kehre   |
| Crossing             | $c_x$             | $7,5 \times$ laneGrid    | 120              | soft — minimieren, nicht verbieten         |
| 90°-Biegung          | $c_b$             | $5 \times$ laneGrid      | 80               | Detour-Budget: $\le 80$ px lohnt eine Ecke |
| 180°-Kehre           | $c_u$             | $25 \times$ laneGrid     | 400              | $= 5$ Biegungen, nur wenn erzwungen        |
| Nachbar-Lane         | $c_n$             | $1 \times$ laneGrid      | 16               | Bündelungs-Druck knapp über Clearance      |
| Bevorzugte Lane      | $c_{\text{pref}}$ | $-0{,}5 \times$ laneGrid | $-8$             | Bonus (kein Produktivkonsument, ROUTE-002) |

**Nicht-Linearität:** Die geforderte Nicht-Linearität entsteht nicht durch
Polynomialkosten in $\ell$, sondern durch (a) die **stufenweise Umgebungsfunction**
$\Phi$ (Sprünge bei Clearance-/Overlap-Schwellen), (b) die **Suchraumgeometrie**
(Hindernisse erzwingen Umwege, die $G$ überproportional treiben) und (c) geplante
**netzabhängige Gewichte** $\mu_e$ (§3.4), die stromintensive Pfade verteuern, ohne
die Heuristik zu brechen. Alles bleibt in der **einen Währung „px-äquivalent"**
(1 Kosteneinheit = 1 px Extraweg) — das ist die Skalierungsconvention, die es erlaubt,
Biegung, Kreuzung, Thermik und Spannungsfall auf einer Achse zu addieren (λ kalibriert,
§6).

### 1.5 Heuristik $h(n)$: zulässig, monoton, fehlerfrei

**Ist-Formel** (`remainingCostLowerBound(x, y, hd, gx, gy, gh)`):

$$
h(n) \;=\; \underbrace{|x_n - x_g| + |y_n - y_g|}_{\text{Manhattan}}
\;+\; c_b \cdot b_{\min}\big(d_n,\; d_g,\; \Delta\big)
$$

wobei $b_{\min}$ die Mindestanzahl Richtungsänderungen ist, die von Heading $d_n$ bei
Zielvektor $\Delta = (x_g-x,\; y_g\!-\!y)$ nötig sind, **und** am Ziel die Sonderregel

$$
h = \min\big(c_u,\; 2 c_b\big) \quad \text{wenn } \Delta = 0 \text{ und } d_g = -d_n
$$

**Lemma 1 (Zulässigkeit, $h \le h^\*$).**
(i) In einem 4-connecteden Graphen ist jedes Zielpfad-Längenminimum $\ge \|\Delta\|_1$
(Koordinaten trennen sich additiv je Achse). (ii) Jede im Restpfad nötige
Richtungsänderung kostet in $g$ mindestens $c_b$, da $\text{turnCost} \in \{0, c_b, c_u\}$
und $c_u \ge c_b$; $b_{\min}$ zählt nur _nötige_ Änderungen, also
$b_{\min} \cdot c_b \le$ Kosten der realen Reständerungen. (iii) Für $\Delta = 0$ mit
Gegenüber-Heading ist die reale Restkosten mind. $c_u$; der Schätzwert
$\min(c_u, 2c_b) \le c_u$ ist zulässig. □

**Lemma 2 (Konsistenz/Monotonie, $h(n) \le c(n,n') + h(n')$).**
Für einen Suchschritt $n \to n'$ mit Kosten $c(n,n') = \ell + \text{turnCost}$:
Die Manhattan-Komponente erfüllt die Dreiecksungleichung mit Gleichheit entlang der
Achsenbewegung ($|\Delta_x|' \le |\Delta_x| + \ell_x$); die Bend-Komponente kann höchstens
um $c_b$ sinken, wenn die Bewegung die letzte Richtungsänderung „überflüssig" macht —
genau dann, wenn $c(n,n') \ge c_b$. Am Ziel ($\Delta = 0$) folgt die Abschätzung aus
Lemma 1(iii). □

**Korollar (Optimalität).** A\* mit zulässiger, konsistenter Heuristik und
nichtnegativen Kantenkosten ist optimal bezüglich $G$ (Hart, Nilsson & Raphael 1968).
Nichtnegativität ist im Code erzwungen: die einzigen negativen Termine ($c_{\text{pref}}$)
sind keine Suchkosten, sondern Bewertungsboni — solange ein Bonus nie in `g` des
Suchloops eingeht, bleibt A\* optimal. **Regel für die Physik-Einkopplung (§3.4):**
Nimmt $\mu_e$ in `g` ein, so bleibt $h$ zulässig, weil $\mu_e$ **konstant je
Suchlauf** ist: $h_{\mu}(n) = \mu_e\|\Delta\|_1 + c_b b_{\min}$. Für
_suchraumweite_ Variable (z. B. Bündel-Strafen, die von der Nachbarschaft abhängen)
gilt: entweder als Kantenkosten in $g$ (zulässig, da $\ge 0$) oder gar nicht in $h$ —
$ h $ unterschätzt dann weiter, wird nur _weniger scharf_.

**Expansionsdeckel:** `MAX_EXPANSIONS = 48_000`; bei Überschreitung wird das beste
bisherige Zielergebnis zurückgegeben (`bestGoalKey`), nie `null` erzwungen — der
Katalog-Vorlauf und der Nudge-Postprozess fangen Restfälle ab. Die Heuristik ist
gleichzeitig der Grund, dass der Deckel selten greift: ohne Biegungsanteil würde A\*
ganze Hindernisflächen wellenförmig abtasten.

### 1.6 Katalog-Vorlauf (Gerade / L / Z / U)

Vor dem A\* prüft `bestFreeCatalog` eine feste Katalogfamilie (`catalogCandidates`:
Gerade, L in beiden Drehungen, Z in vier Varianten, U-Loop, Varianten `midX/midY/late`).
**Warum das korrekt ist:** Für zwei Rechtecke mit achsenparallelen Ports existiert
stets ein manhattan-optimaler Pfad mit höchstens 3 Biegungen außerhalb der
Hindernisse — die Kandidaten sind genau diese Normalformen. Ist einer kollisionsfrei,
ist er Längen-optimal; die Katalog-Bewertung `scoreCatalog` wendet dieselben
$c_b, c_u$ an, sodass Katalog und A\* **in derselben Währung** vergleichen. Erst wenn
kein Kandidat frei ist, wird das Grid durchsucht. Das hält den typischen Fall
(meist gerade Korridore) bei $O(1)$ Suchläufen.

---

## 2. Modul 2 — Kollisionen, Spatial Index & Routing-Garantien

### 2.1 Segment Spatial Index

**Struktur** (`lib/routing/geometry/segmentSpatialIndex.ts`): uniformes Hash-Grid,
Zellgröße `SPATIAL_CELL_SIZE = 160` px (≈ 2 Kabelabschnitte + Freigabe). Jedes Segment
wird in alle Zellen seiner Bounding-Box eingetragen (dedupliziert pro Zelle).

| Struktur              | Einfügen              | Abfrage                   | Aufwand                       | Urteil für diesen Anwendungsfall                                            |
| --------------------- | --------------------- | ------------------------- | ----------------------------- | --------------------------------------------------------------------------- |
| Brute Force           | $O(1)$                | $O(N)$ je Segment         | $O(S^2)$ gesamt               | ❌ ab ~120 Kanten messbar (ehem. `CROSSING_SCAN_EDGE_LIMIT`)                |
| **Hash-Grid (Ist)**   | $O(\text{Zellen}(s))$ | $O(\text{Zellen}(q) + k)$ | $O(S)$ Bau                    | ✅ statisch, achsenparallell, gleichmäßig verteilt                          |
| Interval Tree (Achse) | $O(\log N)$           | $O(\log N + k)$           | $O(N \log N)$                 | ⚠️ nur 1D; für 2D Kreuzungstests je Achse zweimal + Filter                  |
| R-Tree (STR bulk)     | $O(N \log N)$         | $O(\log N + k)$           | speicherintensiv, Rebalancing | ⚠️ Vorteil nur bei stark schiefer Verteilung; Index wird je Pass neu gebaut |

**Analyse.** Der Index ist _pro Routing-Pass statisch_ (kein Rebalancing nötig),
Segmente sind achsenparallell und gleichmäßig (Korridore), die Abfrage ist immer
Bounding-Box + exakter Folgetest (`segmentsIntersect` beim Aufrufer — der Index
liefert nur die Grobmenge). Bei diesem Profil ist das Hash-Grid asymptotisch
$O(1)$-Amortized pro Abfrage und konstanter Faktor besser als R-Tree. Ein
Interval-Tree-Zwischenschritt (nur horizontale bzw. vertikale Segmente) wäre die
logische Verfeinerung, falls je Korridor mit extrem hohem $k$ (Dichte, §5) zu rechnen
ist — dann: eine 1D-Struktur je Orientierung, Abfrage = Intervallsuche auf der
Quer-Achse, $O(\log S + k)$.

**Hot-Path-Regeln (Ist):** `queryRectInto(rect, out, seen)` mit vom Caller
wiederverwendeten Puffern (kein GC-Druck im Frame); `queryNear(a, b, padding)` bildet
die Bounding-Box des Segments ⊕ Padding — Padding = `nearbyBand = cableClearance + laneGrid`,
also genau die Reichweite von $\Phi$.

### 2.2 Kollisionsmodell: Overlap verboten, Crossing erlaubt

**Formale Definitionen** für Segmente $s_1 = \overline{p_1q_1}$, $s_2 = \overline{p_2q_2}$,
Toleranz $\varepsilon$:

$$
\text{Overlap}(s_1,s_2) \iff \text{kollinear} \;\wedge\; \lambda\big(I_1 \cap I_2\big) > \varepsilon
$$

wobei $\lambda$ die 1D-Länge des Intervallschnitts auf der gemeinsamen Geraden ist —
also **positives Maß**, kein Punktschnittpunkt. Parallel-verschobene Segmente mit
Abstand $> 0$ sind kein Overlap (das ist der Nudge-Fall), kollineare Stubs am selben
Handle sind Overlap _zulässiger Sonderfall_ (Port-Bündelung, ADR 0009, Prüfung
`isPortBundleOverlap`: Überdeckung vollständig in den Stubs **beider** Kanten +
gemeinsame Anschlussstelle; ohne Stub-Kenntnis fail-safe hart).

$$
\text{Crossing}(s_1,s_2) \iff \text{transversaler Schnitt bei genau einem Punkt},\;
\text{richtungsverschieden} \;(s_1 \perp s_2)
$$

**Klassifikationstabelle** (`rules/collision.ts` — EIN Modell für ELK- und A\*-Pass):

| Befund                 | Klasse     | Konsequenz A\*                      | Invariante                  |
| ---------------------- | ---------- | ----------------------------------- | --------------------------- |
| Edge × fremde Node-Box | `hard`     | $\Phi = \infty$, nicht expandierbar | **I1**                      |
| Edge × Edge (Overlap)  | `hard`     | $\Phi = \infty$ (außer Port-Bündel) | **I2**                      |
| Edge × Edge (Crossing) | `soft`     | $+c_x = 120$ je Schnitt             | I10 (nur wenn unvermeidbar) |
| Abstand $< c$          | `weighted` | $+c_c = 400$                        | **I3**                      |
| Abstand $< c + g$      | `none`     | $+c_n = 16$ (Bündelungs-Druck)      | —                           |
| sonst                  | `none`     | $0$                                 | —                           |

**Zwei-Ebenen-Garantie** (die „mathematische Strenge" des Master-Prompts):

1. **Suchebene:** Härte ist _struktural_ — Overlaps können gar nicht entstehen, weil
   fremde Segmente als Tube-Boxen (`cableTubes`) bzw. Index-Nachbarn mit
   $\Phi = \infty$ in den Suchraum eingespeist sind.
2. **Abnahmeebene:** `finalValidation.ts` prüft I1/I2/I3 binär (kein Gewichten!) und
   meldet `INVALID` ab der ersten Verletzung. Ein Kostenmodell kann eine Kollision nur
   _unwahrscheinlich_ machen — die Invariante macht sie _unmöglich_ zu akzeptieren.
   Gate: `npm run routing:audit` (G1/G2/G3 aus `ROUTING-V2.md` §10:
   $0$ Overlaps, $0$ Edge-Node-Collisions, Clearance $\ge$ `cableClearance`).

**Orthogonale Brücken-/Tunnel-Konvention (Crossings).** Verbleibende Crossings werden
nicht aufgelöst, sondern **dargestellt**: Die Kante mit der niedrigeren Priorität hüpft.
Priorität (`rules/hopping.ts`):

$$
\text{routingPriority} = \text{domainPriority} + w_{\text{backbone}} + w_{\text{crossSection}} + w_{\text{manualLock}}
$$

Der Hüpfer bekommt am Schnittpunkt einen halbkreisförmigen Bogen (Radius
`hopRadius`, gerendert via `waypointsToPathWithHops`) — die Konvention entspricht dem
Schaltplan-„Bridge"-Symbol: eine Leitung geht sichtbar _über_ die andere hinweg,
ohne elektrische Verbindung. **Topologisch bleibt der Schnitt ein Crossing** (Punkt,
Maß 0), I2 ist nicht berührt; der geprüfte Zustand „Hop entfernt keine Kollision gegen
Objekte — nur Kanten-Crossings" ist testgesichert.

### 2.3 Nudging & Lane-Registry (äquidistante Trassen-Lanes)

**Nudging** (`nudge.ts`, libavoid-Phase-2-Prinzip):

1. **Clusterbildung:** Innensegmente (Index $1..n-3$, Handles/Stub-Grenzen bleiben
   fix) mit gleicher Orientierung, deren Projektionsintervalle sich über
   $\ge$ `NUDGE_MIN_OVERLAP = cableClearance = 12` px überlappen, bilden einen
   Cluster — formaler Ähnlichkeitsgraph, zusammenhängende Komponenten.
2. **Äquidistante Zuweisung:** Die Querkoordinaten des Clusters werden sortiert
   (Determinismus: stabile Reihenfolge, Endgültigkeit über `compareIds`) und auf
   $p_k = p_0 + k \cdot g$ gelegt mit $g$ = `NUDGE_GAP = laneGrid = 16`. Nach
   Anwendung gilt für je zwei Cluster-Mitglieder
   $|{\rm perp}(s) - {\rm perp}(t)| \ge g = 16$ — die Trassen stehen
   äquidistant mit genau einem Lane-Abstand — kollinear-flächige Überdeckung ist damit
   ausgeschlossen (I2), die Mindest-Clearance $c$ zwischen parallelen Läufen ist
   durch $g = 16 > c = 12$ erfüllt (I3).
3. **Reflow-Begrenzung:** `MAX_NUDGE_REFLOW_STEPS = 3`, `MAX_NUDGE_REFLOW_PASSES = 2`
   — Nudging ist ein Fixpoint-Verfahren mit hartem Deckel, damit es frame-budget-
   kompatibel bleibt und keine Oszillation erzeugt.
4. **Ellbogen-Erhaltung:** Wo ein Stub nicht mitwandern darf, setzt
   `stitchOrthogonal` einen rechtwinkligen Ersatzellenbogen — Orthogonalität ist
   nach jedem Schritt wiederhergestellt (Prädikat `isOrthogonalPath`).

**Lane-Registry** (`lib/routing/rules/laneRegistry.ts` — deterministische
Lane-Vergabe, unabhängig von der Eingabe-Reihenfolge):

$$
\text{lane}(e) = \operatorname{rank}_{\text{stable}}\Big(
\underbrace{\text{topoRank}(s), \text{topoRank}(t)}_{\text{Stufe 1}},
\underbrace{\text{targetPosition}(e)}_{\text{Stufe 2}},
\underbrace{\text{edgeId}}_{\text{Stufe 3 (Tie-Break)}}
\Big)
$$

Garantie (testgesichert): Permutation der Eingabe, Undo/Redo und Re-Layout liefern
**identische** Lane-Zuordnungen — keine Lane-Flips (ADR 0010). Der Versatz ist immer
$\text{laneIndex} \times \texttt{laneGrid}$; das ersetzt die frühere $\pm 40/\pm 80$-px-
Heuristik durch benannte, prüfbare Korridore.

### 2.4 Spatial-Index-gestützte Kreuzungserkennung (Render-Hot-Path)

`CableEdge` prüft Crossings je Frame gegen alle übrigen Kanten — über
`crossingSegmentsExcluding` + `SegmentSpatialIndex.queryRectInto` statt $O(E^2)$
(Fix R-4; große Pläne verloren still die Kreuzungsvermeidung, sobald die alte
120-Kanten-Grenze griff). Frame-Caches in `routingCache.ts` halten den
Kostenrahmen: Index-Bau $O(S)$ je Planänderung, Abfragen $O(k)$ je Kante/Frame.

---

## 3. Modul 3 — Multi-Physics & Elektrotechnische Integrität

### 3.1 Thermisch-elektrische Basis (Ist)

Widerstand mit Temperaturabhängigkeit (Kupfer, linear, $0\dots100\,°C$):

$$
R(T) \;=\; \rho_{20}\big(1 + \alpha\,(T - 20\,°C)\big)\frac{L}{A},
\qquad \alpha = 0{,}00393\ \mathrm{K^{-1}}
$$

(`COPPER_TEMPERATURE_COEFFICIENT_PER_K`, `copperResistanceRiseFactor` in
`lib/materials.ts`; $\rho_{20} = 0{,}0175\ \Omega\,\mathrm{mm^2/m}$ bzw.
$\kappa = 1/\rho = 58\ \mathrm{m/(\Omega\, mm^2)}$.)

Joule'sche Verlustleistung je Leitung:

$$
P_{\text{loss}} \;=\; I^2 R(T) \;=\; I^2 \,\rho_{20}\big(1+\alpha\,\Delta T\big)\frac{L}{A}
$$

Design-Belastbarkeit und Koordination (Ist, `lib/electrical.ts`):

$$
I_z^{\text{design}}(A) = k_{\text{Derate}} \cdot I_{z,\text{Tabelle}}(A),
\qquad k_{\text{Derate}} = 0{,}7 \ \text{(pauschal)}
$$

$$
\text{Koordination } I_B \le I_n \le I_z \ \text{ist im Modell durch Konstruktion erfüllt}
$$

(ein einziger $I_z$-Begriff: sowohl `lookupThermalCrossSection` als auch die
Sicherungsgrenze `FUSE_MAP` nutzen denselben Faktor — AUDIT ELE-001).

> **Hinweis „Maxwell":** Für Leitungsrouting ist die volle Maxwell-Randwert-
> Formulierung (verteilte $\mathbf{E}/\mathbf{B}$-Felder) das falsche Werkzeug — die
> relevanten Effekte sind ortsaufgelöste Leitungseigenschaften, die das Modell bereits
> als konzentrierte Elemente trägt: $R(T)$, Netzimpedanz $Z_s$ (`shortCircuit.ts`),
> Schutzkoordination (`acProtection.ts`), Netzfrequenz-Skin-Effekt bei 50 Hz an
> Kabelquerschnissen $\le 70\,\mathrm{mm^2}$ ist vernachlässigbar
> ($\delta_{\text{Cu}}(50\,\text{Hz}) \approx 9{,}3\ \mathrm{mm}$ — rund
> doppelt so groß wie der Leiterradius selbst des größten Normquerschnitts
> $\le 70\,\mathrm{mm^2}$ mit $r \approx 4{,}7\ \mathrm{mm}$). Als
> **Zukunftsschritt** wertvoll wäre dagegen die
> **Schleifeninduktivität** $L' \approx \frac{\mu_0}{\pi}\ln\frac{d}{r}$ für
> Zuleitungsschleifen (DC-Ripple/EMI-Bewertung) — sie gehört als L-Term in
> dieselbe RLGC-Sicht, nicht in einen Feldlöser.

### 3.2 Bündelung & thermisches Derating (VDE 0298-4) — die fehlende Kopplung

**Formulierung (Zielmodell).** Für eine Leitung $e$ im Bündel $\mathcal{B}$ (Kabel in
Rohr/Kanal, gemeinsame Verlegeart) gilt die korrigierte Belastbarkeit:

$$
\boxed{\;I_{z,\text{eff}}(e) \;=\; I_{z,\text{Tabelle}}(A_e)\;\cdot\;
k_\vartheta(\vartheta_U)\;\cdot\;
k_B\big(n(\mathcal{B})\big)\;\cdot\;
k_V(\text{Verlegeart})\;}
$$

- $k_\vartheta$: Umgebungstemperatur-Korrekturfaktor (Tab. 3/4 DIN VDE 0298-4),
- $k_B(n)$: **Häufungsfaktor** in Abhängigkeit der Anzahl _belasteter_ Stromkreise
  im selben Bündel,
- $k_V$: Verlegeart (B2: im Rohr auf Wand — die Ist-Tabelle ist bereits auf B2/30 °C
  bezogen, d. h. $k_\vartheta = k_V = 1$ als Basis).

Die Tabelle der $k_B(n)$-Werte ist **mit Zitatseite zu transkribieren und als
Token/Record abzulegen** (Disziplin des Hauses: kein Normzitat ohne VERIFIED-Quelle,
s. `electrical.ts`-Kommentarstil). Der Entwurf speist sie als
`VDE_GROUP_FACTORS: Record<number, number>` neben `VDE_AMPACITY`; bis zur
Zitatprüfung bleibt der pauschale $0{,}7$-Faktor der Produktivwert (fail-safe:
**nie** optimistischer als der Ist-Zustand).

**Bündel-Detektion aus der Geometrie** — hier trifft sich Routing auf Physik.
Geometrische Bündel-Relation für Kanten $e \ne f$ mit Segmenten $s \in e, t \in f$:

$$
e \sim f \iff \exists\, s,t:\;
\begin{cases}
s \parallel t \ \text{(gleiche Orientierung)}\\
\text{perp-Abstand} \le W_{\text{Kanal}} \;(\text{z. B. } 2{\cdot}\texttt{laneGrid})\\
\text{Projektions-Overlap} \ge L_{\min}
\end{cases}
$$

$\sim$ erzeugt zusammenhängende Komponenten $\mathcal{B}$ — **und genau diese
Berechnung ist ein Index-Scan**, kein neues Datenmodell:

```ts
// ZUKUNFTSENTWURF (noch kein Produktivkonsument) — lib/routing/rules/thermalBundle.ts
import { SegmentSpatialIndex } from '../geometry/segmentSpatialIndex';
import { ROUTING_TOKENS } from '../tokens';

export type ThermalBundle = { edgeIds: string[]; parallelLengthPx: number };

export function detectThermalBundles(
  segmentsOf: (edgeId: string) => readonly Segment[],
  edgeIds: readonly string[],
  opts?: { channelWidthPx?: number; minLengthPx?: number }
): ThermalBundle[] {
  const channel = opts?.channelWidthPx ?? 2 * ROUTING_TOKENS.laneGrid;
  const minLen = opts?.minLengthPx ?? 4 * ROUTING_TOKENS.laneGrid;
  const all: Segment[] = [];
  for (const id of edgeIds) all.push(...segmentsOf(id));
  const index = new SegmentSpatialIndex(all);

  // Ähnlichkeitsgraph: Kante (e,f) bei ko-lokalem Parallelschnipsel.
  const adj = new Map<string, Set<string>>();
  for (const id of edgeIds) adj.set(id, new Set());
  for (const id of edgeIds) {
    for (const s of segmentsOf(id)) {
      for (const other of index.queryNear(s[0], s[1], channel)) {
        const f = edgeIdOf(other); // Zuordnung über Reverse-Lookup
        if (f === id) continue;
        if (!isParallelWithin(s, other, channel, minLen)) continue;
        adj.get(id)!.add(f);
        adj.get(f)!.add(id);
      }
    }
  }
  return connectedComponents(adj) // deterministisch: Sortierung via compareIds
    .map((ids) => ({ edgeIds: ids, parallelLengthPx: summedParallelRun(ids) }));
}
```

**Einkopplung in Routing & Validierung (Entwurf):**

1. **Validierung (hart, zuerst):** Nach dem Final Gate je Bündel prüfen
   $\forall e \in \mathcal{B}: I_e \le I_{z,\text{eff}}(e)$. Verletzung ⇒
   `RoutingStatusBadge`-Fehler wie I1–I3 — binär, nicht gewichtet (ein
   thermisch überlastetes Bündel ist kein „hoher Kostenwert", es ist ein Defekt).
   Baustein existiert: `isThermallyOverloaded(I, A)` — er kennt nur noch nicht
   $k_B(n)$.
2. **Kosten (weich, im Suchlauf):** Ein Bündel-Strafterm in $\Phi$ oder als
   netzabhängiger Term:

$$
\Phi_{\text{therm}}(s) \;=\; \lambda_T \cdot \max\Big(0,\;\;
\tfrac{1}{n}\textstyle\sum_{e \in \mathcal{B}} I_e^2 \tfrac{\rho}{A_e}
\;-\; \Theta_{\text{budget}}\Big) \cdot \ell(s)
$$

d. h. der Router bekommt Motivation, stromintensive Leitungen **auseinander**
statt in denselben Korridor zu legen — genau umgekehrt zum (noch nicht
existierenden) Bündelungs-Bonus, der Platz spart. Das Spannungsgewicht ist
$O(k)$ je Abfrage über den bestehenden Index (Komponente aus Caching,
Inkrementell-Aktualisierung wie `laneRegistry`). 3. **Maximale Wirkung bei geringster Kosten:** Die DETEKTION ist der teure Teil —
sie läuft inkrementell (nur geänderte Kanten invalidieren ihre Komponenten),
nicht je Suchschritt.

### 3.3 Spannungsfall $\Delta U$

**Formel (Ist, exakt die Rechnung von `electrical.ts` / `voltageDrop.ts`):**

$$
\Delta U_{\text{DC}} \;=\; \frac{2\, I\, L}{\kappa\, A}
\;=\; \frac{I \, L \, \rho_{20}}{A} \cdot 2,
\qquad
\Delta U\,\% \;=\; \frac{\Delta U}{U_n}\cdot 100
$$

Der Faktor 2 ist der Hin-/Rückleiter; $\kappa = 58\ \mathrm{m/(\Omega\,mm^2)}$
(`COPPER_CONDUCTIVITY_MS_PER_MM2`); $L$ in Metern über
`resolveCableLength` (explizite Planlänge $>$ Route-Länge in px $/$
`PX_PER_METER = 100` $>$ Punktabstand). Budgets im Code:

$$
\Delta U_{\max} =
\begin{cases}
0{,}36\ \text{V} \;=\; 3\,\% \cdot 12\,\text{V} & \text{DC 12 V}\\
4{,}6\ \text{V} \;\approx\; 2\,\% \cdot 230\,\text{V} & \text{AC 230 V (konservativ)}
\end{cases}
$$

In Pfad-Summenform (Netz $\mathcal{N}$ in Serie):

$$
\Delta U\,\% (\mathcal{N}) \;=\;
\frac{2}{U_n} \sum_{e \in \mathcal{N}} \frac{I_e L_e \rho_{20}\big(1+\alpha\,\Delta T\big)}{A_e}
\cdot 100
\;\le\; \text{Grenzwert}
$$

Der Temperaturfaktor ist in der Ist-Rechnung bewusst **nicht** enthalten
(Planungsgrundlage 20 °C, dokumentiert in `materials.ts` — DIN VDE 0100-520 nennt den
Spannungsfall ohne Temperaturzuschlag, solange $T$ unter der Leitertemperaturgrenze
bleibt). Der Faktor `copperResistanceRiseFactor(T)` ist implementiert, aber
„kein Recheneingang der Planungsfunktionen" — für eine _thermisch gekoppelte_
Variantenrechnung (§3.4) steht er bereit.

### 3.4 Kopplung in die Routenkosten (Entwurf)

**Gewichtete Länge je Kante.** Konstante Skalierung je Suchlauf:

$$
\mu_e \;=\; 1 \;+\; \lambda_{\Delta U}\cdot\frac{2\,\rho\, I_e}{\kappa\, A_e\, U_n}
\;+\; \lambda_J \cdot \frac{I_e^2 \rho}{A_e}
\qquad (\text{px-äquivalente Kosten je px Länge})
$$

Einbau in $G(\pi)$ gemäß §1.4; Suchlauf-Heuristik $h_\mu(n) = \mu_e \|\Delta\|_1 + c_b b_{\min}$
bleibt nach §1.5 zulässig ($\mu_e$ konstant je Suchlauf). **Kalibrierregel:**
$\lambda$ so wählen, dass 1 % $\Delta U$-Budgetverbrauch ≡ $k$ px Extraweg wiegt
(Vorgabe als Token, analog `COST_FACTORS`; Grenzwert-Markierung kommt aus der
bestehenden Prüfung `hasVoltageDropError`). Effekt: Der stromintensive
Batterie-Hauptstrang sucht kürzere Pfade als der Signalkabel-Zweig — **Längen-
optimierung wird netzabhängig**, exakt wie vom Master-Prompt gefordert.

**Warum das Existing-Ratchet respektiert:** Jede Physik-Strafe ändert
Golden-Master-Geometrien. Der Pfad dafür ist vorgegeben: messen
(`npm run routing:audit`, `scripts/routing/cableLength.test.ts`-Ratchet) → begründeter
Recapture → Ledger-Eintrag — nicht stille Geometrieänderung (AGENTS.md).

### 3.5 Medienleitungen: strömungsmechanische Verluste (Entwurf)

Für `WaterPipeEdge` existiert noch kein Verlustmodell. Vorschlag, gleiche
Architektur-Schicht wie $\Delta U$ (reine Funktion, Domäne, Tokens):

$$
\Delta p \;=\; \underbrace{\lambda \frac{L}{D}\frac{\rho_f v^2}{2}}_{\text{Reibung}}
\;+\; \underbrace{\sum_j \zeta_j \frac{\rho_f v^2}{2}}_{\text{Formverluste (Bögen/Armaturen)}},
\qquad
v = \frac{4 \dot V}{\pi D^2}
$$

$$
\lambda \approx \frac{0{,}25}{\Big[\log_{10}\!\big(\tfrac{\varepsilon}{3{,}7D} + \tfrac{5{,}74}{\mathrm{Re}^{0{,}9}}\big)\Big]^{2}}
\quad (\text{Swamee–Jain, glatt bis rau, } \mathrm{Re} \le 10^5)
$$

Kopplung ins Routing: Biegungen von Leitungen kosten Rohrlängenäquivalent
($\zeta_{90°} \approx 0{,}9$ → $L_{\text{equiv}} = \zeta \frac{D}{\lambda}$) — ein
zweiter, physikalisch motivierter Bend-Term, der Wasserleitungen **ruhiger** führt
als Kabel (andere $\lambda$-Gewichtung je Domäne). Polygonzüge zählen als
Formverlust je Ecke. Gate: Domänen-Trennregeln `domainSeparationRules` bleiben
unberührt (Wasser↔Elektrik-Abstand `crossDomainSpacing`).

---

## 4. Modul 4 — Architektur & Deterministischer Ablauf

### 4.1 State Separation (Ist, verbindlich)

```
┌────────────────────────────────────────────────────────────┐
│ UI / React Flow (components/edges, Planner)                │
│   • Rendering (CableEdge, Hops, RoutingStatusBadge)        │
│   • Adapter: Routen aus Store → SVG-Path                   │
├────────────────────────────────────────────────────────────┤
│ Orchestrierung (components/edges/utils/routeAll.ts, store) │
│   • Reihenfolge, Fan-Out, Invalidierung, Caches            │
├────────────────────────────────────────────────────────────┤
│ Domain-Pass 1: components/edges/utils/* (Produktiv-A*)     │
│   pathfinding.ts · nudge.ts · orthogonalRouting.ts         │
├────────────────────────────────────────────────────────────┤
│ Domain-Schicht 2/3: lib/routing/*   (framework-FREI)       │
│   geometry/ · rules/ (collision, costModel, laneRegistry,  │
│   hopping, portBundle) · tokens · invariants · finalValid. │
├────────────────────────────────────────────────────────────┤
│ Physik/Domänen: lib/electrical, vde-standards, materials,  │
│   units, solar, shortCircuit, acProtection, peukert        │
└────────────────────────────────────────────────────────────┘
```

Regeln (ADR 0007/0008/0014): `lib/routing/*` importiert **keine** React-/XYFlow-Typen;
Bereinigung ist rein und plattformunabhängig testbar (`vitest run lib/`);
eine Erlaubnis-Liste sichert die App-Grenze (Architektur-Gate
`scripts/routing/architecture.test.ts`: keine Clearance-Literals, keine persisted
Geometry-Reads, kein zweiter V2-Loader). UI-kritische Werte (z. B. Fehlerfarben) kommen
aus **einer** Quelle je Zuständigkeit.

### 4.2 Pipeline (5 Stufen des Master-Prompts → Ist)

| Stufe | Master-Prompt                     | Ist-Implementierung                                                                                                                                         |
| ----- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Graph-Extraction & Netlist        | `routableNodes.ts` + `RouteEdgeRef` (fachliche Kantenmerkmale: Domäne, Querschnitt, Backbone)                                                               |
| 2     | Global Routing Pass (ELK/Layered) | `lib/routing/elk/*` — **Knoten**-Layout (Layered, port-FIXED_ORDER, generierte Spacing-Tokens); Kanten-GESPENSTERRouten bewusst nicht konsumiert (ADR 0018) |
| 3     | Detailed Orthogonal Routing       | `routeAllCables`: Katalog → `hananAStar` (Port-Zwang, Stub-Frame, `cableTubes`, Fensterung)                                                                 |
| 4     | Post-Processing & Nudging         | `nudgeOrthogonalPaths` (Lane-Verteilung) → `analyzeRouteCrossings`/Hops                                                                                     |
| 5     | Final Gate Validation             | `finalValidation.ts` (I1–I3 binär) → `useCableRouteFinalValidation` → `RoutingStatusBadge`                                                                  |

Der **globale Routen-Pass** im Sinne des Master-Prompts (Kanal-/Trassenzuweisung)
existiert heute implizit über (a) die ELK-Spaltenabstände als Kapazitätsvorgabe und
(b) die Reihenfolge von `routeAllCables` + `laneRegistry`. Der explizite
Kapazitätsgraph aus §5.3 ist der geplante Ausbau von Stufe 2 — ohne ELK-Abhängigkeit
in `lib/routing` (ELK bleibt Austauschbar; ADR 0018).

### 4.3 Kern-A\*-Router mit Spatial Index & Kollisionsschutz (TypeScript-Core)

Referenzschnitt — demonstriert die Verdrahtung der realen Module; Markierungen
`(IST)` / `(ENTWURF)` sind Vertrag:

```ts
// (IST) Importe aus der framework-freien Domain-Schicht
import { ROUTING_TOKENS } from 'lib/routing/tokens';
import { COST_WEIGHTS, segmentExtraCost } from 'lib/routing/rules/costModel';
import { classifySegmentAgainstNode } from 'lib/routing/rules/collision';
import { SegmentSpatialIndex } from 'lib/routing/geometry/segmentSpatialIndex';

export type Heading = 0 | 1 | 2 | 3; // E, N, W, S
export type SearchState = { ix: number; iy: number; hd: Heading };

export type RouteSearchInput = {
  start: Point;
  goal: Point;
  startHeading: Heading;
  goalHeading: Heading; // Port-Normalen (Port-Zwang)
  xs: number[];
  ys: number[]; // Hanan-Achsen (§1.1)
  blocked: Uint8Array;
  hClosed: Uint8Array;
  vClosed: Uint8Array; // Masken
  obstacles: Rect[]; // INFLATED boxes
  routed: SegmentSpatialIndex; // bereits geroutete Segmente
  portBundle?: PortBundleContext; // ADR-0009-Ausnahme
  mu: number; // gewichtete Länge (§3.4), Default 1
};

/** (IST) Kostenkonstanten ausschließlich aus dem Modell — nie lokal pflegen. */
const {
  bend: C_BEND,
  uTurn: C_UTURN,
  crossing: C_CROSS,
  clearanceViolation: C_CLEAR,
  nearbyLane: C_NEAR,
} = COST_WEIGHTS;

export function searchOrthogonalPath(input: RouteSearchInput): Point[] | null {
  const { xs, ys, start, goal, startHeading, goalHeading, routed } = input;
  const nx = xs.length,
    ny = ys.length;

  const pack = (ix: number, iy: number, hd: number) => (iy * nx + ix) * 4 + hd;
  const gScore = new Map<number, number>();
  const parent = new Map<number, number>();
  const heap = new MinHeap(); // (IST) Binärheap mit seq-Tie-Break

  const h0 = lowerBound(start, startHeading, goal, goalHeading); // §1.5
  gScore.set(pack(start.ix, start.iy, startHeading), 0);
  heap.push({ f: h0, g: 0, ix: start.ix, iy: start.iy, hd: startHeading });

  let expansions = 0,
    best = null,
    bestG = Infinity;

  while (heap.size > 0) {
    const cur = heap.pop()!;
    const key = pack(cur.ix, cur.iy, cur.hd);
    if (cur.g > (gScore.get(key) ?? Infinity) + EPS) continue; // veraltet
    if (++expansions > MAX_EXPANSIONS) break;

    if (cur.ix === goal.ix && cur.iy === goal.iy) {
      // Zielheading beachten
      const done = cur.g + turnCost(cur.hd, goalHeading);
      if (done < bestG) {
        bestG = done;
        best = key;
      }
      if (cur.hd === goalHeading) break;
      continue;
    }
    if (cur.g + cur.h >= bestG) continue; // Dominanz

    for (const nd of ORDER) {
      // (IST) stabil: 0,1,2,3 → Determinismus
      if (!canStep(cur.ix, cur.iy, nd, input)) continue; // hClosed/vClosed
      const [nix, niy] = [cur.ix + DX[nd], cur.iy + DY[nd]];
      const step = Math.abs(xs[nix] - xs[cur.ix]) + Math.abs(ys[niy] - ys[cur.iy]);
      if (step <= EPS) continue;

      // Umgebungskosten O(k) über den Index (§2.1): hard ⇒ ∞, soft/weighted ⇒ +c
      const seg: Segment = [
        { x: xs[cur.ix], y: ys[cur.iy] },
        { x: xs[nix], y: ys[niy] },
      ];
      const extra = segmentExtraCost(seg, routed, { portBundle: input.portBundle });
      if (extra.cost === Infinity) continue; // Overlap verboten

      const g = cur.g + input.mu * step + turnCost(cur.hd, nd) + extra.cost;
      const nkey = pack(nix, niy, nd);
      if (g >= (gScore.get(nkey) ?? Infinity) - EPS) continue;
      gScore.set(nkey, g);
      parent.set(nkey, key);
      const h = lowerBound({ x: xs[nix], y: ys[niy] }, nd, goal, goalHeading);
      heap.push({ f: g + h, g, h, ix: nix, iy: niy, hd: nd });
    }
  }
  return best < 0 ? null : reconstruct(parent, best, input); // + stitch/simplify
}

/*
 * (IST) Guarantees, die der Aufrufer hat — testgesichert:
 *  G1  Kein Expandieren durch hindernisnahe Kanten (Masken + obstacles inflated).
 *  G2  Kein Overlap- Segment wird je in gScore geschrieben (∞-Frühexit).
 *  G3  Determinismus: Nachfolger in fester Reihenfolge, Heap-Tie-Break über seq;
 *      gleiche Eingabe ⇒ bitidentisches Ergebnis (Doppel-Lauf-Test I9).
 *  G4  Zulässigkeit von h (§1.5) ⇒ Pfad ist Kosten-optimal in der Modellwährung,
 *      solange alle Zusatzkosten ≥ 0 sind.
 *
 * (ENTWURF) Zukünftige Stecker, ohne den Suchraum zu sprengen:
 *  - input.mu                       → physikalisch gewichtete Länge (§3.4)
 *  - bundlePenalty(segment)         → Bündel-Hotspot aus Caching (§3.2), nicht je Schritt
 *  - laneDimension (L)              → explizite Lane-Ebene als 4. Zustandsdimension
 */
```

### 4.4 Determinismus-Vertrag (Regeln)

1. **Keine Zeit, keine Zufallsquelle** im Routing (`Date.now`, `Math.random`
   verboten — Architektur-Gate).
2. **Stabile Ordnung überall:** Nachfolger in fester Richtungsreihenfolge;
   Gleichstände über `compareIds` (`lib/sortOrder.ts`); Lane-Vergabe über die
   3-Stufen-Sortierung der Registry (§2.3).
3. **Keine Insertion-Order-Abhängigkeit:** Mengen werden sortiert, nicht
   „wiedergegeben" (Registry-Schlüssel, Bundle-Komponenten).
4. **Float-Disziplin:** `quantize` vor Vergleichen, `EPS = 1e-6` für
   Kollinearitäts-/Schwellenentscheidungen, keine Rundung nach dem Suchlauf.
5. **Prüfbar:** Doppel-Lauf (I9), Permutationsinvarianz
   (`laneRegistry.test.ts`), Plan-Translation (`shiftInvariance.test.ts`),
   Golden Master (byte-exakte SVGs), `npm run routing:audit`.

### 4.5 Performance-Budget (16 ms / 60 FPS)

Verbindlich sind die **Gates**; die Tabelle ist die ingenieurmäßige Zielverteilung für
einen vollständigen `routeAllCables`-Durchlauf bei ~250 Kanten (Szenario des
Scaling-Probes):

| Phase                     | Budget                     | Mechanismus (Ist)                                                                              |
| ------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| Graph-Extraction          | ≤ 1 ms                     | `routableNodes`, präparierte Handles                                                           |
| Segment-Index (Plan)      | ≤ 1 ms                     | `SegmentSpatialIndex` Bulk-Bau $O(S)$                                                          |
| Hindernisfenster je Kante | ≤ 0,5 ms                   | `obstacleRegionPad = 240`, Routen-BBox statt $N\!-\!1$ (PERF-001)                              |
| Maskenbau + A\* je Kante  | ≤ 2 ms Ø / 48k Exp. Deckel | Intervall-Markierung, Katalog-Vorlauf, `clip`-Envelope bei $                                   | X   | \!\cdot\! | Y   | > 20{,}000$ |
| Nudge + Hops              | ≤ 3 ms                     | Deckel 3 Steps × 2 Pässe, Cluster-Zerlegung                                                    |
| Final Gate I1–I3          | ≤ 2 ms                     | geteiltes Kollisionsmodell, Index-gestützte Paare                                              |
| Rendering-Reserve         | ≥ 6 ms                     | Frame-Caches (`routingCache`), LRU 256 (`CACHE_LIMIT`), `queryRectInto`-Pufferwiederverwendung |

Ergänzende Regeln: **inkrementelles Routing** — nur invalidierte Kanten routen neu
(Ablage `cableRouteStore`), Drag = Einzelkanten-Update mit Cache; **harte Komplexitäts-
Argumente** statt „schon schnell genug" (Maskenbau $O(\sum \text{Zellen})$, Abfrage
$O(k)$); **Budget ist Gate**: `npm run perf:edge-routing` (Exit-Code 1 bei
Überschreitung), `npm run perf:route-scaling` als Skalierungssonde.

---

## 5. Das Dense-Grid-Problem

_„Viele Leitungen durch einen engen physischen Raum, ohne sich zu berühren."_

### 5.1 Kapazitätsmathematik

Korridorbreite $W$ (zwischen den Hinderniswänden), Clearance $c$ = `cableClearance`,
Lane-Raster $g$ = `laneGrid`. Anzahl nebeneinanderpassender Trassen:

$$
\boxed{\;n_{\max}(W) \;=\; \left\lfloor \frac{W - 2c}{g} \right\rfloor + 1
\qquad \text{gilt iff } W \ge 2c\;}
$$

(Herleitung: $k$ Spuren brauchen $2c$ Wandabstand plus $(k\!-\!1)$ Lücken zwischen
Trassen: $W \ge 2c + (k\!-\!1)g$.) **Verifikation an den Ist-Tokens:**

- $c = 12$, $g = 16$: drei Trassen brauchen $24 + 32 = 56$ px — die in
  `tokens.ts` hergeleitete Kanalbreite (ADR 0028).
- ELK-Spaltenabstand `elkColumnSpacing = 68 + 2·16 = 100` px; die Handle-Boxen
  entnehmen 42 px ⇒ $W = 58 \ge 56$ ⇒ $n_{\max} = 3$ (mit 68 px war $W = 26$,
  $n_{\max} = 1$ → gemessene I2-Verstöße, ADR 0027 — die Spaltenweite ist
  **aus der Kapazitätsformel abgeleitet**, nicht gesetzt).
- Port-Freigabe `portFacingClearance = 68` = `stubMin + 2·laneGrid + cableClearance`
  = Stub + **zwei** Fan-Out-Schritte + Clearance — ebenfalls Kapazitätsarithmetik.

**Konsequenz:** Dichte ist zuerst ein **Platzierungsproblem**. Der Router kann nur
verteilen, was der Platzierer als Korridorbreite hergibt. Die drei
$W$-Herleitungen oben sind das Muster: _Token = abgeleitete Funktion der Kapazität_.

### 5.2 Lösungsleiter (aufsteigend, jeweils mit Mechanismus)

**Stufe 0 — Prävention (Ist, wirksam):** ELK-Spacing-Tokens aus §5.1; Korridore
werden _vor_ dem Routing breit genug gelegt. Messbare Wirksamkeit: I1–I3 = 0 über
alle sieben Referenzpläne bei `elkColumnSpacing` (ADR 0028), Preis +13,6 % Kabelweg —
bewusst dokumentiert.

**Stufe 1 — Port-Fan-Out / Stub-Leiter (Ist):** $k$ Kanten an einem Handle verlassen
den Port nicht alle auf derselben Linie: Staffelung `lane/laneStep`
(`portFanOut.ts`) und die **Rang-Treppe** der Stub-Längen

$$
\text{stub}(r) \;=\; \min\big(\text{stubCap},\; \text{stubMin} + r \cdot \delta\big),
\qquad \delta \ge g
$$

(`capStep`/`stubCapRank`, ROUTE-BUG-31/34). Ohne sie kollabieren die Lanes des
Bündels kollinear (gemessen: I2 = 5 port-nah, ROUTE-002).

**Stufe 2 — Lane-Registry mit Kapazitätsprüfung (Ist → Ausbau):** Deterministische
Zuweisung (§2.3) plus harte Prüfung $|\text{belegte Lanes}(K)| \le n_{\max}(W_K)$ je
Korridor $K$. Bei $>$ $n_{\max}$: **Stufe 3** statt stille Doppelbelegung.

**Stufe 3 — Kapazitätsgraph im Global Pass (ENTWURF):** Der Korridor wird zur
Kantenkapazität:

$$
\text{Korridor } K: \quad \sum_{e \in K} f_e \;\le\; n_{\max}(W_K),
\qquad f_e \in \{0,1\}
$$

Zuweisung als **Multi-Commodity-Flow**: Ziel $\min \sum_e w_e \ell_e + \beta \cdot
\text{crossings}$, Subtour-/Flow-Erhaltungskonventionen wie üblich. Exakt ist das
NP-schwer (Rand-zu-Rand-Sichtbarkeitsgraph-Wege mit Kapazitäten subsumiert
disjunktes Pfadrouting) — praktisch: **greedy in deterministischer Kantenreihenfolge**
(Längenrang absteigend, Tie-Break `compareIds`), jeder Fluss reserviert seine Lane
in der Registry; Fehlschlag ⇒ Stufe 4.

**Stufe 4 — Deterministischer Rip-up & Reroute (ENTWURF):**

```text
repeat (max R ×):
  failed = Kanten, die keine freie Lane/Kapazität fanden (sortiert: compareIds)
  if failed leer: break
  ripup = die Kante mit den höchsten Ist-Kosten (längs × crossing × clearance)
          — Tie-Break: Edge-ID  ⇒ KEIN Zufall, gleiche Eingabe gleicher Ablauf
  entferne ripup aus Index/Registry, routiere failed ∪ {ripup} neu
  Invariante: Kosten des Gesamtplans sinkt streng (Monotonie-Argument) oder Abbruch
```

Obergrenzen $R$ (z. B. 3) halten das Frame-Budget; jeder Durchlauf ist ein
vollständiger, reproduzierbarer Zustandsübergang — kein „Zittern" im UI.

**Stufe 5 — Bündel-bewusstes Routing (ENTWURF, mehrziel):** $m$ Leitungen desselben
Korridors können als **Super-Edge** mit gemeinsamer Geometrie und Lanes
$\pm g, \pm 2g, \dots$ geführt werden (Platz- und Biegeersparnis: ein Korridor, ein
Umweg, $B$ einmal) — aber thermisch teurer (§3.2: $k_B(n)$ fällt). Zielfunktion:

$$
J(\pi) \;=\; \alpha L + \beta B + \gamma X + \delta \underbrace{\big(1 - k_B(n(\mathcal{B}))\big)}_{\text{thermische Bündel-Strafe}}
+ \varepsilon\, \Delta U\,\%
$$

Alle Terme in der einen Währung px-äquivalent (§1.4), $\alpha..\varepsilon$ als Tokens
mit Ratchet-Messung. Das ist die ehrliche Antwort auf das Paradoxon _„Platz sparen
will bündeln, Thermik will trennen"_ — es gibt keinen Punkt, nur eine Kurve.

**Stufe 6 — Kreuzungsbudget statt Überlappung (Ist):** Was räumlich nicht
nebeneinander passt, kreuzt: Crossing-Kosten $c_x$, Prioritäts-Hopping (§2.4),
`MAX_ACCEPTABLE_CROSSINGS = 2` je Route als harte Suchgrenze. Orthogonalität bleibt,
Überlappung bleibt verboten — die Brücke ist der legitime Notausgang des
Zweidimensionalen.

**Stufe 7 — Layout-Eskalation (ENTWURF, UI-Rückkopplung):** Ist
$n > n_{\max}(W)$ _nach_ Stufen 1–4, ist die Geometrie beweisbar zu eng
(Formel 5.1). Dann keine heimliche Fehlervergrößerung, sondern: Signal an den
Platzierer (ELK-Spacing-Anhebung / Korridorspaltung) inkl. sichtbarer Meldung —
derselbe Pfad wie ADR 0027/0028, nur automatisiert statt von Hand gemessen.

### 5.3 Formale Problemstellung & RSMT-Bezug

Gesucht: für jedes Paar $(s_e,t_e)$ ein Pfad $\pi_e$ auf dem Hanan-Grid mit

$$
\min \sum_e G(\pi_e)
\quad \text{s.t.} \quad
\begin{cases}
\text{Overlap}(\pi_e,\pi_f) = 0 & \forall e \ne f \text{ (außer Port-Bündel)}\\
\pi_e \cap \text{fremde Boxen} = \emptyset\\
\text{Kapazitätsbeschränkungen §5.2}
\end{cases}
$$

Das ist **Edge-Disjoint-Routing auf dem Sichtbarkeitsgraphen** (NP-schwer).
Seine Klassifikation in `hard/soft/weighted` ist genau das Lagern der Nebenbedingungen:
hart = Nebenbedingung, weich = Zielfunktionsanteil.

**RSMT-Verwendung (Roadmap, Global Pass):** Die Einspeisung eines Netzes mit $k$
Pins ist ein RSMT-Problem auf $H(P)$ (Satz §1.1). Statt exakter RSMT-Lösung
(NP-schwer): MST auf dem Hanan-Grid der Pins (praktische Konstruktion: Rekursion über
Punktmengen, Kantenkosten = Manhattan; Konstruktion $O(k^2 \log k)$ nach Prioritäts-
queue-varianten) — liefert die **Trassen-Gerüstlinie**, die Stufe 3 als Kapazitäts-
reservierung verteilt. Das Detailrouting (Stufe 3/4) spaltet den Baum in gerichtete
Punkt-zu-Punkt-Aufträge auf — genau die Rollenverteilung, die der Master-Prompt als
_Global → Detailed_ beschreibt und die heute ELK (Knoten) + A\* (Kanten) übernimmt.

---

## 6. Gap-Analyse & Roadmap (Gate-konform)

### 6.1 Ergebnisse Phase 0 — Messung, Baseline, Kill-Gate-Entscheidung

**Stand:** 2026-09-28 · Commit `e1682c1` · Rohdaten `benchmarks/baseline.json`
(`capturedAt`, `machine`, `gitCommit`, `method`, Per-Plan-Zeilen in
`subsets.regression15.perPlan`). Absolute Millisekunden sind maschinenabhängig
(ADR-0030) — Vergleiche nur gegen dieselbe Maschine/Datum.

**Methodik (vier Sonden, ohne Flags, `tsx` nach `docs/ai/TESTING-CONTEXT.md`):**

```bash
npm run perf:edge-routing            # Zwei-Gate-Frame-Budget, Live-Pfad, Edit-Sweeps
npm run perf:route-scaling           # Full-Route-Skalierung: Kette + Worst-Case-Spannkanten
npx tsx benchmarks/phase0Baseline.ts # Stufe 0: 15 Regressionspläne / 25 Galerie-Szenarien / 120×240 → benchmarks/baseline.json
npx tsx scripts/routing/audit.ts     # I1–I7 über 6 GOLDEN_PLANS
```

_Full-Route_ = ein kompletter Plan durch `routeAllCables` (`routeAll.ts:482`) —
derselbe Aufruf wie im Live-Pfad-Gate. _Inkrementell_ = pro Kante
Frame-Cache-Read (`obstaclesExcluding`/`crossingSegmentsExcluding`,
`routingCache.ts:55/157`) + `buildOrthogonalPath` (`orthogonalRouting.ts:561`)
mit zentrierten Endpunkten, Right/Left-Ports und `polarityPathOffset`
(`pathUtils.ts:90`) — Muster aus `benchmarks/edgeRoutingPerf.bench.ts`;
_pathOnly_ isoliert den Pfadbau ohne Cache-Read. Prozentile über **rohen**
Samples (Index $\lfloor n\cdot q\rfloor$), keine Perzentil-Überlagerung.

**Skalenplan 120×240 (Teilmenge c):** Raster 420/220 px wie
`benchmarks/routeAllScaling.probe.ts` (`makeNodes` — routbare Abstände),
Kantenmuster nach `edgeRoutingPerf.bench.ts` (`buildPlan`,
$n_{i-1-j}\to n_i$, 8 Spalten ⇒ 237 Kanten) + 3 planweite Spannkanten
($n_0\!\to\!n_{119}$, $n_0\!\to\!n_{118}$, $n_3\!\to\!n_{117}$ = exakt 240).
Das engmaschige 220-px-Raster des Render-Fixtures wurde gemessen und
**bewusst nicht** als Gate-Teilmenge genommen: 28-px-Spaltenlücken ⇒ 676
Clearance-Verletzungen und Pfad-Fallbacks — ein nicht-routbarer Plan darf kein
Kill-Gate tragen.

**Referenz-Gates (perf-Skripte, 2026-09-28)**

| Sonde                                         | Szenario                                                    | Ergebnis                                                | Budget                   | Status                 |
| --------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- | ------------------------ | ---------------------- |
| `perf:edge-routing` Render                    | N=36/E=134                                                  | p50 1,89 ms · p90 2,04 ms                               | 16 ms                    | ✅                     |
| `perf:edge-routing` Live (`routeAllCables`)   | N=36/E=134                                                  | p50 40,39 ms · p90 54,28 ms · Tail 1,34×                | Ratchet 60 ms · Tail ≤ 2 | ✅                     |
| Edit-Sweeps (vorher→nachher)                  | Klein 8/13 · Mittel 24/66 · Groß 60/230 · Sehr groß 120/585 | 1,07→0,49 · 9,98→7,73 · 4,67→3,89 · 17,35→13,29 ms      | —                        | alle verbessert        |
| `perf:route-scaling` Kette                    | N=10/50/100/250/500 (E=9/49/99/249/499)                     | 0,8 · 3,4 · 10,8 · 39,2 · 154,1 ms (0,08→0,31 ms/Kante) | —                        | fallbacks 0            |
| `perf:route-scaling` Worst Case (Spannkanten) | N=100/250/500 (E=50/125/250)                                | 40,3 · 285,0 · 2561,3 ms                                | —                        | dominante Kostenquelle |

**Stufe-0-Messung (`benchmarks/phase0Baseline.ts`, Rohdaten `benchmarks/baseline.json`)**

| Teilmenge        | Full-Route p50 · p95 · p99 [ms]                  | Inkrementell p50 · p95 · p99 [ms] | pathOnly p50 [ms] | n (Full/Edit) |
| ---------------- | ------------------------------------------------ | --------------------------------- | ----------------- | ------------- |
| (a) regression15 | 0,283 · 6,054 · 7,230                            | 0,022 · 0,380 · 0,837             | 0,018             | 105 / 171     |
| (b) gallery25    | 0,004 · 0,051 · 0,130 (Einzelroute, Full = Edit) | identisch (1 Pfadbau je Szene)    | —                 | 475           |
| (c) scale120×240 | **692,754 · 739,884 · 739,884**                  | 0,693 · 6,406 · 6,793             | 0,691             | 7 / 720       |

**R-1-Qualitäts-Dashboard** (agent.md „Done ohne Metrik-Nachweis";
Quellen: `buildRoutingQualityReport` (`routingQuality.ts`), `measureScenario`
(`scripts/regression/layout.ts`), `countUTurns`, `scripts/routing/audit.ts`):

| Teilmenge               | Länge/Manhattan (Ziel ≤ 1,3)                                                        | Bends   | U-Turns | Kreuzungen                      | Clearance | Overlaps                        | Fallbacks |
| ----------------------- | ----------------------------------------------------------------------------------- | ------- | ------- | ------------------------------- | --------- | ------------------------------- | --------- |
| (b) gallery25           | worst 1,33 (Szene 07; Baseline-Ratchet 1,33 in `routingQuality.test.ts`)            | 59 (Σ)  | 1       | 22 (Σ; davon 12 Stressszene 22) | 4 (Σ)     | —                               | —         |
| (a) regression15        | worst 0,885 (p09) · alle ≤ 0,89                                                     | 108 (Σ) | 0       | 8 (Σ)                           | 0         | max 1 (p11, Ratchet ≤ Baseline) | 0         |
| (c) scale120×240        | 0,905                                                                               | 688     | 1       | 436                             | 0         | 54 (Doppelkanten-Muster)        | 0         |
| I1–I7 (`routing:audit`) | 6 GOLDEN_PLANS: hart/orth/overlap/fallback je 0 · I1–I7 je 0 · Determinismus `true` | —       | —       | —                               | —         | —                               | —         |

Bewertung: (a)/(b) liegen im eingefrorenen Bestand, kein Ratchet-Bruch. Die
Galerie-Stressszenarien 15/22 tragen die Kreuzungssumme; Ziel „Kreuzungen ≤ 2"
gilt planweise und wird in (c) durch den Doppelkanten-Graphen
(436 planweite Kreuzungen) überschritten — **gemeldeter Bestand, kein neues
Gate**; Stufen 1–3 belegen Verbesserungen über genau diese Tabelle.
Überdeckungen in (c) folgen aus dem Kantenmuster (Diagonalverbindungen der
Doppelkette), nicht aus den Regressionsplänen.

**Kill-Gate (MISSION Stufe 0).** Regel aus dem Missionstext (Grenzwerte sind
Vorgabe, nicht gemessen): Full-Route-Median ≤ 50 ms **UND** Inkrementell-Median
≤ 4 ms ⇒ kein Stufe-4-Track. Evaluiert auf Teilmenge (c) — die Teilmenge, die
das Gate entscheidet; (a)/(b) als Zusatz:

- Full-Route-Median (c): 692,754 ms ≤ 50 ms → **erfüllt? nein**
- Inkrementell-Median (c): 0,693 ms ≤ 4 ms → **erfüllt? ja**
- UND-Regel ⇒ **Kill-Gate nicht erfüllt.**
- Zusatz: (a) 0,283 ms / 0,022 ms und (b) 0,004 ms erfüllen beide Grenzen
  großzügig; Kette N=250/E=249 = 39,2 ms ≤ 50. In (c) dominieren planweite
  Spannkanten (Worst-Case-Sonde 2561 ms bei 500/250) und der dichte
  Diagonal-Graph.

**Entscheidung:** Das Kill-Gate tötet den GPU-Track **nicht** — Stufe 4 bleibt
zulässig, ist aber nach der strikten Reihenfolge erst nach Stufen 1–3 fällig;
GPU-Code ausschließlich hinter Flag `ROUTING_GPU` (default off, nie in
Regression/Golden/E2E/Coverage-Gates, kein zweites Pfad-Verhalten in CI) und
nur mit Begründung aus dem damaligen Gate-Stand. Stufen 1–3 greifen die
gemessenen dominierenden Kostenquellen an (Suchaufwand bei Dichte,
Spannkanten-Längen, Inkrementell-Overhead im Cache-Lesepfad). Damit ist
**Phase 0 abgeschlossen**: beide perf-Skripte, drei Teilmengen, Baseline-JSON
mit Datum/Maschine/p50/p95/p99, R-1-Dashboard, dokumentierte Gate-Entscheidung.

### 6.2 Lücken & Maßnahmen (Roadmap)

| #   | Lücke                                                             | Maßnahme                                                                                                                                        | Gate/Wächter                                                                                         |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| L1  | $k_B(n)$-Häufungsfaktoren fehlen (pauschal 0,7)                   | Tabelle transkribieren (Zitatprüfung!), `VDE_GROUP_FACTORS` neben `VDE_AMPACITY`; `designAmpacity(A, n)` erweitern; Bestandswert bleibt Default | `vde-properties.test.ts` G1–G7, `vde-consistency.test.ts`; nie optimistischer als 0,7 ohne Recapture |
| L2  | Bündel-Detektion aus Geometrie fehlt                              | `thermalBundle.ts` (§3.2) über bestehenden Index; inkrementell cachen                                                                           | Unit-Tests an Referenzplänen; `routing:audit` unverändert grün                                       |
| L3  | Thermik/ΔU nicht in Routenkosten                                  | `mu`-Gewicht (§3.4) hinter Token-λ; zunächst NUR Bewertung, dann Suchlauf                                                                       | `cableLength.test.ts`-Ratchet + `routing:audit` + Golden-Master-Recapture mit Ledger                 |
| L4  | `preferredLaneBonus`/`segmentExtraCost` ohne Produktivkonsumenten | bewusster Ist-Zustand (ROUTE-002, gemessen) — **nicht** einfach anschließen                                                                     | `routing:lane-probe` als Gegenprobe; Längen-Ratchet                                                  |
| L5  | Kein Kapazitätsgraph/$n_{\max}$ im Pass                           | Stufen 3–4 (§5.2) als Ausbau von `routeAllCables`; Tokens bleiben Quelle                                                                        | Perf-Gate, Determinismus-Doppellauf, I1–I7                                                           |
| L6  | Kein Druckverlustmodell Wasser                                    | §3.5 als reines Domänenmodul, NUR Bewertung zuerst                                                                                              | `domainProbe` (Trennregeln unberührt)                                                                |
| L7  | RSMT-Trunk-Pass fehlt                                             | MST-auf-Hanan als Global-Pass-Schritt 2b (§5.3), austauschbar hinter ADR 0018                                                                   | `ab-compare`-Muster: A/B gegen Ist-Baseline                                                          |
| L8  | EDT-Feld (Stufe 1) gebaut, Kosten-Gate aber Token-0               | Stufe 2: `edtNearObstaclePerLaneGrid` begründet anheben (Physik-Masken speisen dieselbe Kanal), Recapture mit Ledger                            | Drift-Guard `costModel.test.ts` + `pathfinding.edt.test.ts` + `routing:audit` + Golden Master        |

**Änderungsregelwerk (unverhandelbar, aus AGENTS.md):**

1. Docs-Only wie dieses Dokument: `npm run format:check` grün.
2. Jede Geometrie-Änderung: `npm run check` (lint + 2× typecheck + Coverage),
   `npm run routing:audit`, `npm run test:regression` (byte-exakte SVGs),
   `npm run perf:edge-routing`.
3. Golden-Master-Recapture **nur** mit Begründung + Ledger-Eintrag; Ratchets
   (`cableLength.test.ts`) werden angehoben, nie stillgeschwiegen.
4. Neue Konstanten: zuerst Token in `lib/routing/tokens.ts` mit Herleitung — nie
   ein Literal im Router (Architektur-Gate findet es).

### 6.3 Ergebnisse Stufe 2 — Physik-Fixpoint (2026-09-28)

**Umfang (Evaluation-first, §6.2 L1–L3):**

- **L1 — VDE-0298-4-Häufungsfaktoren:** `VDE_GROUP_FACTORS` (n=1..9:
  1,00/0,80/0,70/0,65/0,60/0,57/0,54/0,52/0,50) in `lib/electrical.ts`,
  Quellen im Code-Kommentar (web-geprüft 2026-09-28; abweichende Varianten
  VDE 0298-4:2003 und grobe „6–8: 0,55"-Tabellen dokumentiert, nicht
  verwendet). `groupFactor(n)` wirft `RangeError` bei n>9 (Rule M — kein
  stilles Abschneiden). `designAmpacity` behält 1-Argument byte-stabil ×0,7
  (Bestands-Default, keine Optimierung ohne Recapture).
- **ΔU-Bänder:** `classifyVoltageDropPercent` (≤1 % Ziel / ≤3 % Planungsgrenze
  / ≤4 % Verstoß / >4 % kritisch) — kantenkonsistent zu
  `hasVoltageDropError` (>3 %).
- **L2 — Bündel-Detektion:** `lib/routing/rules/thermalBundle.ts` —
  `detectThermalBundles` (Kanal 32 px = 2·laneGrid, Mindest-Overlap 64 px =
  4·laneGrid, kanonische sortierte Komponenten, jedes Segment-Paar genau
  einmal gezählt), `bundleMargin`/`classifyBundleMargin` (<1,0 Überlast,
  <1,25 Strafe; unbekannter Querschnitt ⇒ 0 ⇒ Überlast — fail-safe).
- **Fixpoint-Modul:** `lib/routing/rules/thermalFixpoint.ts` —
  `thermalFixpoint` (≤12 Iterationen, ≤0,05 K, explizites
  `converged:false` statt stummes Abbrechen), `jouleHeatingStep` (alle
  Parameter Eingaben, keine Defaults).

**Bewusst NICHT in dieser Stufe (L3-Stage-Regel):** keine
Produktiv-Validierung, keine Kostenaktivierung, keine Golden-Master-
Recapture — Module sind zunächst nur Bewertung. Die EDT-Kostenanhebung
(L8, Token `edtNearObstaclePerLaneGrid`) bleibt ausstehend und gehört in
eine eigene Recapture-Stage mit Ledger.

**Gates (2026-09-28):** `npm run check` ✓ (Coverage-Schwelle) ·
`test:regression` 50/50 byte-stabil ✓ · `test:goldenmaster` 13/13 ✓ ·
`routing:audit` I1–I7=0, deterministisch ✓ · `perf:edge-routing` Median
41,95 ms (Baseline 40,39 ms — neutral) ✓ · e2e 113 bestanden/0 fehlgeschlagen
✓. Neue Tests: `electrical.groupFactors.test.ts` (13),
`thermalBundle.test.ts` (16), `thermalFixpoint.test.ts` (11).

---

## Anhang A — Symbolverzeichnis

| Symbol                      | Bedeutung                                   | Quelle                               |
| --------------------------- | ------------------------------------------- | ------------------------------------ |
| $c$ / `cableClearance`      | Mindestabstand Kabel↔Kabel/-Node            | `tokens.ts` (12)                     |
| $g$ / `laneGrid`            | Kanal-/Lane-Raster                          | `tokens.ts` (16)                     |
| `stubMin`                   | Mindeststub, Mindestlänge vor 1. Bend       | `tokens.ts` (24)                     |
| `segmentMin`                | Mindestsegmentlänge (= `laneGrid`, I6)      | `tokens.ts` (16)                     |
| $c_b, c_u, c_x, c_c, c_n$   | Bend/UTurn/Crossing/Clearance/Nearby-Kosten | `costModel.ts` (80/400/120/400/16)   |
| $\mu_e$                     | netzabhängiges Längengewicht (ENTWURF)      | §3.4                                 |
| $k_\vartheta, k_B, k_V$     | Temp./Häufung/Verlegeart-Derating           | §3.2                                 |
| $\kappa, \rho_{20}, \alpha$ | Kupfer-Leitfähigkeit/Widerstand/TK          | `materials.ts` (58; 0,0175; 0,00393) |
| $n_{\max}(W)$               | Korridorkapazität                           | §5.1                                 |
| I1–I7                       | Freigabe-Invarianten                        | `lib/routing/invariants.ts`          |
| G1–G7                       | Abnahme-Gates                               | `docs/ROUTING-V2.md` §10             |

## Anhang B — Befehle (Wächter dieses Dokuments)

```bash
npm run routing:audit        # I1–I7 über 6 Referenzpläne (+ --shifts)
npm run routing:lane-probe   # Wirksamkeit bevorzugter Lanes (Gegenprobe zu L4)
npm run perf:edge-routing    # Frame-Budget-Gate (Zwei-Gate-Exit)
npm run perf:route-scaling   # Full-Route-Skalierung + Worst-Case-Spannkanten
npx tsx benchmarks/phase0Baseline.ts  # Stufe-0-Baseline → benchmarks/baseline.json
npm run test:regression      # Layout/Metriken/SVG byte-exakt
npm run test:goldenmaster    # Eingefrorene Geometrie
npm run check                # Gate vor Commit: lint, format, 2× typecheck, Coverage
```
