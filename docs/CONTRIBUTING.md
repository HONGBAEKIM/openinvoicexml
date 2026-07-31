# Contributing

Thank you for your interest in contributing to `openinvoicexml`. This guide covers everything you need to get started.

---

## Prerequisites

- **Node.js** ≥ 20.0.0
- **npm** (included with Node.js)
- **git**

---

## Local Setup

```bash
git clone https://github.com/hongbae/openinvoicexml.git
cd openinvoicexml
npm install
npm test
```

If all tests pass, your environment is ready.

### Useful Commands

| Command                 | What it does                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `npm test`              | Run all tests (Vitest)                                                                 |
| `npm run test:watch`    | Run tests in watch mode                                                                |
| `npm run test:coverage` | Run tests with coverage report                                                         |
| `npm run typecheck`     | Type-check without emitting files                                                      |
| `npm run lint`          | Check for lint errors (ESLint)                                                         |
| `npm run lint:fix`      | Auto-fix lint errors                                                                   |
| `npm run format`        | Format all files (Prettier)                                                            |
| `npm run format:check`  | Check formatting without changing files                                                |
| `npm run build`         | Compile TypeScript to `dist/`                                                          |
| `make generate`         | Regenerate XML fixtures from `dist/` (run `npm run build` first)                       |
| `make validate-xml`     | Generate XML and verify each file has a valid XML declaration                          |
| `make kosit-setup`      | One-time download of the KoSIT validator + XRechnung config (see `docs/VALIDATION.md`) |
| `make validate-kosit`   | Generate XML and validate it against the real KoSIT validator                          |

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
make type && make generate
```

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

## How to Propose Changes

1. **Fork** the repository on GitHub.
2. **Create a branch** from `main` with a descriptive name (e.g., `add-credit-note-fixture`, `fix-vat-rounding`).
3. **Make your changes.** Keep commits focused — one logical change per commit.
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

Use [GitHub Issues](https://github.com/hongbaekim/openinvoicexml/issues) to report bugs or request features. A good issue includes:

- **What you expected** to happen
- **What actually happened** (error messages, validation output)
- **Steps to reproduce** (ideally a fixture JSON that triggers the issue)
- **Environment** (Node.js version, OS)

---

## Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for a detailed description of how the modules fit together. The short version:

- `core/` — TypeScript types for the internal invoice model
- `schemas/` — JSON Schema (the structural contract)
- `validators/` — Schema validation (AJV) and business rule validation
- `adapters/` — Output format adapters (XML, PDF — added in later phases)
- `fixtures/` — Example invoice JSON files
- `docs/` — Documentation

---

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](../LICENSE).
