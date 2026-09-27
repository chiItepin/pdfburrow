import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";
import { filenameRules } from "./filename-rules.mjs";

/** @param {"web" | "ui" | "engine" | "tooling"} layer */
export const configFor = (layer) => {
  const forbidden = {
    web: [],
    ui: ["@repo/web", "@repo/pdf-engine"],
    engine: ["@repo/web", "@repo/core-ui", "react", "react-dom"],
    tooling: ["@repo/web", "@repo/core-ui", "@repo/pdf-engine"],
  }[layer];

  return tseslint.config(
    {
      ignores: [
        "dist/**",
        ".dev/**",
        "node_modules/**",
        ".rush/**",
        "test-results/**",
        "playwright-report/**",
      ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
      languageOptions: { globals: layer === "engine" ? globals.worker : globals.browser },
      rules: {
        eqeqeq: ["error", "always"],
        curly: ["error", "all"],
        "no-var": "error",
        "prefer-const": "error",
        "prefer-arrow-callback": "error",
        "object-shorthand": "error",
        "no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
        "no-implicit-coercion": "error",
        "no-else-return": "error",
        "max-depth": ["error", 4],
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["@repo/*/src", "@repo/*/src/**"],
                message: "Import from an explicit package entry barrel.",
              },
              {
                group: ["@repo/core-ui/*", "!@repo/core-ui/styles.css"],
                message: "Import UI through @repo/core-ui.",
              },
              {
                group: ["@repo/tooling", "@repo/tooling/**"],
                message: "Tooling is development-only configuration.",
              },
              ...forbidden.map((name) => ({
                group: [name, `${name}/**`],
                message: `This import violates the ${layer} package boundary.`,
              })),
            ],
          },
        ],
      },
    },
    {
      files: ["**/*.{ts,tsx}"],
      rules: {
        "@typescript-eslint/consistent-type-imports": "error",
        "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      },
    },
    {
      files: ["**/*.tsx"],
      plugins: { "repo-filenames": filenameRules },
      rules: { "repo-filenames/tsx-pascal-case": "error" },
    },
    {
      files: ["src/**/*.{ts,tsx}"],
      rules: {
        "func-style": ["error", "expression"],
        "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      },
    },
    {
      files: ["**/*.mjs", "**/*config.ts"],
      languageOptions: { globals: globals.node },
      rules: { "no-restricted-imports": "off" },
    },
    ...(layer === "web" || layer === "ui"
      ? [
          {
            files: ["src/**/*.{ts,tsx}"],
            plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
            rules: {
              ...reactHooks.configs.recommended.rules,
              ...jsxA11y.configs.recommended.rules,
            },
          },
        ]
      : []),
  );
};

export default configFor("tooling");
