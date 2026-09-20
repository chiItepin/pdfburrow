import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

/** @param {"web" | "ui" | "engine" | "tooling"} layer */
export function configFor(layer) {
  const forbidden = {
    web: [],
    ui: ["@repo/web", "@repo/pdf-engine"],
    engine: ["@repo/web", "@repo/core-ui", "react", "react-dom"],
    tooling: ["@repo/web", "@repo/core-ui", "@repo/pdf-engine"],
  }[layer];

  return tseslint.config(
    { ignores: ["dist/**", "node_modules/**", ".rush/**"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      languageOptions: {
        globals: layer === "engine" ? globals.worker : globals.browser,
      },
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["@repo/*/src", "@repo/*/src/**"],
                message: "Use the package's public source exports.",
              },
              {
                group: ["@repo/tooling", "@repo/tooling/**"],
                message: "Tooling is development configuration, not runtime code.",
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
      files: ["**/*.mjs", "**/*config.ts"],
      languageOptions: { globals: globals.node },
      rules: { "no-restricted-imports": "off" },
    },
    ...(layer === "web" || layer === "ui"
      ? tseslint.config(
          {
            files: ["**/*.{ts,tsx}"],
            plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
            rules: {
              ...reactHooks.configs.recommended.rules,
              "react-refresh/only-export-components": [
                "warn",
                { allowConstantExport: true },
              ],
            },
          },
        )
      : []),
    ...(layer === "ui"
      ? tseslint.config({
          files: ["src/primitives/**/*.tsx"],
          rules: { "react-refresh/only-export-components": "off" },
        })
      : []),
  );
}

export default configFor("tooling");
