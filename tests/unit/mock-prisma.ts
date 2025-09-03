import { vi } from 'vitest';

// Simple mock Prisma client structure for tests
export function createMockPrisma(models: string[]) {
  const prisma: any = {};
  for (const m of models) {
    const store: any[] = [];
    prisma[m] = {
      create: vi.fn(async ({ data }: any) => { const rec = { id: store.length + 1, ...data }; store.push(rec); return rec; }),
      createMany: vi.fn(async ({ data }: any) => { const arr = Array.isArray(data) ? data : [data]; arr.forEach(d => store.push({ id: store.length + 1, ...d })); return { count: arr.length }; }),
      findMany: vi.fn(async (args: any = {}) => applyFiltering(store, args)),
      findUnique: vi.fn(async ({ where }: any) => store.find(r => matchWhere(r, where)) || null),
      update: vi.fn(async ({ where, data }: any) => { const i = store.findIndex(r => matchWhere(r, where)); if (i === -1) throw Object.assign(new Error('P2025'), { code: 'P2025' }); store[i] = { ...store[i], ...data }; return store[i]; }),
      updateMany: vi.fn(async ({ where, data }: any) => { let count=0; store.forEach((r,i) => { if (!where || matchWhere(r, where)) { store[i] = { ...store[i], ...data }; count++; } }); return { count }; }),
      delete: vi.fn(async ({ where }: any) => { const i = store.findIndex(r => matchWhere(r, where)); if (i === -1) throw Object.assign(new Error('P2025'), { code: 'P2025' }); const rec = store[i]; store.splice(i,1); return rec; }),
      deleteMany: vi.fn(async ({ where }: any) => { const before = store.length; for (let i=store.length-1;i>=0;i--) { if (!where || matchWhere(store[i], where)) store.splice(i,1); } return { count: before - store.length }; }),
      count: vi.fn(async (args: any = {}) => applyFiltering(store, args).length),
      aggregate: vi.fn(async () => ({ count: store.length })),
      groupBy: vi.fn(async () => []),
    };
  }
  return prisma;
}

function applyFiltering(data: any[], args: any) {
  let result = data;
  if (args?.where) {
    result = result.filter(r => matchWhere(r, args.where));
  }
  if (args?.skip) result = result.slice(args.skip);
  if (args?.take) result = result.slice(0, args.take);
  return result;
}

function matchWhere(record: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k,v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const obj: any = v;
      const hasOp = ['equals','contains','lt','gt'].some(op => op in obj);
      if (hasOp) {
        if ('equals' in obj && record[k] !== obj.equals) return false;
        if ('contains' in obj && !(typeof record[k] === 'string' && (record[k] as string).includes(String(obj.contains)))) return false;
        if ('lt' in obj && !(record[k] < obj.lt)) return false;
        if ('gt' in obj && !(record[k] > obj.gt)) return false;
        return true;
      }
    }
    return record[k] === v;
  });
}
