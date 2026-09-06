# Deep Audit — `lib/autoWire.ts`

**Date:** 2026-08-22 · **Branch:** `arena/01a02865-camp` · **Scope:** `lib/autoWire.ts` + direct dependencies (`lib/units.ts`, `lib/electrical.ts`, `lib/vde-standards.ts`) as called from `autoWire.ts`
**Method:** full static trace + empirical verification. Every claim below was reproduced with throwaway probe tests executed against the current code (probes deleted after the audit). Baseline suite: **84/84 green** (`autoWire.test.ts` + `vde-properties.test.ts`).

Legend for handle semantics used throughout: on a pass-through node (shunt, busbar, fuse, …) the **`minus` target-handle is the upstream (battery-side) port** and the **`minus` source-handle is the downstream (rail-side) port**. Auto-wire itself relies on this: `battery.minus → shunt[target:minus]` (L890) and `shunt[source:minus] → minusRail` (L891).

---

## Per-task verification results (things checked and found CORRECT — not issues)

| Audit question                                               | Verdict                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plus-rail → FuseBox → consumer                               | ✅ battery→rail→fuseBox→consumer star topology; consumers never direct on battery in auto output (probe 7)                                                                                                                                                                                                                               |
| Parallel batteries → rails, not battery-direct               | ✅ plus→rail, minus→**shunt battery-side port** (probe A) — electrically correct: all return current crosses the shunt                                                                                                                                                                                                                   |
| shorePower→inverter(ac_in), direct otherwise                 | ✅ L962–977; multi-inverter: only first feeds 230V consumers, each gets ac_in (test exists)                                                                                                                                                                                                                                              |
| Idempotency (same input twice)                               | ✅ probe 9: run2 == run1, run3 == run2 (nodes, adjacency, cs, fuse, domain); G5 property (1000 runs) green. `existingConnections` keys are reused from healed/normalised user edges, so auto-creation dedups correctly on re-run. `retargetEdge`'s `drop` path frees the old key correctly                                               |
| `autoCreatedNodeIds` causing findOrCreate skip on run 2      | ✅ No. The set is local per call and never gates discovery; discovery is role/label/key-driven, and auto-created nodes persist with `role`/`label`, so run 2 finds them deterministically                                                                                                                                                |
| 0 / 1 / 2 batteries (same + different chemistry)             | ✅ null for no battery (tested); different chemistry/voltage is excluded from the rails (tested). See issue #3 for the 3+ case                                                                                                                                                                                                           |
| dcdcChargers + only starter battery                          | ✅ new `Aufbaubatterie` created, starter feed fused (probe 11: 16 mm² / 30 A)                                                                                                                                                                                                                                                            |
| `busbars.length === 1` ("known bug")                         | ✅ **Fixed.** `rail()` excludes both `excludeId` and the opposite-role busbar (`oppositeRoleId`, L556–560). Probe 10: single `role:'negative'` busbar is reused as minus rail and a fresh plus rail is **created** — it is _not_ stolen for plus. The `minus.id === plus.id` re-roll (L579–582) is unreachable-but-harmless dead defence |
| `node.data === undefined`                                    | ✅ normalised in the clone (`{ ...(n.data                                                                                                                                                                                                                                                                                                |     | {}) }`, L753); all readers use optional chaining / `quantityOr` |
| `edge.data === undefined` in `edgeLength`/`edgeCrossSection` | ✅ `quantityOr(edge.data?.…)` with fallbacks (L88–95)                                                                                                                                                                                                                                                                                    |
| `cumulativeDropAt` cycles                                    | ✅ per-branch `visited` copy (`new Set(visited).add(nodeId)`, L297) — diamond-safe, cycle-safe; a node that is source in one edge and target in another is handled by direction-based traversal; tested                                                                                                                                  |
| `sizeDcEdges` 20-iteration loop termination                  | ✅ always terminates (bounded `for`); cross-sections are monotone non-decreasing (never written smaller than `currentCs`) so no oscillation is possible. The _binding_ defect is elsewhere — issue #4                                                                                                                                    |
| ΔU = I·2L/(κ·A) factor 2                                     | ✅ acceptable. Every consumer gets paired plus+minus edges; the cumulative walk sums one conductor direction, and 2L per edge ≈ plus+return loop with equal default lengths. For chassis-return segments it overestimates (conservative/safe direction). No change required now                                                          |
| `crossSectionForDrop` with allowedDrop = 0                   | ✅ double-guarded: `crossSectionForDrop` returns `MIN_CROSS_SECTION` for ≤0 (L115) and `sizeEdge` only calls it when `allowedOwn > 0` (L378). Near-zero `remaining` yields a huge-but-finite requirement capped at `MAX_CROSS_SECTION`; an `Infinity → RangeError` needs a denormal ΔV (~1e-308), not reachable in practice              |
| `applyFuseSizes` when no larger size is feasible             | ✅ handled: `fuseWarning = true` and fuse stays at `selectFuseSize(I, cs)` = `FUSE_MAP[cs]` ≤ cable limit (the slice "fuse ≤ thermal limit" holds). The >70 mm² import path is handled separately (L444–449). Rating update for auto vs user fuse boxes is correct (L1050–1059)                                                          |
| Minus-side fusing skipped                                    | ✅ by design (VDE topology fuses the plus conductor; minus edges carry an edge-level fuse never) — consistent with tests                                                                                                                                                                                                                 |
| AC patch ordering before `sizeAcEdges`/`sizeDcEdges`         | ✅ guaranteed by sequential execution in one function body (patch L1036–1042 → calls L1044–1046). `userDcEdges` uses the same `isAcEdge` as the patch, so classification is consistent. **Every** output edge carries a marker: auto AC edges are created with `AC_230V`, unmarked user edges are patched                                |
| AC handle list vs registry                                   | ✅ currently consistent: inverter `plus`-source = AC output, `ac_in`-target = AC input (registry L204–208); `isAcEdge` covers all UI-creatable handles                                                                                                                                                                                   |
| `acCurrentA` priority                                        | ✅ target-first is correct for WR→device; see issue #11 for the daisy-chain residue                                                                                                                                                                                                                                                      |
| `autoCreatedNodeIds` completeness                            | ✅ all six creation paths tracked: 2× direct `ensureNode` (battery replacement L787–797, starter L861–873) and 4× via `findOrCreate`/`rail()` wrapper (rails, fuseBox, shunt, MPPT) — `findOrCreate` only adds on the real creation branch (byExact/regex/single exit first)                                                             |
| Branded types discipline                                     | ✅ no quantity-producing raw arithmetic on branded values; `cumAtSource + ownDrop` uses `addVolts` (L407); no Volts↔Amps mixups found; `mm2(Math.max(…))` re-brands correctly (L385). Comparisons of branded values against `0`/each other are intentional and safe (TS allows them; they don't manufacture units)                       |
| Mutation safety                                              | ✅ clones are depth-1 and all writes to `node.data` are depth-1 primitives (`amps`, `continuousPower`, `rating`); input arrays/objects are never mutated; `edge.data!` uses are preceded by per-edge initialisation in the same pass (L373–375, L428)                                                                                    |
| Water edges/nodes reaching `performAutoWiring`               | ✅ water topology lives in separate store slices (`waterNodes`/`waterEdges`); `autoWireSystem` passes only the electrical graph                                                                                                                                                                                                          |

---

## Issues

---

### Issue 1

SEVERITY: HIGH
LOCATION: `healUserEdges`, lib/autoWire.ts L678–682 (plus missing branch for target=shunt, L651–718)
TYPE: Bug
DESCRIPTION: The shunt's _target-side_ minus port is the **battery side** (probe: the backbone edge `battery.minus → shunt` lands on `target:minus`; `shunt → minusRail` leaves from `source:minus`). Two paths put consumer/charger return current on the **battery side of the shunt**, i.e. downstream of nothing — a classic **shunt bypass** that the function's own docstring promises to eliminate ("kein Shunt-Bypass"):

1. `X.minus → battery.minus` (user draws the return to the battery) is retargeted to `{ target: shuntId }` — the edge keeps `targetHandle: 'minus'` and therefore lands on the shunt's **target port = battery side**. The consumer's return current never crosses the shunt → under-measured SoC/current. Probe: `healUserEdges([c1.minus→b1.minus])` ⇒ `{ source: c1, target: sh, targetHandle: 'minus' }`. Note the existing test `autoWire.test.ts` ("legt Minus-Rückleiter … über den Shunt um") **asserts this buggy target** (`expect(healed[0].target).toBe('sh')`) and must change with the fix. Side effect: for charger-type sources this generic branch runs _before_ the charger branch (L708), so the charger branch's `minusRailId` choice is **dead code** (it only ever sees plus).
2. `X.minus → shunt.minus` _as target_ (user wires straight onto the shunt's battery-side pin) matches no branch (target is shunt, not battery; source isn't battery) and **survives verbatim** — a hidden bypass. Probe: `performAutoWiring` with `c1.minus → shunt.minus` keeps the edge unchanged.

The default auto-generated topology is compliant; the defect triggers on user-repairable wiring mistakes — precisely what `healUserEdges` exists to fix — and violates the headline invariant "Shunt MUST be the only path on the minus rail (no bypass)".

REPRODUCTION:

```ts
// (1) consumer return to battery minus:
performAutoWiring(
  [n('b1', 'battery', { label: 'Aufbau' }), n('c1', 'consumer', { watts: 50 })],
  [
    {
      id: 'u1',
      source: 'c1',
      target: 'b1',
      sourceHandle: 'minus',
      targetHandle: 'minus',
      type: 'cableEdge',
      data: {},
    },
  ]
); // healed edge now ends at shunt TARGET port 'minus' (= battery side)
// (2) straight onto the shunt target pin:
performAutoWiring(
  [
    n('b1', 'battery', { label: 'Aufbau' }),
    n('sh', 'shunt', { label: 'Smart Shunt' }),
    n('c1', 'consumer', { watts: 50 }),
  ],
  [
    {
      id: 'u2',
      source: 'c1',
      target: 'sh',
      sourceHandle: 'minus',
      targetHandle: 'minus',
      type: 'cableEdge',
      data: {},
    },
  ]
); // kept verbatim
```

FIX: land such returns on the minus rail, normalised to the canonical direction `rail.minus → X.minus` so the key matches the auto-generated edge and dedups cleanly:

```diff
 if (targetIsHouseMinus && edge.source !== shuntId && sourceNode?.type !== 'battery') {
-  if (retargetEdge(edge, { target: shuntId }, existingConnections) === 'drop') {
+  // BATTERIE-Seite des Shunts ist tabu (Bypass). Auf die Minus-Schiene legen,
+  // Richtung normalisieren (Schiene -> Verbraucher), damit sie mit der
+  // Auto-Kante dedupliziert statt parallel verdoppelt wird.
+  if (retargetEdge(edge, { source: minusRailId, target: edge.source }, existingConnections) === 'drop') {
     dropIds.add(edge.id);
   }
   continue;
 }
+// Neu: Kanten, die AUF den Shunt (Batterie-Port) zeigen, obwohl sie keine
+// Batterie sind — verdeckter Bypass:
+if (edge.target === shuntId && !!edge.targetHandle?.includes('minus') && sourceNode?.type !== 'battery') {
+  if (retargetEdge(edge, { source: minusRailId, target: edge.source }, existingConnections) === 'drop') {
+    dropIds.add(edge.id);
+  }
+  continue;
+}
```

(`sourceIsHouseMinus` at L672, which makes `shunt → X` from the _source_ port, is already correct side — keep.) Update the test L~441 to `expect(healed[0].target).toBe(minusRailId)` / `source === 'minusRail'`.

---

### Issue 2

SEVERITY: HIGH
LOCATION: `safeToParallel` + parallel-battery loop, lib/autoWire.ts L900–912
TYPE: Bug
DESCRIPTION: Compatibility is only checked **house ↔ each extra** — extras are never checked **pairwise**. When the house battery has no explicit `nominalVoltage` (the voltage guard is skipped: `va > 0 && vb > 0 && va !== vb`), two extras with _different_ nominal voltages both pass and land on the same rails: a 24 V battery silently paralleled onto the 12 V bus. Probe: house LiFePO4 (no `nominalVoltage`) + extra LiFePO4 12.8 + extra LiFePO4 24 ⇒ both extras wired to the plus rail (and shunt). Chemistry has the same hole (extras only compared against house, which may itself be unlabelled: `isLeadChemistry` reads a free-text field).
REPRODUCTION:

```ts
performAutoWiring([
  n('h', 'battery', { label: 'Aufbau', chemistry: 'LiFePO4' }), // no nominalVoltage
  n('x1', 'battery', { label: 'Zweit', chemistry: 'LiFePO4', nominalVoltage: 12.8 }),
  n('x2', 'battery', { label: 'Dritt', chemistry: 'LiFePO4', nominalVoltage: 24 }),
]); // ⇒ x2 (24 V) is wired to the 12 V rail
```

FIX: check each candidate against every already-accepted battery, defaulting a missing `nominalVoltage` to the resolved system voltage so "unset" cannot silently widen the acceptance window:

```diff
-const safeToParallel = (a: Node, b: Node): boolean => { /* house-only */ };
-for (const extra of batteries) {
-  if (extra.id === batteryNode.id) continue;
-  if (starterBatteryNode && extra.id === starterBatteryNode.id) continue;
-  if (!safeToParallel(batteryNode, extra)) continue;
+const accepted: Node[] = [batteryNode];
+const voltageOf = (b: Node): Volts =>
+  quantityOr(b.data?.nominalVoltage, volts, sysVoltage); // kein stiller Freifahrtschein
+const safeToParallel = (a: Node, b: Node): boolean =>
+  voltageOf(a) === voltageOf(b) && isLeadChemistry(a) === isLeadChemistry(b);
+for (const extra of batteries) {
+  if (extra.id === batteryNode.id) continue;
+  if (starterBatteryNode && extra.id === starterBatteryNode.id) continue;
+  if (!accepted.every((a) => safeToParallel(a, extra))) continue;
+  accepted.push(extra);
```

---

### Issue 3

SEVERITY: HIGH
LOCATION: `sizeDcEdges` convergence loop, lib/autoWire.ts L397–418 (gate at L407)
TYPE: Logic Error
DESCRIPTION: The loop enforces the 3 % budget with a purely **local gate**: an edge is only thickened when `cumAtSource + ownDrop > dropLimit` at _its own_ endpoint. Upstream/backbone edges near the battery always pass their local gate (small `cumAtSource`) and are therefore **never thickened to relieve downstream nodes**. Once every tail edge is at 70 mm² and the accumulated upstream drop still exceeds the budget, `changed` becomes `false` and the loop exits — **silently, with the 3 % invariant violated, even when a compliant sizing exists**. Empirically (probe): battery → 4 cascaded fuse/distribution stages with 7.5 A loads each ⇒ deepest consumer at **0.456 V > 0.384 V** although an all-70 mm² backbone achieves ≈0.206 V; a second `sizeDcEdges` pass changes nothing (proof the cap of 20 is not what stopped it — the gate is). Daisy chains are UI-reachable because every DC node has pass-through handles. Two secondary effects ride along: (a) when the situation is physically _infeasible_ even at 70 mm², there is likewise **no signal** (no warning flag, no error) — `CableEdgeData` has no `dropWarning`; (b) the fixed 20-iteration cap is adequate for the gated algorithm on star topologies but is not a principled bound (`dcEdges.length × VDE_SIZES.length` is, given monotonicity).
REPRODUCTION:

```ts
// battery -> f0 -> f1 -> f2 -> f3 -> f4 (each fi: fuse node with a 96 W consumer, 2 m legs)
// via public API: user edges for the chain are included in allDcEdges of performAutoWiring;
// direct drive of the exported unit (same function the engine calls):
sizeDcEdges(chainEdges, nodes, chainEdges, volts(12.8));
relevantCumulativeDrop('c4', nodeMap, chainEdges, nodes, volts(12.8)); // 0.456 > 0.384
```

FIX: after the local loop, run a global relief pass that thickens the largest-own-drop edge on each violating node's supply path, one VDE step at a time; if every path edge is at `MAX_CROSS_SECTION` and the node still violates, mark the path:

```ts
// Nacherschleife: Restverletzungen am Lastknoten aufloesen (lokale Gates
// vergroessern niemals vorgelagerte Kanten)
for (const node of nodes) {
  if (node.type !== 'consumer' && node.type !== 'inverter') continue;
  for (let guard = 0; guard < dcEdges.length * VDE_SIZES.length; guard++) {
    if (relevantCumulativeDrop(node.id, nodeMap, allEdges, nodes, sysVoltage) <= dropLimit) break;
    const victim = heaviestSupplyPathEdge(node.id, nodeMap, allEdges, nodes, sysVoltage); // ownDrop max, cs < MAX
    if (!victim) {
      markSupplyPath(node.id, allEdges, nodeMap);
      break;
    } // edge.data.dropWarning = true (Feld ergaenzen)
    (victim.data ??= {}).crossSection = nextStandardCrossSection(mm2(edgeCrossSection(victim) + 0.1));
  }
}
```

`heaviestSupplyPathEdge` walks the same direction-aware incoming-edge chain as `cumulativeDropAt`, returning the edge with the largest `edgeVoltageDrop` whose section can still grow. Add `dropWarning?: boolean` to `CableEdgeData` so infeasible paths are surfaced, and re-run `applyFuseSizes` afterwards for any edge whose section changed.

---

### Issue 4

SEVERITY: HIGH
LOCATION: `isAcEdge`, lib/autoWire.ts L338–352 (`acBatteryCharger` blanket, L345–346); mirrored in electrical.ts `getEdgeDomain` L143–146 / `getHandleDomain` L172; contradicted by registry (`acBatteryCharger` has `handles: dcPassThrough` = all DC_12V, builtinComponents.ts L152–162)
TYPE: Logic Error
DESCRIPTION: `acBatteryCharger` is a **mixed-domain** device (AC shore input, DC charging output) — auto-wire itself wires its DC output to the rails with explicit `DC_12V` markers (L983–987). Yet `isAcEdge`/`getEdgeDomain` classify **any** edge touching an `acBatteryCharger` as AC. Consequences, all probe-verified on an import-style plan where the user (pre-)wires the charger's DC output:

1. `acCharger.plus → battery.plus` is healed to the plus rail, then stamped **`AC_230V`**, excluded from DC sizing and fuse logic, and sized by 230 V logic at **1.5 mm² — while the charger's auto minus edge on the same DC output is DC_12V / 25 mm² at 40 A**. The auto-created plus path is suppressed (its connection key is now taken), so the _only_ DC output path is a 1.5 mm² "AC" cable on a 40 A charger — precisely the fire-risk class the sizing engine exists to prevent.
2. The same blanket in `getHandleDomain` makes the UI reject the legitimate DC connection (`AC_230V` source-handle vs `DC_12V` target mismatch): **auto-wire is the only producer of acCharger DC-side edges**, users cannot reproduce or repair them by hand.
3. `vde-properties.test.ts` never exercises this: `acBatteryCharger` is absent from the property generators (see Issue 9).

REPRODUCTION:

```ts
performAutoWiring(
  [
    n('b1', 'battery', { label: 'Aufbau' }),
    n('sp', 'shorePower', {}),
    n('ac', 'acBatteryCharger', { amps: 40 }),
  ],
  [
    {
      id: 'u1',
      source: 'ac',
      target: 'b1',
      sourceHandle: 'plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 2 },
    },
  ]
); // u1: healed to rail, domain AC_230V, crossSection 1.5
```

FIX (coordinated, three places):

```diff
  // autoWire.ts isAcEdge — acBatteryCharger ist AC-am-Eingang, DC-am-Ausgang:
  if (
    s === 'shorePower' || t === 'shorePower' ||
    s === 'consumer230v' || t === 'consumer230v'
-   || s === 'acBatteryCharger' || t === 'acBatteryCharger'
  ) return true;
```

(`shorePower → acCharger` stays AC via the shorePower blanket; `acCharger → rail/battery` becomes DC.) Apply the identical carve-out in `electrical.ts` (`getEdgeDomain` L143–146, `getHandleDomain` L172) and declare explicit handles in the registry: `plus` target = AC_230V (shore in), `plus`/`minus` source = DC_12V (charger out), keeping `ChargerNode` markup in sync.

---

### Issue 5

SEVERITY: MEDIUM
LOCATION: `healUserEdges` `sourceIsHousePlus` branch, lib/autoWire.ts L685–707
TYPE: Logic Error
DESCRIPTION: Battery-plus user edges are only healed for targets `consumer` (→ fuseBox), `inverter` (→ plus rail), `fuse` (→ plus rail). Two target classes fall through:
(a) **AC nodes** (`consumer230v`, `acBatteryCharger`, `shorePower`): `battery.plus → consumer230v` is kept verbatim and stamped `AC_230V` (probe: kept, 1.5 mm²). The schematic then shows a 12 V battery "feeding" a 230 V socket with no protective device and no warning — physically meaningless, and the engine silently legitimates it.
(b) **charger-type targets in battery→charger direction**: `battery.plus → charger.plus` is kept _alongside_ the auto-generated `charger → rails` pair (probe: both survive), a duplicated parallel feed hanging 2+ m off the battery post — contradicting the documented backbone model ("Batterie+ —(≤20 cm, abgesichert)→ Plus-Busbar"). The edge does receive an edge-level fuse label from `applyFuseSizes`, which is why this is MEDIUM not HIGH.
REPRODUCTION:

```ts
// (a)
performAutoWiring(
  [n('b1', 'battery', { label: 'A' }), n('c', 'consumer230v', { watts: 500 })],
  [
    {
      id: 'u1',
      source: 'b1',
      target: 'c',
      sourceHandle: 'plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: {},
    },
  ]
); // kept, AC_230V
// (b) same with target: charger node (type 'charger') → b1[plus]→ch[plus] AND ch[plus]→rail[plus] both exist
```

FIX: extend the `sourceIsHousePlus` branch:

```diff
 if (sourceIsHousePlus) {
   ...
+  if (targetNode && chargerTypeSet.has(targetNode.type || '')) {
+    // Richtung normalisieren: charger -> Plus-Schiene; dedupliziert sich gegen
+    // die Auto-Kante und verschwindet damit als Batterie-Direktabgang.
+    if (retargetEdge(edge, { source: edge.target, target: plusRailId }, existingConnections) === 'drop') dropIds.add(edge.id);
+    continue;
+  }
+  if (targetNode?.type === 'consumer230v' || targetNode?.type === 'shorePower' || targetNode?.type === 'acBatteryCharger') {
+    // 12-V-Batterie speist nie direkt eine 230-V-Seite. Wenn ein WR existiert,
+    // an dessen AC-Ausgang haengen; sonst entfernen (Validierung meldet die Leiche).
+    const inv = (nodeMapValues(nodeMap).find((nd) => nd.type === 'inverter'));
+    const res = inv ? retargetEdge(edge, { source: inv.id }, existingConnections) : 'drop';
+    existingConnections.delete(connectionKey(edge)); if (res === 'drop') dropIds.add(edge.id);
+    continue;
+  }
 }
```

---

### Issue 6

SEVERITY: MEDIUM
LOCATION: `performAutoWiring` user-edge normalisation, lib/autoWire.ts L756–766 (`length: e.data?.length ?? 1`, L759)
TYPE: Bug
DESCRIPTION: A missing user-edge length is **persisted as 1 m**. Two problems: (1) sizing uses 1 m even when the geometric run is much longer — probe: 400 W consumer placed 500 px away with no stored length ⇒ sized 10 mm² for "1 m", while the real 5 m run needs ≈16–25 mm² (drop 4.2 % > 3 %); (2) once `length:1` is persisted, the renderer's geometric fallback in `edgeDropInputs` (`edge.data?.length || physical`) is disabled, so the violation is **invisible on the canvas** (shows 0.54 % green instead of 4.2 % red). UI-created edges always carry `length: 3`, so this hits imports, templates and programmatic plans — the same data class `healUserEdges` is built for.
REPRODUCTION:

```ts
performAutoWiring(
  [n('b1', 'battery', { label: 'A' }, { x: 0, y: 0 }), n('c1', 'consumer', { watts: 400 }, { x: 500, y: 0 })],
  [
    {
      id: 'u2',
      source: 'b1',
      target: 'c1',
      sourceHandle: 'plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: {},
    },
  ]
); // u2.data = { length: 1, crossSection: 10, fuseSize: 32 }  → real 5 m run violates 3 %
```

FIX: estimate missing lengths from geometry, consistent with the display layer, and only persist real values:

```diff
+const nodePos = new Map(initialNodes.map((nd) => [nd.id, nd.position]));
+const geometricLength = (e: Edge): number | undefined => {
+  const a = nodePos.get(e.source), b = nodePos.get(e.target);
+  return a && b ? Math.max(1, Math.hypot(b.x - a.x, b.y - a.y) / 100) : undefined;
+};
 .map((e) => ({ ...e, data: {
-  length: e.data?.length ?? 1,
+  length: e.data?.length ?? geometricLength(e), // bleibt undefined → Reader-Fallback greift
```

---

### Issue 7

SEVERITY: MEDIUM
LOCATION: ground-bond detection, lib/autoWire.ts L996–1002 and enforcement loop L1022–1027
TYPE: Logic Error
DESCRIPTION: `connectsToMinusSystem` requires `e.sourceHandle?.includes('minus') === true`. An import-style bond with `sourceHandle: null`/missing matches neither, so (probe-verified): (1) `hasDirectGroundBond` is false → an auto bond is created **in parallel to the user's** (duplicate chassis bond on the canvas), and (2) the user's bond never enters the 16 mm² enforcement loop either (same predicate) — probe left it at **1.5 mm²**, below the VDE minimum the code is written to enforce. No false _positives_ are possible (the predicate requires rail/shunt + minus handle — good), only this false negative; UI-created edges always carry handles, so reachability is import/template data.
REPRODUCTION:

```ts
performAutoWiring(nodes, [
  {
    id: 'u-bond',
    source: minusRailId,
    target: 'g1',
    sourceHandle: null,
    targetHandle: null,
    type: 'cableEdge',
    data: { length: 1 },
  },
]);
// ⇒ u-bond stays 1.5 mm² AND a duplicate e-auto-* rail→ground bond (16 mm²) is created
```

FIX: treat a missing handle on a rail/shunt↔ground connection as minus-side, and enforce 16 mm² on every bond the predicate accepts:

```diff
 const connectsToMinusSystem = (e: CableEdge): boolean =>
-  (e.sourceHandle?.includes('minus') === true) &&
+  (!e.sourceHandle || e.sourceHandle.includes('minus')) &&
   ((e.source === rails.minus.id && e.target === groundId) || …);
```

---

### Issue 8

SEVERITY: LOW
LOCATION: `acCurrentA`, lib/autoWire.ts L496–497
TYPE: Logic Error
DESCRIPTION: When both endpoints are `consumer230v`, the target branch fires first and only the **target's** watts are used. In a user-drawn daisy chain `inverter → A → B`, the segment `inverter → A` physically carries A+B but is sized for A alone (upstream segments of chains are systematically undersized). Reachability is import-only — the registry gives `consumer230v` no source handle — hence LOW.
REPRODUCTION: `[{inv}, {A: consumer230v, 2000 W}, {B: consumer230v, 1500 W}]` with edges inv→A, A→B: inv→A sized at 8.7 A instead of ≈15.2 A.
FIX:

```diff
- if (targetNode?.type === 'consumer230v') return loadOf(targetNode);
+ if (targetNode?.type === 'consumer230v') {
+   // Daisy-Chain: ein vorgelagertes Geraet traegt auch die Summe nachgelagerter Geraete.
+   if (sourceNode?.type === 'consumer230v') return maxAmps(loadOf(sourceNode), loadOf(targetNode));
+   return loadOf(targetNode);
+ }
```

(Or declare consumer-to-consumer wiring unsupported and drop such edges in `healUserEdges`.)

---

### Issue 9

SEVERITY: MEDIUM
LOCATION: lib/autoWire.test.ts, lib/vde-properties.test.ts (generators L~250–290, 470–490)
TYPE: Missing Test
DESCRIPTION: Branches with **no** coverage (would have caught Issues 1–8):

1. **3+ batteries**, incl. pairwise-incompatible extras with house battery lacking `nominalVoltage` (Issue 2); two same-chemistry batteries (parallel to rail+shunt) also untested.
2. **Daisy-chain/deep distribution chains** sized by `sizeDcEdges` — the >3 % termination case (Issue 3); no test asserts total path drop for anything beyond the 2-node reference plan.
3. **`acBatteryCharger` anywhere in the property generators** — `nodeSpec` omits it, so G6 ("keine Domänenmischung", "jede Kante dimensioniert/markiert") never sees the mixed-domain device (Issue 4); `dcdcCharger`+_only-starter_ is unit-tested, but the 24 V-mismatch case is not.
4. **Heal branches**: `battery+ → consumer230v`, `battery+ → charger` (Issue 5), and the corrected minus-rail landing (Issue 1) — one existing test currently asserts the _buggy_ shunt target and must be inverted.
5. **Single-busbar fallbacks**: unlabeled single busbar tested; single **negative-role** busbar and duplicate-label busbar pairs untested.
6. **Multiple solars, no MPPT** → assert exactly one MPPT is created and all panels attach to it (only single-solar covered).
7. **Ground already bonded** (rail→ground with minus handles ⇒ _no_ duplicate auto bond) and the null-handle import bond (Issue 7) — only the consumer-decoy false-positive case is tested.
8. **Convergence determinism**: `sizeDcEdges(sizeDcEdges(x)) == sizeDcEdges(x)` property — catches non-converged exits.
   REPRODUCTION: probes used for this audit (deleted) demonstrate each gap.
   FIX: add the eight test groups above; add `acBatteryCharger` to `nodeSpec` (with `shorePower` present) in both generators of `vde-properties.test.ts`.

---

### Issue 10

SEVERITY: LOW
LOCATION: `isAcEdge`, lib/autoWire.ts L338–365 vs electrical.ts L151–163 & L167–176
TYPE: Design Flaw
DESCRIPTION: Three independent AC-handle allow-lists must be kept in sync by hand: `isAcEdge` (`'plus'`, `['ac_out','ac_in','L','ac','output']`), `getEdgeDomain.AC_SOURCE_HANDLES` (`['plus','ac_out','L','ac','output']` — note: no `'ac_in'`), and the registry. Today they agree on all UI-creatable edges, but a future handle name (`'L2'`, `'N'`, or a renamed inverter output) silently downgrades an AC edge to DC sizing (12 V model / DC fuse logic applied to a 230 V line). Divergence already exists in embryo: `isAcEdge` accepts `'ac_in'` as an inverter _source_ handle, `getEdgeDomain` does not.
REPRODUCTION: add handle `{ id:'L2', type:'source', domain:'AC_230V' }` to the inverter in the registry; a user edge with `sourceHandle:'L2'` is then classified DC by `isAcEdge` while the store's `getHandleDomain`… stays AC — split-brain.
FIX: single source of truth — after the marker short-circuits, delegate:

```diff
 function isAcEdge(edge: CableEdge, nodeMap: Map<string, Node>): boolean {
   if (edge.data?.edgeDomain === 'AC_230V') return true;
   if (edge.data?.edgeDomain === 'DC_12V') return false;
   const s = nodeMap.get(edge.source)?.type;
   const t = nodeMap.get(edge.target)?.type;
-  /* … lokale Handle-Listen … */
+  return getEdgeDomain(s, t, edge.sourceHandle, edge.targetHandle) === 'AC_230V';
 }
```

(after the Issue-4 carve-out is applied to `getEdgeDomain`).

---

### Issue 11

SEVERITY: LOW
LOCATION: `ensureNode`, lib/autoWire.ts L204–205
TYPE: Null Safety
DESCRIPTION: `batteryNode.position.x + offsetX` assumes `position` is always defined. Store-created nodes always have one, but a malformed imported node (`position: undefined`) crashes the entire auto-wire run with a TypeError instead of returning `null`. Cheap hardening.
REPRODUCTION: `performAutoWiring([{ id:'b1', type:'battery', data:{} } as Node])` (no `position`).
FIX:

```ts
position: { x: (batteryNode.position?.x ?? 0) + offsetX, y: (batteryNode.position?.y ?? 0) + offsetY },
```

---

## Corrections to the preliminary draft (claims verified as FALSE — do not "fix" these)

1. **"Parallel batteries must connect to `rails.minus`, not `shuntNode`" — WRONG and dangerous.** The shunt's target-side minus port _is_ the battery bank side (auto backbone: `battery.minus → shunt[target]`, `shunt[source] → rail`). A parallel battery at `extra.minus → shunt[target]` has **all** its return current crossing the shunt (probe A). Moving it to `rails.minus` would **create** the shunt bypass the draft claimed to fix. Current code is correct.
2. **"Single negative-role busbar becomes the plus rail" — already fixed.** `oppositeRoleId` exclusion (L556–560) prevents it; probe 10 confirms a fresh plus rail is created and the negative busbar is reused as minus.
3. **"Inverter `sourceHandle:'plus'` misclassifies DC as AC" — false.** In the registry the inverter's **source** `plus` handle _is_ the 230 V output (L208); the DC input is the _target_ `plus` handle, which never matches the source check.
4. **"`larger === undefined` assigns an undersized fuse silently" — false.** `fuseWarning = true` is set and `selectFuseSize(I, cs)` returns `FUSE_MAP[cs]` (≤ cable limit). The draft's proposed `selectFuseSize(I, MAX_CROSS_SECTION)` + `continue` would have **broken** the "fuse ≤ cable thermal limit" invariant for `cs < 70`.
5. **"AC user edge with `data: undefined` never sized" — unreachable.** `performAutoWiring` rebuilds every user edge with a fresh `data` object (L756–766), so the patch loop's `edge.data` guard can never skip; ordering is sequential and guaranteed.
6. **"User MPPT amps overwritten breaks idempotency" — not a defect.** The upsize is applied only upward (`if current < required`), is idempotent across runs, and mirrors the deliberate fuse-box rating upsize policy (L1050–1059).
7. **"Near-zero `allowedDrop` → `RangeError`" — not reachable:** guarded at two levels; producing `Infinity` needs a denormal voltage remainder (~1e-308).
8. **"20-iteration cap insufficient" — misleading:** the loop always terminates, cross-sections are monotone, and the observed early exit is caused by the local _gate_ (Issue 3), not the cap; a second identical pass changes nothing.
9. **"Label collisions flip rail attachment between runs" — not reproducible:** role/label priority plus `excludeId`/`oppositeRoleId` keep rail selection deterministic on re-run (G5, 1000 runs, probe 9).
10. **"`edge.data!` unguarded" — safe:** every edge in `dcEdges` is initialised in the function's first pass before the convergence loop; `applyFuseSizes` guards per edge.
11. **"starter→booster has no fuse" — false:** `applyFuseSizes` processes the plus edge (probe 11: 16 mm² / fuse 30 A).

---

## Summary Table

| #   | Severity | Location                                                                    | Type         | One-line description                                                                                                                                                   |
| --- | -------- | --------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | HIGH     | `healUserEdges` L678–682 (+ missing branch), autoWire.ts                    | Bug          | Minus-side returns healed onto the shunt's **battery-side** port → shunt bypass; user edges onto that port survive verbatim; charger-branch `minusRailId` is dead code |
| 2   | HIGH     | `safeToParallel` loop L900–912, autoWire.ts                                 | Bug          | 3+ batteries: extras checked only against house, not pairwise → 24 V pack lands on 12 V rail when house `nominalVoltage` unset                                         |
| 3   | HIGH     | `sizeDcEdges` L397–418, autoWire.ts                                         | Logic Error  | Local gate never thickens upstream edges → loop exits with >3 % violations although a compliant sizing exists; infeasible paths produce no signal (no `dropWarning`)   |
| 4   | HIGH     | `isAcEdge` L338–352 (+ electrical.ts L143/L172, registry L152), autoWire.ts | Logic Error  | `acBatteryCharger` blanket-classified AC → its DC-output user edges stamped AC_230V, unfused, sized 1.5 mm² at 40 A; UI can't wire the legitimate DC connection either |
| 5   | MEDIUM   | `healUserEdges` `sourceIsHousePlus` L685–707                                | Logic Error  | `battery+ → consumer230v` kept as valid "AC" from a 12 V battery; `battery+ → charger` kept as duplicate parallel feed                                                 |
| 6   | MEDIUM   | `performAutoWiring` L756–766                                                | Bug          | Missing user-edge length persisted as 1 m → long imported runs under-sized **and** geometric display fallback disabled (violation invisible)                           |
| 7   | MEDIUM   | `connectsToMinusSystem` L996–1002, L1022–1027                               | Logic Error  | Null/missing handles → bond not detected: duplicate auto bond created **and** user's 1.5 mm² bond escapes the 16 mm² enforcement                                       |
| 8   | LOW      | `acCurrentA` L496–497                                                       | Logic Error  | consumer230v→consumer230v daisy chain: upstream segments sized for target load only                                                                                    |
| 9   | MEDIUM   | autoWire.test.ts / vde-properties.test.ts                                   | Missing Test | 3+ batteries, deep chains, acBatteryCharger in generators, heal branches, busbar fallbacks, multi-solar, ground-bond dedup, sizeDcEdges re-entrancy                    |
| 10  | LOW      | `isAcEdge` vs `getEdgeDomain`/`getHandleDomain`                             | Design Flaw  | Three hand-synced AC-handle lists; a new handle name silently sizes AC as DC — delegate to one source of truth                                                         |
| 11  | LOW      | `ensureNode` L204–205                                                       | Null Safety  | `batteryNode.position` assumed defined → malformed import crashes the whole run instead of returning null                                                              |
