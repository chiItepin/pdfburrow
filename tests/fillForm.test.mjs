import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { fillPdfForm, inspectFillablePdf } from "../packages/pdf-engine/src/fillForm.ts";
import { inspectMarkupPdf } from "../packages/pdf-engine/src/markupDocuments.ts";

const require = createRequire(new URL("../packages/pdf-engine/package.json", import.meta.url));
const { PDFDocument, PDFName, PDFDict, PDFHexString, PDFNumber, degrees } = require("pdf-lib");
const fixture = async (configure = () => {}) => {
  const document = await PDFDocument.create();
  const page = document.addPage([600, 800]);
  page.drawText("Application form", { x: 40, y: 760, size: 16 });
  const form = document.getForm();
  const text = form.createTextField("applicant.name");
  text.setMaxLength(40);
  text.enableRequired();
  text.setText("Original");
  text.addToPage(page, { x: 40, y: 650, width: 250, height: 30 });
  const notes = form.createTextField("notes");
  notes.enableMultiline();
  notes.addToPage(page, { x: 40, y: 540, width: 250, height: 80 });
  const check = form.createCheckBox("consent");
  check.addToPage(page, { x: 40, y: 500, width: 20, height: 20 });
  const radio = form.createRadioGroup("delivery");
  radio.addOptionToPage("email", page, { x: 40, y: 450, width: 20, height: 20 });
  radio.addOptionToPage("post", page, { x: 100, y: 450, width: 20, height: 20 });
  const dropdown = form.createDropdown("status");
  dropdown.acroField.dict.set(
    PDFName.of("Opt"),
    document.context.obj([
      [PDFHexString.fromText("a"), PDFHexString.fromText("Accepted")],
      [PDFHexString.fromText("r"), PDFHexString.fromText("Rejected")],
    ]),
  );
  dropdown.select("a");
  dropdown.disableEditing();
  dropdown.addToPage(page, { x: 40, y: 400, width: 180, height: 30 });
  const locked = form.createTextField("reference");
  locked.setText("LOCKED");
  locked.enableReadOnly();
  locked.addToPage(page, { x: 40, y: 350, width: 180, height: 30 });
  await configure(document);
  return {
    id: "form",
    name: "application.pdf",
    blob: new Blob([await document.save({ updateFieldAppearances: false })]),
  };
};
const requestFor = async (input, changes = {}) => {
  const info = await inspectFillablePdf(input);
  return {
    input,
    acknowledged: true,
    flatten: false,
    values: info.fields.map(({ name, value }) => ({
      name,
      value: Object.hasOwn(changes, name) ? changes[name] : value,
    })),
  };
};

test("describes field types, constraints, labels, page controls and current values", async () => {
  const input = await fixture();
  const info = await inspectFillablePdf(input);
  assert.equal(info.fields.length, 6);
  assert.equal(info.formPages[0].width, 600);
  const text = info.fields.find((field) => field.name === "applicant.name");
  assert.equal(text.required, true);
  assert.equal(text.maxLength, 40);
  assert.equal(text.value, "Original");
  assert.equal(text.widgets[0].page, 1);
  assert.equal(info.fields.find((field) => field.name === "reference").readOnly, true);
  assert.deepEqual(info.fields.find((field) => field.name === "status").options, [
    { value: "a", label: "Accepted" },
    { value: "r", label: "Rejected" },
  ]);
});

test("saves real editable field values and preserves source bytes, flags and export options", async () => {
  const input = await fixture();
  const before = new Uint8Array(await input.blob.arrayBuffer());
  const output = await fillPdfForm(
    await requestFor(input, {
      "applicant.name": "España — café €",
      notes: "First line\nSecond line",
      consent: true,
      delivery: "post",
      status: "r",
    }),
    () => {},
  );
  assert.equal(output.suggestedFilename, "application-filled.pdf");
  const document = await PDFDocument.load(await output.blob.arrayBuffer());
  const form = document.getForm();
  assert.equal(form.getTextField("applicant.name").getText(), "España — café €");
  assert.equal(form.getTextField("applicant.name").getMaxLength(), 40);
  assert.equal(form.getTextField("applicant.name").isRequired(), true);
  assert.equal(form.getTextField("notes").getText(), "First line\nSecond line");
  assert.equal(form.getCheckBox("consent").isChecked(), true);
  assert.equal(form.getRadioGroup("delivery").getSelected(), "post");
  assert.deepEqual(form.getDropdown("status").getSelected(), ["r"]);
  assert.equal(form.getDropdown("status").isEditable(), false);
  await inspectFillablePdf({ ...input, blob: output.blob });
  assert.equal(form.getTextField("reference").isReadOnly(), true);
  form.getTextField("applicant.name").setText("Recipient edit");
  const saved = await PDFDocument.load(await document.save());
  assert.equal(saved.getForm().getTextField("applicant.name").getText(), "Recipient edit");
  assert.deepEqual(new Uint8Array(await input.blob.arrayBuffer()), before);
});

test("only explicit flattening removes fields and produces a markup-compatible PDF", async () => {
  const input = await fixture();
  const request = await requestFor(input, {
    "applicant.name": "Completed",
    consent: true,
    delivery: "email",
  });
  const editable = await fillPdfForm(request, () => {});
  await assert.rejects(inspectMarkupPdf({ ...input, blob: editable.blob }), /form fields/i);
  const flattened = await fillPdfForm({ ...request, flatten: true }, () => {});
  const document = await PDFDocument.load(await flattened.blob.arrayBuffer());
  assert.equal(document.getForm().getFields().length, 0);
  assert.equal(document.getPage(0).node.Annots()?.size() ?? 0, 0);
  assert.equal((await inspectMarkupPdf({ ...input, blob: flattened.blob })).pageCount, 1);
});

test("incomplete required fields can be saved; length, read-only, option and encoding violations cannot", async () => {
  const input = await fixture();
  await fillPdfForm(await requestFor(input, { "applicant.name": "" }), () => {});
  for (const [changes, pattern] of [
    [{ "applicant.name": "x".repeat(41) }, /at most 40/],
    [{ reference: "changed" }, /read-only/],
    [{ status: "unknown" }, /existing dropdown/],
    [{ delivery: "unknown" }, /existing radio/],
    [{ consent: "true" }, /checked or unchecked/],
    [{ "applicant.name": "中文" }, /not supported by the local form font/],
    [{ "applicant.name": "Two\nLines" }, /control characters/],
  ]) {
    await assert.rejects(
      fillPdfForm(await requestFor(input, changes), () => {}),
      pattern,
    );
  }
  const request = await requestFor(input);
  await assert.rejects(
    fillPdfForm({ ...request, values: request.values.slice(1) }, () => {}),
    /missing/,
  );
  await assert.rejects(
    fillPdfForm({ ...request, values: [...request.values, request.values[0]] }, () => {}),
    /do not match/,
  );
  await assert.rejects(
    fillPdfForm({ ...request, acknowledged: false }, () => {}),
    /acknowledge/,
  );
  await assert.rejects(
    fillPdfForm({ ...request, limits: { outputBytes: 1 } }, () => {}),
    /Output bytes/,
  );
});

test("unsupported form behavior is rejected during validation, not silently flattened", async () => {
  for (const [configure, pattern] of [
    [
      (doc) =>
        doc.catalog
          .lookup(PDFName.of("AcroForm"), PDFDict)
          .set(PDFName.of("XFA"), doc.context.obj([])),
      /XFA/,
    ],
    [
      (doc) =>
        doc.catalog
          .lookup(PDFName.of("AcroForm"), PDFDict)
          .set(PDFName.of("CO"), doc.context.obj([doc.getForm().getField("notes").ref])),
      /Calculated/,
    ],
    [
      (doc) =>
        doc.getForm().getField("notes").acroField.dict.set(PDFName.of("AA"), doc.context.obj({})),
      /Scripted/,
    ],
    [
      (doc) =>
        doc.getForm().getField("notes").acroField.dict.set(PDFName.of("FT"), PDFName.of("Sig")),
      /Digital signatures/,
    ],
    [
      (doc) =>
        doc
          .getForm()
          .getField("notes")
          .acroField.getWidgets()[0]
          .dict.set(PDFName.of("F"), PDFNumber.of(2)),
      /Hidden or nonprinting/,
    ],
    [(doc) => doc.getForm().createTextField("orphan"), /without visible/],
    [(doc) => doc.getForm().getDropdown("status").enableEditing(), /custom options/],
    [
      (doc) =>
        doc
          .getPage(0)
          .node.Annots()
          .push(
            doc.context.register(
              doc.context.obj({ Type: "Annot", Subtype: "Link", Rect: [0, 0, 10, 10] }),
            ),
          ),
      /annotations or links/,
    ],
  ]) {
    await assert.rejects(inspectFillablePdf(await fixture(configure)), pattern);
  }
});

test("shared widgets retain one field value across cropped, rotated and UserUnit pages", async () => {
  const input = await fixture((doc) => {
    const page = doc.addPage([600, 800]);
    page.setCropBox(20, 20, 550, 750);
    page.setRotation(degrees(90));
    page.node.set(PDFName.of("UserUnit"), PDFNumber.of(2));
    doc
      .getForm()
      .getTextField("applicant.name")
      .addToPage(page, { x: 40, y: 600, width: 250, height: 30 });
  });
  const info = await inspectFillablePdf(input);
  const widgets = info.fields.find((field) => field.name === "applicant.name").widgets;
  assert.equal(widgets.length, 2);
  assert.equal(widgets[1].rotation, 90);
  assert.equal(widgets[1].page, 2);
  const output = await fillPdfForm(
    await requestFor(input, { "applicant.name": "Shared edit" }),
    () => {},
  );
  const document = await PDFDocument.load(await output.blob.arrayBuffer());
  assert.equal(document.getForm().getTextField("applicant.name").acroField.getWidgets().length, 2);
  assert.equal(document.getPage(1).getRotation().angle, 90);
});
