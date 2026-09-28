import { PDFDocument } from "pdf-lib";
import { loadValidatedPdf } from "./pdf.ts";
import { PdfError } from "./pdfError.ts";
import { enforceLimit } from "./resourceLimits.ts";
import { planSplit } from "./selection.ts";
import type { SplitRequest } from "./splitTypes";
import type { PdfOutput, PdfProgress } from "./types";

export const splitDocuments = async (
  request: SplitRequest,
  progress: (value: PdfProgress) => void,
): Promise<readonly PdfOutput[]> => {
  if (!request.acknowledged) {
    throw new PdfError(
      "invalid",
      "Acknowledge the PDF preservation limitations before generating.",
    );
  }
  if (!request.input || !(request.input.blob instanceof Blob)) {
    throw new PdfError("invalid", "Add one source PDF.");
  }
  const limits = request.limits ?? {};
  progress({ phase: "validating", completed: 0, total: 1 });
  const { document, info } = await loadValidatedPdf(request.input, limits);
  const plan = planSplit(request.input.name, info.pageCount, request.selection, limits);
  const outputs: PdfOutput[] = [];
  let completed = 0;
  let outputBytes = 0;
  for (let index = 0; index < plan.outputCount; index++) {
    const planned = plan.outputAt(index);
    const output = await PDFDocument.create();
    // One copy operation per output preserves shared resources without duplicating them per page.
    const indices = planned.ranges.flatMap(({ start, end }) =>
      Array.from({ length: end - start + 1 }, (_, offset) => start + offset - 1),
    );
    for (const page of await output.copyPages(document, indices)) {
      output.addPage(page);
      progress({ phase: "copying", completed: ++completed, total: plan.totalPages });
    }
    progress({ phase: "saving", completed, total: plan.totalPages });
    const bytes = await output.save();
    outputBytes += bytes.byteLength;
    enforceLimit(outputBytes, limits.outputBytes, "Output bytes", "Select fewer pages or outputs.");
    outputs.push({
      blob: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
      suggestedFilename: planned.filename,
    });
  }
  return outputs;
};
