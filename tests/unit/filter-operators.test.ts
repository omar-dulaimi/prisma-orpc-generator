import { beforeAll, describe, expect, it } from 'vitest';
import { createMockPrisma } from './mock-prisma';

describe('Filter operators', () => {
  const prisma = createMockPrisma(['user']);
  const userStore = prisma.user;

  beforeAll(async () => {
    await userStore.create({ data: { name: 'Alice', age: 30 } });
    await userStore.create({ data: { name: 'Bob', age: 40 } });
    await userStore.create({ data: { name: 'Charlie', age: 25 } });
  });

  it('contains operator', async () => {
    const res = await userStore.findMany({ where: { name: { contains: 'li' } } });
    expect(res.map((r: any) => r.name).sort()).toEqual(['Alice', 'Charlie']);
  });

  it('gt operator', async () => {
    const res = await userStore.findMany({ where: { age: { gt: 30 } } });
    expect(res).toHaveLength(1);
    expect(res[0].name).toBe('Bob');
  });

  it('range operators combine', async () => {
    const res = await userStore.findMany({ where: { age: { gt: 25, lt: 40 } } });
    // gt is strict (>25) and lt is strict (<40) so Alice (30) qualifies, Charlie (25) excluded
    expect(res.map((r: any) => r.name).sort()).toEqual(['Alice']);
  });
});
