import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.doMock so it doesn't get hoisted and we can control when it's used with resetModules
vi.doMock('pg', () => {
  return {
    Pool: vi.fn().mockImplementation((config) => ({
        config,
        connect: vi.fn(),
        end: vi.fn(),
        query: vi.fn(),
    })),
  };
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
