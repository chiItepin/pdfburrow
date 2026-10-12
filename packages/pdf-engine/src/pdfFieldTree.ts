import { PDFArray, PDFDict, PDFHexString, PDFName, PDFRef, PDFString } from "pdf-lib";
import type { PDFDocument } from "pdf-lib";
import { PdfError } from "./pdfError.ts";

const partialName = (field: PDFDict) => {
  const name = field.lookup(PDFName.of("T"));
  if (!(name instanceof PDFString || name instanceof PDFHexString) || !name.decodeText()) {
    throw new PdfError("invalid", "A form field has no usable name.");
  }
  return name.decodeText();
};

export const pdfFieldName = (field: PDFDict): string => {
  const names: string[] = [];
  const visited = new Set<PDFDict>();
  let current: PDFDict | undefined = field;
  while (current) {
    if (visited.has(current)) {
      throw new PdfError("invalid", "The form field hierarchy contains a cycle.");
    }
    visited.add(current);
    names.unshift(partialName(current));
    current = current.lookupMaybe(PDFName.of("Parent"), PDFDict);
  }
  return names.join(".");
};

export const appendPdfField = (
  document: PDFDocument,
  form: PDFDict,
  field: PDFDict,
  ref: PDFRef,
  name: string,
) => {
  const parts = name.split(".");
  let children = form.lookup(PDFName.of("Fields"), PDFArray);
  let parentRef: PDFRef | undefined;
  for (const part of parts.slice(0, -1)) {
    let branchRef = children.asArray().find((candidate) => {
      const branch = document.context.lookup(candidate, PDFDict);
      return partialName(branch) === part;
    });
    if (branchRef === undefined) {
      branchRef = document.context.register(
        document.context.obj({ T: PDFHexString.fromText(part), Kids: [] }),
      );
      const branch = document.context.lookup(branchRef, PDFDict);
      if (parentRef) {
        branch.set(PDFName.of("Parent"), parentRef);
      }
      children.push(branchRef);
    }
    if (!(branchRef instanceof PDFRef)) {
      throw new PdfError("invalid", "A form hierarchy node has no object reference.");
    }
    const branch = document.context.lookup(branchRef, PDFDict);
    if (branch.has(PDFName.of("FT"))) {
      throw new PdfError("invalid", "A terminal form field cannot also be a field group.");
    }
    children = branch.lookup(PDFName.of("Kids"), PDFArray);
    parentRef = branchRef;
  }
  const last = parts.at(-1);
  if (!last) {
    throw new PdfError("invalid", "A form field has an empty name.");
  }
  field.set(PDFName.of("T"), PDFHexString.fromText(last));
  if (parentRef) {
    field.set(PDFName.of("Parent"), parentRef);
  } else {
    field.delete(PDFName.of("Parent"));
  }
  children.push(ref);
};
