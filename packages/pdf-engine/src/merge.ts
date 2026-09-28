import type { WorkerRequest, WorkerValue } from "./protocol";
import { runWorker } from "./workerClient";
import type { WorkerOptions } from "./workerClient";
import type {
  MergeRequest,
  Outcome,
  PdfInfo,
  PdfInput,
  PdfLimits,
  PdfOutput,
  PdfProgress,
} from "./types";
type RunOptions = WorkerOptions<PdfProgress>;
const run = (request: WorkerRequest, options: RunOptions) =>
  runWorker<WorkerRequest, WorkerValue, PdfProgress>(
    new URL("./merge.worker.js", import.meta.url),
    "pdfburrow-merge",
    request,
    options,
  );
export const validatePdf = async (
  input: PdfInput,
  options: RunOptions & {
    limits?: PdfLimits;
  } = {},
): Promise<Outcome<PdfInfo>> => {
  const result = await run({ operation: "validate", input, limits: options.limits }, options);
  if (result.kind !== "success") {
    return result;
  }
  return result.value.operation === "validate"
    ? { kind: "success", value: result.value.info }
    : {
        kind: "failure",
        code: "worker",
        message: "The local worker returned an unexpected validation response.",
      };
};
export const mergePdfs = async (
  request: MergeRequest,
  options: RunOptions = {},
): Promise<Outcome<PdfOutput>> => {
  const result = await run({ operation: "merge", request }, options);
  if (result.kind !== "success") {
    return result;
  }
  return result.value.operation === "merge"
    ? { kind: "success", value: result.value.output }
    : {
        kind: "failure",
        code: "worker",
        message: "The local worker returned an unexpected merge response.",
      };
};
