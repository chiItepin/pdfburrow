import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { configFor } from "../packages/tooling/eslint.config.mjs";

const require = createRequire(new URL("../packages/tooling/package.json", import.meta.url));
const { ESLint } = require("eslint");
const eslint = new ESLint({
  cwd: fileURLToPath(new URL("../packages/pdf-engine/", import.meta.url)),
  overrideConfigFile: true,
  overrideConfig: configFor("engine"),
});
const ruleId = "repo-pdf/preparation-boundary";
const check = async (code, prohibited, filePath = "src/check.ts") => {
  const [result] = await eslint.lintText(code, { filePath });
  assert.ok(!result.messages.some((message) => message.fatal), JSON.stringify(result.messages));
  const errors = result.messages.filter((message) => message.ruleId === ruleId);
  assert.equal(errors.length > 0, prohibited, `${filePath}: ${code}`);
  for (const error of errors) {
    assert.equal(error.severity, 2);
    assert.match(error.message, /loadValidatedPdf|named|re-export|literal/u);
  }
};

const internals = [
  ["preparePdfDocument", "preparePdfDocument", "pdf"],
  ["inspectDocument", "inspectDocument", "preparePdfDocument"],
  ["preservePdfForms", "preservePdfForms", "preparePdfDocument"],
  ["inspectFillableForm", "inspectFormForFilling", "preparePdfDocument"],
];

test("preparation runtime imports resolve exact modules and owners, not filenames", async () => {
  for (const [module, name, owner] of internals) {
    for (const suffix of ["", ".ts", ".js"]) {
      const source = `./nested/../${module}${suffix}`;
      const code = `import { ${name} as run } from "${source}"; export const use = () => run();`;
      await check(code, true);
      await check(code, false, `src/${owner}.ts`);
      await check(
        `import { ${name} as run } from "../${module}${suffix}"; export const use = () => run();`,
        true,
        `src/nested/${owner}.ts`,
      );
    }
    await check(
      `import { ${name} as run } from "../../pdf-engine/src/${module}.ts"; export const use = () => run();`,
      true,
    );
    await check(
      `import { ${name} as run } from "./nested/${module}.ts"; export const use = () => run();`,
      false,
    );
    await check(
      `import { ${name} as run } from "./${module}.ts?copy"; export const use = () => run();`,
      true,
    );
  }
});

test("protected internals cannot escape through runtime re-exports or opaque imports", async () => {
  for (const [module, name, owner] of internals) {
    for (const code of [
      `export { ${name} as run } from "./${module}.ts";`,
      `export * from "./${module}";`,
      `export * as internal from "./${module}.js";`,
      `import * as internal from "./${module}.ts"; export const run = internal;`,
      `import internal from "./${module}.ts"; export const run = internal;`,
      `export const run = import("./${module}.ts");`,
      `export const run = require("./${module}.ts");`,
      `export const run = module.require("./${module}.ts");`,
    ]) {
      await check(code, true);
    }
    await check(`export { ${name} } from "./${module}.ts";`, true, `src/${owner}.ts`);
    await check(
      `import { ${name} as run } from "./${module}.ts"; export { run };`,
      true,
      `src/${owner}.ts`,
    );
  }
});

test("protected imports remain direct calls inside their owners, not alias exports", async () => {
  for (const [module, name, owner] of internals) {
    for (const escape of [
      "export const bypass = run;",
      "const alias = run; export { alias as bypass };",
      "export const bypass = { run };",
      "export const bypass = run.bind(null);",
      "export const bypass = () => Promise.resolve(run);",
    ]) {
      const exporter = `import { ${name} as run } from "./${module}.ts"; ${escape}`;
      const importer = `import { bypass } from "./${owner}.ts"; export const use = () => bypass();`;
      const results = await Promise.all([
        eslint.lintText(exporter, { filePath: `src/${owner}.ts` }),
        eslint.lintText(importer, { filePath: "src/newCapability.ts" }),
      ]);
      assert.ok(
        results
          .flat()
          .flatMap((result) => result.messages)
          .some((message) => message.ruleId === ruleId),
        `${owner}: ${escape}`,
      );
      await check(exporter, true, `src/${owner}.ts`);
    }
    await check(
      `import { ${name} as run } from "./${module}.ts"; export type Preparation = typeof run; export const use = () => run();`,
      false,
      `src/${owner}.ts`,
    );
  }
});

test("preparation types and the public field-description helper remain accessible", async () => {
  for (const [module, name] of internals) {
    await check(
      `import type { ${name} } from "./${module}.ts"; export type Result = ${name};`,
      false,
    );
    await check(
      `import { type ${name} } from "./${module}.ts"; export type Result = ${name};`,
      false,
    );
    await check(`export type { ${name} } from "./${module}.ts";`, false);
    await check(`export { type ${name} } from "./${module}.ts";`, false);
    await check(`export type * from "./${module}.ts";`, false);
    await check(`import type * as Types from "./${module}"; export type Result = Types;`, false);
  }
  for (const code of [
    'import type { FormHandling } from "./preparePdfDocument.ts"; export type Policy = FormHandling;',
    'import { describeFormFields } from "./inspectFillableForm.ts"; export const describe = describeFormFields;',
    'export { describeFormFields } from "./inspectFillableForm.ts";',
  ]) {
    await check(code, false, "src/fillForm.ts");
  }
  await check(
    'import { type FormHandling, preparePdfDocument } from "./preparePdfDocument"; export const run = () => preparePdfDocument(); export type Policy = FormHandling;',
    false,
    "src/pdf.ts",
  );
  await check(
    'import { describeFormFields, inspectFormForFilling } from "./inspectFillableForm"; export const run = [describeFormFields, inspectFormForFilling];',
    true,
    "src/fillForm.ts",
  );
});

test("raw PDF loading and constructor escape forms are restricted to the actual loader", async () => {
  const uses = [
    "PDFDocument.load(bytes)",
    'PDFDocument["load"](bytes)',
    "PDFDocument.load",
    'PDFDocument["load"]',
    "((PDFDocument as typeof PDFDocument).load)(bytes)",
    "PDFDocument[key]",
    "PDFDocument.prototype",
    "PDFDocument",
  ];
  for (const use of uses) {
    const code = `import { PDFDocument } from "pdf-lib"; export const open = (bytes, key) => ${use};`;
    await check(code, true);
    await check(code, false, "src/pdf.ts");
    await check(code, true, "src/nested/pdf.ts");
    await check(code, true, "src/pdf.js");
  }
  for (const code of [
    'import { PDFDocument as Doc } from "pdf-lib"; export const open = Doc.load;',
    'import { PDFDocument } from "pdf-lib"; const Doc = PDFDocument; export const open = Doc.load;',
    'import { PDFDocument } from "pdf-lib"; const { load } = PDFDocument; export const open = load;',
    'import { PDFDocument } from "pdf-lib"; const { ["load"]: open } = PDFDocument; export { open };',
    'import { PDFDocument } from "pdf-lib"; export const open = PDFDocument.load.bind(PDFDocument);',
    'import { PDFDocument } from "pdf-lib"; export { PDFDocument as Doc };',
    'export { PDFDocument as Doc } from "pdf-lib";',
    'export * from "pdf-lib";',
    'export * as library from "pdf-lib";',
    'import * as library from "pdf-lib"; export const open = library.PDFDocument.load;',
    'import library from "pdf-lib"; export const open = library.PDFDocument.load;',
    'export const open = (await import("pdf-lib")).PDFDocument.load;',
    "export const open = (await import(`pdf-lib`)).PDFDocument.load;",
    'export const open = require("pdf-lib").PDFDocument.load;',
    'export const open = module.require("pdf-lib").PDFDocument.load;',
    'import library = require("pdf-lib"); export const open = library.PDFDocument.load;',
    'import { PDFDocument } from "pdf-lib/es/index.js"; export const open = PDFDocument.load;',
    'export { default as Doc } from "pdf-lib/es/api/PDFDocument.js";',
    'const source = "pdf-lib"; export const library = import(source);',
    'const source = "./inspectDocument"; export const library = import(source);',
  ]) {
    await check(code, true);
  }
});

test("creation, instances, unrelated imports, previews, and type references remain valid", async () => {
  for (const code of [
    'import { PDFDocument } from "pdf-lib"; export const make = () => PDFDocument.create();',
    'import { PDFDocument as Doc } from "pdf-lib"; export const make = () => Doc["create"]();',
    'import { PDFDocument } from "pdf-lib"; export const make = PDFDocument.create;',
    'import { PDFDocument } from "pdf-lib"; export const make = async () => { const doc = await PDFDocument.create(); doc.addPage(); return doc.save(); };',
    'import type { PDFDocument } from "pdf-lib"; export const save = (doc: PDFDocument) => doc.save();',
    'import { type PDFDocument, PDFName } from "pdf-lib"; export const entry = PDFName.of("Name"); export type Doc = PDFDocument;',
    'import type { PDFDocument } from "pdf-lib"; export type Constructor = typeof PDFDocument;',
    'import { PDFDocument } from "pdf-lib"; export type Constructor = typeof PDFDocument; export const make = PDFDocument.create;',
    'import { type PDFDocument } from "pdf-lib/es/index.js"; export type Doc = PDFDocument;',
    'export type { PDFDocument } from "pdf-lib";',
    'export { type PDFDocument, PDFName } from "pdf-lib";',
    'export { PDFName } from "pdf-lib";',
    'import { PDFName } from "pdf-lib"; export const name = PDFName.of("Name");',
    'import { getDocument } from "pdfjs-dist"; export const preview = getDocument;',
    'export const preview = import("pdfjs-dist");',
    'export const data = import("./unrelated");',
    'import { PDFDocument } from "pdf-lib"; export const make = PDFDocument.create; export const other = (PDFDocument: { load: () => void }) => PDFDocument.load();',
    'import type { PDFDocument } from "pdf-lib"; export const other = (PDFDocument: { load: () => void }) => PDFDocument.load();',
    'export const digest = (bytes: ArrayBuffer) => crypto.subtle.digest("SHA-256", bytes);',
  ]) {
    await check(code, false);
  }
});

test("CommonJS globals cannot hide imports behind require aliases in ESM source", async () => {
  for (const code of [
    'const open = require; export const library = open("pdf-lib");',
    'const { require: open } = module; export const library = open("./inspectDocument");',
    'export const library = require.call(null, "pdf-lib");',
  ]) {
    const [result] = await eslint.lintText(code, { filePath: "src/check.mjs" });
    assert.ok(
      result.messages.some((message) => message.ruleId === "no-restricted-globals"),
      code,
    );
  }
});

test("enforcement covers engine source formats without restricting tests or other packages", async () => {
  const code = 'import { PDFDocument } from "pdf-lib"; export const open = PDFDocument.load;';
  for (const extension of ["ts", "tsx", "mts", "cts", "js", "mjs", "cjs"]) {
    await check(code, true, `src/Example.${extension}`);
  }
  for (const filePath of ["tests/example.test.ts", "tests/example.test.mjs", "example.ts"]) {
    await check(code, false, filePath);
  }
  for (const layer of ["web", "ui", "tooling"]) {
    const otherLint = new ESLint({
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      overrideConfigFile: true,
      overrideConfig: configFor(layer),
    });
    const [result] = await otherLint.lintText(code, { filePath: "src/example.ts" });
    assert.ok(!result.messages.some((message) => message.ruleId === ruleId), layer);
  }
});
