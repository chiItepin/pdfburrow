import {
  EncryptedPDFError, PDFArray, PDFDict, PDFDocument, PDFInvalidObject,
  PDFName, PDFObject, PDFRef, PDFStream,
} from "pdf-lib";
import type { FailureCode, MergeRequest, PdfInfo, PdfInput, PdfLimits, PdfOutput, PdfProgress } from "./types";

export class PdfError extends Error {
  constructor(readonly code: FailureCode, message: string) {
    super(message);
  }
}

export function enforceLimit(value: number, maximum: number | undefined, label: string, remedy: string) {
  if (maximum === undefined) return;
  if (!Number.isFinite(maximum) || maximum <= 0) {
    throw new PdfError("limit", `The configured ${label} limit is invalid.`);
  }
  if (value > maximum) {
    throw new PdfError("limit", `${label}: ${value} exceeds the configured limit of ${maximum}. ${remedy}`);
  }
}

function checkInputs(inputs: readonly PdfInput[], limits: PdfLimits) {
  if (!inputs.length) throw new PdfError("invalid", "Add at least one PDF.");
  enforceLimit(inputs.length, limits.inputCount, "Input count", "Remove some files.");
  enforceLimit(inputs.reduce((sum, input) => sum + input.blob.size, 0),
    limits.totalInputBytes, "Total input bytes", "Remove files or prepare smaller copies externally.");
  for (const input of inputs) {
    enforceLimit(input.blob.size, limits.perInputBytes, `${input.name}: input bytes`,
      "Prepare a smaller source copy externally.");
  }
}

function inspect(document: PDFDocument): PdfInfo {
  if (document.context.trailerInfo.Encrypt) {
    throw new PdfError("unsupported", "Encrypted PDFs are not supported. Use an unencrypted source copy.");
  }
  const warnings = new Set<string>();
  const pending: PDFObject[] = document.context.enumerateIndirectObjects().map(([, object]) => object);
  pending.push(document.catalog);
  const visited = new Set<PDFObject>();
  let hasForms = false;
  let hasSignatures = document.catalog.has(PDFName.of("Perms"));
  while (pending.length) {
    const object = pending.pop()!;
    if (visited.has(object)) continue;
    visited.add(object);
    if (object instanceof PDFRef) {
      const target = document.context.lookup(object);
      if (!target) throw new PdfError("invalid", "A required PDF object is missing. Export a new copy using another PDF tool.");
      pending.push(target);
    } else if (object instanceof PDFInvalidObject) {
      throw new PdfError("invalid", "The PDF contains an invalid object. Export a new copy using another PDF tool.");
    } else if (object instanceof PDFStream) {
      pending.push(object.dict);
    } else if (object instanceof PDFArray) {
      pending.push(...object.asArray());
    } else if (object instanceof PDFDict) {
      const type = object.lookup(PDFName.of("Type"))?.toString();
      const fieldType = object.lookup(PDFName.of("FT"))?.toString();
      if (type === "/Sig" || fieldType === "/Sig") hasSignatures = true;
      if (fieldType || object.get(PDFName.of("Subtype"))?.toString() === "/Widget") hasForms = true;
      for (const [key, value] of object.entries()) {
        pending.push(value);
        if (key.toString() === "/Annots" && !object.lookupMaybe(key, PDFArray)?.size()) continue;
        if (["/Annots", "/Outlines", "/Dests", "/EmbeddedFiles", "/AF", "/Metadata",
          "/StructTreeRoot", "/MarkInfo", "/OutputIntents"].includes(key.toString())) {
          warnings.add(key.toString() === "/Annots"
            ? "Annotations or links detected: visible marks, appearance, or behavior may change or disappear."
            : "Document features detected: bookmarks, attachments, metadata, accessibility, or PDF/A guarantees are not preserved.");
        }
      }
    }
  }
  const acroForm = document.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  if (acroForm) {
    const fields = acroForm.lookupMaybe(PDFName.of("Fields"), PDFArray);
    hasForms ||= Boolean(fields?.size()) || acroForm.has(PDFName.of("XFA"));
  }
  if (hasSignatures) throw new PdfError("unsupported", "Digital signatures detected. Use an unsigned source copy; merging would invalidate signatures.");
  if (hasForms) throw new PdfError("unsupported", "Interactive form fields detected. Export a flattened, noninteractive copy using another PDF tool.");
  if (document.context.trailerInfo.Info) {
    warnings.add("Source metadata is not guaranteed to be preserved.");
  }
  const pages = document.getPages();
  if (!pages.length) throw new PdfError("invalid", "This PDF has no pages.");
  for (const page of pages) {
    for (const box of [page.getMediaBox(), page.getCropBox(), page.getBleedBox(), page.getTrimBox(), page.getArtBox()]) {
      if (![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width <= 0 || box.height <= 0) {
        throw new PdfError("invalid", "A page has invalid dimensions. Export a new source copy using another PDF tool.");
      }
    }
    if (!Number.isInteger(page.getRotation().angle / 90)) {
      throw new PdfError("invalid", "A page has an invalid rotation. Export a new source copy using another PDF tool.");
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
}

async function load(input: PdfInput, limits: PdfLimits) {
  checkInputs([input], limits);
  const header = new Uint8Array(await input.blob.slice(0, 1024).arrayBuffer());
  if (!new TextDecoder("latin1").decode(header).includes("%PDF-")) {
    throw new PdfError("invalid", "This file is not a PDF. Choose a valid, unencrypted PDF.");
  }
  try {
    const document = await PDFDocument.load(await input.blob.arrayBuffer(), {
      updateMetadata: false, throwOnInvalidObject: true,
    });
    const info = inspect(document);
    enforceLimit(info.pageCount, limits.totalPages, "Page count", "Prepare a source with fewer pages.");
    return { document, info };
  } catch (error) {
    if (error instanceof PdfError) throw error;
    // pdf-lib's ES5 Error subclass does not retain its prototype in every runtime.
    if (error instanceof EncryptedPDFError || (error instanceof Error && error.message === new EncryptedPDFError().message)) {
      throw new PdfError("unsupported", "Encrypted PDFs are not supported, even without an opening password. Use an unencrypted source copy.");
    }
    throw new PdfError("invalid", "The PDF could not pass structural validation. Export a new copy using another PDF tool.");
  }
}

export async function inspectPdf(input: PdfInput, limits: PdfLimits = {}): Promise<PdfInfo> {
  return (await load(input, limits)).info;
}

export function mergedFilename(name: string): string {
  // eslint-disable-next-line no-control-regex -- Control characters are unsafe in download filenames.
  const stem = name.replace(/\.pdf$/iu, "").replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/gu, "_")
    .replace(/[. ]+$/gu, "").trim();
  return `${stem || "document"}-merged.pdf`;
}

export async function mergeDocuments(
  request: MergeRequest,
  progress: (value: PdfProgress) => void,
): Promise<PdfOutput> {
  if (!request.acknowledged) {
    throw new PdfError("invalid", "Acknowledge the PDF preservation limitations before merging.");
  }
  const limits = request.limits ?? {};
  checkInputs(request.inputs, limits);
  const output = await PDFDocument.create();
  let pages = 0;
  for (const [index, input] of request.inputs.entries()) {
    progress({ phase: "validating", completed: index, total: request.inputs.length });
    try {
      const { document, info } = await load(input, limits);
      pages += info.pageCount;
      enforceLimit(pages, limits.totalPages, "Total pages", "Remove some input files.");
      const copiedPages = await output.copyPages(document, document.getPageIndices());
      for (const copied of copiedPages) {
        output.addPage(copied);
        progress({ phase: "copying", completed: output.getPageCount(), total: pages });
      }
    } catch (error) {
      if (error instanceof PdfError) throw new PdfError(error.code, `${input.name}: ${error.message}`);
      throw new PdfError("generation", `${input.name}: pages could not be copied. Try a newly exported source copy.`);
    }
  }
  progress({ phase: "saving", completed: pages, total: pages });
  const bytes = await output.save();
  enforceLimit(bytes.byteLength, limits.outputBytes, "Output bytes", "Remove some input files.");
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    suggestedFilename: mergedFilename(request.inputs[0]!.name),
  };
}
