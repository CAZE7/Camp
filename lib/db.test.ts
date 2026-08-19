import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.doMock so it doesn't get hoisted and we can control when it's used with resetModules.
// Pool must be a real class because it's used with `new Pool(...)`.
vi.doMock('pg', () => {
  const calls: any[] = [];
  class Pool {
    config: any;
    connect: any;
    end: any;
    query: any;
    constructor(config: any) {
      this.config = config;
      this.connect = vi.fn();
      this.end = vi.fn();
      this.query = vi.fn();
      calls.push(config);
    }
  }
  // Attach a spy for assertion. We can spy on the class itself.
  const PoolSpy = vi.fn(Pool as any);
  // Also expose the calls tracker for testing
  (PoolSpy as any).__calls = calls;
  // Re-bind so `new PoolSpy(...)` works as constructor.
  // The trick: assign prototype so vi.fn instance becomes constructible.
  PoolSpy.prototype = Pool.prototype;
  return { Pool: PoolSpy };
});

describe('db utility', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Reset env for each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should initialize Pool with connectionString when DATABASE_URL is set', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host:5432/db';

    const { Pool } = await import('pg');
    const db = (await import('./db')).default;

    expect(Pool).toHaveBeenCalledWith({
      connectionString: 'postgres://user:pass@host:5432/db',
    });
    expect(db).toBeDefined();
  });

  it('should initialize Pool with empty object when DATABASE_URL is not set', async () => {
    // Ensure DATABASE_URL is not set
    delete process.env.DATABASE_URL;

    const { Pool } = await import('pg');
    const db = (await import('./db')).default;

    expect(Pool).toHaveBeenCalledWith({});
    expect(db).toBeDefined();
  });
});
