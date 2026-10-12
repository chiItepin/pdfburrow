import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { splitDocuments } from "../packages/pdf-engine/src/splitDocuments.ts";

const require = createRequire(new URL("../packages/pdf-engine/package.json", import.meta.url));
const { PDFDocument, PDFHexString, PDFName, PDFNumber } = require("pdf-lib");

const exportSelection = async (source, selection) => {
  const input = { id: "controls", name: "controls.pdf", blob: new Blob([await source.save()]) };
  const [output] = await splitDocuments({ input, selection, acknowledged: true }, () => {});
  return PDFDocument.load(await output.blob.arrayBuffer());
};

test("radio subsets retain export values and editability when options are reordered, repeated or omitted", async () => {
  const source = await PDFDocument.create();
  const radio = source.getForm().createRadioGroup("answers.choice");
  for (const value of ["one", "two", "three"]) {
    radio.addOptionToPage(value, source.addPage(), { x: 40, y: 200, width: 25, height: 25 });
  }
  radio.select("two");
  const document = await exportSelection(source, {
    mode: "ranges",
    ranges: [
      { start: 3, end: 3 },
      { start: 2, end: 2 },
      { start: 3, end: 3 },
    ],
    combined: true,
  });
  const field = document.getForm().getRadioGroup("answers.choice");
  assert.deepEqual(field.getOptions(), ["three", "two", "three"]);
  assert.equal(field.getSelected(), "two");
  field.select("three");
  const saved = await PDFDocument.load(await document.save());
  const retained = saved.getForm().getRadioGroup("answers.choice");
  assert.equal(retained.getSelected(), "three");
  const pages = saved.getPages();
  const widgets = retained.acroField.getWidgets();
  assert.equal(new Set(widgets.map((widget) => saved.context.getObjectRef(widget.dict))).size, 3);
  widgets.forEach((widget, index) => assert.equal(widget.P(), pages[index].ref));
  const withoutSelected = await exportSelection(source, { mode: "selected", pages: [1, 3] });
  const remaining = withoutSelected.getForm().getRadioGroup("answers.choice");
  assert.deepEqual(remaining.getOptions(), ["one", "three"]);
  assert.equal(
    remaining.acroField.dict.get(PDFName.of("V")).toString(),
    radio.acroField.dict.get(PDFName.of("V")).toString(),
  );
  remaining.select("one");
  const edited = await PDFDocument.load(await withoutSelected.save());
  assert.equal(edited.getForm().getRadioGroup("answers.choice").getSelected(), "one");
});

test("editable export keeps read-only and hidden flags rather than unlocking or exposing those fields", async () => {
  const source = await PDFDocument.create();
  const field = source.getForm().createTextField("restricted");
  field.setText("Restricted value");
  field.enableReadOnly();
  field.addToPage(source.addPage());
  field.acroField.getWidgets()[0].dict.set(PDFName.of("F"), PDFNumber.of(2));
  const document = await exportSelection(source, { mode: "selected", pages: [1] });
  const result = document.getForm().getTextField("restricted");
  assert.equal(result.isReadOnly(), true);
  assert.equal(result.acroField.getWidgets()[0].dict.lookup(PDFName.of("F")).asNumber(), 2);
});

test("shared checkbox widgets and dropdown export/display options remain editable after export", async () => {
  const source = await PDFDocument.create();
  const checkbox = source.getForm().createCheckBox("confirmed");
  const dropdown = source.getForm().createDropdown("status");
  for (const page of [source.addPage(), source.addPage()]) {
    checkbox.addToPage(page, { x: 30, y: 200, width: 25, height: 25 });
    dropdown.addToPage(page, { x: 30, y: 100, width: 200, height: 30 });
  }
  checkbox.check();
  const options = source.context.obj([
    [PDFHexString.fromText("accepted"), PDFHexString.fromText("Approved")],
    [PDFHexString.fromText("declined"), PDFHexString.fromText("Rejected")],
  ]);
  dropdown.acroField.dict.set(PDFName.of("Opt"), options);
  dropdown.select("accepted");
  const document = await exportSelection(source, { mode: "selected", pages: [2, 1] });
  const form = document.getForm();
  const retained = form.getCheckBox("confirmed");
  assert.equal(retained.isChecked(), true);
  assert.equal(retained.acroField.getWidgets().length, 2);
  retained.uncheck();
  form.getDropdown("status").select("declined");
  const saved = await PDFDocument.load(await document.save());
  const savedCheckbox = saved.getForm().getCheckBox("confirmed");
  assert.equal(savedCheckbox.isChecked(), false);
  assert.ok(
    savedCheckbox.acroField
      .getWidgets()
      .every((widget) => widget.getAppearanceState().toString() === "/Off"),
  );
  const savedDropdown = saved.getForm().getDropdown("status");
  assert.deepEqual(savedDropdown.getSelected(), ["declined"]);
  assert.deepEqual(
    savedDropdown.acroField
      .getOptions()
      .map((option) => [option.value.decodeText(), option.display.decodeText()]),
    [
      ["accepted", "Approved"],
      ["declined", "Rejected"],
    ],
  );
});
