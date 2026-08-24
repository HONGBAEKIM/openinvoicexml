import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs["recommended"].rules,
      ...tseslint.configs["recommended-requiring-type-checking"].rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-function-return-type": "error",
    },
  },
  prettier,
  {
    // src/ (frontend + backend) are separate services/apps with their own package.json and
    // tsconfig.json (not part of the published npm package) — they're outside this eslint
    // config's `project` (root tsconfig.json only covers core/adapters/validators). The root
    // package itself has no /src of its own, so this is unambiguous.
    // vitest.config.ts is root-level tooling config, outside tsconfig.json's
    // `include` (core/adapters/validators only), so it can't use the type-aware parser project.
    ignores: ["dist/**", "node_modules/**", "src/**", "vitest.config.ts", "coverage/**"],
  },
];
