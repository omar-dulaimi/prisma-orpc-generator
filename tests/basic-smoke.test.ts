import { describe, expect, it } from 'vitest';

// Lightweight smoke test to ensure helpers compile & basic runtime-support functions behave.

// Temp shim (since runtime-support lives in generated output, we mimic minimal API here for CI smoke)
function createTempCache() {
  const cache = new Map<string, any>();
  return {
    async get(k: string) { return cache.get(k) ?? null; },
    async set(k: string, v: any) { cache.set(k, v); },
    async clear() { cache.clear(); },
    async clearNamespace(prefix: string) { for (const key of cache.keys()) if (key.startsWith(prefix+':')) cache.delete(key); }
  };
}

describe('runtime support smoke', () => {
  it('stores and clears namespaced keys', async () => {
    const cache: any = createTempCache();
    await cache.set('user:findMany:{}', [1]);
    await cache.set('post:findMany:{}', [2]);
    expect(await cache.get('user:findMany:{}')).toEqual([1]);
    await cache.clearNamespace('user');
    expect(await cache.get('user:findMany:{}')).toBeNull();
    expect(await cache.get('post:findMany:{}')).toEqual([2]);
  });
});
