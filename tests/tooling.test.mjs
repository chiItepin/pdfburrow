import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { configFor } from "../packages/tooling/eslint.config.mjs";

const require = createRequire(new URL("../packages/tooling/package.json", import.meta.url));
const { ESLint } = require("eslint");

test("standard lint rules reject weak equality, function declarations and missing image descriptions", async () => {
  const eslint = new ESLint({
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    overrideConfigFile: true,
    overrideConfig: configFor("web"),
  });
  const cases = [
    ["export const same = (a: number, b: number) => a == b;", "eqeqeq"],
    ["export function count() { return 1; }", "func-style"],
    ['export const Image = () => <img src="local.png" />;', "jsx-a11y/alt-text"],
  ];
  for (const [code, rule] of cases) {
    const [result] = await eslint.lintText(code, { filePath: "src/example.tsx" });
    assert.ok(
      result.messages.some((message) => message.ruleId === rule),
      rule,
    );
  }
});

test("web tooling uses React and esbuild without Vite and exposes formatter commands", async () => {
  const web = JSON.parse(
    await readFile(new URL("../apps/web/package.json", import.meta.url), "utf8"),
  );
  assert.ok(web.dependencies.react);
  assert.ok(web.devDependencies.esbuild);
  assert.ok(web.devDependencies["@tailwindcss/cli"]);
  assert.ok(!Object.keys(web.devDependencies).some((name) => name.includes("vite")));
  assert.ok(!Object.values(web.scripts).some((script) => script.includes("vite")));
  const root = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(root.scripts["format:check"]);
  assert.ok(root.scripts.check.includes("format:check"));
});

test("filename lint requires PascalCase only for TSX files", async () => {
  const eslint = new ESLint({
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    overrideConfigFile: true,
    overrideConfig: configFor("web"),
  });
  const invalid = [
    "src/file-picker.tsx",
    "src/filePicker.tsx",
    "src/file_picker.tsx",
    "src/main.tsx",
    "src/index.tsx",
    "src/File.Picker.tsx",
  ];
  const valid = [
    "src/FilePicker.tsx",
    "src/Main.tsx",
    "src/App.tsx",
    "src/PDFPreview2.tsx",
    "src/use-draft.ts",
    "src/index.ts",
    "tests/workspace.spec.ts",
    "scripts/build-options.mjs",
  ];
  for (const filename of [...invalid, ...valid]) {
    const [result] = await eslint.lintText("export const value = 1;", { filePath: filename });
    const errors = result.messages.filter(
      (message) => message.ruleId === "repo-filenames/tsx-pascal-case",
    );
    assert.equal(errors.length, invalid.includes(filename) ? 1 : 0, filename);
    if (errors.length) assert.equal(errors[0].severity, 2);
  }
});
