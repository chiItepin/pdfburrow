import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { loadValidatedPdf } from "../packages/pdf-engine/src/pdf.ts";
import { formHandlingPolicies } from "../packages/pdf-engine/src/preparePdfDocument.ts";

const require = createRequire(new URL("../packages/pdf-engine/package.json", import.meta.url));
const { PDFDocument, PDFDict, PDFName, PDFRef } = require("pdf-lib");

const inputFor = async (kind) => {
  const document = await PDFDocument.create();
  const page = document.addPage([400, 500]);
  page.drawText("Ordinary page content", { x: 30, y: 450 });
  if (kind === "form" || kind === "xfa") {
    const field = document.getForm().createTextField("name");
    field.setText("Current value");
    field.addToPage(page, { x: 30, y: 350, width: 280, height: 30 });
    document.catalog.set(
      PDFName.of("StructTreeRoot"),
      document.context.obj({ Type: "StructTreeRoot", IDTree: PDFRef.of(9999) }),
    );
    if (kind === "xfa") {
      document.catalog
        .lookup(PDFName.of("AcroForm"), PDFDict)
        .set(PDFName.of("XFA"), document.context.obj([]));
    }
  }
  if (kind === "missing-content") {
    page.node.set(PDFName.of("Contents"), PDFRef.of(8888));
  }
  if (kind === "missing-resource") {
    page.node
      .Resources()
      .lookup(PDFName.of("Font"), PDFDict)
      .set(PDFName.of("Missing"), PDFRef.of(8888));
  }
  return {
    id: kind,
    name: `${kind}.pdf`,
    blob: new Blob([await document.save({ updateFieldAppearances: false })]),
  };
};

const expectations = {
  preserve: { accepts: "form", rejects: "xfa", message: /XFA/ },
  reject: { accepts: "flat", rejects: "form", message: /Interactive form fields/ },
  fill: { accepts: "form", rejects: "flat", message: /No supported fillable fields/ },
};

test("every preparation policy has explicit acceptance and rejection expectations", () => {
  assert.deepEqual(
    Object.keys(expectations).sort(),
    [...formHandlingPolicies].sort(),
    "A new preparation policy must declare both compatibility outcomes.",
  );
});

for (const [policy, expected] of Object.entries(expectations)) {
  test(`${policy} preparation accepts its supported Input without changing original bytes`, async () => {
    const input = await inputFor(expected.accepts);
    const original = new Uint8Array(await input.blob.arrayBuffer());
    const { document, info } = await loadValidatedPdf(input, {}, policy);
    assert.equal(info.pageCount, 1);
    assert.equal(document.getPageCount(), 1);
    assert.equal(Boolean(info.hasEditableForms), expected.accepts === "form");
    if (expected.accepts === "form") {
      assert.equal(document.getForm().getTextField("name").getText(), "Current value");
      assert.equal(document.catalog.has(PDFName.of("StructTreeRoot")), false);
      assert.ok(info.warnings.some((warning) => /accessibility.*not preserved/.test(warning)));
    }
    assert.deepEqual(new Uint8Array(await input.blob.arrayBuffer()), original);
  });

  test(`${policy} preparation rejects unsupported Input explicitly`, async () => {
    await assert.rejects(loadValidatedPdf(await inputFor(expected.rejects), {}, policy), {
      code: "unsupported",
      message: expected.message,
    });
  });

  for (const kind of ["missing-content", "missing-resource"]) {
    test(`${policy} preparation rejects ${kind}`, async () => {
      await assert.rejects(loadValidatedPdf(await inputFor(kind), {}, policy), {
        code: "invalid",
        message: /required PDF object is missing/,
      });
    });
  }
}
