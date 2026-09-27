import { EncryptedPDFError, PDFDocument } from "pdf-lib";
import { inspectDocument } from "./inspect-document.ts";
import { PdfError } from "./pdf-error.ts";
import type { MergeRequest, PdfInfo, PdfInput, PdfLimits, PdfOutput, PdfProgress } from "./types";

export const enforceLimit = (
  value: number,
  maximum: number | undefined,
  label: string,
  remedy: string,
) => {
  if (maximum === undefined) {
    return;
  }
  if (!Number.isFinite(maximum) || maximum <= 0) {
    throw new PdfError("limit", `The configured ${label} limit is invalid.`);
  }
  if (value > maximum) {
    throw new PdfError(
      "limit",
      `${label}: ${value} exceeds the configured limit of ${maximum}. ${remedy}`,
    );
  }
};

const validateInputLimits = (inputs: readonly PdfInput[], limits: PdfLimits) => {
  if (!inputs.length) {
    throw new PdfError("invalid", "Add at least one PDF.");
  }
  enforceLimit(inputs.length, limits.inputCount, "Input count", "Remove some files.");
  enforceLimit(
    inputs.reduce((sum, input) => sum + input.blob.size, 0),
    limits.totalInputBytes,
    "Total input bytes",
    "Remove files or prepare smaller copies externally.",
  );
  for (const input of inputs) {
    enforceLimit(
      input.blob.size,
      limits.perInputBytes,
      `${input.name}: input bytes`,
      "Prepare a smaller source copy externally.",
    );
  }
};

const loadValidatedPdf = async (input: PdfInput, limits: PdfLimits) => {
  validateInputLimits([input], limits);
  const header = new Uint8Array(await input.blob.slice(0, 1024).arrayBuffer());
  if (!new TextDecoder("latin1").decode(header).includes("%PDF-")) {
    throw new PdfError("invalid", "This file is not a PDF. Choose a valid, unencrypted PDF.");
  }
  try {
    const document = await PDFDocument.load(await input.blob.arrayBuffer(), {
      updateMetadata: false,
      throwOnInvalidObject: true,
    });
    const info = inspectDocument(document);
    enforceLimit(
      info.pageCount,
      limits.totalPages,
      "Page count",
      "Prepare a source with fewer pages.",
    );
    return { document, info };
  } catch (error) {
    if (error instanceof PdfError) {
      throw error;
    }
    // pdf-lib's ES5 Error subclass does not retain its prototype in every runtime.
    if (
      error instanceof EncryptedPDFError ||
      (error instanceof Error && error.message === new EncryptedPDFError().message)
    ) {
      throw new PdfError(
        "unsupported",
        "Encrypted PDFs are not supported, even without an opening password. Use an unencrypted source copy.",
      );
    }
    throw new PdfError(
      "invalid",
      "The PDF could not pass structural validation. Export a new copy using another PDF tool.",
    );
  }
};

export const inspectPdf = async (input: PdfInput, limits: PdfLimits = {}): Promise<PdfInfo> =>
  (await loadValidatedPdf(input, limits)).info;

export const mergedFilename = (name: string): string => {
  const stem = name
    .replace(/\.pdf$/iu, "")
    .replace(/\p{Cc}|[<>:"/\\|?*]/gu, "_")
    .replace(/[. ]+$/gu, "")
    .trim();
  return `${stem || "document"}-merged.pdf`;
};

export const mergeDocuments = async (
  request: MergeRequest,
  progress: (value: PdfProgress) => void,
): Promise<PdfOutput> => {
  if (!request.acknowledged) {
    throw new PdfError("invalid", "Acknowledge the PDF preservation limitations before merging.");
  }
  const limits = request.limits ?? {};
  validateInputLimits(request.inputs, limits);
  const firstInput = request.inputs[0];
  if (!firstInput) {
    throw new PdfError("invalid", "Add at least one PDF.");
  }
  const output = await PDFDocument.create();
  let pages = 0;
  for (const [index, input] of request.inputs.entries()) {
    progress({ phase: "validating", completed: index, total: request.inputs.length });
    try {
      const { document, info } = await loadValidatedPdf(input, limits);
      pages += info.pageCount;
      enforceLimit(pages, limits.totalPages, "Total pages", "Remove some input files.");
      const copiedPages = await output.copyPages(document, document.getPageIndices());
      for (const copied of copiedPages) {
        output.addPage(copied);
        progress({ phase: "copying", completed: output.getPageCount(), total: pages });
      }
    } catch (error) {
      if (error instanceof PdfError) {
        throw new PdfError(error.code, `${input.name}: ${error.message}`);
      }
      throw new PdfError(
        "generation",
        `${input.name}: pages could not be copied. Try a newly exported source copy.`,
      );
    }
  }
  progress({ phase: "saving", completed: pages, total: pages });
  const bytes = await output.save();
  enforceLimit(bytes.byteLength, limits.outputBytes, "Output bytes", "Remove some input files.");
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    suggestedFilename: mergedFilename(firstInput.name),
  };
};
