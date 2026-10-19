import { PDFDocument, PDFHexString, PDFName, degrees } from "pdf-lib";

export const createFillableForm = async (scripted = false) => {
  const document = await PDFDocument.create();
  const page = document.addPage([600, 800]);
  const form = document.getForm();
  const text = form.createTextField("Full name");
  text.enableRequired();
  text.setMaxLength(40);
  text.addToPage(page, { x: 40, y: 660, width: 340, height: 30 });
  const notes = form.createTextField("Notes");
  notes.enableMultiline();
  notes.addToPage(page, { x: 40, y: 530, width: 340, height: 90 });
  const check = form.createCheckBox("I agree");
  check.addToPage(page, { x: 40, y: 470, width: 20, height: 20 });
  const radio = form.createRadioGroup("Delivery");
  radio.addOptionToPage("Email", page, { x: 40, y: 400, width: 20, height: 20 });
  radio.addOptionToPage("Post", page, { x: 160, y: 400, width: 20, height: 20 });
  const dropdown = form.createDropdown("Status");
  dropdown.acroField.dict.set(
    PDFName.of("Opt"),
    document.context.obj([
      [PDFHexString.fromText("a"), PDFHexString.fromText("Accepted")],
      [PDFHexString.fromText("r"), PDFHexString.fromText("Rejected")],
    ]),
  );
  dropdown.addToPage(page, { x: 40, y: 320, width: 200, height: 30 });
  const reference = form.createTextField("Reference");
  reference.setText("REF-123");
  reference.enableReadOnly();
  reference.addToPage(page, { x: 40, y: 240, width: 200, height: 30 });
  page.drawText("Application form", { x: 40, y: 750, size: 24 });
  for (const [label, y] of [
    ["Full name", 700],
    ["Notes", 630],
    ["Delivery", 435],
    ["Status", 360],
    ["Reference", 280],
  ] as const) {
    page.drawText(label, { x: 40, y, size: 12 });
  }
  page.drawText("I agree", { x: 75, y: 475, size: 12 });
  page.drawText("Email", { x: 70, y: 405, size: 12 });
  page.drawText("Post", { x: 190, y: 405, size: 12 });
  const second = document.addPage([600, 800]);
  second.setRotation(degrees(90));
  second.drawText("Shared name", { x: 40, y: 700, size: 12 });
  text.addToPage(second, { x: 40, y: 650, width: 340, height: 30 });
  if (scripted) {
    text.acroField.dict.set(
      PDFName.of("AA"),
      document.context.obj({
        K: { S: "JavaScript", JS: PDFHexString.fromText("event.value = 'changed'") },
      }),
    );
  }
  return Buffer.from(await document.save());
};
