/**
 * components/analytics/onboardingGate.ts — Assistent hält den Banner zurück.
 *
 * Prüfrunde 8 (R8-01): Beim ersten Besuch auf dem Handy lagen Assistent
 * und Analytics-Banner gleichzeitig offen; der Banner verdeckte die
 * Fußzeile des Assistenten, und ein Tipp auf „Weiter" traf „Akzeptieren" —
 * eine Einwilligung per Fehltipp. Deshalb meldet der Assistent hier seine
 * Sichtbarkeit, und der Banner wartet, bis er geschlossen ist. Danach
 * erscheint er wie gewohnt (die Entscheidung bleibt offen, nicht verworfen).
 */

let onboardingOpen = false;
const listeners = new Set<() => void>();

export function setPlannerOnboardingOpen(open: boolean): void {
  if (onboardingOpen === open) return;
  onboardingOpen = open;
  for (const listener of listeners) listener();
}

export function isPlannerOnboardingOpen(): boolean {
  return onboardingOpen;
}

export function subscribePlannerOnboarding(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
