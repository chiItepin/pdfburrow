import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { fillPdfForm, inspectFillablePdf } from "../packages/pdf-engine/src/fillForm.ts";
import { inspectPdf, mergeDocuments, preparePdfCopy } from "../packages/pdf-engine/src/pdf.ts";
import { inspectMarkupPdf } from "../packages/pdf-engine/src/markupDocuments.ts";
import { splitDocuments } from "../packages/pdf-engine/src/splitDocuments.ts";
import { createCompatibilityForm } from "../apps/web/tests/fixtures/formCompatibility.ts";
import { inspectArtifact } from "../apps/web/tests/fixtures/pdfArtifacts.ts";

const require = createRequire(new URL("../packages/pdf-engine/package.json", import.meta.url));
const { PDFDocument, PDFDict, PDFName, PDFRef } = require("pdf-lib");
const inputFor = async (document) => ({
  id: "compatibility",
  name: "compatibility.pdf",
  blob: new Blob([await document.save({ updateFieldAppearances: false })]),
});
const requestFor = (input, info) => ({
  input,
  acknowledged: true,
  flatten: false,
  values: info.fields.map(({ name, value }) => ({ name, value })),
});

test("the stale-catalog fixture contains conflicting catalog and visible-widget values", async () => {
  const input = await inputFor(await createCompatibilityForm());
  const source = await PDFDocument.load(await input.blob.arrayBuffer());
  const catalogField = source.getForm().getTextField("Name");
  assert.equal(catalogField.getText(), "Stale catalog value");
  const widget = source.getPage(0).node.Annots().lookup(0, PDFDict);
  const visibleField = widget.lookup(PDFName.of("Parent"), PDFDict);
  assert.notEqual(visibleField, catalogField.acroField.dict);
  assert.equal(visibleField.lookup(PDFName.of("V")).decodeText(), "Current value");
  const prepared = await inspectFillablePdf(input);
  assert.equal(prepared.fields.find((field) => field.name === "Name").value, "Current value");
});

for (const feature of ["brokenTags", "staleCatalog", "alternateCheckboxes"]) {
  test(`filling shares page-tool preparation for ${feature}`, async () => {
    const input = await inputFor(
      await createCompatibilityForm({
        brokenTags: false,
        staleCatalog: false,
        alternateCheckboxes: false,
        [feature]: true,
      }),
    );
    assert.equal((await inspectPdf(input)).pageCount, 2);
    const info = await inspectFillablePdf(input);
    assert.equal(info.fields.find((field) => field.name === "Name").value, "Current value");
    const output = await fillPdfForm(requestFor(input, info), () => {});
    const reopened = await inspectFillablePdf({ ...input, blob: output.blob });
    assert.deepEqual(reopened.fields, info.fields);
  });
}

test("preview preparation, merge, extract, remove and filling retain the same visible form", async () => {
  const input = await inputFor(await createCompatibilityForm());
  const original = new Uint8Array(await input.blob.arrayBuffer());
  const background = await inspectArtifact(original);
  const info = await inspectFillablePdf(input);
  assert.equal(info.fields.length, 2);
  assert.ok(info.warnings.some((warning) => /accessibility.*not preserved/i.test(warning)));
  const request = requestFor(input, info);
  const outputs = [
    await preparePdfCopy(input),
    await mergeDocuments({ inputs: [input], acknowledged: true }, () => {}),
    ...(await splitDocuments(
      { input, selection: { mode: "selected", pages: [1, 2] }, acknowledged: true },
      () => {},
    )),
    ...(await splitDocuments(
      { input, selection: { mode: "remove", pages: [2] }, acknowledged: true },
      () => {},
    )),
    await fillPdfForm(request, () => {}),
  ];
  for (const [index, output] of outputs.entries()) {
    const parsed = await PDFDocument.load(await output.blob.arrayBuffer());
    assert.equal(parsed.getPageCount(), index === 3 ? 1 : 2);
    assert.equal(parsed.getForm().getTextField("Name").getText(), "Current value");
    assert.equal(parsed.getForm().getCheckBox("Response").acroField.getValue().decodeText(), "No");
    assert.equal(parsed.catalog.has(PDFName.of("StructTreeRoot")), false);
    const reopened = await inspectFillablePdf({ ...input, blob: output.blob });
    assert.deepEqual(reopened.fields, info.fields);
    const artifact = await inspectArtifact(new Uint8Array(await output.blob.arrayBuffer()));
    for (const [page, rendered] of artifact.entries()) {
      assert.equal(rendered.text, background[page].text);
      assert.ok(rendered.pixels.equals(background[page].pixels));
    }
    await assert.rejects(inspectMarkupPdf({ ...input, blob: output.blob }), /form fields/i);
  }
  const flattened = await fillPdfForm({ ...request, flatten: true }, () => {});
  assert.equal((await inspectMarkupPdf({ ...input, blob: flattened.blob })).pageCount, 2);
  const filledPixels = await inspectArtifact(
    new Uint8Array(await outputs.at(-1).blob.arrayBuffer()),
    undefined,
    true,
  );
  const flatPixels = await inspectArtifact(new Uint8Array(await flattened.blob.arrayBuffer()));
  for (const [index, page] of flatPixels.entries()) {
    assert.ok(page.pixels.equals(filledPixels[index].pixels));
  }
  assert.deepEqual(new Uint8Array(await input.blob.arrayBuffer()), original);
});

test("alternate checkbox choices can be retained, changed and cleared without changing field flags", async () => {
  const input = await inputFor(await createCompatibilityForm());
  const info = await inspectFillablePdf(input);
  const response = info.fields.find((field) => field.name === "Response");
  assert.equal(response.kind, "checkbox-group");
  assert.deepEqual(response.options, ["Yes", "No"]);
  assert.deepEqual(
    response.widgets.map((widget) => widget.option),
    ["Yes", "No"],
  );
  assert.equal(response.value, "No");
  for (const value of ["Yes", "No", ""]) {
    const request = requestFor(input, info);
    request.values.find((field) => field.name === "Response").value = value;
    const output = await fillPdfForm(request, () => {});
    const form = (await PDFDocument.load(await output.blob.arrayBuffer())).getForm();
    const checkbox = form.getCheckBox("Response");
    assert.equal(checkbox.acroField.getFlags(), 0);
    assert.equal(checkbox.acroField.getValue().decodeText(), value || "Off");
    assert.deepEqual(
      checkbox.acroField.getWidgets().map((widget) => widget.getAppearanceState().decodeText()),
      ["Yes", "No"].map((option) => (option === value ? option : "Off")),
    );
    const reopened = await inspectFillablePdf({ ...input, blob: output.blob });
    assert.equal(reopened.fields.find((field) => field.name === "Response").value, value);
  }
  for (const value of ["unknown", true]) {
    const request = requestFor(input, info);
    request.values.find((field) => field.name === "Response").value = value;
    await assert.rejects(
      fillPdfForm(request, () => {}),
      /existing checkbox option/i,
    );
  }
});

test("repeated checkbox options share one value and read-only choice groups cannot change", async () => {
  const document = await createCompatibilityForm({ staleCatalog: false });
  const checkbox = document.getForm().getCheckBox("Response");
  checkbox.addToPage(document.getPage(1), { x: 30, y: 250, width: 25, height: 25 });
  const input = await inputFor(document);
  const info = await inspectFillablePdf(input);
  const response = info.fields.find((field) => field.name === "Response");
  assert.deepEqual(response.options, ["Yes", "No"]);
  assert.deepEqual(
    response.widgets.map((widget) => widget.option),
    ["Yes", "No", "Yes"],
  );
  const request = requestFor(input, info);
  request.values.find((field) => field.name === "Response").value = "Yes";
  const output = await fillPdfForm(request, () => {});
  const saved = await PDFDocument.load(await output.blob.arrayBuffer());
  const field = saved.getForm().getCheckBox("Response");
  assert.deepEqual(
    field.acroField.getWidgets().map((widget) => widget.getAppearanceState().decodeText()),
    ["Yes", "Off", "Yes"],
  );
  field.enableReadOnly();
  const locked = await inputFor(saved);
  const lockedInfo = await inspectFillablePdf(locked);
  const change = requestFor(locked, lockedInfo);
  change.values.find((entry) => entry.name === "Response").value = "No";
  await assert.rejects(
    fillPdfForm(change, () => {}),
    /read-only/,
  );
  await fillPdfForm(requestFor(locked, lockedInfo), () => {});
});

test("shared normalization does not hide orphan fields or multiply a source widget", async () => {
  const orphaned = await createCompatibilityForm({ staleCatalog: false });
  orphaned.getForm().createTextField("Invisible");
  const orphanInput = await inputFor(orphaned);
  await assert.rejects(inspectFillablePdf(orphanInput), /without visible page controls/);
  await inspectPdf(orphanInput);
  const duplicated = await createCompatibilityForm({ staleCatalog: false });
  duplicated
    .getPage(1)
    .node.set(
      PDFName.of("Annots"),
      duplicated.context.obj([duplicated.getPage(0).node.Annots().get(0)]),
    );
  const duplicateInput = await inputFor(duplicated);
  for (const inspect of [inspectPdf, inspectFillablePdf]) {
    await assert.rejects(inspect(duplicateInput), /assigned to more than one page/);
  }
});

test("optional-tag tolerance never permits missing page content or font resources", async () => {
  for (const target of ["Contents", "Font"]) {
    const document = await createCompatibilityForm();
    const page = document.getPage(0);
    if (target === "Contents") {
      page.node.set(PDFName.of("Contents"), PDFRef.of(8888));
    } else {
      page.node.Resources().lookup(PDFName.of("Font")).set(PDFName.of("Missing"), PDFRef.of(8888));
    }
    const input = await inputFor(document);
    for (const inspect of [inspectPdf, inspectFillablePdf, preparePdfCopy]) {
      await assert.rejects(inspect(input), /required.*(missing|invalid)/i);
    }
    await assert.rejects(
      mergeDocuments({ inputs: [input], acknowledged: true }, () => {}),
      /required.*missing/i,
    );
    await assert.rejects(
      splitDocuments(
        { input, selection: { mode: "selected", pages: [1] }, acknowledged: true },
        () => {},
      ),
      /required.*missing/i,
    );
  }
});
