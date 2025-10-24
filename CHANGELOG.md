## [1.1.1](https://github.com/omar-dulaimi/prisma-orpc-generator/compare/v1.1.0...v1.1.1) (2025-09-17)

### 🐛 Bug Fixes

* correct model name casing from PascalCase to camelCase in generated Prisma client calls ([23b8151](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/23b815144d501b2368f5c8846d4a07046903835e)), closes [#34](https://github.com/omar-dulaimi/prisma-orpc-generator/issues/34) [#34](https://github.com/omar-dulaimi/prisma-orpc-generator/issues/34)
* **generator:** correct procedure naming for multi-word models ([a23364c](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/a23364cad57ae5b4f435380f022f1ac7eb699d5e))
* resolve import/export mismatch in generated test files ([0324ee8](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/0324ee85e7ecd409047a2cf3e001b987a9a7fdb6))

## [1.1.0](https://github.com/omar-dulaimi/prisma-orpc-generator/compare/v1.0.1...v1.1.0) (2025-09-04)

### 🚀 Features

* improve authentication system and integrate oRPC Shield ([de633e7](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/de633e73d99b2acb56bdf6f27b44fc61765c898c))

### 🐛 Bug Fixes

* ensure schema-generator consistency for defaultWriteRule ([1525532](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/1525532e69e72f28ea0f3232bb6f5e2f7f620edd))
* improve security and consistency in shield generator ([e0f29bf](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/e0f29bf648c6fa3a3ea7570edce155e26f298320))
* preserve model name casing in shield configuration ([c63fc75](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/c63fc7588e56a49a5e4985f52394f3246baead67))
* resolve pnpm version mismatch in GitHub Actions ([6eadd68](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/6eadd68f77d8d603df2a46bbcef9a762eda7d43d))

### ♻️ Code Refactoring

* improve shield generator and address code review feedback ([493e45e](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/493e45ec019180cd4ea8f94ab597bc46fe62b3da))

### 📚 Documentation

* clarify built-in vs custom rules in shield documentation ([2073e4d](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/2073e4da580348a903f013b347ed1d80d0c73f9d))

## [1.0.1](https://github.com/omar-dulaimi/prisma-orpc-generator/compare/v1.0.0...v1.0.1) (2025-09-04)

### ♻️ Code Refactoring

* update naming from ORPC to oRPC across codebase and docs ([0495aca](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/0495aca005b07994243501b035fdbe0e7d47f628))

### 📚 Documentation

* fix badge URLs in README ([ba562cb](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/ba562cbde351f4edb1983d55fccd3db02fe76ed4))
* fix incorrect links and file references in README ([2c59c33](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/2c59c334b2eb6b1a2655f55cb7152b64188140b7))
* remove coverage badge from README ([2279149](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/22791495b1fb567070ad97595745c97b45f19ba3))

## 1.0.0 (2025-09-03)

### 🚀 Features

* initial release of prisma-orpc-generator ([2173fa4](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/2173fa456eacea8d923d9efb660320659b6090a8))

### 🐛 Bug Fixes

* only import and use zod when validation is enabled ([dab4c83](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/dab4c83668ed66f30be2a9b12878dada55352737))
* prevent zod imports when validation is disabled ([424e94e](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/424e94e2f45e10f0e342d53afacc1df784d54dcc))
* remove unused variables to pass ESLint checks ([8673211](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/86732112b5b6c31c1d795e82711157448941c195))
* reorder GitHub Actions steps to install pnpm before Node.js setup ([8226e22](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/8226e2223a4edce3729431dde77dcfdfbf18988f))
* resolve test failures in CI pipeline ([6a8ca85](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/6a8ca85613ef47c80d5242e5b4ac6cc30ab02631))
* update e2e test to use correct input structure without validation ([836eb38](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/836eb3852035fd79e7b1933bdb1c83e5707c6d4a))
* update pnpm lockfile to include semantic-release dependencies ([1c93fba](https://github.com/omar-dulaimi/prisma-orpc-generator/commit/1c93fba82674c6cbe94894b2bb3943d97f15fde4))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
