import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef } from "pdf-lib";

export const createCompatibilityForm = async ({
  brokenTags = true,
  staleCatalog = true,
  alternateCheckboxes = true,
} = {}) => {
  const document = await PDFDocument.create();
  const page = document.addPage([400, 500]);
  page.drawText("Original page content", { x: 30, y: 450 });
  document.addPage([400, 500]).drawText("Second page", { x: 30, y: 450 });
  const form = document.getForm();
  const text = form.createTextField("Name");
  text.setText("Current value");
  text.addToPage(page, { x: 30, y: 350, width: 280, height: 30 });
  const checkbox = form.createCheckBox("Response");
  for (const [index, value] of ["Yes", alternateCheckboxes ? "No" : "Yes"].entries()) {
    checkbox.addToPage(page, { x: 30 + index * 80, y: 250, width: 25, height: 25 });
    const widget = checkbox.acroField.getWidgets()[index]!;
    for (const appearance of Object.values(widget.getAppearances() ?? {})) {
      if (appearance instanceof PDFDict && value !== "Yes") {
        appearance.set(PDFName.of(value), appearance.get(PDFName.of("Yes"))!);
        appearance.delete(PDFName.of("Yes"));
      }
    }
    widget.setAppearanceState(PDFName.of(index === 1 || !alternateCheckboxes ? value : "Off"));
    page.drawText(value, { x: 30 + index * 80, y: 290, size: 12 });
  }
  checkbox.acroField.dict.set(PDFName.of("V"), PDFName.of(alternateCheckboxes ? "No" : "Yes"));
  if (staleCatalog) {
    const catalogFields = form.getFields().map((field) => {
      const detached = field.acroField.dict.clone();
      const ref = document.context.register(detached);
      const widgets = field.acroField.getWidgets().map((widget) => {
        const copy = widget.dict.clone();
        copy.set(PDFName.of("Parent"), ref);
        return document.context.register(copy);
      });
      detached.set(PDFName.of("Kids"), document.context.obj(widgets));
      if (field === text) {
        detached.set(PDFName.of("V"), PDFHexString.fromText("Stale catalog value"));
      }
      return ref;
    });
    document.catalog
      .lookup(PDFName.of("AcroForm"), PDFDict)
      .set(PDFName.of("Fields"), document.context.obj(catalogFields));
  }
  if (brokenTags) {
    document.catalog.set(
      PDFName.of("StructTreeRoot"),
      document.context.register(
        document.context.obj({ Type: "StructTreeRoot", IDTree: PDFRef.of(9999) }),
      ),
    );
  }
  return document;
};
