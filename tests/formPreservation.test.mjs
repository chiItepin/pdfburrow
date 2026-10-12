import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { inspectPdf, mergeDocuments } from "../packages/pdf-engine/src/pdf.ts";
import { splitDocuments } from "../packages/pdf-engine/src/splitDocuments.ts";
import { inspectArtifact } from "../apps/web/tests/fixtures/pdfArtifacts.ts";

const require = createRequire(new URL("../packages/pdf-engine/package.json", import.meta.url));
const { PDFDocument, PDFName, PDFRef, PDFNumber, PDFHexString, degrees } = require("pdf-lib");

const filledInput = async (configure) => {
  const document = await PDFDocument.create();
  const page = document.addPage([400, 500]);
  page.drawText("Original content", { x: 30, y: 450 });
  await configure(document, page);
  return {
    id: "form",
    name: "form.pdf",
    blob: new Blob([await document.save({ updateFieldAppearances: false })]),
  };
};

const assertEditable = async (output) => {
  const saved = await PDFDocument.load(await output.blob.arrayBuffer());
  assert.equal(saved.catalog.has(PDFName.of("AcroForm")), true);
  for (const page of saved.getPages()) {
    assert.ok(page.node.Annots()?.size() > 0);
  }
  assert.equal(
    (await inspectPdf({ id: "output", name: "output.pdf", blob: output.blob })).hasEditableForms,
    true,
  );
  return inspectArtifact(new Uint8Array(await output.blob.arrayBuffer()), undefined, true);
};

test("a form with stale appearances and broken accessibility tags retains current editable values", async () => {
  const document = await PDFDocument.create();
  const page = document.addPage([400, 500]);
  page.drawText("Original page content", { x: 30, y: 450 });
  const field = document.getForm().createTextField("name");
  field.setText("Old value");
  field.addToPage(page, { x: 30, y: 350, width: 300, height: 40 });
  document.getForm().updateFieldAppearances();
  field.setText("Current filled value");
  document.catalog.set(
    PDFName.of("StructTreeRoot"),
    document.context.register(
      document.context.obj({ Type: "StructTreeRoot", IDTree: PDFRef.of(9999) }),
    ),
  );
  const input = {
    id: "filled-form",
    name: "filled.pdf",
    blob: new Blob([await document.save({ updateFieldAppearances: false })]),
  };
  const original = new Uint8Array(await input.blob.arrayBuffer());
  const info = await inspectPdf(input);
  assert.equal(info.pageCount, 1);
  assert.ok(info.warnings.some((warning) => /Form fields.*stay editable/.test(warning)));
  await assert.rejects(
    splitDocuments(
      { input, selection: { mode: "selected", pages: [1] }, acknowledged: false },
      () => {},
    ),
    /Acknowledge/,
  );
  const result = await splitDocuments(
    { input, selection: { mode: "selected", pages: [1] }, acknowledged: true },
    () => {},
  );
  const output = result[0];
  assert.ok(output);
  const saved = await PDFDocument.load(await output.blob.arrayBuffer());
  assert.equal(saved.catalog.has(PDFName.of("AcroForm")), true);
  assert.equal(saved.getPage(0).node.Annots()?.size() ?? 0, 1);
  assert.equal(saved.getForm().getTextField("name").getText(), "Current filled value");
  const artifact = await inspectArtifact(new Uint8Array(await output.blob.arrayBuffer()));
  assert.doesNotMatch(artifact[0].text, /Old value/);
  assert.match(artifact[0].text, /Original page content/);
  assert.deepEqual(new Uint8Array(await input.blob.arrayBuffer()), original);
});

test("visible widgets prevail over a stale catalog and detached widgets, and repeated sources keep separate values", async () => {
  const input = await filledInput((document, page) => {
    const form = document.getForm();
    const visible = form.createTextField("visible");
    visible.setText("Current visible value");
    visible.addToPage(page, { x: 30, y: 300, width: 280, height: 30 });
    const detached = form.createTextField("detached");
    detached.setText("Never displayed");
    document.catalog
      .lookup(PDFName.of("AcroForm"))
      .set(PDFName.of("Fields"), document.context.obj([detached.ref]));
  });
  const output = await mergeDocuments({ inputs: [input, input], acknowledged: true }, () => {});
  const pages = await assertEditable(output);
  const form = (await PDFDocument.load(await output.blob.arrayBuffer())).getForm();
  assert.equal(form.getTextField("visible").getText(), "Current visible value");
  assert.equal(form.getTextField("visible_2").getText(), "Current visible value");
  assert.equal(pages.length, 2);
  for (const page of pages) {
    assert.doesNotMatch(page.text, /Never displayed/);
  }
});

test("auto-fitted text retains complete values even when the previous font size would clip them", async () => {
  const input = await filledInput((document, page) => {
    const field = document.getForm().createTextField("long");
    field.addToPage(page, { x: 30, y: 300, width: 130, height: 30 });
    field.setFontSize(40);
    field.setText("Complete current filled value");
  });
  const [output] = await splitDocuments(
    { input, selection: { mode: "selected", pages: [1] }, acknowledged: true },
    () => {},
  );
  await assertEditable(output);
  const form = (await PDFDocument.load(await output.blob.arrayBuffer())).getForm();
  assert.equal(form.getTextField("long").getText(), "Complete current filled value");
});

test("checkboxes with indirect appearance dictionaries, radio choices and dropdown display labels remain visible", async () => {
  const input = await filledInput((document, page) => {
    const form = document.getForm();
    const checkbox = form.createCheckBox("checked");
    checkbox.addToPage(page, { x: 30, y: 300, width: 25, height: 25 });
    checkbox.check();
    const widget = checkbox.acroField.getWidgets()[0];
    checkbox.acroField.dict.delete(PDFName.of("V"));
    const appearances = widget.dict.lookup(PDFName.of("AP"));
    appearances.set(
      PDFName.of("N"),
      document.context.register(appearances.lookup(PDFName.of("N"))),
    );
    const radio = form.createRadioGroup("choice");
    radio.addOptionToPage("first", page, { x: 80, y: 300, width: 25, height: 25 });
    radio.addOptionToPage("second", page, { x: 120, y: 300, width: 25, height: 25 });
    radio.select("second");
    const dropdown = form.createDropdown("status");
    dropdown.addToPage(page, { x: 30, y: 200, width: 220, height: 30 });
    dropdown.acroField.dict.set(
      PDFName.of("Opt"),
      document.context.obj([
        [PDFHexString.fromText("internal-value"), PDFHexString.fromText("Approved display label")],
      ]),
    );
    dropdown.acroField.dict.set(PDFName.of("V"), PDFHexString.fromText("internal-value"));
  });
  const [output] = await splitDocuments(
    { input, selection: { mode: "selected", pages: [1] }, acknowledged: true },
    () => {},
  );
  const [page] = await assertEditable(output);
  const form = (await PDFDocument.load(await output.blob.arrayBuffer())).getForm();
  assert.equal(form.getCheckBox("checked").isChecked(), true);
  assert.equal(form.getRadioGroup("choice").getSelected(), "second");
  assert.deepEqual(form.getDropdown("status").getSelected(), ["internal-value"]);
  assert.doesNotMatch(page.text, /internal-value/);
  const dark = (left, top, width, height) => {
    let count = 0;
    for (let y = top; y < top + height; y++) {
      for (let x = left; x < left + width; x++) {
        if (page.pixels[(y * page.width + x) * 4] < 128) count++;
      }
    }
    return count;
  };
  assert.ok(dark(35, 180, 15, 15) > 20, "checkbox check mark is present");
  assert.ok(
    dark(125, 180, 15, 15) > dark(85, 180, 15, 15),
    "only the selected radio has a center mark",
  );
});

test("form normalization retains crop boxes, rotations, UserUnit and unrelated link annotations", async () => {
  const input = await filledInput((document, page) => {
    page.setCropBox(10, 20, 360, 450);
    page.setRotation(degrees(90));
    page.node.set(PDFName.of("UserUnit"), PDFNumber.of(1.25));
    const field = document.getForm().createTextField("value");
    field.setText("Retained value");
    field.addToPage(page, { x: 40, y: 250, width: 260, height: 30 });
    const link = document.context.register(
      document.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [40, 40, 80, 60],
        A: { S: "URI", URI: PDFHexString.fromText("https://example.invalid") },
      }),
    );
    page.node.addAnnot(link);
  });
  const output = await mergeDocuments({ inputs: [input], acknowledged: true }, () => {});
  const source = await PDFDocument.load(await input.blob.arrayBuffer());
  const saved = await PDFDocument.load(await output.blob.arrayBuffer());
  for (const method of ["getMediaBox", "getCropBox", "getRotation"]) {
    assert.deepEqual(saved.getPage(0)[method](), source.getPage(0)[method]());
  }
  assert.equal(saved.getPage(0).node.lookup(PDFName.of("UserUnit")).asNumber(), 1.25);
  assert.equal(saved.getPage(0).node.Annots().size(), 2);
  assert.equal(saved.getForm().getTextField("value").getText(), "Retained value");
});

test("forms do not bypass missing required content, invalid resources, encryption, signatures or unsupported field variants", async () => {
  for (const configure of [
    (document, page) => page.node.set(PDFName.of("Contents"), PDFRef.of(9999)),
    (document, page) =>
      page.node
        .Resources()
        .set(PDFName.of("XObject"), document.context.obj({ Missing: PDFRef.of(9999) })),
    (document) =>
      document.context.register(document.context.obj({ Type: "Sig", ByteRange: [0, 1, 2, 3] })),
    (document) =>
      document.catalog
        .lookup(PDFName.of("AcroForm"))
        .set(PDFName.of("XFA"), document.context.obj([])),
    (document) => {
      document.context.trailerInfo.Encrypt = document.context.register(
        document.context.obj({ Filter: "Standard", V: 1, R: 2 }),
      );
    },
    (document, page, field) => field.enablePassword(),
    (document, page, field) => field.enableRichFormatting(),
    (document, page, field) => field.setText("\u4e2d\u6587"),
    (document, page, field) => field.acroField.dict.set(PDFName.of("Parent"), field.ref),
    (document, page, field) =>
      field.acroField
        .getWidgets()[0]
        .dict.set(PDFName.of("Rect"), document.context.obj([0, 0, -10, 30])),
    (document, page, field) =>
      field.acroField.dict.set(
        PDFName.of("AA"),
        document.context.obj({ K: { S: "JavaScript", JS: PDFHexString.fromText("return true;") } }),
      ),
  ]) {
    const input = await filledInput((document, page) => {
      const field = document.getForm().createTextField("value");
      field.addToPage(page, { x: 40, y: 250, width: 260, height: 30 });
      field.setText("Current value");
      configure(document, page, field);
    });
    await assert.rejects(inspectPdf(input));
    await assert.rejects(mergeDocuments({ inputs: [input], acknowledged: true }, () => {}));
    await assert.rejects(
      splitDocuments(
        { input, selection: { mode: "selected", pages: [1] }, acknowledged: true },
        () => {},
      ),
    );
  }
});
