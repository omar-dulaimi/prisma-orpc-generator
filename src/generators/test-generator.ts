import { promises as fs } from 'fs';
import path from 'path';
import { Config } from '../config/schema';
import { PrismaModel } from '../types/generator-types';
import { Logger } from '../utils/logger';
import { ProjectManager } from '../utils/project-manager';

export class TestGenerator {
  constructor(
    private config: Config,
    private outputDir: string,
    private projectManager: ProjectManager,
    private logger: Logger
  ) {}

  async generateTests(models: PrismaModel[]): Promise<void> {
    this.logger.debug('Generating tests...');

    await this.generateUnitTests(models);
    await this.generateIntegrationTests(models);
    await this.generateTestUtils(models);

    this.logger.debug('Tests generated');
  }

  private async generateUnitTests(models: PrismaModel[]): Promise<void> {
    for (const model of models) {
      await this.generateModelUnitTests(model);
    }
  }

  private async generateModelUnitTests(model: PrismaModel): Promise<void> {
    const testFile = this.projectManager.createSourceFile(
      path.join(this.outputDir, 'tests', 'unit', `${model.name}.test.ts`),
      undefined,
      { overwrite: true }
    );

    testFile.addStatements(`
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ${model.name.charAt(0).toLowerCase() + model.name.slice(1)}sRouter } from '../../routers/models/${model.name}.router';
import { createMockContext, MockContext } from '../utils/mock-context';

describe('${model.name} Router', () => {
  let mockContext: MockContext;
  let router: any;

  beforeEach(() => {
    mockContext = createMockContext();
    router = ${model.name.charAt(0).toLowerCase() + model.name.slice(1)}sRouter;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new ${model.name}', async () => {
      const input = ${JSON.stringify(this.generateTestData(model, 1, false, true), null, 6)};
      
      const expectedResult = { id: '1', ...input, ${this.generateTimestampFields()} };
      mockContext.prisma.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}.create.mockResolvedValue(expectedResult);

      const result = await router.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}Create['~orpc'].handler({ input, context: mockContext });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedResult);
      expect(mockContext.prisma.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}.create).toHaveBeenCalledWith({
        data: input
      });
    });

  });

  describe('findMany', () => {
    it('should return paginated results', async () => {
      const mockData = [
        { id: '1', ...${JSON.stringify(this.generateTestData(model, 1, false, true), null, 8)}, ${this.generateTimestampFields()} },
        { id: '2', ...${JSON.stringify(this.generateTestData(model, 2, false, true), null, 8)}, ${this.generateTimestampFields()} }
      ];

      mockContext.prisma.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}.findMany.mockResolvedValue(mockData);
      mockContext.prisma.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}.count.mockResolvedValue(2);

      const result = await router.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}FindMany['~orpc'].handler({ 
        input: { take: 10, skip: 0 }, 
        context: mockContext 
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(mockContext.prisma.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}.findMany).toHaveBeenCalledWith({
        take: 10,
        skip: 0
      });
    });
  });

  describe('findUnique', () => {
    it('should return a single ${model.name}', async () => {
      const mockData = { id: '1', ...${JSON.stringify(this.generateTestData(model, 1, false, true), null, 6)}, ${this.generateTimestampFields()} };
      
      mockContext.prisma.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}.findUnique.mockResolvedValue(mockData);

      const result = await router.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}FindById['~orpc'].handler({ 
        input: { id: '1' }, 
        context: mockContext 
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(mockContext.prisma.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}.findUnique).toHaveBeenCalledWith({
        where: { id: '1' }
      });
    });

    it('should throw NOT_FOUND when ${model.name} does not exist', async () => {
      mockContext.prisma.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}.findUnique.mockResolvedValue(null);

      await expect(
        router.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}FindById['~orpc'].handler({ 
          input: { id: 'non-existent' }, 
          context: mockContext 
        })
      ).rejects.toThrow(/NOT_FOUND|Not Found/);
    });
  });

  describe('update', () => {
    it('should update an existing ${model.name}', async () => {
      const updateData = ${JSON.stringify(this.generateTestData(model, 1, true, true), null, 6)};
      const updatedResult = { id: '1', ...updateData, ${this.generateTimestampFields()} };
      
      mockContext.prisma.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}.update.mockResolvedValue(updatedResult);

      const result = await router.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}Update['~orpc'].handler({ 
        input: { where: { id: '1' }, data: updateData }, 
        context: mockContext 
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedResult);
      expect(mockContext.prisma.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData
      });
    });
  });

});
`);

    testFile.formatText({ indentSize: 2 });
  }

  private async generateIntegrationTests(models: PrismaModel[]): Promise<void> {
    const integrationTestFile = this.projectManager.createSourceFile(
      path.join(this.outputDir, 'tests', 'integration', 'api.test.ts'),
      undefined,
      { overwrite: true }
    );

    integrationTestFile.addStatements(`
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createORPCClient } from '@orpc/client';
import { appRouter, type AppRouter } from '../../routers';
import { createTestServer, type TestServer } from '../utils/test-server';
import type { NestedClient } from '@orpc/client';

describe('API Integration Tests', () => {
  let server: TestServer;
  let client: NestedClient<AppRouter>;
  let baseUrl: string;

  beforeAll(async () => {
    server = await createTestServer(appRouter);
    baseUrl = \`http://localhost:\${server.port}\`;
    client = createORPCClient({
      call: async (path, input) => {
        const response = await fetch(\`\${baseUrl}/\${path.join('/')}\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input)
        });
        return response.json();
      }
    });
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    // await cleanupDatabase();
  });

${models
  .map(
    (model) => `
  describe('${model.name} API', () => {
    it('should create, read, update, and delete ${model.name}', async () => {
      // Create
      const createData = ${JSON.stringify(this.generateTestData(model), null, 6)};
      
      // TODO: Implement actual integration test
      // const created = await client.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}.create(createData);
      // expect(created.success).toBe(true);
      // expect(created.data).toMatchObject(createData);
      
      // Read
      // const found = await client.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}.findUnique({ id: created.data.id });
      // expect(found.success).toBe(true);
      // expect(found.data).toMatchObject(createData);
      
      // Update
      // TODO: Implement update test
      // const updateData = { /* sample data */ };
      // const updated = await client.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}.update({ 
      //   where: { id: created.data.id },
      //   data: updateData 
      // });
      // expect(updated.success).toBe(true);
      // expect(updated.data).toMatchObject(updateData);
      
      // Delete
      // const deleted = await client.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}.delete({ id: created.data.id });
      // expect(deleted.success).toBe(true);
    });

    it('should handle list operations with pagination', async () => {
      // TODO: Implement pagination test
      // const result = await client.${model.name.charAt(0).toLowerCase() + model.name.slice(1)}.findMany({ take: 10, skip: 0 });
      // expect(result.success).toBe(true);
      // expect(result.meta.pagination).toBeDefined();
    });
  });`
  )
  .join('\n')}

  describe('Error Handling', () => {
    it('should return proper error format for validation errors', async () => {
      // TODO: Implement error handling test
    });

    it('should return proper error format for not found errors', async () => {
      // TODO: Implement not found test
    });


  });
});
`);

    integrationTestFile.formatText({ indentSize: 2 });
  }

  private async generateTestUtils(models: PrismaModel[]): Promise<void> {
    await this.generateMockContext(models);
    await this.generateTestServer();
    await this.generateVitestConfig();
    await this.generateTsProjectConfig();
    await this.generateTestTypes();
    await this.generateTestSetup();
  }

  private async generateMockContext(models: PrismaModel[]): Promise<void> {
    // Generate mock context
    const mockContextFile = this.projectManager.createSourceFile(
      path.join(this.outputDir, 'tests', 'utils', 'mock-context.ts'),
      undefined,
      { overwrite: true }
    );

    mockContextFile.addStatements(`
import { vi } from 'vitest';

export interface MockPrismaClient {
  [key: string]: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
}

export interface MockContext {
  prisma: MockPrismaClient;
  user?: { id: string; [key: string]: unknown } | null;
  request?: {
    ip?: string;
    headers?: Record<string, string>;
    requestId?: string;
    correlationId?: string;
  };
}

/**
 * Create a mock context for testing
 */
export function createMockContext(): MockContext {
  return {
    prisma: createMockPrisma(),
    user: null,
    request: {
      ip: '127.0.0.1',
      headers: {},
    },
  };
}

/**
 * Create a mock Prisma client
 */
function createMockPrisma(): MockPrismaClient {
  const models = [${models.map(m => `'${m.name.toLowerCase()}'`).join(', ')}];
  const mockPrisma: MockPrismaClient = {};
  
  for (const model of models) {
    mockPrisma[model] = {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    };
  }
  
  return mockPrisma;
}
`);

  }

  private async generateTestServer(): Promise<void> {
    const testServerFile = this.projectManager.createSourceFile(
      path.join(this.outputDir, 'tests', 'utils', 'test-server.ts'),
      undefined,
      { overwrite: true }
    );

    testServerFile.addStatements(`
import { createServer } from 'http';
 
/**
 * Create a minimal test server for integration testing
 * Note: We intentionally avoid external deps here since integration tests
 * currently don't perform real RPC calls (requests are commented out).
 */
export interface TestServer {
  server: import('http').Server;
  port: number;
  close: () => Promise<void>;
}
export async function createTestServer(_router: any): Promise<TestServer> {
  const server = createServer(async (_req, res) => {
    // Always return 404 for now; integration tests don't make requests yet.
    res.statusCode = 404;
    res.end('Not Found');
  });
 
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to start test server'));
        return;
      }
 
      resolve({
        server,
        port: address.port,
        close: () => new Promise<void>((resolveClose) => {
          server.close(() => resolveClose());
        })
      });
    });
  });
}
`);
  }

  private async generateVitestConfig(): Promise<void> {
    const vitestConfig = `import { defineConfig } from 'vitest/config';
 import path from 'path';
 import { fileURLToPath } from 'url';
 
 const root = path.dirname(fileURLToPath(import.meta.url));
 
 export default defineConfig({
   root,
   test: {
     environment: 'node',
     include: ['tests/**/*.test.ts'],
     coverage: {
       include: ['routers/**/*.ts'],
       exclude: ['routers/**/*.test.ts', 'routers/**/index.ts'],
       reporter: ['text', 'lcov', 'html']
     },
     setupFiles: ['tests/setup.ts']
   }
 });`;
  
     await fs.writeFile(path.join(this.outputDir, 'vitest.config.ts'), vitestConfig);
   }
 
   private async generateTsProjectConfig(): Promise<void> {
     const tsconfig = `{
   "compilerOptions": {
     "target": "ES2022",
     "module": "ESNext",
     "moduleResolution": "Bundler",
     "lib": ["ES2022"],
     "strict": true,
     "skipLibCheck": true,
     "esModuleInterop": true,
     "forceConsistentCasingInFileNames": true,
     "resolveJsonModule": true,
     "types": ["vitest", "node"],
     "composite": true
   },
   "include": [
     "routers/**/*.ts",
     "tests/**/*.ts",
     "types/**/*.ts",
     "utils/**/*.ts",
     "zod-schemas/**/*.ts"
   ]
  }`;
     await fs.writeFile(path.join(this.outputDir, 'tsconfig.json'), tsconfig);
   }
 
  private async generateTestTypes(): Promise<void> {
    const file = this.projectManager.createSourceFile(
      path.join(this.outputDir, 'tests', 'global.d.ts'),
      undefined,
      { overwrite: true }
    );
    file.addStatements(`export {};
declare global {
  // eslint-disable-next-line no-var
  var testUtils: { [key: string]: unknown };
}
`);
  }

  private async generateTestSetup(): Promise<void> {
    const setupFile = this.projectManager.createSourceFile(
      path.join(this.outputDir, 'tests', 'setup.ts'),
      undefined,
      { overwrite: true }
    );
 
    setupFile.addStatements(`export {};
/**
 * Vitest test setup
 */
// Set test environment
process.env.NODE_ENV = 'test';
 
// Initialize global test utils container at runtime
(globalThis as any).testUtils = (globalThis as any).testUtils ?? {};
 
// Mock console methods in tests if needed
// global.console = {
//   ...console,
//   log: vi.fn(),
//   debug: vi.fn(),
//   info: vi.fn(),
//   warn: vi.fn(),
//   error: vi.fn(),
// };
`);
  }

  private generateTimestampFields(): string {
    return 'createdAt: new Date(), updatedAt: new Date()';
  }

  private generateTestData(
    model: PrismaModel,
    seed: number = 1,
    isUpdate: boolean = false,
    skipTimestamps: boolean = false
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    for (const field of model.fields) {
      if (field.isId && !isUpdate) continue;
      if (field.isReadOnly) continue;
      if (isUpdate && field.isId) continue;
      if (skipTimestamps && (field.name === 'createdAt' || field.name === 'updatedAt')) continue;

      switch (field.type) {
        case 'String':
          if (field.name.toLowerCase().includes('email')) {
            data[field.name] = `test${seed}@example.com`;
          } else if (field.name.toLowerCase().includes('name')) {
            data[field.name] = `Test ${field.name} ${seed}`;
          } else {
            data[field.name] = `test_${field.name}_${seed}`;
          }
          break;
        case 'Int':
          data[field.name] = seed;
          break;
        case 'Float':
        case 'Decimal':
          data[field.name] = seed * 1.5;
          break;
        case 'Boolean':
          data[field.name] = seed % 2 === 0;
          break;
        case 'DateTime':
          data[field.name] = new Date().toISOString();
          break;
        default:
          if (!field.isOptional) {
            data[field.name] = `test_${field.name}_${seed}`;
          }
      }
    }

    return data;
  }
}
