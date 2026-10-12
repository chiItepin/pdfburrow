import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { inspectPdf, mergeDocuments } from "../packages/pdf-engine/src/pdf.ts";
import { splitDocuments } from "../packages/pdf-engine/src/splitDocuments.ts";

const require = createRequire(new URL("../packages/pdf-engine/package.json", import.meta.url));
const { PDFDocument, PDFName, PDFRef } = require("pdf-lib");

const danglingStructure = async (configure = () => {}) => {
  const document = await PDFDocument.create();
  const page = document.addPage([300, 400]);
  page.drawText("Synthetic page content");
  configure(document, page);
  document.catalog.set(
    PDFName.of("StructTreeRoot"),
    document.context.register(
      document.context.obj({ Type: "StructTreeRoot", IDTree: PDFRef.of(9999) }),
    ),
  );
  return {
    id: "synthetic",
    name: "synthetic.pdf",
    blob: new Blob([await document.save()]),
  };
};

const rejectInEveryOperation = async (input, expected) => {
  await assert.rejects(inspectPdf(input), expected);
  await assert.rejects(
    mergeDocuments({ inputs: [input], acknowledged: true }, () => {}),
    expected,
  );
  await assert.rejects(
    splitDocuments(
      { input, selection: { mode: "selected", pages: [1] }, acknowledged: true },
      () => {},
    ),
    expected,
  );
};

test("supported forms with dangling accessibility references are prepared for all PDF operations", async () => {
  const input = await danglingStructure((document, page) => {
    const field = document.getForm().createTextField("syntheticField");
    field.setText("Synthetic value");
    field.addToPage(page);
  });
  assert.equal((await inspectPdf(input)).hasEditableForms, true);
  await mergeDocuments({ inputs: [input], acknowledged: true }, () => {});
  await splitDocuments(
    { input, selection: { mode: "selected", pages: [1] }, acknowledged: true },
    () => {},
  );
});

test("XFA and detached fields remain unsupported when other object references are missing", async () => {
  for (const configure of [
    (document) => {
      document.catalog.set(PDFName.of("AcroForm"), document.context.obj({ XFA: [] }));
    },
    (document) => {
      document.context.register(document.context.obj({ FT: "Tx" }));
    },
  ]) {
    await rejectInEveryOperation(await danglingStructure(configure), {
      code: "unsupported",
      message: /Interactive form fields|Form fields cannot be associated/,
    });
  }
});

test("signatures take precedence over forms and missing references without allowing output", async () => {
  const input = await danglingStructure((document, page) => {
    document.getForm().createTextField("syntheticField").addToPage(page);
    document.context.register(document.context.obj({ Type: "Sig", ByteRange: [0, 1, 2, 3] }));
  });
  await rejectInEveryOperation(input, {
    code: "unsupported",
    message: /Digital signatures detected/,
  });
});

test("missing references still reject otherwise supported documents rather than being silently dropped", async () => {
  await rejectInEveryOperation(await danglingStructure(), {
    code: "invalid",
    message: /A required PDF object is missing/,
  });
});
