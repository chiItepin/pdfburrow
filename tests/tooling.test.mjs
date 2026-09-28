import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
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

test("filename lint enforces PascalCase components and camelCase non-components", async () => {
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
    "src/use-pdf-draft.ts",
    "src/use_pdf_draft.ts",
    "src/UsePdfDraft.ts",
    "src/image-preview.worker.ts",
    "tests/worker_client.test.mjs",
    "scripts/build-options.mjs",
    "scripts/BuildOptions.mjs",
    "src/some-types.d.ts",
  ];
  const valid = [
    "src/FilePicker.tsx",
    "src/Main.tsx",
    "src/App.tsx",
    "src/PDFPreview2.tsx",
    "src/usePdfDraft.ts",
    "src/index.ts",
    "tests/workspace.spec.ts",
    "tests/workerClient.test.mjs",
    "scripts/buildOptions.mjs",
    "src/imagePreview.worker.ts",
    "src/workerTypes.d.ts",
    "src/workerTypes.mts",
    "eslint.config.mjs",
    "playwright.config.ts",
  ];
  for (const filename of [...invalid, ...valid]) {
    const [result] = await eslint.lintText("export const value = 1;", { filePath: filename });
    const errors = result.messages.filter((message) =>
      message.ruleId?.startsWith("repo-filenames/"),
    );
    assert.equal(errors.length, invalid.includes(filename) ? 1 : 0, filename);
    if (errors.length) assert.equal(errors[0].severity, 2);
  }
});

test("all project-owned source, test and build filenames follow the naming rules", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: configFor("web"),
  });
  const ignored = new Set([
    "node_modules",
    ".rush",
    ".dev",
    "dist",
    "test-results",
    "playwright-report",
  ]);
  const checkDirectory = async (directory) => {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory() && !ignored.has(entry.name)) {
        await checkDirectory(filename);
      } else if (entry.isFile() && /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/u.test(entry.name)) {
        const [result] = await eslint.lintText("export const value = 1;", { filePath: filename });
        assert.deepEqual(
          result.messages.filter((message) => message.ruleId?.startsWith("repo-filenames/")),
          [],
          filename,
        );
      }
    }
  };
  for (const directory of ["apps", "packages", "tests"]) {
    await checkDirectory(directory);
  }
});

test("manual React memoization imports are rejected in favor of the compiler", async () => {
  for (const layer of ["web", "ui"]) {
    const eslint = new ESLint({
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      overrideConfigFile: true,
      overrideConfig: configFor(layer),
    });
    for (const code of [
      'import { useMemo } from "react"; export const useValue = () => useMemo(() => 1, []);',
      'import { useCallback as memo } from "react"; export const useValue = () => memo(() => 1, []);',
      'import * as React from "react"; export const useValue = () => React.useMemo(() => 1, []);',
    ]) {
      const [result] = await eslint.lintText(code, { filePath: "src/useValue.ts" });
      assert.ok(result.messages.some((message) => message.ruleId === "no-restricted-imports"));
    }
  }
});
