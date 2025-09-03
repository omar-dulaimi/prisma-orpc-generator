<div align="center">

<h1>⚡ Prisma ORPC Generator</h1>
<p><strong>Generate typed ORPC routers, Zod schemas, and docs straight from your Prisma schema.</strong></p>

<p>
  <a href="https://www.npmjs.com/package/prisma-orpc-generator"><img alt="npm" src="https://img.shields.io/npm/v/prisma-orpc-generator?style=flat&label=npm"></a>
  <a href="https://github.com/omar-dulaimi/prisma-orpc-generator/actions"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/omar-dulaimi/prisma-orpc-generator/release.yml?branch=master&label=CI&style=flat"></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat"></a>
  <a href="#quickstart"><img alt="node" src="https://img.shields.io/badge/node-18.18%2B%20%7C%2020.9%2B%20%7C%2022.11%2B-2ea44f?style=flat"></a>
  <a href="#compatibility"><img alt="prisma" src="https://img.shields.io/badge/prisma-6%2B-2D3748?style=flat"></a>
  <a href="tsconfig.json"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-%E2%89%A5%205.1-3178C6?style=flat"></a>
  <a href=".prettierrc"><img alt="Prettier" src="https://img.shields.io/badge/Code%20Style-Prettier-F7B93E?style=flat"></a>
</p>

<p><em>Prisma v6+, Node 18.18+/20.9+/22.11+, TypeScript ≥ 5.1.</em></p>
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
}
```

```bash
# generate
npx prisma generate
```

---

<a id="quickstart"></a>
## ⚡ Quickstart
Prerequisites
- Node: 18.18.0+, 20.9.0+, or 22.11.0+
- Prisma CLI (v6+) in your project
- TypeScript ≥ 5.1.0 recommended

Install
```bash
# npm
npm install -D prisma-orpc-generator zod prisma @prisma/client

# pnpm
pnpm add -D prisma-orpc-generator zod prisma @prisma/client

# yarn
yarn add -D prisma-orpc-generator zod prisma @prisma/client
```

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
Generate
```bash
npx prisma generate
```

---

<a id="compatibility"></a>
## 🧩 Compatibility
- Prisma ORM: v6+
- Node.js minimums for Prisma v6:
  - 18.18.0+
  - 20.9.0+
  - 22.11.0+
  - Not supported: 16, 17, 19, 21
- TypeScript: ≥ 5.1.0

---

<a id="what-you-get"></a>
## 📦 What you get
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

---

<a id="usage"></a>
## 🛠️ Usage
- Runs as part of Prisma’s generator pipeline.
- Default output directory is `./src/generated/orpc` (configurable via the generator block).
- Import the generated code into your server/app. See the runnable example server in [examples/basic/src/server.ts](examples/basic/src/server.ts).

Tip: Browse the example’s generated root for real structure: [examples/basic/src/generated/orpc](examples/basic/src/generated/orpc).

---

<a id="configuration"></a>
## ⚙️ Configuration
Where configuration lives
- Inside your generator block in [schema.prisma](examples/basic/schema.prisma)
- Booleans are strings: "true"/"false"; numbers as strings are supported

Validated against [src/config/schema.ts](src/config/schema.ts). Below are the most commonly used options.

Core options
| Option | Type | Default | Values | Description |
|---|---|---|---|---|
| output | string | ./src/generated/orpc | — | Directory for generated ORPC artifacts |
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

---

<a id="zod-schemas-generation"></a>
## 🔧 Zod Schemas Generation

This generator leverages [prisma-zod-generator](https://github.com/omar-dulaimi/prisma-zod-generator) to create Zod schemas from your Prisma models. Here's how the process works:

### Generation Process

1. **Automatic Integration**: When `schemaLibrary = "zod"` is set, the generator automatically calls `prisma-zod-generator` 
2. **Configuration Management**: Creates a `zod.config.json` file with optimized settings for ORPC usage
3. **Schema Output**: Generates Zod schemas in the `zod-schemas/` subdirectory of your output path
4. **Import Integration**: Generated ORPC routers automatically import and use these schemas for validation

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
- ORPC-specific settings are passed as generator options instead of modifying the config file
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
└─ routers/              # ORPC routers (import from ../zod-schemas)
```

---

<a id="examples"></a>
## 🧪 Examples
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

---

<a id="faq--troubleshooting"></a>
## ❓ FAQ / Troubleshooting
Prisma version mismatch
- Symptom: generator fails or types not aligned
- Action: ensure Prisma v6+ in dev deps and runtime
  - `npm i -D prisma @prisma/client`
  - Regenerate: `npx prisma generate`

Node version or ESM issues
- Symptom: runtime errors about module type or syntax
- Action: use Node 18.18.0+, 20.9.0+, or 22.11.0+; align package type with your build, then rebuild `npm run build`

Generated path is unexpected
- Symptom: files not where you expect
- Action: verify your generator output path and config; compare with [examples/basic/src/generated/orpc](examples/basic/src/generated/orpc)

Schema/config validation failures
- Symptom: errors referencing invalid options
- Action: check inputs against [src/config/schema.ts](src/config/schema.ts); fix paths/booleans; re-run generation

Docs not emitted
- Symptom: documentation folder missing
- Action: set `generateDocumentation = "true"` and inspect [src/generators/documentation-generator.ts](src/generators/documentation-generator.ts)

---

<a id="development-contributing"></a>
## 🧑‍💻 Development (Contributing)
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

---

<a id="roadmap"></a>
## 🗺️ Roadmap
- Plugin hooks for custom emitters
- Config discovery and overrides

---

<a id="license"></a>
- License: MIT — see the `LICENSE` file.
- Copyright © 2025 Omar Dulaimi.

---

<a id="acknowledgements"></a>
## 🙏 Acknowledgements
- Prisma and its ecosystem
- ORPC community and patterns
- Zod for runtime validation
- TypeScript tooling
- Vitest and contributors

---

<a id="changelog"></a>
## 📝 Changelog
See [CHANGELOG.md](CHANGELOG.md)

---

Made with ❤️ by [Omar Dulaimi](https://github.com/omar-dulaimi)
