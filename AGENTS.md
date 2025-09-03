# Repository Guidelines

This project is a TypeScript code generator for ORPC built around Prisma. Use Node.js 18+.

## Project Structure & Module Organization
- `src/`: source code.
  - `generators/`: ORPC code generation logic.
  - `utils/`, `types/`, `config/`: shared helpers, type defs, config schema.
  - `bin.ts`, `index.ts`: CLI entry and public exports.
- `tests/`: Vitest suites (`unit/`, `integration/`, `e2e-crud.test.ts`).
- `examples/`: runnable examples; see `example:basic` scripts.
- `lib/`: compiled output from `npm run build` (publish target).
- `schema.prisma`: local schema for tests/examples.

## Build, Test, and Development Commands
- `npm run build`: compile TypeScript to `lib/` and copy templates.
- `npm run dev`: watch-mode build for local development.
- `npm test` / `npm run test:watch`: run Vitest once / in watch mode.
- `npm run test:e2e`: execute Prisma-backed CRUD E2E test.
- `npm run test:coverage`: generate coverage report.
- `npm run lint` / `npm run lint:fix`: lint and auto-fix with ESLint.
- `npm run format`: apply Prettier formatting.
- `npm run typecheck`: type-only check without emit.
- `npm run example:basic`: build, generate Prisma artifacts, seed, and start example.

## Coding Style & Naming Conventions
- Language: TypeScript; indent: 2 spaces via Prettier (`.prettierrc`).
- Linting: ESLint (`eslint.config.js`, `.eslintrc.js`).
- Filenames: kebab-case (e.g., `code-generator.ts`).
- Types/classes: PascalCase; variables/functions: camelCase.

## Testing Guidelines
- Framework: Vitest. Place tests in `tests/` with `*.test.ts`.
- Scope: unit in `tests/unit`, integration in `tests/integration`, E2E at repo root.
- Aim for meaningful coverage on changed areas; add tests alongside features.
- Run locally: `npm test` (fast), `npm run test:e2e` (full path).

## Commit & Pull Request Guidelines
- Commits: use Conventional Commits (`feat:`, `fix:`, `docs:`) to support semantic releases.
- PRs: include clear description, rationale, linked issues, and test updates. Update README if flags/outputs change and include before/after snippets or screenshots where helpful.
- Pre-merge: ensure `npm run build` and `npm run typecheck` pass.

## Security & Configuration Tips
- Generated output defaults to `./src/generated/orpc` in consumer apps—never hardcode secrets.
- Use `prisma`/`@prisma/client` >= 6.14 to match peer deps.
- Keep environment variables in `.env` and avoid committing sensitive data.
