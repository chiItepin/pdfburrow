import type { PDFDocument } from "pdf-lib";
import { preservePdfForms } from "./preservePdfForms.ts";
import { inspectDocument } from "./inspectDocument.ts";
import { inspectFormForFilling } from "./inspectFillableForm.ts";
import { PdfError } from "./pdfError.ts";
import type { PdfLimits } from "./types";

export const editableFormWarning =
  "Form fields on exported pages stay editable, with their current values. Fonts and field appearance may change; review the downloaded PDF. Same-named fields from separate merged inputs are renamed to keep them independent.";

export const formHandlingPolicies = ["preserve", "reject", "fill"] as const;
export type FormHandling = (typeof formHandlingPolicies)[number];

export const preparePdfDocument = async (
  source: PDFDocument,
  limits: PdfLimits,
  formHandling: FormHandling,
) => {
  try {
    const info = inspectDocument(source, limits);
    if (formHandling === "fill") {
      inspectFormForFilling(source);
    }
    return { document: source, info };
  } catch (error) {
    if (!(error instanceof PdfError) || error.feature !== "forms" || formHandling === "reject") {
      throw error;
    }
  }
  let document: PDFDocument;
  try {
    document = await preservePdfForms(source, formHandling === "fill");
    if (formHandling === "fill") {
      inspectFormForFilling(document);
    }
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
