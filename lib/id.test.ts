/**
 * M11-1-Regression: newEntityId() muss auch ohne Secure Context (http im LAN)
 * funktionsfähige, UUID-v4-förmige IDs liefern — drei Stufen: randomUUID,
 * getRandomValues, Math.random.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newEntityId } from './id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('newEntityId', () => {
  it('nutzt crypto.randomUUID, wenn verfügbar', () => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => '0f9d0000-4000-4000-8000-000000000000') });
    expect(newEntityId()).toBe('0f9d0000-4000-4000-8000-000000000000');
  });

  it('fällt auf getRandomValues zurück, wenn randomUUID fehlt (unsicherer Kontext)', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = (i * 37 + 11) & 0xff;
        return arr;
      },
    });
    const id = newEntityId();
    expect(id).toMatch(UUID_V4);
  });

  it('wirft ohne jede Crypto-API und nutzt den Math.random-Fallback', () => {
    vi.stubGlobal('crypto', undefined);
    expect(newEntityId()).toMatch(UUID_V4);
  });

  it('erzeugt unterschiedliche IDs (Sitzungs-Eindeutigkeit)', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newEntityId()));
    expect(ids.size).toBe(200);
  });
});
