import { PDFArray, PDFDict, PDFRef, PDFStream } from "pdf-lib";
import type { PDFDocument, PDFObject } from "pdf-lib";
import { PdfError } from "./pdfError.ts";

export const inspectPageReferences = (document: PDFDocument) => {
  const pages = new Set<PDFDict>(document.getPages().map((page) => page.node));
  const pending: PDFObject[] = [...pages];
  const visited = new Set<PDFObject>();
  while (pending.length) {
    const object = pending.pop();
    if (!object || visited.has(object)) {
      continue;
    }
    visited.add(object);
    if (object instanceof PDFRef) {
      const target = document.context.lookup(object);
      if (!target) {
        throw new PdfError(
          "invalid",
          "A required page content or resource object is missing. Export a new copy using another PDF tool.",
        );
      }
      pending.push(target);
    } else if (object instanceof PDFStream) {
      pending.push(object.dict);
    } else if (object instanceof PDFArray) {
      for (const item of object.asArray()) {
        pending.push(item);
      }
    } else if (object instanceof PDFDict) {
      for (const [key, value] of object.entries()) {
        if (!(pages.has(object) && key.toString() === "/Annots")) {
          pending.push(value);
        }
      }
    }
  }
};
