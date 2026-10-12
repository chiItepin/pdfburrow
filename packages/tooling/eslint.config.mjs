import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";
import { filenameRules } from "./filenameRules.mjs";

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
        ".prerender-*/**",
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
            paths:
              layer === "web" || layer === "ui"
                ? [
                    {
                      name: "react",
                      importNames: ["useMemo", "useCallback"],
                      message:
                        "React Compiler handles memoization. Use state or refs for persistent resource ownership.",
                    },
                  ]
                : [],
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
      files: ["**/*.{ts,tsx,mts,cts,js,mjs,cjs}"],
      plugins: { "repo-filenames": filenameRules },
    },
    {
      files: ["**/*.{ts,mts,cts,js,mjs,cjs}"],
      rules: { "repo-filenames/non-component-camel-case": "error" },
    },
    {
      files: ["**/*.tsx"],
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
    ...(layer === "web"
      ? tseslint.config({
          files: ["src/**/*.tsx"],
          // Pre-existing controls only. Remove entries as screens migrate; never add exemptions.
          ignores: [
            "src/images/ImageSettings.tsx",
            "src/markup/GoToPage.tsx",
            "src/markup/MarkupOutput.tsx",
            "src/markup/MarkupProperties.tsx",
            "src/markup/NoteEditor.tsx",
            "src/markup/ObjectControls.tsx",
            "src/markup/SignatureCapture.tsx",
            "src/markup/ZoomLevel.tsx",
            "src/split/ModePicker.tsx",
            "src/split/RangeEditor.tsx",
            "src/split/SelectionSettings.tsx",
            "src/split/SortablePage.tsx",
            "src/workspace/PreservationNotice.tsx",
            "src/workspace/ToolNavigation.tsx",
          ],
          rules: {
            "no-restricted-syntax": [
              "error",
              {
                selector:
                  "JSXOpeningElement[name.type='JSXIdentifier'][name.name=/^(input|textarea|select|button|label)$/]",
                message:
                  "Use shadcn components from @repo/core-ui. Add missing shared primitives first; do not hand-style native controls in feature JSX.",
              },
            ],
          },
        })
      : []),
  );
};

export default configFor("tooling");
