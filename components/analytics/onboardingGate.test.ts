import { describe, expect, it, vi } from 'vitest';

import {
  isPlannerOnboardingOpen,
  setPlannerOnboardingOpen,
  subscribePlannerOnboarding,
} from './onboardingGate';

describe('onboardingGate (R8-01)', () => {
  it('meldet Öffnen/Schließen und benachrichtigt Abonnenten nur bei Wechsel', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePlannerOnboarding(listener);
    setPlannerOnboardingOpen(false);
    expect(listener).not.toHaveBeenCalled();
    setPlannerOnboardingOpen(true);
    expect(isPlannerOnboardingOpen()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    setPlannerOnboardingOpen(true);
    expect(listener).toHaveBeenCalledTimes(1);
    setPlannerOnboardingOpen(false);
    expect(isPlannerOnboardingOpen()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    setPlannerOnboardingOpen(true);
    expect(listener).toHaveBeenCalledTimes(2);
    setPlannerOnboardingOpen(false);
  });
});
