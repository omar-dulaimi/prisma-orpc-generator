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
            { name: 'name', kind: 'scalar', type: 'String' }
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

const datamodel = `
model AccommodationPricing {
  id    String @id @default(cuid())
  price Float
}

model UserAccount {
  id   String @id @default(cuid())
  name String
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
        output: './temp-procedure-test',
        generateDocumentation: 'false',
        generateTests: 'false',
        schemaLibrary: 'zod',
        showModelNameInProcedure: 'true'  // Enable model names in procedures
      },
      output: { value: './temp-procedure-test' }
    },
    otherGenerators: [{ provider: { value: 'prisma-client-js', fromEnvVar: null } }],
    datamodel,
    schemaPath: 'schema.prisma'
  };
}

describe('Procedure Naming Consistency', () => {
  const outputDir = './temp-procedure-test';

  afterAll(async () => {
    // Clean up test output directory
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should use correct camelCase for multi-word model names in procedure names', async () => {
    const opts = createOptions();
    const generator = new ORPCGenerator(opts);
    
    // Generate the code
    await generator.generate();

    // Check AccommodationPricing router for correct camelCase procedure names
    const accommodationPricingRouter = path.join(outputDir, 'routers', 'models', 'AccommodationPricing.router.ts');
    const accommodationContent = await fs.readFile(accommodationPricingRouter, 'utf8');
    
    // These should use camelCase: accommodationPricingCreate (not accommodationpricingCreate)
    expect(accommodationContent).toMatch(/accommodationPricingCreate:/);
    expect(accommodationContent).toMatch(/accommodationPricingFindMany:/);
    expect(accommodationContent).toMatch(/accommodationPricingUpdate:/);
    expect(accommodationContent).toMatch(/accommodationPricingDelete:/);
    
    // Should NOT contain all-lowercase versions
    expect(accommodationContent).not.toMatch(/accommodationpricingCreate:/);
    expect(accommodationContent).not.toMatch(/accommodationpricingFindMany:/);
    expect(accommodationContent).not.toMatch(/accommodationpricingUpdate:/);
    expect(accommodationContent).not.toMatch(/accommodationpricingDelete:/);

    // Check UserAccount router for correct camelCase procedure names  
    const userAccountRouter = path.join(outputDir, 'routers', 'models', 'UserAccount.router.ts');
    const userAccountContent = await fs.readFile(userAccountRouter, 'utf8');
    
    // These should use camelCase: userAccountCreate (not useraccountCreate)
    expect(userAccountContent).toMatch(/userAccountCreate:/);
    expect(userAccountContent).toMatch(/userAccountFindMany:/);
    expect(userAccountContent).toMatch(/userAccountUpdate:/);
    expect(userAccountContent).toMatch(/userAccountDelete:/);
    
    // Should NOT contain all-lowercase versions
    expect(userAccountContent).not.toMatch(/useraccountCreate:/);
    expect(userAccountContent).not.toMatch(/useraccountFindMany:/);
    expect(userAccountContent).not.toMatch(/useraccountUpdate:/);
    expect(userAccountContent).not.toMatch(/useraccountDelete:/);

    // Check Post router (single word should work correctly)
    const postRouter = path.join(outputDir, 'routers', 'models', 'Post.router.ts');
    const postContent = await fs.readFile(postRouter, 'utf8');
    
    // Single word models should work fine (this is our control)
    expect(postContent).toMatch(/postCreate:/);
    expect(postContent).toMatch(/postFindMany:/);
    expect(postContent).toMatch(/postUpdate:/);
    expect(postContent).toMatch(/postDelete:/);
  });

  it('should demonstrate the casing difference between current and correct implementation', () => {
    const modelName = 'AccommodationPricing';
    
    // Current implementation (WRONG) 
    const currentPrefix = modelName.toLowerCase(); // "accommodationpricing"
    const currentProcedureName = `${currentPrefix}Create`; // "accommodationpricingCreate"
    
    // Correct implementation
    const correctPrefix = modelName.charAt(0).toLowerCase() + modelName.slice(1); // "accommodationPricing"  
    const correctProcedureName = `${correctPrefix}Create`; // "accommodationPricingCreate"
    
    console.log('Current (wrong):', currentProcedureName);
    console.log('Correct:', correctProcedureName);
    
    // This should pass after fix - correct implementation should NOT match the wrong implementation
    expect(correctProcedureName).not.toBe(currentProcedureName);
  });
});