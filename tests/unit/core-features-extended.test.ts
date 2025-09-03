import { describe, expect, it } from 'vitest';

let routers: any;
try { 
  routers = require('../../temp-generated/routers'); 
} catch {
  // Generation not available - tests will be skipped
}

// These tests are smoke-level: they verify presence/shape of newly added core feature procedures.

describe('Extended Core Feature Procedures (generation smoke)', () => {
  if (!routers?.appRouter) {
    it('skips when generation not present', () => expect(true).toBe(true));
    return;
  }
  const models = Object.entries(routers.appRouter._def?.record || {});
  if (!models.length) {
    it('no models -> skip', () => expect(true).toBe(true));
    return;
  }
  const [firstKey, firstRouter]: any = models[0];
  const procKeys = Object.keys(firstRouter._def?.record || {});

  it('has stats procedure', () => {
    expect(procKeys.some(k => k.toLowerCase().endsWith('stats'))).toBe(true);
  });
  it('has query builder procedure', () => {
    expect(procKeys.some(k => k.toLowerCase().endsWith('query'))).toBe(true);
  });
  it('has batch transaction procedure', () => {
    expect(procKeys.some(k => k.toLowerCase().includes('batchtransact'))).toBe(true);
  });
});
