import { runWorker } from "../workerClient";
import type { WorkerOptions } from "../workerClient";
import type { FormsWorkerRequest, FormsWorkerValue } from "../formsProtocol";
import type { FillFormRequest, FormInfo } from "../formTypes";
import type { Outcome, PdfInput, PdfLimits, PdfOutput, PdfProgress } from "../types";

const run = (request: FormsWorkerRequest, options: WorkerOptions<PdfProgress>) =>
  runWorker<FormsWorkerRequest, FormsWorkerValue, PdfProgress>(
    new URL("./forms.worker.js", import.meta.url),
    "pdfburrow-forms",
    request,
    options,
  );
export const validateFormPdf = async (
  input: PdfInput,
  options: WorkerOptions<PdfProgress> & { limits?: PdfLimits } = {},
): Promise<Outcome<FormInfo>> => {
  const result = await run({ operation: "validate", input, limits: options.limits }, options);
  if (result.kind !== "success") {
    return result;
  }
  return result.value.operation === "validate"
    ? { kind: "success", value: result.value.info }
    : {
        kind: "failure",
        code: "worker",
        message: "The form worker returned an unexpected validation response.",
      };
};
export const generateFilledPdf = async (
  request: FillFormRequest,
  options: WorkerOptions<PdfProgress> = {},
): Promise<Outcome<PdfOutput>> => {
  const result = await run({ operation: "fill", request }, options);
  if (result.kind !== "success") {
    return result;
  }
  return result.value.operation === "fill"
    ? { kind: "success", value: result.value.output }
    : {
        kind: "failure",
        code: "worker",
        message: "The form worker returned an unexpected generation response.",
      };
};
