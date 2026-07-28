#!/usr/bin/env node
/**
 * Clean-clone audit of the published artifact.
 *
 * The repo's own suites import from `src/`, so they cannot see anything that only goes wrong once
 * the package is packed and installed somewhere else. This script does what a user does: build,
 * `npm pack`, install the tarball into an empty directory alongside exactly the dependencies the
 * README Quickstart tells people to install, generate against a schema whose models are keyed every
 * awkward way Prisma allows, and typecheck the result.
 *
 * It fails if:
 *  - the generated code imports a package the README does not tell users to install, or
 *  - the generated code does not typecheck against the real Prisma Client types.
 *
 * Run with `npm run test:packed`. Needs network access for the install.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Packages the consumer needs for the check itself, not because the generated code imports them. */
const TOOLING = { typescript: '^5.9.3' };

/** Models keyed every way that is not `id String @id`. */
const SCHEMA = `datasource db {
  provider = "sqlite"
}

generator client {
  provider = "prisma-client-js"
}

generator orpc {
  provider = "prisma-orpc-generator"
  output   = "./src/generated/orpc"
}

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

model Device {
  deviceId BigInt    @id
  sessions Session[]
}

model Session {
  token    String   @unique
  issuedAt DateTime
  device   Device   @relation(fields: [deviceId], references: [deviceId])
  deviceId BigInt
}

model Note {
  id   String @id @default(cuid())
  body String
}
`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    ...options,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function fail(message, detail) {
  console.error(`\n[packed-output] FAIL: ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

/**
 * The dependency list the README Quickstart hands users, so the README is the thing under test
 * rather than a copy of it that can drift.
 */
function readmeQuickstartDependencies() {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const blocks = readme.match(/```bash\n([\s\S]*?)```/g) ?? [];
  const quickstart = blocks.find((block) => block.includes('prisma-orpc-generator'));
  if (!quickstart) fail('no README install block mentioning prisma-orpc-generator was found');

  const dependencies = new Set();
  const devDependencies = new Set();
  for (const line of quickstart.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('npm install') && !trimmed.startsWith('npm i ')) continue;
    const tokens = trimmed.split(/\s+/).slice(2);
    const isDev = tokens.some((t) => t === '-D' || t === '--save-dev');
    for (const token of tokens) {
      if (token.startsWith('-')) continue;
      (isDev ? devDependencies : dependencies).add(token);
    }
  }
  if (dependencies.size === 0 && devDependencies.size === 0) {
    fail('the README install block declared no packages');
  }
  return { dependencies, devDependencies };
}

/** Every bare module specifier the generated sources import. */
function importedPackages(dir) {
  const found = new Set();
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;
      const source = fs.readFileSync(full, 'utf8');
      for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const specifier = match[1];
        if (specifier.startsWith('.') || specifier.startsWith('/')) continue;
        const parts = specifier.split('/');
        found.add(specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
      }
      for (const match of source.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const specifier = match[1];
        if (specifier.startsWith('.') || specifier.startsWith('/')) continue;
        const parts = specifier.split('/');
        found.add(specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
      }
    }
  };
  walk(dir);
  return found;
}

function main() {
  console.log('[packed-output] building');
  const build = run('npm', ['run', 'build'], { cwd: repoRoot });
  if (build.status !== 0) fail('npm run build failed', build.stdout + build.stderr);

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orpc-packed-'));
  const consumer = path.join(workDir, 'consumer');
  fs.mkdirSync(consumer);

  console.log('[packed-output] packing');
  const pack = run('npm', ['pack', '--pack-destination', workDir], { cwd: repoRoot });
  if (pack.status !== 0) fail('npm pack failed', pack.stdout + pack.stderr);
  const tarball = pack.stdout.trim().split('\n').pop().trim();
  const tarballPath = path.join(workDir, tarball);
  if (!fs.existsSync(tarballPath)) fail(`packed tarball not found at ${tarballPath}`);

  const { dependencies, devDependencies } = readmeQuickstartDependencies();
  console.log(
    `[packed-output] README Quickstart installs: ${[...dependencies].join(' ')} (dev: ${[...devDependencies].join(' ')})`
  );

  // Resolve consumer versions from the ranges this package itself declares, so the check does not
  // start failing because an unrelated upstream published a major.
  const own = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const declaredRanges = {
    ...own.devDependencies,
    ...own.dependencies,
    ...own.peerDependencies,
  };
  const toSpec = (name) =>
    name === 'prisma-orpc-generator'
      ? `file:${tarballPath}`
      : declaredRanges[name] || 'latest';
  const manifest = {
    name: 'packed-output-consumer',
    private: true,
    version: '1.0.0',
    type: 'module',
    dependencies: Object.fromEntries([...dependencies].map((n) => [n, toSpec(n)])),
    devDependencies: {
      ...Object.fromEntries([...devDependencies].map((n) => [n, toSpec(n)])),
      ...TOOLING,
    },
  };
  fs.writeFileSync(
    path.join(consumer, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  fs.writeFileSync(path.join(consumer, 'schema.prisma'), SCHEMA);
  fs.writeFileSync(
    path.join(consumer, 'prisma.config.ts'),
    `import { defineConfig } from 'prisma/config';\n\nexport default defineConfig({\n  schema: './schema.prisma',\n  datasource: { url: 'file:./dev.db' },\n});\n`
  );
  fs.writeFileSync(
    path.join(consumer, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          esModuleInterop: true,
        },
        include: ['src/generated/orpc/**/*.ts'],
      },
      null,
      2
    )}\n`
  );

  console.log('[packed-output] installing into an empty directory');
  const install = run('npm', ['install', '--no-audit', '--no-fund'], { cwd: consumer });
  if (install.status !== 0) fail('npm install failed', install.stdout + install.stderr);

  console.log('[packed-output] generating');
  const generate = run('npx', ['prisma', 'generate', '--config', 'prisma.config.ts'], {
    cwd: consumer,
  });
  if (generate.status !== 0) fail('prisma generate failed', generate.stdout + generate.stderr);

  const generatedDir = path.join(consumer, 'src', 'generated', 'orpc');
  if (!fs.existsSync(generatedDir)) fail('the generator produced no output');

  // 1. Everything the generated code imports must be something the README told the user to install.
  const declared = new Set([...dependencies, ...devDependencies]);
  const missing = [...importedPackages(generatedDir)].filter((pkg) => !declared.has(pkg)).sort();
  if (missing.length > 0) {
    fail(
      `the generated code imports packages the README Quickstart does not install: ${missing.join(', ')}`,
      'Add them to the install block in README.md, or stop generating imports of them.'
    );
  }
  console.log('[packed-output] every generated import is covered by the README install list');

  // 2. The generated code must typecheck against the real Prisma Client types.
  const typecheck = run('npx', ['tsc', '-p', 'tsconfig.json'], { cwd: consumer });
  if (typecheck.status !== 0) {
    fail('the generated code does not typecheck', typecheck.stdout + typecheck.stderr);
  }
  console.log('[packed-output] generated code typechecks against the real Prisma Client');

  fs.rmSync(workDir, { recursive: true, force: true });
  console.log('[packed-output] OK');
}

main();
