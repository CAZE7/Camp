/**
 * Mission Stufe 3 — px-Ganzzahlskala in Milli-px mit sättigender Arithmetik.
 *
 * Beleg: `docs/ai/GPU-ROUTING-ARCH.md` §3″ — „Der GPU-Kern rechnet daher in
 * Ganzzahl-Milli-px (1 Kosten-einheit = 0,001 px)“ und die Sättigungsregel
 *
 *     g' = min(g_alt + c, G_max),   G_max = 0x7FFF0000 − S_max
 *
 * wobei `S_max` die maximal je einem Label addierbare Kostenmenge ist
 * (Per-Zelle-Maximum + Sicherheitsband). Sentinel `INF = 0x7FFF0000` ist per
 * Konstruktion strikt größer als jeder erreichbare Wert — „kein
 * Overflow-Szenario existiert mehr, unabhängig von Pfadlängen“ (§3″, die
 * v1-Argumentation über „realistisch ≤ 2000 Zellen“ wurde in Review 2
 * ausdrücklich verworfen).
 *
 * Die Einheit folgt der etablierten Kostenwährung des Repos (px-äquivalent,
 * wörtlich `costModel.ts` „1 Kosteneinheit = 1 px Leitungslänge“). Diese
 * Datei liefert die Arithmetik; ob `hananAStar` darin rechnet, entscheidet
 * das Gate `ROUTING_GATES.integerMilliPxCosts` (Standard 0 — Golden Master
 * byte-stabil).
 */

/** Milli-px je px (GPU-ARCH §3″: 1 Kosteneinheit = 0,001 px). */
export const MILLI_PX_PER_PX = 1000;

/**
 * Sentinel der Ganzzahl-Kosten (GPU-ARCH §3″, konstruktiv — derselbe
 * Wertfamilien-Fall wie `EDT_MAX_D2 = 0x7fffffff` in `edt.ts`).
 *
 * Nie als normales Label-Ergebnis erreichbar: Die Sättigung klemmt jeden
 * Wert auf `g_max ≤ INF − s_max < INF`.
 */
export const INT_COST_INF = 0x7fff0000;

/** Sättigungsbudget eines Suchlaufs (§3″: Per-Zelle-Maximum + Sicherheitsband). */
export type IntCostBudget = {
  /** Maximal je Label-Update addierbare Menge in Milli-px (S_max). */
  readonly sMax: number;
  /** Sättigungsschwelle G_max = INF − S_max. */
  readonly gMax: number;
};

const requireFiniteNonNegative = (value: number, what: string): number => {
  if (!Number.isFinite(value) || value < 0) {
    // Rule M: kein stilles Abschneiden — ungültige Eingabe wirft.
    throw new RangeError(`${what}: endliche, nicht-negative Zahl erwartet, bekam ${value}`);
  }
  return value;
};

/**
 * Kosten px → Milli-px (gerundet, ganzzahlig).
 *
 * Nur für nicht-negative Kosten (Schritt-, Wende- und Zuschlagskosten im
 * A*-Label); `Infinity` bleibt `Infinity` (harte Kanten im Kostenmodell),
 * alles andere wirft `RangeError` (Rule M).
 */
export const costToMilliPx = (px: number): number => {
  if (px === Infinity) return Infinity;
  requireFiniteNonNegative(px, 'costToMilliPx');
  return Math.round(px * MILLI_PX_PER_PX);
};

/**
 * Heuristik px → Milli-px, abgerundet (`Math.floor`).
 *
 * Zulässigkeit (admissible h) bleibt gewahrt: floor(h·1000) ≤ h·1000, die
 * Schätzung wird also nie größer als der wahre Wert — der Branch-and-Bound-
 * Pruning `g + h ≥ bestGoalG` (GPU-ARCH §2.1′) bleibt korrekt.
 */
export const heuristicToMilliPx = (px: number): number => {
  requireFiniteNonNegative(px, 'heuristicToMilliPx');
  return Math.floor(px * MILLI_PX_PER_PX);
};

/**
 * Sättigendes Label-Update: `min(current + update, gMax)` (§3″-Gleichung).
 *
 * `onSaturate` feuert genau dann, wenn die Addition geklemmt wird — der
 * Gegenmaßnahmen-Pfad der Spec („Kapazität erschöpft — CPU-Reroute“);
 * ohne Callback bleibt die Sättigung rechnerisch, aber nie still (Daten
 * werden nie verworfen, nur geklemmt — der Zähler ist der Warnweg).
 */
export const saturatingAddMilli = (
  current: number,
  update: number,
  budget: IntCostBudget,
  onSaturate?: () => void
): number => {
  requireFiniteNonNegative(current, 'saturatingAddMilli(current)');
  requireFiniteNonNegative(update, 'saturatingAddMilli(update)');
  if (current > budget.gMax) {
    throw new RangeError(`saturatingAddMilli: current ${current} über gMax ${budget.gMax}`);
  }
  const sum = current + update;
  if (sum <= budget.gMax) return sum;
  onSaturate?.();
  return budget.gMax;
};

/**
 * Budget aus einem Per-Update-Maximum in px ableiten (Sicherheitsband: die
 * Extrarate selbst, damit `g_max + s_max` exakt den Sentinel erreicht, den
 * die Sättigung nie ausgibt — „Sentinel konstruktiv“, §3″).
 *
 * `maxStepPx` muss die größte Einzelschrittlänge des konkreten Grids
 * überschätzen (in `hananAStar` aus den Achsen-Arrays abgeleitet, kein
 * erfundenes Lazarat); `maxExtraPx` die größte Turn-/Zuschlagskostenrate.
 */
export const intCostBudget = (maxStepPx: number, maxExtraPx: number): IntCostBudget => {
  requireFiniteNonNegative(maxStepPx, 'intCostBudget(maxStepPx)');
  requireFiniteNonNegative(maxExtraPx, 'intCostBudget(maxExtraPx)');
  // Aufwärts runden: Das Budget MUSS die Realität überdecken.
  const sMax =
    Math.ceil((maxStepPx + maxExtraPx) * MILLI_PX_PER_PX) + Math.ceil(maxExtraPx * MILLI_PX_PER_PX);
  const gMax = INT_COST_INF - sMax;
  if (gMax <= 0) {
    throw new RangeError(`intCostBudget: Budget ${sMax} Milli-px sprengt den Sentinel ${INT_COST_INF}`);
  }
  return Object.freeze({ sMax, gMax });
};

/**
 * Größte konsequente Schrittlänge |Δx| + |Δy| eines sorts-Grids in px:
 * max Δx über die X-Achse plus max Δy über die Y-Achse. Ein Zellpaar kann
 * höchstens beides liefern; die Summe der Achsenmaxima überdeckt also jede
 * tatsächliche Schrittlänge (Überdeckung garantiert, keine Untergrenze
 * behauptet).
 */
export const maxStepPxOfGrid = (xs: readonly number[], ys: readonly number[]): number => {
  const maxDelta = (coords: readonly number[]): number => {
    if (coords.length < 2) return 0;
    let m = 0;
    for (let i = 1; i < coords.length; i++) {
      const d = Math.abs(coords[i]! - coords[i - 1]!);
      if (d > m) m = d;
    }
    return m;
  };
  return maxDelta(xs) + maxDelta(ys);
};
