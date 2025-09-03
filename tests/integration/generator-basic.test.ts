import { describe, expect, it, vi } from 'vitest';

// Mock prisma internals to avoid heavy DMMF generation in tests
vi.mock('@prisma/internals', () => ({
  getDMMF: async () => ({ datamodel: { models: [] }, mappings: { modelOperations: [] } }),
  parseEnvValue: (v: any) => (typeof v === 'string' ? v : v.value),
}));

// Import after mocks
import { ORPCGenerator } from '../../src/generators/orpc-generator';

// Minimal Prisma datamodel for integration-like generation
const datamodel = `
model User {
  id    String @id @default(cuid())
  name  String
  age   Int
  posts Post[]
}

model Post {
  id     String @id @default(cuid())
  title  String
  user   User   @relation(fields: [userId], references: [id])
  userId String
}
`;

function createOptions(): any {
  return {
    generator: {
  config: { output: './temp-generated', generateDocumentation: 'false', generateTests: 'false', schemaLibrary: 'zod' },
      output: { value: './temp-generated' }
    },
  otherGenerators: [ { provider: { value: 'prisma-client-js', fromEnvVar: null } } ],
    datamodel,
    schemaPath: 'schema.prisma'
  };
}

describe('ORPCGenerator basic generation', () => {
  it('generates routers and types without throwing', async () => {
    const opts = createOptions();
    const generator = new ORPCGenerator(opts);
    await expect(generator.generate()).resolves.not.toThrow();
  });
});
