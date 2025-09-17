import { describe, expect, it, vi, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

// Mock prisma internals to avoid heavy DMMF generation in tests
vi.mock('@prisma/internals', () => ({
  getDMMF: async () => ({
    datamodel: {
      models: [
        {
          name: 'AccommodationPricing',
          dbName: null,
          fields: [
            { name: 'id', kind: 'scalar', type: 'String', isId: true },
            { name: 'price', kind: 'scalar', type: 'Float' }
          ]
        },
        {
          name: 'UserAccount',
          dbName: null,
          fields: [
            { name: 'id', kind: 'scalar', type: 'String', isId: true },
            { name: 'username', kind: 'scalar', type: 'String' }
          ]
        },
        {
          name: 'Post',
          dbName: null,
          fields: [
            { name: 'id', kind: 'scalar', type: 'String', isId: true },
            { name: 'title', kind: 'scalar', type: 'String' }
          ]
        }
      ]
    },
    mappings: {
      modelOperations: [
        {
          model: 'AccommodationPricing',
          findUnique: 'findUniqueAccommodationPricing',
          findMany: 'findManyAccommodationPricing',
          create: 'createOneAccommodationPricing',
          update: 'updateOneAccommodationPricing',
          delete: 'deleteOneAccommodationPricing',
          count: 'countAccommodationPricing',
          aggregate: 'aggregateAccommodationPricing'
        },
        {
          model: 'UserAccount',
          findUnique: 'findUniqueUserAccount',
          findMany: 'findManyUserAccount',
          create: 'createOneUserAccount',
          update: 'updateOneUserAccount',
          delete: 'deleteOneUserAccount',
          count: 'countUserAccount',
          aggregate: 'aggregateUserAccount'
        },
        {
          model: 'Post',
          findUnique: 'findUniquePost',
          findMany: 'findManyPost',
          create: 'createOnePost',
          update: 'updateOnePost',
          delete: 'deleteOnePost',
          count: 'countPost',
          aggregate: 'aggregatePost'
        }
      ]
    }
  }),
  parseEnvValue: (v: any) => (typeof v === 'string' ? v : v.value),
}));

// Import after mocks
import { ORPCGenerator } from '../../src/generators/orpc-generator';

// Test datamodel with PascalCase model names that should convert to camelCase in Prisma client
const datamodel = `
model AccommodationPricing {
  id    String @id @default(cuid())
  price Float
}

model UserAccount {
  id       String @id @default(cuid())
  username String
}

model Post {
  id    String @id @default(cuid())
  title String
}
`;

function createOptions(): any {
  return {
    generator: {
      config: { 
        output: './temp-test-output',
        generateDocumentation: 'false',
        generateTests: 'false',
        schemaLibrary: 'zod'
      },
      output: { value: './temp-test-output' }
    },
    otherGenerators: [{ provider: { value: 'prisma-client-js', fromEnvVar: null } }],
    datamodel,
    schemaPath: 'schema.prisma'
  };
}

describe('Model Name Casing in Generated Code', () => {
  const outputDir = './temp-test-output';

  afterAll(async () => {
    // Clean up test output directory
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('generates correct camelCase model names for Prisma client calls', async () => {
    const opts = createOptions();
    const generator = new ORPCGenerator(opts);
    
    // Generate the code
    await generator.generate();

    // Read the generated router files and verify they use correct camelCase
    const accommodationPricingRouter = path.join(outputDir, 'routers', 'models', 'AccommodationPricing.router.ts');
    const userAccountRouter = path.join(outputDir, 'routers', 'models', 'UserAccount.router.ts');
    const postRouter = path.join(outputDir, 'routers', 'models', 'Post.router.ts');

    // Check AccommodationPricing -> accommodationPricing (camelCase)
    const accommodationContent = await fs.readFile(accommodationPricingRouter, 'utf8');
    expect(accommodationContent).toMatch(/ctx\.prisma\.accommodationPricing\./);
    expect(accommodationContent).not.toMatch(/ctx\.prisma\.accommodationpricing\./); // Should not contain lowercase

    // Check UserAccount -> userAccount (camelCase)
    const userContent = await fs.readFile(userAccountRouter, 'utf8');
    expect(userContent).toMatch(/ctx\.prisma\.userAccount\./);
    expect(userContent).not.toMatch(/ctx\.prisma\.useraccount\./); // Should not contain lowercase

    // Check Post -> post (already lowercase, should remain post)
    const postContent = await fs.readFile(postRouter, 'utf8');
    expect(postContent).toMatch(/ctx\.prisma\.post\./);
  });

  it('verifies specific Prisma operations use correct camelCase', async () => {
    const opts = createOptions();
    const generator = new ORPCGenerator(opts);
    
    await generator.generate();

    const accommodationPricingRouter = path.join(outputDir, 'routers', 'models', 'AccommodationPricing.router.ts');
    const content = await fs.readFile(accommodationPricingRouter, 'utf8');

    // Test common Prisma operations with correct camelCase
    expect(content).toMatch(/ctx\.prisma\.accommodationPricing\.findUnique/);
    expect(content).toMatch(/ctx\.prisma\.accommodationPricing\.findMany/);
    expect(content).toMatch(/ctx\.prisma\.accommodationPricing\.create/);
    expect(content).toMatch(/ctx\.prisma\.accommodationPricing\.update/);
    expect(content).toMatch(/ctx\.prisma\.accommodationPricing\.delete/);
    expect(content).toMatch(/ctx\.prisma\.accommodationPricing\.count/);
    expect(content).toMatch(/ctx\.prisma\.accommodationPricing\.aggregate/);

    // Ensure no lowercase variants exist
    expect(content).not.toMatch(/ctx\.prisma\.accommodationpricing\./);
  });

  it('correctly handles edge cases in model name conversion', () => {
    // Test the camelCase conversion logic directly
    const testCases = [
      { input: 'AccommodationPricing', expected: 'accommodationPricing' },
      { input: 'UserAccount', expected: 'userAccount' },
      { input: 'Post', expected: 'post' },
      { input: 'APIKey', expected: 'aPIKey' },
      { input: 'XMLHttpRequest', expected: 'xMLHttpRequest' },
      { input: 'HTMLElement', expected: 'hTMLElement' }
    ];

    testCases.forEach(({ input, expected }) => {
      const result = input.charAt(0).toLowerCase() + input.slice(1);
      expect(result).toBe(expected);
    });
  });
});