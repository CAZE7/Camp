import { expect } from 'vitest';

/**
 * Typisierte Asymmetrik-Matcher für Tests (AUDIT T1).
 *
 * Vitest tippt `expect.stringContaining()` als `any`. In einem typbewussten
 * Lint-Gate wird daraus an jeder Objektzuweisung ein `no-unsafe-assignment` —
 * und die naheliegende „Lösung" (`as any` daneben) wäre genau die
 * `any`-Ausbreitung, die das Gate verhindern soll. Dieser Helfer ist die eine
 * Stelle, an der die Lücke geschlossen wird: Der Matcher bleibt derselbe,
 *nach außen sichtbar ist ein `string`.
 */
export function textContaining(expected: string): string {
  return expect.stringContaining(expected) as unknown as string;
}

/**
 * Dasselbe für Zahlen: `expect.closeTo()` ist `any`.
 */
export function closeTo(expected: number, precision?: number): number {
  return expect.closeTo(expected, precision) as unknown as number;
}
