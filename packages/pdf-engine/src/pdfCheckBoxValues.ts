import { PDFName } from "pdf-lib";
import type { PDFCheckBox } from "pdf-lib";
import { PdfError } from "./pdfError.ts";

export const describePdfCheckBox = (field: PDFCheckBox) => {
  const widgetOptions = field.acroField.getWidgets().map((widget) => {
    const value = widget.getOnValue()?.decodeText();
    if (!value) {
      throw new PdfError("unsupported", "A checkbox has no supported checked appearance.");
    }
    return value;
  });
  const options = [...new Set(widgetOptions)];
  const value = field.acroField.getValue().decodeText();
  if (!options.length || (value !== "Off" && !options.includes(value))) {
    throw new PdfError(
      "unsupported",
      "A checkbox's current value does not match its page controls.",
    );
  }
  return { options, widgetOptions, value: value === "Off" ? "" : value };
};

export const setPdfCheckBoxValue = (field: PDFCheckBox, value: string) => {
  const { options } = describePdfCheckBox(field);
  if (value && !options.includes(value)) {
    throw new PdfError("invalid", "Choose an existing checkbox option.");
  }
  // pdf-lib's check()/setValue() only accept the first widget's on-value.
  const selected = PDFName.of(value || "Off");
  field.acroField.dict.set(PDFName.of("V"), selected);
  for (const widget of field.acroField.getWidgets()) {
    widget.setAppearanceState(widget.getOnValue() === selected ? selected : PDFName.of("Off"));
  }
};
