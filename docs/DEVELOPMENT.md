# Development Guide

Thank you for your interest in contributing to `openinvoicexml`. This guide covers local setup, tooling configuration, and how to propose changes.

---

## Prerequisites

- **Node.js** ≥ 20.0.0
- **npm** (included with Node.js)
- **git**

---

## Local Setup

```bash
git clone https://github.com/HongbaeKim/openinvoicexml.git
cd openinvoicexml
npm install
npm test
```

If all tests pass, your environment is ready.

### Available Commands

| Command                 | What it does                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `npm test`               | Run all tests (Vitest)                                                                       |
| `npm run test:watch`     | Run tests in watch mode                                                                      |
| `npm run test:coverage`  | Run tests with coverage report                                                               |
| `npm run typecheck`      | Type-check without emitting files                                                            |
| `npm run lint`           | Check for lint errors (ESLint)                                                               |
| `npm run lint:fix`       | Auto-fix lint errors                                                                          |
| `npm run format`         | Format all files (Prettier)                                                                  |
| `npm run format:check`   | Check formatting without changing files                                                      |
| `npm run build`          | Compile TypeScript to `dist/`                                                                |
| `make type`              | Type-check without emitting files (`npm run typecheck` under the hood — does not update `dist/`) |
| `make generate`          | Regenerate XML fixtures from `dist/` (run `npm run build` first — `make type` alone won't populate `dist/`) |
| `make validate-xml`      | Generate XML and verify each file has a valid XML declaration                                |
| `make kosit-setup`       | One-time download of the KoSIT validator + XRechnung config (see [`COMPLIANCE.md`](COMPLIANCE.md#validating-xrechnung-output)) |
| `make validate-kosit`    | Validate generated XML using the KoSIT validator and the pinned XRechnung configuration       |

---

## Code Style

This project uses **Prettier** for formatting and **ESLint** for linting. Configuration files:

- `.prettierrc` — Prettier settings
- `eslint.config.js` — ESLint settings
- `.editorconfig` — Editor defaults (indent size, line endings)

Before committing, run:

```bash
npm run format
npm run lint
```

After changing the adapter or fixtures, regenerate XML output with:

```bash
npm run build && make generate
```

### TypeScript configuration

`tsconfig.json` is plain JSON and cannot hold inline comments, so each `compilerOptions` entry is documented here instead.

#### compilerOptions

| Option                             | Value        | Purpose                                                                                                                          |
| ----------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `target`                           | `ES2022`     | Compile output to ES2022 syntax, matching the minimum supported Node.js version (>=20).                                          |
| `module`                           | `NodeNext`   | Use Node's native ESM module system, matching `"type": "module"` in `package.json`.                                              |
| `moduleResolution`                 | `NodeNext`   | Resolve imports the same way Node does for ESM (requires explicit file extensions in relative imports).                          |
| `lib`                              | `["ES2022"]` | Include type definitions for ES2022 built-ins only — no DOM types, since this is a Node library.                                 |
| `outDir`                           | `./dist`     | Emit compiled output to `dist/`.                                                                                                 |
| `rootDir`                          | `.`          | Treat the project root as the source root, preserving the `core/`, `adapters/`, `validators/` directory structure under `dist/`. |
| `declaration`                      | `true`       | Emit `.d.ts` type declaration files alongside compiled output, so consumers get type information.                                |
| `declarationMap`                   | `true`       | Emit source maps for `.d.ts` files, so editors can jump from declarations to the original `.ts` source.                          |
| `sourceMap`                        | `true`       | Emit `.js.map` source maps for debugging compiled output.                                                                        |
| `strict`                           | `true`       | Enable all strict type-checking options (`strictNullChecks`, `noImplicitAny`, etc.).                                             |
| `noUncheckedIndexedAccess`         | `true`       | Treat indexed access (e.g. `arr[i]`) as possibly `undefined`, catching out-of-bounds bugs at compile time.                       |
| `noImplicitOverride`               | `true`       | Require the `override` keyword when overriding a base class member, preventing accidental signature drift.                       |
| `exactOptionalPropertyTypes`       | `true`       | Distinguish between an optional property that is missing and one explicitly set to `undefined`.                                  |
| `forceConsistentCasingInFileNames` | `true`       | Reject imports that differ only in filename casing, avoiding cross-platform (Linux/macOS/Windows) build issues.                  |
| `skipLibCheck`                     | `true`       | Skip type-checking of `.d.ts` files in `node_modules`, speeding up builds and avoiding errors from third-party type bugs.        |
| `resolveJsonModule`                | `true`       | Allow importing `.json` files as typed modules (used to load `schemas/invoice.schema.json` directly).                            |
| `esModuleInterop`                  | `true`       | Allow default imports from CommonJS modules (e.g. `import Ajv from "ajv"`), needed since `ajv` and `ajv-formats` ship as CJS.    |

#### include / exclude

| Key       | Value                                               | Purpose                                                                 |
| --------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `include` | `["core/**/*", "adapters/**/*", "validators/**/*"]` | Only compile the library source directories.                            |
| `exclude` | `["node_modules", "dist", "fixtures"]`              | Exclude dependencies, build output, and test fixtures from compilation. |

### Dependency policy

`package.json` is plain JSON and cannot hold inline comments, so the purpose of each dependency is documented here instead.

This project has no runtime (`dependencies`) — only `devDependencies`, used for building, type-checking, linting, formatting, and testing.

#### devDependencies

| Package                            | Purpose                                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `@types/node`                      | Type definitions for Node.js built-in modules (used by build scripts and tests).                              |
| `@typescript-eslint/eslint-plugin` | ESLint rules for TypeScript-specific issues (unused vars, type safety, etc.).                                 |
| `@typescript-eslint/parser`        | Lets ESLint parse TypeScript syntax.                                                                          |
| `@vitest/coverage-v8`              | Code coverage reporting for `vitest` via V8's built-in coverage.                                              |
| `ajv`                              | JSON Schema validator used by the test suite to verify fixtures against `schemas/invoice.schema.json`. |
| `ajv-formats`                      | Adds format validators (`date`, `email`, etc.) to `ajv`, used by the schema's `format` keywords.              |
| `eslint`                           | Linter for catching code issues and enforcing style rules.                                                    |
| `eslint-config-prettier`           | Disables ESLint formatting rules that conflict with Prettier.                                                 |
| `prettier`                         | Code formatter for consistent style across the codebase.                                                      |
| `typescript`                       | TypeScript compiler, used for type-checking and building `dist/`.                                             |
| `vitest`                           | Test runner used for unit and schema validation tests.                                                        |

---

## How to Add a New Invoice Fixture

Fixtures are example invoices in `fixtures/`. Each one represents a distinct legal scenario.

1. **Create the JSON file** at `fixtures/<name>.invoice.json`. It must validate against `schemas/invoice.schema.json`.

2. **Add it to the schema test** in `validators/test/invoice-schema.test.ts` — import the fixture and add it to the valid-fixture test array.

3. **Add it to the business rules test** in `validators/test/business-rules.test.ts` — import the fixture and add it to the valid-fixture array so `validateBusinessRules()` confirms it produces no issues.

4. **Run the tests** to confirm everything passes:

   ```bash
   npm test
   ```

5. **Document the scenario** it covers in a comment or in the fixtures `README.md`.

**Naming convention:** `<scenario>.invoice.json` — e.g., `intra-eu-supply.invoice.json`, `credit-note-full.invoice.json`.

---

## Commit Message Convention

This repo loosely follows [Conventional Commits](https://www.conventionalcommits.org/): `type: short description`.

### Common Types

| Type       | Meaning                                | Example                                 |
| ---------- | --------------------------------------- | ---------------------------------------- |
| `feat`     | A new feature                          | `feat: add XRechnung export`            |
| `fix`      | A bug fix                              | `fix: handle empty invoice lines`       |
| `docs`     | Documentation only                     | `docs: update roadmap`                  |
| `style`    | Formatting (no code logic changes)     | `style: format TypeScript files`        |
| `refactor` | Improve code without changing behavior | `refactor: simplify VAT validator`      |
| `test`     | Add or update tests                    | `test: add reverse charge fixtures`     |
| `chore`    | Maintenance tasks                      | `chore: update dependencies`            |
| `build`    | Build system changes                   | `build: configure Docker image`         |
| `ci`       | CI/CD changes                          | `ci: run KoSIT tests in GitHub Actions` |
| `perf`     | Performance improvements               | `perf: cache XML schema compilation`    |
| `revert`   | Revert a previous commit               | `revert: remove experimental validator` |

### How strict is this?

`feat`, `fix`, `docs`, and `chore` cover most commits and should always be used. The rest apply when they clearly fit. This isn't enforced by CI or commitlint yet — it's a convention, not a hard requirement.

---

## How to Propose Changes

1. **Fork** the repository on GitHub.
2. **Create a branch** from `main` with a descriptive name (e.g., `add-credit-note-fixture`, `fix-vat-rounding`).
3. **Make your changes.** Keep commits focused — one logical change per commit, following the commit message convention above.
4. **Run the full check suite** before pushing:
   ```bash
   npm run format:check && npm run lint && npm run typecheck && npm test
   ```
5. **Open a Pull Request** against `main`. In the PR description, explain:
   - What you changed and why
   - Which legal rule or scenario is affected (if applicable)
   - How you tested it

---

## Reporting Issues

Use [GitHub Issues](https://github.com/HongbaeKim/openinvoicexml/issues) to report bugs or request features. A good issue includes:

- **What you expected** to happen
- **What actually happened** (error messages, validation output)
- **Steps to reproduce** (ideally a fixture JSON that triggers the issue)
- **Environment** (Node.js version, OS)

---

## Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for a detailed description of how the modules fit together. The short version:

- `core/` — TypeScript types for the internal invoice model
- `schemas/` — JSON Schema that consumers may use for runtime structural validation
- `validators/` — Business-rule validation, KoSIT integration, and schema-validation tests
- `adapters/` — Output adapters, including the implemented XML adapter and planned PDF adapter
- `fixtures/` — Example invoice JSON files
- `docs/` — Documentation

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project, as stated in the repository's [LICENSE](../LICENSE) file (currently Apache License 2.0).
