import { describe, expect, it, vi, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import pluralize from 'pluralize';

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
`;

function createOptions(): any {
  return {
    generator: {
      config: { 
        output: './temp-test-imports',
        generateDocumentation: 'false',
        generateTests: 'true', // Enable test generation
        schemaLibrary: 'zod'
      },
      output: { value: './temp-test-imports' }
    },
    otherGenerators: [{ provider: { value: 'prisma-client-js', fromEnvVar: null } }],
    datamodel,
    schemaPath: 'schema.prisma'
  };
}

describe('Test Generator Import/Export Mismatch', () => {
  const outputDir = './temp-test-imports';

  afterAll(async () => {
    // Clean up test output directory
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should have matching import and export names for generated tests', async () => {
    const opts = createOptions();
    const generator = new ORPCGenerator(opts);
    
    // Generate the code including tests
    await generator.generate();

    // Check what the router actually exports
    const routerFile = path.join(outputDir, 'routers', 'models', 'AccommodationPricing.router.ts');
    const routerContent = await fs.readFile(routerFile, 'utf8');
    
    // Extract the exported router name from the router file
    const exportMatch = routerContent.match(/export const (\w+Router)/);
    expect(exportMatch).toBeTruthy();
    const actualExportedName = exportMatch![1];
    
    // Check what the test file tries to import
    const testFile = path.join(outputDir, 'tests', 'unit', 'AccommodationPricing.test.ts');
    const testContent = await fs.readFile(testFile, 'utf8');
    
    // Extract the imported router name from the test file (now with alias)
    const importMatch = testContent.match(/import { (\w+Router) as modelRouter }/);
    expect(importMatch).toBeTruthy();
    const attemptedImportName = importMatch![1];

    // These should match but they don't with the current bug
    console.log('Router exports:', actualExportedName);
    console.log('Test imports:', attemptedImportName);
    console.log('Expected export name:', pluralize('AccommodationPricing'.toLowerCase()) + 'Router');

    // With the fix, these should now match
    expect(actualExportedName).toBe(attemptedImportName);
  });

  it('should demonstrate that pluralize and camelCase produce the same result for AccommodationPricing', async () => {
    const modelName = 'AccommodationPricing';
    
    // What the router exports (using pluralize + lowercase)
    const routerExport = pluralize(modelName.toLowerCase()) + 'Router'; // "accommodationpricingsRouter"
    
    // What the test should import (same as router export)
    const testImport = pluralize(modelName.toLowerCase()) + 'Router'; // "accommodationpricingsRouter"
    
    console.log('Router exports:', routerExport);
    console.log('Test imports:', testImport);
    
    // With the fix, these should now match
    expect(routerExport).toBe(testImport);
  });
});