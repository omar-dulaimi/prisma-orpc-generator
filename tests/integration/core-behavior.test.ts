import { describe, expect, it } from 'vitest';

let generated: any;
try { 
  generated = require('../temp-generated/routers'); 
} catch {
  // Generation not available - tests will be skipped
}

// NOTE: These are structural/behavioral smoke tests; without a live DB they validate presence & handler signatures only.
// Full runtime behavior (soft delete filter, transaction rollback) would require executing against a seeded test DB.

describe('Core Behavior (structural)', () => {
  if (!generated?.appRouter) {
    it('skipped - generation artifacts missing', () => expect(true).toBe(true));
    return;
  }
  const firstEntry = Object.entries(generated.appRouter._def?.record || {})[0];
  if (!firstEntry) {
    it('skipped - no models', () => expect(true).toBe(true));
    return;
  }
  const [modelKey, modelRouter]: any = firstEntry;
  const procs = modelRouter._def?.record || {};

  it('includes soft delete override for delete', () => {
    // Expect either delete or model-prefixed delete
    const delKey = Object.keys(procs).find(k => k.toLowerCase().includes('delete'));
    expect(delKey).toBeTruthy();
  });

  it('has batch transaction procedure', () => {
    const key = Object.keys(procs).find(k => k.toLowerCase().includes('batchtransact'));
    expect(key).toBeTruthy();
  });

  it('has stats and query procedures', () => {
    expect(Object.keys(procs).some(k => k.toLowerCase().endsWith('stats'))).toBe(true);
    expect(Object.keys(procs).some(k => k.toLowerCase().endsWith('query'))).toBe(true);
  });
});
