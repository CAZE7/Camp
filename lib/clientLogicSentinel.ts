/**
 * Markiert Client-Chunks, deren eigene Planungslogik der Post-Build
 * verschleiert (`scripts/build/obfuscateClientChunks.ts`).
 *
 * Der String muss im ausgelieferten JavaScript stehen bleiben. Eine reine
 * Konstante würde der Bundler als toten Code streichen; die Zuweisung auf
 * `globalThis` ist eine beobachtbare Schreibweise.
 */

export const CLIENT_LOGIC_SENTINELS = [
  'camp-logic-sentinel:route',
  'camp-logic-sentinel:autowire',
  'camp-logic-sentinel:verify',
  'camp-logic-sentinel:electrical',
] as const;

export type ClientLogicSentinel = (typeof CLIENT_LOGIC_SENTINELS)[number];

export function keepClientLogicSentinel(marker: ClientLogicSentinel): void {
  const host = globalThis as { __campLogic?: Record<string, true> };
  (host.__campLogic ??= {})[marker] = true;
}
