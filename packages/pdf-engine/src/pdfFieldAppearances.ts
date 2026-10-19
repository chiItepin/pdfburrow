import { PDFDropdown, PDFHexString, PDFName, PDFTextField } from "pdf-lib";
import type { PDFDocument } from "pdf-lib";

export const updatePdfFieldAppearances = (document: PDFDocument) => {
  const form = document.getForm();
  const font = form.getDefaultFont();
  for (const field of form.getFields()) {
    if (field instanceof PDFTextField || field instanceof PDFDropdown) {
      field.acroField.setDefaultAppearance(
        `${field.acroField.getDefaultAppearance() ?? ""}\n/${font.name} 0 Tf`,
      );
    }
    // The appearance uses the display label; /V must keep the recipient's export value.
    if (field instanceof PDFDropdown) {
      const value = field.acroField.dict.get(PDFName.of("V"));
      const option = field.acroField
        .getOptions()
        .find((item) => item.value.decodeText() === field.getSelected()[0]);
      try {
        if (option?.display) {
          field.acroField.dict.set(
            PDFName.of("V"),
            PDFHexString.fromText(option.display.decodeText()),
          );
        }
        field.defaultUpdateAppearances(font);
      } finally {
        if (value) {
          field.acroField.dict.set(PDFName.of("V"), value);
        } else {
          field.acroField.dict.delete(PDFName.of("V"));
        }
      }
    } else {
      field.defaultUpdateAppearances(font);
    }
  }
};
