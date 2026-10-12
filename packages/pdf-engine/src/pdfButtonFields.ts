import { PDFArray, PDFName } from "pdf-lib";
import type { PDFDict, PDFDocument } from "pdf-lib";
import { PdfError } from "./pdfError.ts";

export const pdfButtonOption = (
  field: PDFDict,
  owner: PDFDict,
  widget: PDFDict,
  source: PDFDocument,
) => {
  if (field.lookup(PDFName.of("FT"))?.toString() !== "/Btn") {
    return undefined;
  }
  const options = field.lookupMaybe(PDFName.of("Opt"), PDFArray);
  if (!options) {
    return undefined;
  }
  const siblings = owner.lookupMaybe(PDFName.of("Kids"), PDFArray);
  const position = siblings
    ? siblings.asArray().findIndex((ref) => source.context.lookup(ref) === widget)
    : 0;
  if (position < 0 || position >= options.size()) {
    throw new PdfError("invalid", "A form control has inconsistent export options.");
  }
  return options.get(position);
};

export const preservePdfButtonState = (original: PDFDict, field: PDFDict, widget: PDFDict) => {
  if (original.lookup(PDFName.of("FT"))?.toString() !== "/Btn" || original.has(PDFName.of("V"))) {
    return;
  }
  const state = widget.lookupMaybe(PDFName.of("AS"), PDFName);
  if (!state || state.toString() === "/Off") {
    return;
  }
  const value = field.lookupMaybe(PDFName.of("V"), PDFName);
  if (value && value !== state) {
    throw new PdfError("invalid", "A form control has conflicting selected widget states.");
  }
  field.set(PDFName.of("V"), state);
};
