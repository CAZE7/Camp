# General-Audit „Werft" — Camp

**Datum:** 2026-08-20
**Branch:** `arena/01a01f17-camp` (Merge `5a5148a` = PR #310)
**Auditor:** Staff-Level Full-Stack (TS/Next 16, React 19, React Flow 11, Zustand 5, Vitest 4, VDE, WCAG 2.2 AA, Security)
**Stack geprüft:** Typecheck, Vitest, Next-Build, Source-Review app/components/lib/store.

> Hinweis: Der Git-Verlauf ist per Squash auf einen einzelnen Merge-Commit reduziert,
> sodass die fünf PRs nicht per Diff gegengeprüft werden können. Alle PR-Behauptungen
> wurden daher direkt am aktuellen Code verifiziert.

---

## 0. Ergebnis-Zusammenfassung

| Tor | Status | Beobachtung |
|---|---|---|
| `npm test` | ✅ 594/594 grün | Behauptet waren 577 — um 17 Tests gewachsen (kein Befund, nur Stand konservativ) |
| `tsc -p tsconfig.typecheck.json` | ✅ 0 Fehler | |
| `npm run build` | ✅ 13 statische Seiten | **aber** `/api/chat` als `ƒ (Dynamic)` deklariert — siehe ARCH-001 |
| Keine `.skip`/`.only`/gelockerten Tests | ✅ | Keine aufgeweichten Assertions gefunden |
| Hardcoded VDE-Magic-Numbers | ✅ `vde-consistency.test.ts` grün | |

**Trotz grüner Pipelines existieren ~18 Befunde**, darunter ein **produktions-blockierender Architekturfehler** (KI-Chat im Static-Export tot), ein Defekt in der Fuse-Auswahl, eine A11y-Regression auf der wichtigsten Seite, eine unvollständige Token-Migration, ~989 Zeilen toter Code aus #310 und die unbearbeiteten Alt-Funde H1/M1.

### Schweregrade

- 🔴 **Critical (1):** ARCH-001
- 🟠 **High (3):** A11Y-001, ELEC-001, AUTO-001
- 🟡 **Medium (8):** M1, #309-Token, DEAD-001, K1, ELEC-002, ELEC-003, SEC-001, AUTO-002
- 🔵 **Low/Bemerkung (6+):** H1, A11Y-002/003, UX-Handoff, Stale-Kommentare, Typ hygiene

---

## TEIL 0 — PR-Verifikation

### #306 Übersichtlichkeit
Kann ohne Commit-Historie nicht per Diff verifiziert werden. Der aktuelle Zustand ist strukturell aufgeräumt (klare Trennung `components/planner/*`, `lib/`, `store/`). **Aber:** Es gibt zwei parallele Warn-/Farb-Systeme (`warn-card` in Guides/Heizung/Dach/Chat vs. `WarningCenter`+`ExpertPanel` mit rohen Emerald/Amber/Rose/Blue) — siehe UX-001.

### #307 Auto-Wire → `lib/autoWire.ts`
- ✅ Auto-Wire ist **vollständig** nach `lib/autoWire.ts` extrahiert. Im Store (`store/usePlannerStore.ts`) verbleiben nur noch ein dünner Action-Wrapper (`autoWireSystem`, Z. 488–510), der Import und der Aufruf — **keine alten Inline-Reste**.
- ✅ Idempotenz-Tests und Nutzerkanten-Erhalt sind vorhanden (`store/usePlannerStoreExtended.test.ts`, Z. 563–617); Szenarien für alle drei Templates laufen.
- 🔴 **AUTO-001 (Coverage-Lücke, HIGH):** Es gibt **keine dedizierte Datei `lib/autoWire.test.ts`**. Die 27 kB / ~750 Zeilen kritische VDE-Sicherheitslogik (`performAutoWiring`, `cumulativeDropAt`, `sizeDcEdges`, `applyFuseSizes`, `healUserEdges`, `resolveRails`, `pickHouseBattery`) wird nur indirekt über 2 Integrationstests (`usePlannerStoreExtended.test.ts`, `PlannerDashboard.test.tsx`) abgedeckt. Rund um `healUserEdges`/`retargetEdge` (drop-Logik bei Doppelkanten) und die AC-Pfade gibt es keine Unit-Ebene, die Fehler eingrenzt.
- Siehe zusätzlich ELEC-002 (Fuse-Auswahl) und ELEC-003 (RCD-Stempel).

### #308 Accessibility
Skip-Link und `aria-current` sind teilweise umgesetzt, aber **nicht auf allen Seiten konsistent** — siehe A11Y-001 (defekter Skip-Link im Planner) und A11Y-002 (`aria-current` fehlt in der `NavigationSidebar`). `prefers-reduced-motion` ist solide gelöst (Globale Media-Query + GSAP-`matchMedia`-Prüfung + `.planner-flow-particle { display:none }`).

### #309 UX-Audit außerhalb Schaltplan + Token-Migration
🔴 **#309-Token (MEDIUM) — Migration unvollständig.** Außerhalb des Canvas wurden **175 nicht-tokenisierte Farbklassen** in 18 Dateien gefunden (Suche nach `bg/text/border/ring-(stone|emerald|rose|amber|sky|blue|slate|gray|red|green|yellow|orange|teal)-[0-9]`, Canvas-Knoten/-Kanten ausgenommen). Schwerpunkte:

- `components/NavigationSidebar.tsx` — `bg-emerald-100 text-emerald-800`, `text-stone-600`, `bg-stone-100`, `text-[10px]`/`text-[11px]` (mehrfach)
- `components/DachNode.tsx` — `border-blue-500`, `text-stone-900/500`, `bg-slate-600`
- `components/layout/MainLayout.tsx` — `bg-stone-900/60`, `border-stone-100`, `text-stone-800/400` (tot, siehe DEAD-001)
- `components/inspector/NodeInspectors.tsx` — `bg-blue-50/900/800`, `bg-red-100/800`, `border-gray-200`, `bg-gray-50`
- `components/planner/ExpertPanel.tsx` — `bg-emerald-500/amber-500/rose-500/blue-600/700`, `bg-emerald-50 border-emerald-200`
- `components/planner/ui/DashboardPanel.tsx`, `FloatingMetricsCard.tsx`, `WarningCenter.tsx` (z. B. `bg-emerald-50 text-emerald-950` für „Keine Hinweise")
- `app/tools/dach/components/DachPlanerFlow.tsx` — `text-blue-600 bg-blue-50 hover:bg-stone-100` (tot)
- `app/guides/camper-ausbauguide/{RoadTripAnimation,ScrollSidebar}.tsx` — `bg-emerald-600`, `text-slate-400`, Inline-Hex (`#78716c`, `#065f46`, `#fcd34d`, `#7dd3fc`, `#10b981`, `#fbbf24`)
- `app/elektrik-planung/page.tsx` — `bg-stone-50`
- `app/guides/ausbau-fahrplan/page.tsx` — Inline-Hex `bg-[#f3e4dc]`

Zusätzlich verletzt die mehrfache Nutzung von `text-[10px]`/`text-[11px]` in `NavigationSidebar.tsx` die in `globals.css` dokumentierte eigene Typo-Regel („kein Body-/Label-Text unter 12 px") — für die Zielgruppe Heimwerker ohne Fachwissen ein Lesbarkeitsrisiko.

### #310 Orthogonales Routing / Layout / Ansichten
- ✅ `components/edges/utils/pathUtils.ts` nutzt **ausschließlich** `getSmoothStepPath`; Kommentar dokumentiert explizit „Bezier curves (and the old isProMode branch) are intentionally gone".
- ✅ `CableEdge.tsx` und `WaterPipeEdge.tsx` importieren beide `calculateEdgePath` aus `pathUtils` — keine lokalen Bezier-Pfade mehr.
- ✅ Node-Fokus-Dimmen: `applyNeighborhoodFocus` in `components/planner/utils/focusHighlight.ts` wird in `FlowCanvas.tsx` (Z. 24/179/265) verwendet; CSS `.planner-focus-dim { opacity: var(--canvas-dim) }` greift.
- ✅ Zoom-Detailstufen: `PLANNER_OVERVIEW_ZOOM=0.7`, `.planner-zoom-overview .node-details/.edge-label { display:none }`; `minZoom=0.25`, `maxZoom=2`.
- 🟡 **DEAD-001 (MEDIUM):** Die Routing/Layout-Migration hat einen ~989-zeiligen toten Cluster hinterlassen, der von keiner produktiven Seite importiert wird (geprüft per `grep` über `app/`):
  - `components/layout/MainLayout.tsx` (161) — importiert seinerseits `NavigationSidebar` und alten `Sidebar`
  - `components/Sidebar.tsx` (276) — wird nur von `MainLayout` (tot) und `DachPlanerFlow` (tot) importiert; der Planner nutzt `PlannerSidebar`
  - `components/Inspector.tsx` (265) — wird nur von `DachPlanerFlow` importiert; der Planner nutzt `PlannerInspector`/`NodeInspectors`
  - `app/tools/dach/components/DachPlanerFlow.tsx` (182), `DachSidebar.tsx` (88), `data/vehicles.ts` (4), `data/initialData.ts` (13) — komplette alte Dach-Implementierung mit eigenem `useState("vehicle-001")`; die Live-Seite `app/tools/dach/page.tsx` nutzt `lib/vehicleTemplates` + `useDachNodes`
  - Für die toten Komponenten laufen weiterhin Tests (`Sidebar.test.tsx`, `Inspector.test.tsx`) — das erzeugt **falsche Coverage** und kann künftig Refactors blockieren.

---

## TEIL 1 — Bekannte offene Funde

### K1 — Persistenz / Schema-Migration 🟡 MEDIUM
- `store/usePlannerStore.ts` (Z. 735–747): persistiert unter `werft-planner-v1` mit **`version: 1`, aber ohne `migrate`-Funktion** und ohne `onRehydrateStorage`. Persistiert werden u. a. `nodes`, `edges`, `waterNodes`, `waterEdges`, `isSidebarOpen`, `isInspectorOpen`, `season`, `viewMode`. Bei jeder Shape-Änderung an `CableEdgeData`/`PlannerNodeData` wird der alte localStorage-Stand still mit neuen Defaults gemergt; defekte/fehlende Felder können zu Laufzeitfehlern führen (z. B. `edge.data.crossSection` undefined in `sizeDcEdges`).
- `lib/store.ts` (`werft-app-preferences-v1`): persistiert **`isProMode`, `calculatedSolarWatts`, `hasOnboarded`** — **ohne `version` und ohne `migrate`**.
- **Empfehlung:** Für beide Stores `version` hochzählen und eine explizite `migrate: (persisted, version) => …`-Funktion sowie eine Defensiv-Validierung beim Rehydrate ergänzen (siehe auch Auto-Wire-Grenzfälle). `isSidebarOpen`/`isInspectorOpen` zu persistieren ist UX-technisch okay, sollte aber in der Migrations-Pipeline berücksichtigt werden.

### K2 — Canvas-Kontraste ✅ behoben (mit Rest)
Alle in K2 genannten Canvas-Tokens wurden auf dunklere Werte umgestellt; nachgerechnete Kontraste auf `--canvas-bg #f4f5f7`:

| Token | Alt | Neu | Kontrast | WCAG |
|---|---|---|---|---|
| `--wire-selected` | `#9ca3af` | `#374151` | **9,45:1** | ✅ |
| `--pipe-gray` | `#9ca3af` | `#4b5563` | **6,93:1** | ✅ |
| `--wire-dc` / `--pipe-fresh` | `#3b82f6` | `#1d4ed8` | **6,14:1** | ✅ |
| `--wire-solar` | — | `#92400e` | **6,50:1** | ✅ |

- 🟡 `--clay #8f7d68` = **3,52:1** auf Paper. Prüfung aller Verwendungen: `--clay` wird nur als `--chart-5` und als `--rule` (Rahmen/Linien) genutzt, **nicht als Textfarbe** (`text-clay` gibt es nicht). Als Non-Text/UI-Grenze erfüllt 3,52 ≥ 3:1 die WCAG-Schwelle. ✅
- 🟡 **Rest in `components/NavigationSidebar.tsx`:** Nach wie vor hardcodiertes `stroke="#cbd5e1"` (Z. 317, Straßenlinie im Sidebar-Hintergrund) sowie `stroke="#10b981"` (Z. 333, fahrendes Auto). `#cbd5e1` auf Paper beträgt nur ~1,3:1, ist aber mit `opacity-30` rein dekorativ (akzeptabel, sollte dennoch auf ein Token wie `var(--rule)` umgezogen werden). Das Emerald `#10b981` liegt außerhalb des Token-Systems.

### H1 — Pro-Modus-Zombies 🟡 MEDIUM (nicht erledigt)
`isProMode` ist nach wie nicht entfernt, sondern ein **voll funktionsfähiger Live-Toggle**:
- `lib/store.ts` — Interface, Default `false`, Setter, persistiert
- `components/planner/PlannerDashboard.tsx` (Z. 53, 191) — Checkbox „Profi-Modus" mit `setIsProMode`
- `components/planner/ExpertPanel.tsx` (Z. 348, 407, 458, 462, 582) — schaltet Detailtiefe, Tipps, `LiveRecommendationCard`
- Tests: `lib/store.test.ts`, `ExpertPanel.test.tsx`, `CableEdge.test.tsx`, `app/tools/dach/page.test.tsx` referenzieren `isProMode`

Positiv: In `CableEdge.tsx` und `pathUtils.ts` ist die isProMode-Pfad-Verzweigung entfernt (dort jetzt nur noch SmoothStep). Der Befund ist also **teilweise** erledigt — die Toggle-Funktion selbst wurde nicht zurückgebaut. Klarungsbedarf: Soll es den Modus geben (dann als Produkt-Feature dokumentieren + Tests an die neue Realität anpassen) oder komplett entfernen (dann Store-Feld, Checkbox, alle Verzweigungen und Tests löschen)?

### M1 — Root-Artefakte & doppeltes Lockfile 🔴 MEDIUM (nicht erledigt)
Alle genannten Dateien liegen unverändert im Repo-Root:

```
PRESENT  update_cable_edge.js            (64 Zeilen)
PRESENT  update_cable_edge_test.js       (57 Zeilen)
PRESENT  implement_inline_editing.js      (102 Zeilen)
PRESENT  update_inputs.py                (76 Zeilen)
PRESENT  replace.patch                   (43 Zeilen)
PRESENT  test_missing.ts                 (5 Zeilen)
PRESENT  test_plan.md                    (15 Zeilen)
PRESENT  efbd2cd3.md                     (285 Zeilen)
```

Weiterhin vorhanden: **`package-lock.json` (239 kB) UND `pnpm-lock.yaml` (158 kB).**
- Die CI (`.github/workflows/deploy.yml`) nutzt durchgängig `npm ci` mit Cache auf `package-lock.json`; `pnpm-lock.yaml` wird nicht geprüft, kann aber von Entwicklern lokal verwendet werden → **Drift/Risko unterschiedlicher Abhängigkeitsbäume**.
- Im Build-Job existiert ein Fallback, der bei fehlschlagendem `npm ci` nach 3 Versuchen `rm -f package-lock.json && npm install` ausführt — das umgeht den Lockfile und ist ein Supply-Chain-/Reproduzierbarkeitsrisiko.
- **Empfehlung:** Root-Artefakte löschen (oder in `scripts/`/`docs/` versionieren, falls noch gebraucht); ein Lockfile-System festlegen (empfohlen: npm, wie CI); den `rm package-lock.json`-Fallback entfernen.

---

## TEIL 2 — Logik & Fachlichkeit

### Baseline
✅ 594 Tests grün, ✅ Typecheck grün, ✅ Build erzeugt 13 Seiten. Keine `.skip`/`.only`/`xit` gefunden.

### ARCH-001 🔴 CRITICAL — KI-Chat im Static-Export nicht erreichbar
`next.config.ts` ist auf `output: 'export'` konfiguriert (GitHub-Pages-Deployment laut `.github/workflows/deploy.yml`). Der Build erklärt `/api/chat` als `ƒ (Dynamic)`, **aber Next erzeugt im Static-Export keine Server-Route**:

```
out/
├── 404.html, index.html, ...
├── ki-assistent/index.html
└── (KEIN out/api/...)
```

`components/Chat.tsx` nutft `useChat()` aus `@ai-sdk/react` ohne explizite `api`-Option — Default ist `'/api/chat'`. In der Produktion auf GitHub Pages:
1. Schlägt der POST nach `/api/chat` mit 404 fehl (Pfad existiert nicht als statische Datei).
2. Selbst wenn ein Server die Route ausliefert, greift bei BasePath-Deployment (`NEXT_PUBLIC_BASE_PATH`/Repo-Subpfad) der harte Default `'/api/chat'` **nicht** — es fehlt die BasePath-Präfixierung (vgl. andere relative Links im Projekt).
3. Die Route nutzt serverseitig `pg` (`lib/db.ts`, Pool ohne `DATABASE_URL` → leerer Pool) und `OPENAI_API_KEY` — auf einem statischen Hoster nicht verfügbar.

Der Nutzer sieht nach „Nachricht senden" lediglich die generische Meldung „Keine Verbindung. Prüfe deine Internetverbindung …" (`mapErrorMessage`) — **ein stiller Totalausfall der KI-Funktion im produktiven Deployment**.

**Maßnahmen (erforderlich, eine Option wählen):**
- **(a)** KI-Backend als separaten Edge/Server-Dienst hosten (z. B. Vercel-Funktion, Cloudflare Worker, eigener Node-Service) und `useChat({ api: process.env.NEXT_PUBLIC_CHAT_API })` auf die absolute URL zeigen lassen; BasePath dort nicht anwenden, CORS auf die Pages-Domain beschränken.
- **(b)** Auf `output: 'export'` verzichten und die App auf einer Node-Plattform mit Server-Runtime deployen (dann `output: 'standalone'` und DB/Secret sauber konfigurieren).
- **(c)** Falls KI in der Pages-Version nicht verfügbar sein soll: Chat-Trigger auf Static-Umgebungen ausblelden (`process.env.NEXT_PUBLIC_CHAT_ENABLED`) und eine ehrliche Meldung statt „Keine Internetverbindung" zeigen.
- Unabhängig davon: `basePath` aus `useRouter().basePath` / `NEXT_PUBLIC_BASE_PATH` an die Chat-URL anfügen.

### ELEC-001 🟠 HIGH — `selectFuseSize` verletzt bei Grenzströmen die eigene Regel ≤ Kabel-Max
`lib/electrical.ts` wirbt mit der Invariante
**Verbraucher-Nennstrom ≤ Sicherung ≤ Kabel-Ampacity (FUSE_MAP)**. In der Schleife

```ts
for (const size of STANDARD_FUSE_SIZES) {
  if (size >= minFuse && size <= maxFuse) return size;
}
return STANDARD_FUSE_SIZES.find((s) => s >= minFuse)
    || maxFuse || STANDARD_FUSE_SIZES[...];   // ⚠️ > maxFuse!
```

wird, wenn **keine** Norm-Sicherung ≤ `maxFuse` über dem Nennstrom existiert, die nächste Sicherung **oberhalb von `maxFuse`** zurückgegeben. Nachweis:

```
selectFuseSize(16, 1.5) = 16   ✅ (Maximalwert)
selectFuseSize(17, 1.5) = 20   ❌ Kabel 1,5 mm² darf laut FUSE_MAP nur mit 16 A abgesichert werden
```

Im aktuellen Auto-Wire wird das teilweise dadurch kaschiert, dass `sizeDcEdges` den Querschnitt vorher hochtreibt (`lookupThermalCrossSection`), aber der public-Helfer `selectFuseSize` und der Fallback sind fachlich falsch und können — insbesondere an Nutzer-konfigurierten Kanten — eine **überdimensionierte Sicherung erzeugen, die das Kabel im Kurzschlussfall nicht schützt (Brandgefahr)**. Es gibt keinen Test, der den Fall „Strom > max. Sicherung des Kabels" abdeckt.

**Maßnahme:** Wenn `minFuse > maxFuse`, muss der Querschnitt hochgestuft werden (Rückgabe z. B. `{ fuseSize: maxFuse, needsLargerCable: true }`) oder die Funktion muss explizit einen Fehler/`null` zurückgeben, statt eine zu große Sicherung zu empfehlen. Test für 17 A auf 1,5/2,5 mm² ergänzen.

### ELEC-002 🟡 MEDIUM — Auto-Wire stempelt Landstrom-RCD pauschal als vorhanden
In `lib/autoWire.ts` (Z. ~715):

```ts
for (const sp of shorePowers) {
  sp.data.hasRcd = true;
}
```

Jede Landstrom-Komponente bekommt nach Auto-Wire pauschal `hasRcd=true` und `ShorePowerNode` zeigt „RCD (30mA): Ja" an. Das kann einen **tatsächlich fehlenden FI/RCD (30 mA) nach DIN VDE 0100-721 verschleiern** — also genau den Fehler, den der System-Prompt des KI-Assistenten und `validateShorePowerNode` eigentlich anmahnen. `useLiveValidation` prüft den RCD zudem überhaupt nicht (kein Treffer für `RCD`/`shorePower` in `useLiveValidation.ts`).

**Maßnahme:** Auto-Wire darf einen fehlenden RCD nicht stillschweigend als gesetzt markieren; stattdessen eine Warnung/Fehler im `WarningCenter` erzeugen und die Node-Daten nur dann auf `hasRcd=true` setzen, wenn tatsächlich ein RCD-integriertes Bauteil erzeugt wird.

### ELEC-003 🟡 MEDIUM — AC-Kanten ohne Sicherungs-Dimensionierung
`applyFuseSizes` in `autoWire.ts` bearbeitet nur Plus-DC-Kanten (`if (!edge.sourceHandle?.includes('plus')) continue`); `sizeAcEdges` setzt nur `crossSection`, aber **keine `fuseSize`** für AC-Zweige. Der AC-Strom wird für Landstrom pauschal mit `16 A` angenommen (`acCurrentA`). Eine 230-V-Verteilung hat typischerweise einen 16-A-Leitungsschutz + 30-mA-RCD; die Werte sollten als modellierte Eigenschaft der `shorePower`-Node (z. B. `rating`) gepflegt und auf den AC-Kanten abgebildet werden.

### VDE-Magic-Numbers / Formelprüfung
- `lib/vde-consistency.test.ts` ist grün und scannt 5 Dateien gezielt auf `0.85`, `58*0.x`, `>60`. ✅
- `calculateVoltageDrop` (vde-standards.ts): `ΔU = ρ·L·2·I/A` mit `ρ=0,0175 Ω·mm²/m`, Greifbedingung `crossSection<=0 → Infinity`; `calculateMinCrossSection(0,…) = 1,5`. ✅
- Grenzwerte per `tsx` verifiziert:
  - `calculateCrossSection(0,0)=1.5`, `selectFuseSize(0,2.5)=5`, `calculateWire(0,0)=1,5 mm²/10 A` — kein NaN. ✅
  - `calculateVoltageDrop(100 A, 10 m, 1,5 mm²)=23,33 V` — enorme Spannungsfall-Warnung greift. ✅
  - Strom 200 A → `calculateCrossSection(200,5)=70 mm²` (Obergrenze). ✅
- Hinweis: `electrical.ts` rechnet DC mit Leitfähigkeit **58 m/(Ω·mm²)** und 3 % Drop, `vde-standards.ts` mit ρ**0,0175** und 10 % Drop — zwei bewusst unterschiedliche Modelle (thermische Auslegung vs. Validierung), in den JSDoc kommentiert. Werden sie für dieselbe Kante gemischt verwendet (Auto-Wire nutzt `electrical.ts`/58, Validierung `vde-standards.ts`/0,0175), können sich Widersprüche ergeben. Das ist dokumentiert, sollte aber im Team bekannt sein und im Test festgeschrieben werden, welche Berechnung wo gilt.

### Heizung (`app/tools/heizung/page.tsx`)
- `Q_trans = Σ(U_i·A_i)·ΔT` ✅; `Q_luft = 0,34·V·n·ΔT` ✅ (0,34 Wh/(m³·K) ist der übliche Kennwert für Luft).
- `R = R_base(0,17) + d/k`, `U=1/R` — einfache, nachvollziehbare Dämmwirkung; `U_Fenster=3,0`, `U_blank=5,88`, `k=0,036 W/(m·K)` sind plausible Werte.
- `airChangeRate = 0,5 + min(0,5, A_Fenster·0,1)` — Fensterfläche in m²; 2 m² → 0,7 h⁻¹. Plausibel, aber die Abhängigkeit nur von der Fensterfläche ist grob (undokumentiert).
- Defensiv: Division durch `calcArea=0` führt zu `NaN`, wird aber durch `isNaN(...)`-Wachen abgefangen; `finalQ_total <= 0 ? 1` verhindert 0/NaN-Anzeige. ✅
- Taktungs-Warnung (`Verkokungsgefahr`) ist vorhanden. ✅

### Dach (`app/tools/dach/validation.ts`)
- ✅ Skalierung 1 cm = 2 px: `roofWidth*200`, `SAFE_MARGINS.left*2`, `widthCm*2` in `useDachNodes.ts`.
- ✅ Safe-Margins werden in Pixel-Raum geprüft; die Seite selbst berechnet zusätzlich die cm-Überstände (`describeOverrun`).
- 🟡 **Keine Kollisions-/Überlappungsprüfung** zwischen Solarmodulen/Fenstern (`grep` nach `overlap/intersect/collid` ist leer). Zwei Module können übereinander platziert werden, ohne Warnung — fachlich relevant für Dachentlüftung, Statik und Schatten.
- 🟡 Siehe DEAD-001: `DachPlanerFlow.tsx` mit altem `vehicles.ts` (Fahrzeuge **ohne** `roofWidth/roofLength`) würde bei Nutzung `NaN`-Dächer erzeugen — ist aber tot und sollte gelöscht werden.

---

## TEIL 3 — State & Datenintegrität

- **Hydration/Migration:** siehe K1.
- **Verwaiste Edges nach Node-Delete:**
  - `onNodesChange` (Z. 217–235) und `onWaterNodesChange` filtern beim `remove` both `source`/`target`-Kanten und schreiben einen History-Checkpoint. ✅
  - `deleteSelected` (Z. 293–313) filtert Edges über `filterEdge`. ✅
- **AC/DC-Domänentrennung:** `getEdgeDomain`/`getHandleDomain` sind in `electrical.ts` implementiert und unit-getestet (Inverter-`plus` als Input = DC, als Output = AC). ✅
  - Restrisiko: `isAcEdge` in `autoWire.ts` hat eine Sonderregel `s==='inverter' && sourceHandle==='plus'` → AC, die **nicht** in `getEdgeDomain` gespiegelt ist. Zwei Domänen-Entscheider, die auseinanderlaufen können, sobald Handles umbenannt werden. In `vde-standards.ts` wurde die zentrale API gefordert — `autoWire.ts` nutzt sie nicht konsequent.
- **Datenverlust-Szenarien:**
  - Reload: beide Stores persistieren nach localStorage. ✅
  - Tab-Wechsel: kein `storage`-Event-Listener → Änderungen in einem zweiten Tab werden nicht übernommen (klein, kein Härtefall).
  - Browser-zurück: Zustand bleibt über localStorage erhalten. ✅
  - Paralleles Auto-Wire + Nutzeraktion: Auto-Wire klont Nodes/Edges shallow (`{ ...n, data: { ...n.data } }`) und referenziert dann `userEdges`-Daten neu in `healUserEdges`. Die zurückgegebene Edge-Map wird einmal gesetzt — Race ist durch React 18/Actions gering, aber es gibt kein Locking.
- **WeakMap-Caches** (`nodesMapCache`, `waterNodesMapCache`, `totalWattsCache` in `store/usePlannerStore.ts`) sind an die Node-Array-Referenz gebunden. Nach Auto-Wire/Layout werden neue Arrays erzeugt → Cache neu aufgebaut, kein Stale-Cache. ✅

---

## TEIL 4 — UX-Querschnitt

### UX-001 — Parallele Warn-/Farb-Systeme
Es gibt **drei** konkurrierende Patterns:
1. `.warn-card`/`warn-card-critical|warning|ok|info` aus `globals.css` (genutzt in Heizung, Dach, Guides, KI-Seite, Chat) — token-basiert ✅
2. `WarningCenter` mit `TYPE_STYLES` (`bg-warn-critical`, aber „Keine Hinweise" nutzt rohes `border-emerald-700 bg-emerald-50 text-emerald-950`)
3. `ExpertPanel` mit rohen Tailwind-Paletten (`bg-emerald-500`, `bg-amber-500`, `bg-rose-500`, `bg-blue-600/700`, `bg-blue-500/10`)

Das Ergebnis ist eine inkonsistente Status-Sprache zwischen Planner und Content-Seiten und widerspricht dem in `globals.css` formulierten Ziel „Zentral definiert, damit … keine Inline-Hexwerte".

### Layout-Grammatik
- Die Content-Seiten (Start, Guides, Datenschutz, Impressum, KI) nutzen ein konsistentes Header → `main#main` → Footer-Schema. ✅
- Der Planner (`PlannerInner`) nutzt Sidebar/Canvas/Inspector und mobile Tabs — Aktionen oben (`PlannerDashboard`), Auswahl links, Details rechts. ✅
- 🟡 `MainLayout` hätte ein weiteres Layout etabliert, ist aber tot (DEAD-001).

### Leere/Lade/destruktive Zustände
- BOM-Modal hat einen leeren Zustand („Dein Plan ist noch leer"). ✅
- `Planner.tsx` hat einen Lade-Spinner. ✅
- Destruktive Aktionen bestätigen via `window.confirm` (Node/Edge-Delete im Inspector, `deleteSelected`, Onboarding-Template-Wechsel, „Plan leeren"). ✅ „Plan leeren" nutzt zusätzlich einen AccessibleDialog. ✅
- Die KI nutzt ein eigenes Fehler-Mapping (siehe ARCH-001), das im Production-Fall eine **falsche Ursache** nennt.

### Mobile 375 px
- `Chat`-Fenster: `w-96 max-w-[calc(100vw-2rem)]` — kein horizontales Scrollen. ✅
- `DachPanel`: `max-w-[calc(100vw-1.5rem)]`. ✅
- Heizung: Section-Nav `overflow-x-auto`. ✅
- Touch-Targets: im Planner `min-h-11` (44 px) flächendeckend; vereinzelt Icon-Buttons mit `p-1.5` ohne `min-h-11` in `NavigationSidebar` (z. B. Z. 389) — unter 44 px.
- `app/tools/heizung/page.tsx` und Dach sind auf 375 px bedienbar, Tabellen/Ergebnis-Karten nutzen Grid, das umbricht.

### Übergaben zwischen Tools
- ✅ **Dach → Schaltplan:** `useDachNodes` schreibt `setCalculatedSolarWatts`; `FlowCanvas`/`FloatingMetricsCard`/`PlannerInspector` zeigen die Leistung an (`Dachplaner-Daten erkannt: … W`).
- ✅ **Schaltplan → BOM:** `BOMModal` aus dem Planner.
- 🟡 **BOM → KI:** Der Chat rendert ```json-Blöcke als „Stückliste angehängt" und der Server extrahiert sie (`extractAndProcessBOM`), aber es gibt **keine Schaltfläche im BOM-Modal, um die Stückliste an den Chat zu senden**. Der Nutzer muss JSON manuell kopieren; der Chat-Hinweis „Beziehe deine Stückliste über das Schaltplan-Werkzeug" ist irreführend.
- KI nutzt ferner die serverseitige Postgres (`Components`, `Knowledge_Chunks`), die im Static-Export ebenfalls nicht existiert (siehe ARCH-001).

---

## TEIL 5 — Accessibility (WCAG 2.2 AA)

### A11Y-001 🔴 HIGH — Skip-Link auf dem Planner defekt
Der globale Skip-Link in `app/layout.tsx` verweist auf `#main`. 10 von 11 Seiten haben `id="main"`:

```
app/page.tsx                         ✅
app/datenschutz/page.tsx             ✅
app/impressum/page.tsx               ✅
app/ki-assistent/page.tsx            ✅
app/elektrik-planung/page.tsx        ❌ FEHLT  (der Schaltplan!)
app/tools/dach/page.tsx              ✅
app/tools/heizung/page.tsx           ✅
app/guides/holzausbau/page.tsx       ✅
app/guides/ausbau-fahrplan/page.tsx  ✅
app/guides/camper-ausbauguide/...    ✅
```

`<main>` in `app/elektrik-planung/page.tsx` hat kein `id`-Attribut, und `PlannerInner` rendert kein eigenes `<main id="main">`. Der Skip-Link führt auf der **komplexesten Seite der App** ins Leere (WCAG 2.4.1 Bypass Blocks). Einfache Maßnahme: `id="main"` an das `<main>` in `app/elektrik-planung/page.tsx` ergänzen.

### A11Y-002 🟡 — `aria-current` fehlt in NavigationSidebar
`SiteHeader` (Z. 54, 106) und die mobilen Planner-Tabs (`PlannerInner`, Z. 74–86) setzen korrekt `aria-current="page"`. In der `NavigationSidebar` wird der aktive Link rein visuell (`bg-emerald-100 text-emerald-800`) gekennzeichnet — Screenreader erhalten keine aktuelle Seitenangabe. `SidebarLink` braucht `aria-current={isActive ? 'page' : undefined}` auf dem `<Link>`.

### A11Y-003 🔵 — Chat-Dialog ohne `aria-modal`/Fokus-Falle
`Chat` hat `role="dialog" aria-label="KI-Assistent"` und sinnbare Live-Regions (`role="log"`, `role="status"`, `role="alert"`, `aria-live="polite"`). ✅ Beim Öffnen fokussiert der Schließen-Button, aber:
- `aria-modal="true"` fehlt,
- es gibt keinen echten Fokus-Fang (Tab kann aus dem Dialog treten),
- Escape schließt nicht (geprüft: kein `onKeyDown` für Escape),
- beim Schließen kehrt der Fokus nicht zum Trigger zurück.

Für eine per Button geöffnete Overlay-Ansicht sollten diese ergänzt werden (das `AccessibleDialog`-Komponente existiert bereits und könnte wiederverwendet werden).

### Kontrast-Matrix (Stichprobe)
| Text | Hintergrund | Kontrast | AA |
|---|---|---|---|
| `--ink #14110e` | `--paper #f6f1e8` | >12:1 | ✅ |
| `--muted-ink #3f3831` | paper | 10,25:1 | ✅ |
| `--copper #7a3218` | paper | 8,13:1 | ✅ |
| `--wire-dc #1d4ed8` | canvas | 6,14:1 | ✅ |
| `--wire-selected #374151` | canvas | 9,45:1 | ✅ |
| `--pipe-gray #4b5563` | canvas | 6,93:1 | ✅ |
| `--warn-info #2563eb` | `#eff6ff` | 4,75:1 | ✅ |
| `--warn-warning #92400e` | `#fffbeb` | 6,84:1 | ✅ |
| `--warn-critical #b91c1c` | `#fef2f2` | 5,91:1 | ✅ |
| `--clay #8f7d68` | paper (UI/Border) | 3,52:1 | ✅ (Non-Text ≥3:1) |
| `stone-500 #78716c` | bone | 4,72:1 | ✅ |

Bei der Off-Token-Navigation (`NavigationSidebar.tsx`) sind die Primärtexte `stone-600/500` auf weiß ausreichend, aber die 10/11-px-Eyebrows in `stone-500` erreichen nur 4,72:1 bei sehr kleiner Schrift — für die nicht fachkundige Zielgruppe und zugunsten von AA auch bei Text <14 px fett auf 4,5:1 knapp genug, aber kombiniert mit der Schriftgröße ein Lesbarkeitsrisiko.

### Reduced Motion / Tastatur
- ✅ Globale `@media (prefers-reduced-motion: reduce)` setzt Animations-/Transition-Dauern auf 0,01 ms und versteckt `.planner-flow-particle`.
- ✅ `RoadTripAnimation` prüft `matchMedia` und gibt die GSAP-Timeline frei (setzt Camper opak 0); CSS verbirgt ihn zusätzlich.
- ✅ React-Flow-Handles sind 44×44 px Touch-Ziele mit sichtbarem `:focus-visible`-Ring.
- 🔵 Einige native Buttons (z. B. in `NavigationSidebar`, `NodeInspectors`) haben keine eigene `focus-visible`-Ring-Klasse; sie verlassen sich auf Browser-Defaults. Das `Button`-UI-Primitive hat vorbildliche Fokus-Stile — rohe `<button>` sollten es nutzen.

---

## TEIL 6 — Qualität & Hygiene

- **`@ts-ignore`:** 2× in `store/usePlannerStore.test.ts`, 1× in `components/planner/hooks/useLiveValidation.test.ts` (entspricht dem bekannten Stand; alle in Tests). Keine im Produktivcode. ✅
- **`any`-Leaks:** 35 Treffer in Nicht-Test-Quelldateien. Hotspots:
  - `app/api/chat/route.ts` (mehrere `any` in Request-Validierung/RAG — serverseitig, weniger kritisch, aber typisierbar)
  - `components/nodes/*.tsx` (13 Node-Komponenten) greifen auf `node.data.*` ohne Typwächter zu
  - `components/planner/ExpertPanel.tsx`, `PlannerDashboard.tsx`, `Inspector.tsx`, `NodeInspectors.tsx`
  - `app/tools/dach/components/DachPlanerFlow.tsx`, `app/tools/heizung/page.tsx` (dach ist tot)
  - `components/nodes/types.ts` — die zentrale `PlannerNodeData` existiert, wird aber nicht konsequent verwendet.
- **Toter Code:** ~989 Zeilen, siehe DEAD-001.
- **Doppelte Lockfiles:** `package-lock.json` + `pnpm-lock.yaml`, siehe M1.
- **Stale Test-Kommentare:** `components/edges/WaterPipeEdge.test.tsx` behauptet in den Zeilenkommentaren `--pipe-fresh === #3b82f6`, `--pipe-gray === #9ca3af`, `--pipe-selected === #f97316`. Die tatsächlichen Tokens lauten nach K2/Farbkorrektur `#1d4ed8`, `#4b5563`, `#c2410c`. Die Assertions nutzen `var(--pipe-…)` und sind daher weiterhin korrekt, aber die Kommentare dokumentieren falsche Werte (stammt aus der K2-Farbumstellung, ohne die Test-Kommentare nachzuführen).
- **Falscher Browser-Typ:** `app/guides/camper-ausbauguide/RoadTripAnimation.tsx:39` deklariert `let scrollTimeout: NodeJS.Timeout` in Client-Code. Funktioniert, weil `@types/node` installiert ist, ist aber semantisch falsch — bitte `ReturnType<typeof setTimeout>` verwenden (so wie in `FlowCanvas.tsx` bereits korrekt).
- **Keine** `console.log`/`debugger`, `dangerouslySetInnerHTML`, `eval`, `new Function`, `TODO`/`FIXME`/`HACK` im Produktivcode. ✅
- **Keine** Client-Secrets (`NEXT_PUBLIC_*` nicht verwendet). ✅
- **SEC-001 🟡:** `next.config.ts` führt `allowedDevOrigins: ['*.e2b.app', 'localhost']` — dev-only, in Static-Export wirkungslos, aber die Wildcard `*.e2b.app` sollte nicht in ein öffentliches Repo template-artig verbleiben.
- **CI-Hygiene:** Workflow-Dispatch-Eingang `skip_tests` erlaubt das bewusste Überspringen der Test-Gates vor dem Build; der `npm install`-Fallback löscht den Lockfile. Beides für Notfälle dokumentiert, sollte aber an die Hauptbranch-Protection gekoppelt und restriktiv gehandhabt werden.

---

## Maßnahmenplan (priorisiert)

### Sofort (Blockierend für Produktions-Deployment)
1. **ARCH-001:** Chat-Backend-Hosting klären und `useChat({ api })` auf eine absolute/basePath-bewusste URL umstellen; oder Chat im Static-Build ausblenden. Seiten-Route `app/api/chat` kann bei `output:'export'` nicht funktionieren.

### Hoch
2. **A11Y-001:** `id="main"` auf `app/elektrik-planung/page.tsx` ergänzen.
3. **ELEC-001:** `selectFuseSize`-Fallback korrigieren (keine Sicherung > `FUSE_MAP[crossSection]`); Unit-Test für Strom > Kabel-Max.
4. **AUTO-001:** Dedizierte `lib/autoWire.test.ts` anlegen und die reinen Funktionen (`cumulativeDropAt`, `healUserEdges`/`retargetEdge`, `resolveRails`, `sizeDcEdges`, `sizeAcEdges`, `applyFuseSizes`, `pickHouseBattery`) isolieren.

### Mittel
5. **M1:** 8 Root-Artefakte entfernen, ein Lockfile festlegen, CI-Fallback entschärfen.
6. **#309-Token:** 175 Off-Token-Farben auf die Tailwind-Tokens (`paper/bone/ink/copper/oxide/wire/pipe/warn/*`) migrieren; `text-[10px]/[11px]` in NavigationSidebar durch `caption-xs`/`caption-sm` ersetzen.
7. **DEAD-001:** Tote Dächer-Komponenten (`DachPlanerFlow`/`DachSidebar`/`data/*`) und Alt-Layout (`MainLayout`/`Sidebar`/`Inspector`) inkl. ihrer Tests löschen.
8. **K1:** `version`+`migrate` für beide Stores ergänzen.
9. **ELEC-002:** RCD nicht pauschal als vorhanden stempeln; Live-Validierung um RCD-Prüfung nach VDE 0100-721 ergänzen.
10. **ELEC-003:** AC-Kanten modellieren und absichern; Inverter/ShorePower-Ratings statt 16-A-Konstante.
11. **SEC-001:** `allowedDevOrigins` nur dev setzen, nicht in `next.config.ts` committen.

### Niedrig / Verbesserungen
12. **H1:** Entscheidung treffen: `isProMode` als Feature pflegen oder entfernen.
13. **A11Y-002:** `aria-current="page"` in `NavigationSidebar` ergänzen.
14. **A11Y-003:** Chat-Dialog um `aria-modal`, Fokus-Fang, Escape und Fokus-Rückgabe ergänzen (AccessibileDialog wiederverwenden).
15. BOM → KI-Übergabe mit einem Button im BOM-Modal vervollständigen.
16. Dach-Überlappungsprüfung ergänzen.
17. Stale Kommentare in `WaterPipeEdge.test.tsx` aktualisieren.
18. `NodeJS.Timeout` in `RoadTripAnimation` ersetzen.
19. AC-Domänen-Logik aus `autoWire.ts` (`isAcEdge`) mit `getEdgeDomain` zusammenführen.
20. Kleinere Touch-Targets in `NavigationSidebar` auf ≥44 px bringen.

---

## Anhänge

- **Build-Auszug:**
  ```
  Route (app)
  ┌ ○ /                      (Static)
  ├ ○ /_not-found            (Static)
  ├ ƒ /api/chat              (Dynamic)   ← im Static-Export nicht ausgeliefert
  ├ ○ /datenschutz           (Static)
  ├ ○ /elektrik-planung      (Static)
  ├ ○ /guides/...            (Static)
  ├ ○ /impressum             (Static)
  ├ ○ /ki-assistent          (Static)
  ├ ○ /tools/dach            (Static)
  └ ○ /tools/heizung         (Static)
  Test Files  67 passed (67)
  Tests       594 passed (594)
  ```
- **Kontraste** nachgerechnet per WCAG-Relative-Luminance-Formel (Details in Teil 5).
- **Fuse-Bug-Repro:** `selectFuseSize(17, 1.5) === 20` (erwartet ≤16 oder Fehler).
