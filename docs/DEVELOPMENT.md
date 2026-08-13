# Development Guide

Local setup, tooling, and how to propose changes for `openinvoicexml`.

---

## Local Setup

```bash
git clone https://github.com/HongbaeKim/openinvoicexml.git
cd openinvoicexml
npm install
npm test
```

Prerequisites: Node.js ≥ 20.0.0, npm, git.

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
| `npm run build`          | Compile TypeScript to `dist/`                                                                |
| `make generate`          | Regenerate XML fixtures from `dist/` (run `npm run build` first)                             |
| `make kosit-setup`       | One-time download of the KoSIT validator + XRechnung config (see [`COMPLIANCE.md`](COMPLIANCE.md#validating-xrechnung-output)) |
| `make validate-kosit`    | Validate generated XML using KoSIT                                                            |

---

## Code Style

**Prettier** for formatting, **ESLint** for linting (`.prettierrc`, `eslint.config.js`,
`.editorconfig`). Before committing:

```bash
npm run format && npm run lint
```

`npm run lint`
Example: unused variables, unsafe patterns, incorrect TypeScript/ESLint rules.

`npm run format`
Example: spacing, indentation, line breaks, quotes, trailing commas.

After changing the adapter or fixtures, regenerate XML output: `npm run build && make generate`.

### TypeScript configuration

`tsconfig.json` can't hold comments, so the notable non-default options are documented here:

| Option                       | Value      | Purpose                                                                        |
| ------------------------------ | ---------- | --------------------------------------------------------------------------------- |
| `module` / `moduleResolution` | `NodeNext` | Native ESM, matching `"type": "module"` in `package.json`                       |
| `strict`                     | `true`     | All strict type-checking options                                              |
| `noUncheckedIndexedAccess`   | `true`     | Treats `arr[i]` as possibly `undefined`                                        |
| `exactOptionalPropertyTypes` | `true`     | Distinguishes a missing optional property from one explicitly set to `undefined` |

Everything else is standard for a Node ESM library — see `tsconfig.json` directly.

### Dependency policy

No runtime (`dependencies`) — only `devDependencies` (build/lint/format/test). See
[`ARCHITECTURE.md`](ARCHITECTURE.md#no-runtime-dependencies) for why.

---

## How to Add a New Invoice Fixture

1. Create `fixtures/NN.<name>.invoice.json`, where `NN` is the next unused two-digit number. It
   must validate against `schemas/invoice.schema.json`.
2. Add it to `validators/test/00.invoice-schema.test.ts`'s valid-fixture array.
3. Add it to `validators/test/02.business-rules.test.ts`'s valid-fixture array.
4. Run `npm test` to confirm everything passes.
5. Document the scenario in [`fixtures/README.md`](../fixtures/README.md).

**Naming convention:** `<scenario>.invoice.json` — e.g. `08.intra-eu-supply.invoice.json`.

---

## Commit Message Convention

Loosely [Conventional Commits](https://www.conventionalcommits.org/): `type: short description`.
`feat`, `fix`, `docs`, `chore` cover most commits; `style`/`refactor`/`test`/`build`/`ci`/`perf`/
`revert` apply when they clearly fit. Not enforced by CI — a convention, not a hard requirement.

---

## How to Propose Changes

1. Fork the repo, branch from `main` with a descriptive name.
2. Keep commits focused — one logical change per commit.
3. Before pushing: `npm run format:check && npm run lint && npm run typecheck && npm test`.
4. Open a PR against `main` explaining what changed, why, and how it was tested.

## Reporting Issues

Use [GitHub Issues](https://github.com/HongbaeKim/openinvoicexml/issues) — include expected vs.
actual behavior, steps to reproduce (ideally a triggering fixture JSON), and environment.

---

## Project Structure

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for how the modules fit together.

## License

By contributing, you agree that your contributions will be licensed under this project's
[LICENSE](../LICENSE) (currently Apache License 2.0).
