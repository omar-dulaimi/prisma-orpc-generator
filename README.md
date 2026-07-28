<div align="center">

<h1>⚡ Prisma oRPC Generator</h1>
<p><strong>Generate typed oRPC routers, Zod schemas, and docs straight from your Prisma schema.</strong></p>

<p>
  <a href="https://www.npmjs.com/package/prisma-orpc-generator"><img alt="npm" src="https://img.shields.io/npm/v/prisma-orpc-generator?style=flat&label=npm"></a>
  <a href="https://github.com/omar-dulaimi/prisma-orpc-generator/actions"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/omar-dulaimi/prisma-orpc-generator/release.yml?branch=master&label=CI&style=flat"></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat"></a>
  <a href="#quickstart"><img alt="node" src="https://img.shields.io/badge/node-20.19%2B%20%7C%2022.12%2B%20%7C%2024.0%2B-2ea44f?style=flat"></a>
  <a href="#compatibility"><img alt="prisma" src="https://img.shields.io/badge/prisma-7%2B-2D3748?style=flat"></a>
  <a href="tsconfig.json"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-%E2%89%A5%205.4-3178C6?style=flat"></a>
  <a href=".prettierrc"><img alt="Prettier" src="https://img.shields.io/badge/Code%20Style-Prettier-F7B93E?style=flat"></a>
</p>

<p><em>Prisma v7+, Node 20.19+/22.12+/24.0+, TypeScript ≥ 5.4.</em></p>
</div>

> TL;DR — Add the generator to your Prisma schema and run Prisma generate. That’s it.

```prisma
generator client {
  provider = "prisma-client-js"
}

generator orpc {
  provider = "prisma-orpc-generator"
  output   = "./src/generated/orpc"

  // Optional config (booleans are strings)
  schemaLibrary = "zod"
  generateInputValidation  = "true"
  generateOutputValidation = "true"

  // Shield authorization (optional)
  generateShield = "true"
  defaultReadRule = "allow"
  defaultWriteRule = "auth"
}
```

Create `prisma.config.ts` to hold your datasource connection (replace the URL for your database or driver adapter):

```ts
import { defineConfig } from '@prisma/config';

export default defineConfig({
  schema: './schema.prisma',
  datasource: {
    url: 'file:./dev.db',
  },
});
```

```bash
# generate
npx prisma generate --config prisma.config.ts
```

---

## 📋 Table of Contents

- [⚡ Quickstart](#quickstart) - Get up and running in minutes
- [🏗️ What Gets Generated](#what-gets-generated) - See what files are created
- [⚙️ Configuration](#configuration) - All available options
- [🔧 Zod Schemas Generation](#zod-schemas-generation) - Schema validation setup
- [🛡️ Shield Authorization](#shield-authorization) - Type-safe permissions and rules
- [🧪 Examples](#examples) - Working examples to explore
- [❓ FAQ / Troubleshooting](#faq--troubleshooting) - Common issues and solutions
- [🧑‍💻 Development](#development-contributing) - Contributing guidelines
- [🗺️ Roadmap](#roadmap) - Planned features and improvements
- [📄 License](#license) - Licensing information
- [🙏 Acknowledgements](#acknowledgements) - Credits and thanks
- [📝 Changelog](#changelog) - Version history and changes

---

<a id="quickstart"></a>
## ⚡ Quickstart

<details>
<summary>Click to expand quickstart guide</summary>

**Prerequisites**
- Node: 20.19.0+, 22.12.0+, or 24.0.0+ (per Prisma 7 engine support)
- Prisma CLI (v7+) in your project
- TypeScript ≥ 5.4.0 recommended

**Install**

The generator itself and the Prisma CLI are build-time only. Everything the generated routers
`import` has to be a runtime dependency of your app: `@orpc/server`, `zod`, `@prisma/client`, and
`orpc-shield` (the generated `shield.ts` and `createRouter.ts` import it, and shield generation is
on by default — drop it only if you set `generateShield = "false"`).

```bash
# npm
npm install @orpc/server orpc-shield zod @prisma/client
npm install -D prisma-orpc-generator prisma

# pnpm
pnpm add @orpc/server orpc-shield zod @prisma/client
pnpm add -D prisma-orpc-generator prisma

# yarn
yarn add @orpc/server orpc-shield zod @prisma/client
yarn add -D prisma-orpc-generator prisma
```

Serving the routers over HTTP additionally needs a handler package, e.g. `@orpc/openapi` for the
OpenAPI server shown further down.

Add the generator (minimal)
```prisma
generator client {
  provider = "prisma-client-js"
}

generator orpc {
  provider = "prisma-orpc-generator"
  output   = "./src/generated/orpc"
}
```
**Generate**
```bash
npx prisma generate --config prisma.config.ts
```

</details>

---

<a id="compatibility"></a>
## 🧩 Compatibility

<details>
<summary>Click to expand compatibility info</summary>
- Prisma ORM: v7+
- Node.js minimums for Prisma v7:
  - 20.19.0+
  - 22.12.0+
  - 24.0.0+
  - Not supported: 16, 17, 18, 19, 21, 23
- TypeScript: ≥ 5.4.0

</details>

---

<a id="what-gets-generated"></a>
## 🏗️ What Gets Generated

<details>
<summary>Click to expand generated files overview</summary>
A generated surface mirroring your domain:

```
src/generated/orpc/
├─ routers/
│  ├─ models/           # per-model routers
│  └─ helpers/          # common utilities
├─ tests/               # generated tests
├─ zod-schemas/         # zod (if enabled)
└─ documentation/       # docs (if enabled)
```

Explore the example outputs:
- Routers: [examples/basic/src/generated/orpc/routers](examples/basic/src/generated/orpc/routers)
- Zod schemas: [examples/basic/src/generated/orpc/zod-schemas](examples/basic/src/generated/orpc/zod-schemas)
- Tests: [examples/basic/src/generated/orpc/tests](examples/basic/src/generated/orpc/tests)
- Docs: [examples/basic/src/generated/orpc/documentation](examples/basic/src/generated/orpc/documentation)

</details>

---

<a id="usage"></a>
## 🛠️ Usage

<details>
<summary>Click to expand usage guide</summary>
- Runs as part of Prisma’s generator pipeline.
- Default output directory is `./src/generated/orpc` (configurable via the generator block).
- Import the generated code into your server/app. See the runnable example server in [examples/basic/src/server.ts](examples/basic/src/server.ts).

Tip: Browse the example’s generated root for real structure: [examples/basic/src/generated/orpc](examples/basic/src/generated/orpc).

</details>

---

<a id="configuration"></a>
## ⚙️ Configuration

<details>
<summary>Click to expand configuration options</summary>
Where configuration lives
- Inside your generator block in [schema.prisma](examples/basic/schema.prisma)
- Booleans are strings: "true"/"false"; numbers as strings are supported

Validated against [src/config/schema.ts](src/config/schema.ts). Below are the most commonly used options.

Core options
| Option | Type | Default | Values | Description |
|---|---|---|---|---|
| output | string | ./src/generated/orpc | — | Directory for generated oRPC artifacts |
| schemaLibrary | enum | "zod" | zod | Schema validation library |
| generateInputValidation | boolean (string) | "true" | "true", "false" | Emit Zod validation for inputs |
| generateOutputValidation | boolean (string) | "true" | "true", "false" | Emit Zod validation for outputs |
| strictValidation | boolean (string) | "true" | "true", "false" | Stricter Zod shapes for safety |
| zodSchemasOutputPath | string | ./zod-schemas | — | Relative path (under output) for Zod files |
| externalZodImportPath | string | ./zod-schemas | — | Module/path used when importing Zod schemas |
| zodDateTimeStrategy | enum | "coerce" | "date", "coerce", "isoString" | How DateTime fields are modeled in Zod |
| zodConfigPath | string | — | — | Path to custom zod.config.json file (relative to schema or absolute) |

Operational options
| Option | Type | Default | Values | Description |
|---|---|---|---|---|
| generateModelActions | string list | all | see note | Comma-separated actions to emit (see note below) |
| showModelNameInProcedure | boolean (string) | "true" | "true", "false" | Prefix procedures with model name |
| enableSoftDeletes | boolean (string) | "false" | "true", "false" | Add soft-delete semantics where applicable |
| generateRelationResolvers | boolean (string) | "true" | "true", "false" | Emit helpers to resolve relations |
| wrapResponses | boolean (string) | "false" | "true", "false" | Wrap handler results in an envelope |

DX and formatting
| Option | Type | Default | Values | Description |
|---|---|---|---|---|
| useBarrelExports | boolean (string) | "true" | "true", "false" | Generate index.ts barrel exports |
| codeStyle | enum | "prettier" | "prettier", "none" | Format generated code with Prettier |
| generateDocumentation | boolean (string) | "false" | "true", "false" | Generate API documentation |
| generateTests | boolean (string) | "false" | "true", "false" | Generate test files |
| enableDebugLogging | boolean (string) | "false" | "true", "false" | Extra logs during generation |

Runtime and integration
| Option | Type | Default | Values | Description |
|---|---|---|---|---|
| prismaClientPath | string | @prisma/client | — | Import path for PrismaClient |
| contextPath | string | "" | — | Optional path to your app's Context module |
| serverPort | number (string) | 3000 | — | Port used by optional docs/server helpers |
| apiPrefix | string | "" | — | Prefix used by optional docs/server helpers |
| apiTitle | string | Generated API | — | API title for documentation |
| apiDescription | string | Auto-generated API from Prisma schema | — | API description for documentation |
| apiVersion | string | 1.0.0 | — | API version for documentation |

Shield / Authorization
| Option | Type | Default | Values | Description |
|---|---|---|---|---|
| generateShield | boolean (string) | "true" | "true", "false" | Enable shield generation |
| shieldPath | string | — | — | Path to custom shield file (absolute, relative to project root, relative to output dir, or module specifier) |
| defaultReadRule | enum | "allow" | "allow", "deny", "auth" | Default rule for read operations |
| defaultWriteRule | enum | "auth" | "auth", "deny", "allow" | Default rule for write operations |
| denyErrorCode | string | "FORBIDDEN" | — | Error code for denied access |
| debug | boolean (string) | "false" | "true", "false" | Enable debug logging |
| allowExternalErrors | boolean (string) | "false" | "true", "false" | Allow detailed error messages from shields |
Notes
- generateModelActions supports: create, createMany, findFirst, findFirstOrThrow, findMany, findUnique, findUniqueOrThrow, update, updateMany, upsert, delete, deleteMany, aggregate, groupBy, count, findRaw, aggregateRaw.
- Booleans are strings in Prisma generator config: use "true" or "false".
- The full, authoritative shape lives in [src/config/schema.ts](src/config/schema.ts).

<details>
<summary>Example: focused configuration with Zod and docs</summary>

```prisma
generator orpc {
  provider = "prisma-orpc-generator"
  output   = "./src/generated/orpc"

  schemaLibrary             = "zod"
  zodDateTimeStrategy       = "coerce"
  generateInputValidation   = "true"
  generateOutputValidation  = "true"
  generateDocumentation     = "true"
  useBarrelExports          = "true"
  codeStyle                 = "prettier"
}
```
</details>

</details>

---

<a id="zod-schemas-generation"></a>
## 🔧 Zod Schemas Generation

<details>
<summary>Click to expand zod schemas info</summary>

This generator leverages [prisma-zod-generator](https://github.com/omar-dulaimi/prisma-zod-generator) to create Zod schemas from your Prisma models. Here's how the process works:

### Generation Process

1. **Automatic Integration**: When `schemaLibrary = "zod"` is set, the generator automatically calls `prisma-zod-generator` 
2. **Configuration Management**: Creates a `zod.config.json` file with optimized settings for oRPC usage
3. **Schema Output**: Generates Zod schemas in the `zod-schemas/` subdirectory of your output path
4. **Import Integration**: Generated oRPC routers automatically import and use these schemas for validation

### Configuration File

The generator creates a minimal `zod.config.json` file:

```json
{
  "mode": "full",
  "output": "./zod-schemas"
}
```

Additional settings are only added when they differ from defaults:

```json
{
  "mode": "full", 
  "output": "./zod-schemas",
  "dateTimeStrategy": "date"
}
```

### DateTime Handling Strategy

The `zodDateTimeStrategy` option controls how Prisma DateTime fields are modeled in Zod schemas:

| Strategy | Zod Schema | Description | prisma-zod-generator equivalent |
|---|---|---|---|
| `"coerce"` (default) | `z.coerce.date()` | Automatically converts strings/numbers to Date objects | `dateTimeStrategy: "coerce"` |
| `"date"` | `z.date()` | Requires actual Date objects, no conversion | `dateTimeStrategy: "date"` |
| `"isoString"` | `z.string().regex(ISO).transform()` | Validates ISO string format, transforms to Date | `dateTimeStrategy: "isoString"` |

### Custom Zod Configuration

For advanced use cases, you can provide your own `zod.config.json`:

```prisma
generator orpc {
  provider = "prisma-orpc-generator"
  output   = "./src/generated/orpc"
  
  zodConfigPath = "./custom-zod.config.json"  // Path to your config file
}
```

When `zodConfigPath` is specified:
- The generator uses your existing configuration
- oRPC-specific settings are passed as generator options instead of modifying the config file
- Your custom configuration takes precedence

### File Structure

Generated Zod schemas follow this structure:

```
src/generated/orpc/
├─ zod-schemas/
│  ├─ index.ts           # Barrel exports
│  ├─ objects/           # Model schemas
│  │  ├─ UserSchema.ts
│  │  └─ PostSchema.ts
│  └─ inputTypeSchemas/  # Input validation schemas
│     ├─ UserCreateInput.ts
│     └─ UserUpdateInput.ts
└─ routers/              # oRPC routers (import from ../zod-schemas)
```

</details>

---

<a id="shield-authorization"></a>
## 🛡️ Shield Authorization

<details>
<summary>Click to expand shield authorization guide</summary>

The generator can automatically generate [orpc-shield](https://github.com/omar-dulaimi/orpc-shield) configurations for type-safe authorization. Shield provides declarative rules, composable operators, and path-based permissions.

### Shield Configuration

Add shield options to your generator config:

```prisma
generator orpc {
  provider = "prisma-orpc-generator"
  output   = "./src/generated/orpc"

  // Enable shield generation
  generateShield = "true"

  // Option 1: Auto-generate shield rules
  defaultReadRule  = "allow"  // "allow", "deny", "auth"
  defaultWriteRule = "auth"   // "auth", "deny"

  // Option 2: Use custom shield file (relative to output dir)
  // shieldPath = "../auth/my-custom-shield"

  // Error handling
  denyErrorCode = "FORBIDDEN"
  debug = "false"
}
```

### What Gets Generated

Shield generation creates:

```
src/generated/orpc/
├─ shield.ts              # Shield rules and permissions (auto-generated)
├─ routers/
│  ├─ index.ts           # App router with shield exports
│  └─ helpers/
│     └─ createRouter.ts # Base router with shield middleware integration
```

**When `shieldPath` is provided:** The generator skips auto-generation and dynamically integrates your custom shield file into the generated middleware chain.

### Dynamic Shield Path Resolution ✨

The generator now features **smart dynamic path resolution** for shield files. When you specify a `shieldPath`, the generator automatically:

- ✅ **Resolves relative paths** from your project structure
- ✅ **Handles different output directory layouts** 
- ✅ **Integrates shield middleware** using the proper oRPC pattern
- ✅ **Generates correct import paths** regardless of nesting depth
- ✅ **Applies middleware to all generated procedures** through inheritance

**Example Generated Integration:**
```typescript
// In src/generated/orpc/routers/helpers/createRouter.ts
import { permissions } from '../../../../custom-shield';
export const or = os.$context<Context>().use(permissions);
```

### Using Custom Shield Files

For advanced use cases, you can provide your own shield file instead of auto-generation:

```prisma
generator orpc {
  provider = "prisma-orpc-generator"
  output   = "./src/generated/orpc"

  generateShield = "true"
  shieldPath = "../../src/custom-shield"  // Dynamically resolved!
}
```

**Supported Path Formats:**
- Relative paths: `"../../src/auth/shield"`
- Project root relative: `"src/auth/shield"`  
- Absolute paths: `"/absolute/path/to/shield"`

Your custom shield file should export a `permissions` object:

```typescript
// src/custom-shield.ts
import { rule, allow, deny, shield, or } from 'orpc-shield';
import type { Context } from '../generated/orpc/routers/helpers/createRouter';

const isAuthenticated = rule<Context>()(({ ctx }) => !!ctx.user);
const isAdmin = rule<Context>()(({ ctx }) => ctx.user?.role === 'admin');
const isOwner = rule<Context>()(({ ctx, input }) => {
  return ctx.user?.id === (input as any)?.userId;
});

export const permissions = shield<Context>({
  user: {
    userFindMany: allow,           // Match generated procedure names
    userCreate: isAuthenticated,   
    userUpdate: isAuthenticated,
    userDelete: or(isAdmin, isOwner),
    userDeleteMany: deny,          // Explicitly deny dangerous operations
  },
  post: {
    postFindMany: allow,
    postCreate: isAuthenticated,
    postUpdate: isAuthenticated,
    postDelete: isAuthenticated,
  },
}, {
  denyErrorCode: 'FORBIDDEN',      // Maps to HTTP 403
  debug: true,                     // Enable debug logging
  allowExternalErrors: true,       // Allow detailed error messages
});
```

**Important:** Shield procedure names should match your generated router names (e.g., `userCreate`, `postFindMany`).

**Note:** When using `shieldPath`, the generator will skip auto-generation and use your custom shield file instead.

### Generated Shield Rules

The generator creates rules based on your Prisma models:

```typescript
// Built-in rules (generated automatically)
const isAuthenticated = rule<Context>()(({ ctx }) => !!ctx.user);

// Example custom rules (user-defined)
const isAdmin = rule<Context>()(({ ctx }) => ctx.user?.role === 'admin');

// Model-specific rules (generated based on config)
const canReadUser = allow;           // Read operations: allow
const canWriteUser = isAuthenticated; // Write operations: require auth

// Shield configuration
export const permissions = shield<Context>({
  user: {
    list: canReadUser,
    findById: canReadUser,
    create: canWriteUser,
    update: canWriteUser,
    delete: canWriteUser,
  },
  post: {
    list: allow,
    create: isAuthenticated,
    update: isAuthenticated,
  },
});
```

### Using Shield in Your Server

Import and use the generated shield:

```typescript
import { appRouter, permissions } from './generated/orpc/routers';

// Apply shield at server level
const server = createServer(appRouter, {
  // Shield is applied via middleware
  middleware: [permissions]
});

// Or use with oRPC handlers
import { OpenAPIHandler } from '@orpc/openapi';

const handler = new OpenAPIHandler(appRouter, {
  // Shield permissions are automatically applied
  interceptors: [/* your interceptors */]
});
```

### Context Requirements

Shield rules expect a `Context` with user information:

```typescript
interface Context {
  prisma: PrismaClient;
  user?: {
    id: string;
    email?: string;
    name?: string;
    roles?: string[];
    permissions?: string[];
  };
}
```

### Customization

Override default rules by modifying the generated `shield.ts`:

```typescript
// Custom rule for post ownership
const isPostOwner = rule<Context>()(({ ctx, input }) => {
  return ctx.user?.id === (input as any)?.authorId;
});

// Use in shield config
const permissions = shield<Context>({
  post: {
    update: and(isAuthenticated, isPostOwner), // Auth + ownership
    delete: or(isAdmin, isPostOwner),          // Admin or owner
  },
});
```

### Shield Options

| Option | Type | Default | Values | Description |
|---|---|---|---|---|
| generateShield | boolean (string) | "true" | "true", "false" | Enable shield generation |
| shieldPath | string | — | — | Path to custom shield file (absolute, relative to project root, relative to output dir, or module specifier) |
| defaultReadRule | enum | "allow" | "allow", "deny", "auth" | Default rule for read operations |
| defaultWriteRule | enum | "auth" | "auth", "deny", "allow" | Default rule for write operations |
| denyErrorCode | string | "FORBIDDEN" | — | Error code for denied access |
| debug | boolean (string) | "false" | "true", "false" | Enable debug logging |
| allowExternalErrors | boolean (string) | "false" | "true", "false" | Allow detailed error messages from shields |

</details>

---

<a id="examples"></a>
## 🧪 Examples

<details>
<summary>Click to expand examples</summary>
Run the repo example end-to-end
```bash
npm run example:basic
```

What it does
- Builds the generator
- Generates Prisma artifacts
- Seeds a local DB
- Starts a small server using the generated routers/schemas

Notable files
- Server: [examples/basic/src/server.ts](examples/basic/src/server.ts)
- Seed: [examples/basic/src/seed.ts](examples/basic/src/seed.ts)
- Lib utilities: [examples/basic/src/lib](examples/basic/src/lib)
- Example scripts: [examples/basic/package.json](examples/basic/package.json)

</details>

---

<a id="faq--troubleshooting"></a>
## ❓ FAQ / Troubleshooting

<details>
<summary>Click to expand FAQ and troubleshooting</summary>
Prisma version mismatch
- Symptom: generator fails or types not aligned
- Action: ensure Prisma v7+ in dev deps and runtime
  - `npm i -D prisma @prisma/client`
  - Regenerate: `npx prisma generate --config prisma.config.ts`

Node version or ESM issues
- Symptom: runtime errors about module type or syntax
- Action: use Node 20.19.0+, 22.12.0+, or 24.0.0+; align package type with your build, then rebuild `npm run build`

Generated path is unexpected
- Symptom: files not where you expect
- Action: verify your generator output path and config; compare with [examples/basic/src/generated/orpc](examples/basic/src/generated/orpc)

Schema/config validation failures
- Symptom: errors referencing invalid options
- Action: check inputs against [src/config/schema.ts](src/config/schema.ts); fix paths/booleans; re-run generation

Docs not emitted
- Symptom: documentation folder missing
- Action: set `generateDocumentation = "true"` and inspect [src/generators/documentation-generator.ts](src/generators/documentation-generator.ts)

Shield path resolution errors
- Symptom: "Cannot find module" errors for shield imports
- Action: verify `shieldPath` points to correct file; check file exports `permissions` object; ensure path is relative to project root or absolute
- Note: generator now handles dynamic path resolution automatically for common directory structures

</details>

---

<a id="development-contributing"></a>
## 🧑‍💻 Development (Contributing)

<details>
<summary>Click to expand development guide</summary>
Repo quicklinks
- Source: [src/](src)
- Generators: [src/generators/](src/generators)
- Entry point: [src/bin.ts](src/bin.ts)
- Public exports: [src/index.ts](src/index.ts)
- Tests: [tests/](tests)

Local dev loop
```bash
npm run dev         # watch build
npm run build       # one-off build
npm run lint        # lint
npm run lint:fix    # lint + fix
npm run format      # prettier
npm run typecheck   # types only
```

Local development (monorepo) provider example
```prisma
generator orpc {
  provider = "../../lib/bin.js" // relative path to built generator
  output   = "./src/generated/orpc"
}
```

Testing
```bash
npm test               # unit/integration
npm run test:watch     # watch
npm run test:e2e       # Prisma-backed CRUD
npm run test:coverage  # coverage
```

Conventions
- Conventional Commits
- Ensure `npm run build` and `npm run typecheck` pass before PR
- Update [README.md](README.md) if flags/outputs change

</details>

---

<a id="roadmap"></a>
## 🗺️ Roadmap

- ✅ **Integration with oRPC Shield** - Built-in authorization with dynamic path resolution
- **Schema-based Auth Configuration** - Define authorization rules directly in Prisma schema, JSON, or TypeScript config files
- Plugin hooks for custom emitters
- Config discovery and overrides

---

<a id="license"></a>
## 📄 License

- License: MIT — see the `LICENSE` file.
- Copyright © 2025 Omar Dulaimi.

---

<a id="acknowledgements"></a>
## 🙏 Acknowledgements

- Prisma and its ecosystem
- oRPC community and patterns
- Zod for runtime validation
- TypeScript tooling
- Vitest and contributors

<a id="changelog"></a>
## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md)

---

Made with ❤️ by [Omar Dulaimi](https://github.com/omar-dulaimi)
