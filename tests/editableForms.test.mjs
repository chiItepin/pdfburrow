import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { splitDocuments } from "../packages/pdf-engine/src/splitDocuments.ts";
import { inspectPdf, mergeDocuments } from "../packages/pdf-engine/src/pdf.ts";
import { inspectArtifact } from "../apps/web/tests/fixtures/pdfArtifacts.ts";

const require = createRequire(new URL("../packages/pdf-engine/package.json", import.meta.url));
const { PDFDict, PDFDocument, PDFHexString, PDFName } = require("pdf-lib");

test("splitting preserves editable field values and shared widgets on selected pages", async () => {
  const document = await PDFDocument.create();
  const pages = [document.addPage(), document.addPage(), document.addPage()];
  const field = document.getForm().createTextField("claim.name");
  field.setText("Current value");
  for (const page of pages) {
    field.addToPage(page, { x: 30, y: 400, width: 200, height: 30 });
  }
  const input = { id: "form", name: "form.pdf", blob: new Blob([await document.save()]) };
  const [output] = await splitDocuments(
    { input, selection: { mode: "selected", pages: [3, 1] }, acknowledged: true },
    () => {},
  );
  const saved = await PDFDocument.load(await output.blob.arrayBuffer());
  const retained = saved.getForm().getTextField("claim.name");
  assert.equal(retained.getText(), "Current value");
  assert.equal(retained.acroField.getWidgets().length, 2);
  assert.equal(retained.acroField.dict.lookup(PDFName.of("T")).decodeText(), "name");
  assert.equal(
    retained.acroField.dict
      .lookup(PDFName.of("Parent"), PDFDict)
      .lookup(PDFName.of("T"))
      .decodeText(),
    "claim",
  );
  retained.setText("Corrected value");
  const edited = await PDFDocument.load(await saved.save());
  assert.equal(edited.getForm().getTextField("claim.name").getText(), "Corrected value");
});

const fixture = async (value = "Current value") => {
  const document = await PDFDocument.create();
  const pages = Array.from({ length: 3 }, (_, index) => {
    const page = document.addPage([400 + index, 500]);
    page.drawText(`Base page ${index + 1}`, { x: 30, y: 450 });
    return page;
  });
  const shared = document.getForm().createTextField("claim.name");
  shared.setText(value);
  shared.acroField.dict.set(PDFName.of("DV"), PDFHexString.fromText("Default value"));
  shared.setMaxLength(80);
  for (const page of pages) {
    shared.addToPage(page, { x: 30, y: 300, width: 280, height: 30 });
  }
  const omitted = document.getForm().createTextField("only.middle");
  omitted.setText("Middle page only");
  omitted.addToPage(pages[1], { x: 30, y: 200, width: 280, height: 30 });
  return { id: value, name: "form.pdf", blob: new Blob([await document.save()]) };
};

const assertReferences = (document) => {
  const pageRefs = new Set(document.getPages().map((page) => page.ref));
  const attached = new Set(
    document.getPages().flatMap((page) => page.node.Annots()?.asArray() ?? []),
  );
  const fields = document.getForm().getFields();
  const widgets = [];
  for (const field of fields) {
    for (const widget of field.acroField.getWidgets()) {
      const ref = document.context.getObjectRef(widget.dict);
      assert.ok(attached.has(ref), "Every field widget belongs to an exported page");
      assert.ok(pageRefs.has(widget.P()), "Widget page references do not retain omitted pages");
      assert.equal(widget.dict.get(PDFName.of("Parent")), field.ref);
      widgets.push(ref);
    }
  }
  assert.equal(new Set(widgets).size, widgets.length, "Each page occurrence has its own widget");
  assert.equal(
    document.context
      .enumerateIndirectObjects()
      .filter(
        ([, object]) =>
          object instanceof PDFDict && object.lookup(PDFName.of("Type"))?.toString() === "/Page",
      ).length,
    document.getPageCount(),
    "There are no ghost pages in the output",
  );
};

test("every selection shape keeps fields editable without ghost pages, and omits fields on removed pages", async () => {
  const input = await fixture();
  for (const [selection, expected] of [
    [{ mode: "selected", pages: [3, 1] }, [[3, 1]]],
    [{ mode: "remove", pages: [2] }, [[1, 3]]],
    [
      {
        mode: "ranges",
        ranges: [
          { start: 1, end: 2 },
          { start: 2, end: 3 },
        ],
        combined: true,
      },
      [[1, 2, 2, 3]],
    ],
    [
      {
        mode: "ranges",
        ranges: [
          { start: 3, end: 3 },
          { start: 1, end: 1 },
        ],
        combined: false,
      },
      [[3], [1]],
    ],
    [{ mode: "fixed", size: 2 }, [[1, 2], [3]]],
    [{ mode: "every" }, [[1], [2], [3]]],
  ]) {
    const outputs = await splitDocuments({ input, selection, acknowledged: true }, () => {});
    assert.equal(outputs.length, expected.length);
    for (const [index, output] of outputs.entries()) {
      const document = await PDFDocument.load(await output.blob.arrayBuffer());
      const field = document.getForm().getTextField("claim.name");
      assert.equal(field.acroField.getWidgets().length, expected[index].length);
      assert.equal(field.getText(), "Current value");
      assert.equal(field.getMaxLength(), 80);
      assert.equal(field.acroField.dict.lookup(PDFName.of("DV")).decodeText(), "Default value");
      assert.equal(
        Boolean(document.getForm().getFieldMaybe("only.middle")),
        expected[index].includes(2),
      );
      assertReferences(document);
      field.setText("Edited value");
      const bytes = await document.save();
      const reopened = await PDFDocument.load(bytes);
      assert.equal(reopened.getForm().getTextField("claim.name").getText(), "Edited value");
      const artifact = await inspectArtifact(bytes, undefined, true);
      assert.equal(artifact.length, expected[index].length);
      expected[index].forEach((page, offset) =>
        assert.match(artifact[offset].text, new RegExp(`Base page ${page}`)),
      );
      await inspectPdf({ ...input, blob: new Blob([bytes]) });
    }
  }
});

test("same-named merged fields remain independent, including repeated inputs and hierarchy collisions", async () => {
  const first = await fixture("First value");
  const second = await fixture("Second value");
  const output = await mergeDocuments(
    { inputs: [first, second, first], acknowledged: true },
    () => {},
  );
  const document = await PDFDocument.load(await output.blob.arrayBuffer());
  const form = document.getForm();
  assert.equal(form.getTextField("claim.name").getText(), "First value");
  assert.equal(form.getTextField("claim_2.name").getText(), "Second value");
  assert.equal(form.getTextField("claim_3.name").getText(), "First value");
  form.getTextField("claim_2.name").setText("Changed second only");
  const saved = await PDFDocument.load(await document.save());
  assert.equal(saved.getForm().getTextField("claim.name").getText(), "First value");
  assert.equal(saved.getForm().getTextField("claim_3.name").getText(), "First value");
  assertReferences(saved);
  const flat = await PDFDocument.create();
  flat.getForm().createTextField("claim").addToPage(flat.addPage());
  const plain = { id: "flat", name: "flat.pdf", blob: new Blob([await flat.save()]) };
  const combined = await mergeDocuments({ inputs: [plain, first], acknowledged: true }, () => {});
  const combinedForm = (await PDFDocument.load(await combined.blob.arrayBuffer())).getForm();
  assert.ok(combinedForm.getTextField("claim"));
  assert.equal(combinedForm.getTextField("claim_2.name").getText(), "First value");
});

test("exporting only pages without widgets produces a plain PDF", async () => {
  const document = await PDFDocument.create();
  document.addPage().drawText("Plain page");
  document.getForm().createTextField("omitted").addToPage(document.addPage());
  const input = { id: "plain", name: "plain.pdf", blob: new Blob([await document.save()]) };
  const [output] = await splitDocuments(
    { input, selection: { mode: "selected", pages: [1] }, acknowledged: true },
    () => {},
  );
  const saved = await PDFDocument.load(await output.blob.arrayBuffer());
  assert.equal(saved.catalog.has(PDFName.of("AcroForm")), false);
  assert.equal(saved.getPageCount(), 1);
  assert.equal((await inspectPdf({ ...input, blob: output.blob })).hasEditableForms, undefined);
});
