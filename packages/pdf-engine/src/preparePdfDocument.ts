import type { PDFDocument } from "pdf-lib";
import { preservePdfForms } from "./preservePdfForms.ts";
import { inspectDocument } from "./inspectDocument.ts";
import { PdfError } from "./pdfError.ts";
import type { PdfLimits } from "./types";

export const editableFormWarning =
  "Form fields on exported pages stay editable, with their current values. Fonts and field appearance may change; review the downloaded PDF. Same-named fields from separate merged inputs are renamed to keep them independent.";

export const preparePdfDocument = async (
  source: PDFDocument,
  limits: PdfLimits,
  formHandling: "preserve" | "reject",
) => {
  try {
    return { document: source, info: inspectDocument(source, limits) };
  } catch (error) {
    if (!(error instanceof PdfError) || error.feature !== "forms" || formHandling === "reject") {
      throw error;
    }
  }
  let document: PDFDocument;
  try {
    document = await preservePdfForms(source);
  } catch (error) {
    if (error instanceof PdfError) {
      throw error;
    }
    throw new PdfError(
      "unsupported",
      "This form's fields, text encoding, or appearances cannot be preserved safely. No flattened substitute will be generated.",
    );
  }
  const info = inspectDocument(document, limits, true);
  return {
    document,
    info: {
      ...info,
      warnings: [
        editableFormWarning,
        "Document-level features such as bookmarks, attachments, metadata, accessibility, and PDF/A guarantees are not preserved.",
        ...info.warnings,
      ],
    },
  };
};
