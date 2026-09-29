import type { PDFDocument, PDFObject } from "pdf-lib";
import { PDFArray, PDFDict, PDFInvalidObject, PDFName, PDFRef, PDFStream } from "pdf-lib";
import { PdfError } from "./pdfError.ts";
import { inspectPageTree } from "./inspectPageTree.ts";
import type { PdfInfo, PdfLimits } from "./types";
import { enforceLimit } from "./resourceLimits.ts";

export const inspectDocument = (document: PDFDocument, limits: PdfLimits = {}): PdfInfo => {
  if (document.context.trailerInfo.Encrypt) {
    throw new PdfError(
      "unsupported",
      "Encrypted PDFs are not supported. Use an unencrypted source copy.",
    );
  }
  const pageCount = inspectPageTree(document);
  enforceLimit(
    pageCount,
    limits.sourcePages,
    "Source page count",
    "Prepare a source with fewer pages.",
  );
  const warnings = new Set<string>();
  const pending: PDFObject[] = document.context
    .enumerateIndirectObjects()
    .map(([, object]) => object);
  pending.push(document.catalog);
  const visited = new Set<PDFObject>();
  let hasForms = false;
  let hasSignatures = document.catalog.has(PDFName.of("Perms"));
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
          "A required PDF object is missing. Export a new copy using another PDF tool.",
        );
      }
      pending.push(target);
    } else if (object instanceof PDFInvalidObject) {
      throw new PdfError(
        "invalid",
        "The PDF contains an invalid object. Export a new copy using another PDF tool.",
      );
    } else if (object instanceof PDFStream) {
      pending.push(object.dict);
    } else if (object instanceof PDFArray) {
      for (const item of object.asArray()) {
        pending.push(item);
      }
    } else if (object instanceof PDFDict) {
      const type = object.lookup(PDFName.of("Type"))?.toString();
      const fieldType = object.lookup(PDFName.of("FT"))?.toString();
      if (type === "/Sig" || fieldType === "/Sig") {
        hasSignatures = true;
      }
      if (fieldType || object.get(PDFName.of("Subtype"))?.toString() === "/Widget") {
        hasForms = true;
      }
      for (const [key, value] of object.entries()) {
        pending.push(value);
        if (key.toString() === "/Annots" && !object.lookupMaybe(key, PDFArray)?.size()) {
          continue;
        }
        if (
          [
            "/Annots",
            "/Outlines",
            "/Dests",
            "/EmbeddedFiles",
            "/AF",
            "/Metadata",
            "/StructTreeRoot",
            "/MarkInfo",
            "/OutputIntents",
          ].includes(key.toString())
        ) {
          warnings.add(
            key.toString() === "/Annots"
              ? "Annotations or links detected: visible marks, appearance, or behavior may change or disappear."
              : "Document features detected: bookmarks, attachments, metadata, accessibility, or PDF/A guarantees are not preserved.",
          );
        }
      }
    }
  }
  const acroForm = document.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  if (acroForm) {
    const fields = acroForm.lookupMaybe(PDFName.of("Fields"), PDFArray);
    hasForms ||= Boolean(fields?.size()) || acroForm.has(PDFName.of("XFA"));
  }
  if (hasSignatures) {
    throw new PdfError(
      "unsupported",
      "Digital signatures detected. Use an unsigned source copy; merging would invalidate signatures.",
    );
  }
  if (hasForms) {
    throw new PdfError(
      "unsupported",
      "Interactive form fields detected. Export a flattened, noninteractive copy using another PDF tool.",
    );
  }
  if (document.context.trailerInfo.Info) {
    warnings.add("Source metadata is not guaranteed to be preserved.");
  }
  const pages = document.getPages();
  if (pages.length !== pageCount) {
    throw new PdfError("invalid", "Required PDF page checks could not account for every page.");
  }
  if (!pages.length) {
    throw new PdfError("invalid", "This PDF has no pages.");
  }
  for (const page of pages) {
    for (const box of [
      page.getMediaBox(),
      page.getCropBox(),
      page.getBleedBox(),
      page.getTrimBox(),
      page.getArtBox(),
    ]) {
      enforceLimit(
        Math.max(box.width, box.height),
        limits.pageDimension,
        "PDF page dimension in points",
        "Prepare a source with smaller page dimensions.",
      );
      if (
        ![box.x, box.y, box.width, box.height].every(Number.isFinite) ||
        box.width <= 0 ||
        box.height <= 0
      ) {
        throw new PdfError(
          "invalid",
          "A page has invalid dimensions. Export a new source copy using another PDF tool.",
        );
      }
    }
    if (!Number.isInteger(page.getRotation().angle / 90)) {
      throw new PdfError(
        "invalid",
        "A page has an invalid rotation. Export a new source copy using another PDF tool.",
      );
    }
    const contents = page.node.Contents();
    if (contents instanceof PDFArray) {
      for (const item of contents.asArray()) {
        if (!(document.context.lookup(item) instanceof PDFStream)) {
          throw new PdfError("invalid", "A page content stream is missing or invalid.");
        }
      }
    } else if (contents && !(contents instanceof PDFStream)) {
      throw new PdfError("invalid", "A page content stream is invalid.");
    }
  }
  return { pageCount: pages.length, warnings: [...warnings] };
};
