import { PDFArray, PDFDict, PDFHexString, PDFName, PDFNumber, PDFString } from "pdf-lib";
import type { PDFDocument } from "pdf-lib";
import { PdfError } from "./pdfError.ts";

export const inheritedFieldKeys = [
  "FT",
  "Ff",
  "V",
  "DV",
  "DA",
  "Q",
  "MaxLen",
  "Opt",
  "TI",
  "I",
  "TU",
  "TM",
];

export const assertMatchingFieldAttributes = (first: PDFDict, next: PDFDict) => {
  for (const key of inheritedFieldKeys) {
    const name = PDFName.of(key);
    const original = first.lookup(name);
    const candidate = next.lookup(name);
    const text = (value: typeof original) =>
      value instanceof PDFString || value instanceof PDFHexString
        ? value.decodeText()
        : value?.toString();
    if (text(original) !== text(candidate)) {
      throw new PdfError(
        "unsupported",
        "Widgets of one form field have conflicting values or settings. No flattened substitute will be generated.",
      );
    }
  }
};

export const describePdfField = (widget: PDFDict, source: PDFDocument) => {
  const parents = [widget];
  let current = widget;
  while (current.has(PDFName.of("Parent"))) {
    current = current.lookup(PDFName.of("Parent"), PDFDict);
    if (parents.includes(current)) {
      throw new PdfError("invalid", "The PDF contains cyclic form field parents.");
    }
    parents.push(current);
  }
  if (parents.some((parent) => parent.has(PDFName.of("AA")) || parent.has(PDFName.of("A")))) {
    throw new PdfError(
      "unsupported",
      "Scripted form behavior cannot be preserved safely. No flattened substitute will be generated.",
    );
  }
  const owner = parents.find((parent) => parent.has(PDFName.of("T")));
  const names = parents.flatMap((parent) => {
    const name = parent.lookup(PDFName.of("T"));
    if (name === undefined) {
      return [];
    }
    if (
      !(name instanceof PDFString || name instanceof PDFHexString) ||
      !name.decodeText() ||
      name.decodeText().includes(".")
    ) {
      throw new PdfError("invalid", "A form field has an invalid name.");
    }
    return [name.decodeText()];
  });
  if (!owner || !names.length) {
    throw new PdfError("unsupported", "Unnamed form fields cannot be preserved safely.");
  }
  const originalForm = source.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  const field = source.context.obj({ T: PDFHexString.fromText(names.reverse().join(".")) });
  for (const key of inheritedFieldKeys) {
    const name = PDFName.of(key);
    const value = parents.find((parent) => parent.has(name))?.get(name) ?? originalForm?.get(name);
    if (value !== undefined) {
      field.set(name, value);
    }
  }
  const type = field.lookup(PDFName.of("FT"))?.toString();
  const flags = field.lookupMaybe(PDFName.of("Ff"), PDFNumber)?.asNumber() ?? 0;
  if (
    !["/Tx", "/Btn", "/Ch"].includes(type ?? "") ||
    parents.some((parent) => parent.has(PDFName.of("RV"))) ||
    (type === "/Tx" && flags & ((1 << 13) | (1 << 25))) ||
    (type === "/Btn" && flags & (1 << 16)) ||
    (type === "/Ch" && (!(flags & (1 << 17)) || flags & (1 << 21)))
  ) {
    throw new PdfError(
      "unsupported",
      "This form contains field types or formatting that cannot be preserved safely. No flattened substitute will be generated.",
    );
  }
  const rectangle = widget.lookup(PDFName.of("Rect"), PDFArray);
  const bounds = rectangle
    .asArray()
    .map((value) => source.context.lookup(value, PDFNumber).asNumber());
  const [left, bottom, right, top] = bounds;
  if (
    bounds.length !== 4 ||
    bounds.some((value) => !Number.isFinite(value)) ||
    left === undefined ||
    bottom === undefined ||
    right === undefined ||
    top === undefined ||
    right <= left ||
    top <= bottom
  ) {
    throw new PdfError("invalid", "A form field has invalid dimensions. Export a new source copy.");
  }
  return { owner, field, name: names.join("."), type };
};
