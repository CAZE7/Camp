import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('M9-1 Next.js Security-Pin', () => {
  it('package.json pinnt Next.js ≥ 16.3.3 (GHSA-p293-qw3h-jr36 / GHSA-2xp9-vwfh-vxw4)', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      dependencies: { next: string };
    };
    const raw = pkg.dependencies.next.replace(/^[\^~]/, '');
    const [major, minor, patch] = raw.split('.').map((part) => Number(part));
    expect(major).toBeGreaterThanOrEqual(16);
    if (major === 16) {
      expect(minor).toBeGreaterThanOrEqual(3);
      if (minor === 3) expect(patch).toBeGreaterThanOrEqual(3);
    }
  });
});
