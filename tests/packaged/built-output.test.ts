/**
 * Regression tests that run the COMPILED generator out of `lib/`, not `src/`.
 *
 * Every other suite in this repo imports from `src/`, which is why a published package could ship
 * relation resolvers that keyed off a `String id` no matter what the model's real primary key was:
 * the defect only shows in the emitted text, and nothing here ever read the emitted text of a model
 * that was not keyed `id String`.
 *
 * These tests deliberately use a schema where no model is keyed the assumed way.
 */
import { spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../..');
const libEntry = path.join(repoRoot, 'lib', 'generators', 'orpc-generator.js');

const datamodel = `
model Account {
  accountId Int    @id @default(autoincrement())
  email     String @unique
  posts     Post[]
}

model Post {
  slug      String  @id
  title     String
  account   Account @relation(fields: [accountId], references: [accountId])
  accountId Int
  tags      Tag[]
}

model Tag {
  postSlug String
  label    String
  post     Post   @relation(fields: [postSlug], references: [slug])

  @@id([postSlug, label])
}

model Session {
  token    String   @unique
  issuedAt DateTime
  device   Device   @relation(fields: [deviceId], references: [deviceId])
  deviceId BigInt
}

model Device {
  deviceId BigInt    @id
  sessions Session[]
}
`;

/** Rebuild `lib/` when it is missing or older than any source file, so we never assert on a stale artifact. */
function ensureBuilt(): void {
  const newestSource = newestMtime(path.join(repoRoot, 'src'));
  const built = fsSync.existsSync(libEntry) ? fsSync.statSync(libEntry).mtimeMs : 0;
  if (built >= newestSource) return;

  const result = spawnSync('npx', ['tsc'], { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Building lib/ failed:\n${result.stdout}\n${result.stderr}`);
  }
}

function newestMtime(dir: string): number {
  let newest = 0;
  for (const entry of fsSync.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(full) : fsSync.statSync(full).mtimeMs);
  }
  return newest;
}

describe('compiled generator output (lib/)', () => {
  let outputDir: string;
  let workDir: string;
  const routers: Record<string, string> = {};
  let documentation = '';
  const generatedTests: Record<string, string> = {};

  beforeAll(async () => {
    ensureBuilt();

    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'orpc-built-output-'));
    outputDir = path.join(workDir, 'generated');
    const schemaPath = path.join(workDir, 'schema.prisma');
    await fs.writeFile(schemaPath, datamodel, 'utf8');

    // Load the compiled artifact directly. Anything wrong with the build, rather than the sources,
    // shows up here rather than being papered over by the test runner resolving `src/`.
    const requireFromRepo = createRequire(path.join(repoRoot, 'package.json'));
    const { ORPCGenerator } = requireFromRepo(libEntry);

    const generator = new ORPCGenerator({
      generator: {
        name: 'orpc',
        provider: { value: 'prisma-orpc-generator', fromEnvVar: null },
        output: { value: outputDir, fromEnvVar: null },
        config: {
          output: outputDir,
          generateDocumentation: 'true',
          generateTests: 'true',
          generateShield: 'false',
        },
        binaryTargets: [],
        previewFeatures: [],
        sourceFilePath: schemaPath,
      },
      otherGenerators: [{ provider: { value: 'prisma-client', fromEnvVar: null } }],
      datamodel,
      schemaPath,
      datasources: [
        {
          name: 'db',
          provider: 'sqlite',
          url: { value: 'file:./dev.db', fromEnvVar: null },
          directUrl: null,
        },
      ],
      dmmf: undefined,
      version: 'test',
    });

    await generator.generate();

    for (const model of ['Account', 'Post', 'Tag', 'Session', 'Device']) {
      routers[model] = await fs.readFile(
        path.join(outputDir, 'routers', 'models', `${model}.router.ts`),
        'utf8'
      );
      generatedTests[model] = await fs.readFile(
        path.join(outputDir, 'tests', 'unit', `${model}.test.ts`),
        'utf8'
      );
    }
    documentation = await fs.readFile(
      path.join(outputDir, 'documentation', 'README.md'),
      'utf8'
    );
  }, 120_000);

  afterAll(async () => {
    if (workDir) await fs.rm(workDir, { recursive: true, force: true });
  });

  it('never emits the assumed `id: z.string()` key for a model that is not keyed that way', () => {
    for (const [model, source] of Object.entries(routers)) {
      expect(source, `${model}.router.ts`).not.toContain('z.object({ id: z.string() })');
      expect(source, `${model}.router.ts`).not.toContain('where: { id }');
    }
  });

  it('keys an Int primary key by its real name and type', () => {
    expect(routers.Account).toContain('.input(z.object({ accountId: z.number().int() }))');
    expect(routers.Account).toContain(
      'const where: Prisma.AccountWhereUniqueInput = { accountId: input.accountId };'
    );
    expect(routers.Account).toContain('ProcedureHandlerOptions<Context, { accountId: number }');
  });

  it('keys a renamed String primary key by its real name', () => {
    expect(routers.Post).toContain('.input(z.object({ slug: z.string() }))');
    expect(routers.Post).toContain(
      'const where: Prisma.PostWhereUniqueInput = { slug: input.slug };'
    );
  });

  it('nests a composite primary key under the compound key Prisma generates', () => {
    expect(routers.Tag).toContain(
      '.input(z.object({ postSlug: z.string(), label: z.string() }))'
    );
    expect(routers.Tag).toContain(
      'const where: Prisma.TagWhereUniqueInput = { postSlug_label: { postSlug: input.postSlug, label: input.label } };'
    );
  });

  it('falls back to a unique constraint for a model with no @id', () => {
    expect(routers.Session).toContain('.input(z.object({ token: z.string() }))');
    expect(routers.Session).toContain(
      'const where: Prisma.SessionWhereUniqueInput = { token: input.token };'
    );
  });

  it('maps a BigInt primary key to z.bigint(), not z.string()', () => {
    expect(routers.Device).toContain('.input(z.object({ deviceId: z.bigint() }))');
    expect(routers.Device).toContain('ProcedureHandlerOptions<Context, { deviceId: bigint }');
  });

  it('mocks generated tests with key values of the right name and type', () => {
    expect(generatedTests.Account).toContain('accountId: 1');
    expect(generatedTests.Account).toContain('where: { accountId: 1 }');
    expect(generatedTests.Device).toContain('deviceId: BigInt(1)');
    expect(generatedTests.Tag).toContain(
      "where: { postSlug_label: { postSlug: 'test_postSlug_1', label: 'test_label_1' } }"
    );
    for (const [model, source] of Object.entries(generatedTests)) {
      expect(source, `${model}.test.ts`).not.toContain("where: { id: '1' }");
    }
  });

  it('documents the real primary key, including composite ones', () => {
    expect(documentation).toContain('**Primary Key**: `accountId` (Int)');
    expect(documentation).toContain('**Primary Key**: `slug` (String)');
    expect(documentation).toContain(
      '**Primary Key**: composite: `postSlug` (String), `label` (String)'
    );
    expect(documentation).toContain('**Primary Key**: `token` (String) (unique constraint)');
    expect(documentation).not.toContain('**Primary Key**: id\n');
  });

  it('defaults groupBy to columns that exist on the model', () => {
    expect(routers.Account).toContain("input.by : ['accountId']");
    expect(routers.Account).toContain("orderBy = [{ accountId: 'asc' }]");
    expect(routers.Tag).toContain("input.by : ['postSlug', 'label']");
    expect(routers.Post).toContain("input.by : ['slug']");
    for (const [model, source] of Object.entries(routers)) {
      expect(source, `${model}.router.ts`).not.toContain("input.by : ['id']");
      expect(source, `${model}.router.ts`).not.toContain("orderBy = [{ id: 'asc' }]");
    }
  });
});
