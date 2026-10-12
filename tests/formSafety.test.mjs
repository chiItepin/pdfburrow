import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { inspectPdf, mergeDocuments } from "../packages/pdf-engine/src/pdf.ts";
import { splitDocuments } from "../packages/pdf-engine/src/splitDocuments.ts";

const require = createRequire(new URL("../packages/pdf-engine/package.json", import.meta.url));
const { PDFDict, PDFDocument, PDFHexString, PDFName } = require("pdf-lib");

const expectRejected = async (configure, pattern) => {
  const document = await PDFDocument.create();
  const field = document.getForm().createTextField("shared");
  field.setText("Current value");
  field.addToPage(document.addPage());
  field.addToPage(document.addPage());
  configure(document, field);
  const input = {
    id: "unsupported",
    name: "unsupported.pdf",
    blob: new Blob([await document.save({ updateFieldAppearances: false })]),
  };
  await assert.rejects(inspectPdf(input), pattern);
  await assert.rejects(
    mergeDocuments({ inputs: [input], acknowledged: true }, () => {}),
    pattern,
  );
  await assert.rejects(
    splitDocuments(
      {
        input,
        selection: { mode: "selected", pages: [1] },
        acknowledged: true,
      },
      () => {},
    ),
    pattern,
  );
};

test("document-wide form scripts and calculations are blocked instead of silently discarded", async () => {
  await expectRejected((document) => {
    document.catalog.set(
      PDFName.of("Names"),
      document.context.obj({
        JavaScript: {
          Names: [
            PDFHexString.fromText("initialize"),
            {
              S: "JavaScript",
              JS: PDFHexString.fromText("this.getField('shared').value = 'changed';"),
            },
          ],
        },
      }),
    );
  }, /Scripted form behavior/);
  await expectRejected((document, field) => {
    document.catalog
      .lookup(PDFName.of("AcroForm"), PDFDict)
      .set(PDFName.of("CO"), document.context.obj([field.ref]));
  }, /Calculated form behavior/);
});

test("conflicting per-widget field attributes fail rather than silently picking one value", async () => {
  await expectRejected((document, field) => {
    field.acroField
      .getWidgets()[1]
      .dict.set(PDFName.of("V"), PDFHexString.fromText("Different value"));
  }, /conflicting values or settings/);
});

test("rich-text values are rejected anywhere in the hierarchy even without a RichText flag", async () => {
  for (const location of ["field", "widget", "ancestor"]) {
    await expectRejected((document, field) => {
      let target = field.acroField.dict;
      if (location === "widget") {
        target = field.acroField.getWidgets()[0].dict;
      } else if (location === "ancestor") {
        target = document.context.obj({
          T: PDFHexString.fromText("section"),
          Kids: [field.ref],
        });
        const ref = document.context.register(target);
        field.acroField.dict.set(PDFName.of("Parent"), ref);
        document.catalog
          .lookup(PDFName.of("AcroForm"), PDFDict)
          .set(PDFName.of("Fields"), document.context.obj([ref]));
      }
      target.set(PDFName.of("RV"), PDFHexString.fromText("<body><p>Rich value</p></body>"));
    }, /field types or formatting.*cannot be preserved safely/);
  }
});

test("invalid source page dimensions or rotation cannot be hidden by form normalization", async () => {
  for (const [key, value] of [
    ["MediaBox", [0, 0, -20, 30]],
    ["UserUnit", -1],
    ["Rotate", 30],
  ]) {
    await expectRejected((document) => {
      document.getPage(0).node.set(PDFName.of(key), document.context.obj(value));
    }, /invalid (dimensions|UserUnit|rotation)/);
  }
});
