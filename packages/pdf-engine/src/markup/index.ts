import { runWorker } from "../workerClient";
import type { WorkerOptions } from "../workerClient";
import type { MarkupWorkerRequest, MarkupWorkerValue } from "../markupProtocol";
import type { MarkupInfo, MarkupRequest } from "../markupTypes";
import type { Outcome, PdfInput, PdfLimits, PdfOutput, PdfProgress } from "../types";
const run = (request: MarkupWorkerRequest, options: WorkerOptions<PdfProgress>) =>
  runWorker<MarkupWorkerRequest, MarkupWorkerValue, PdfProgress>(
    new URL("./markup.worker.js", import.meta.url),
    "pdfburrow-markup",
    request,
    options,
  );
export const validateMarkupPdf = async (
  input: PdfInput,
  options: WorkerOptions<PdfProgress> & { limits?: PdfLimits } = {},
): Promise<Outcome<MarkupInfo>> => {
  const result = await run({ operation: "validate", input, limits: options.limits }, options);
  if (result.kind !== "success") {
    return result;
  }
  return result.value.operation === "validate"
    ? { kind: "success", value: result.value.info }
    : {
        kind: "failure",
        code: "worker",
        message: "The local markup worker returned an unexpected validation response.",
      };
};
export const generateMarkupPdf = async (
  request: MarkupRequest,
  options: WorkerOptions<PdfProgress> = {},
): Promise<Outcome<PdfOutput>> => {
  const result = await run({ operation: "flatten", request }, options);
  if (result.kind !== "success") {
    return result;
  }
  return result.value.operation === "flatten"
    ? { kind: "success", value: result.value.output }
    : {
        kind: "failure",
        code: "worker",
        message: "The local markup worker returned an unexpected generation response.",
      };
};
