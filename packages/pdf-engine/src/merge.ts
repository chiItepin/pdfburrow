import type { WorkerMessage, WorkerRequest, WorkerValue } from "./protocol";
import type { MergeRequest, Outcome, PdfInfo, PdfInput, PdfLimits, PdfOutput, PdfProgress } from "./types";

interface RunOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: PdfProgress) => void;
}

function run(request: WorkerRequest, options: RunOptions): Promise<Outcome<WorkerValue>> {
  return new Promise((resolve) => {
    if (options.signal?.aborted) {
      resolve({ kind: "cancelled" });
      return;
    }
    let worker: Worker;
    try {
      worker = new Worker(new URL("./merge.worker.ts", import.meta.url), { type: "module", name: "pdfburrow-merge" });
    } catch {
      resolve({ kind: "failure", code: "worker", message: "A local PDF worker could not start. Use a browser with module workers and retry." });
      return;
    }
    let finished = false;
    const finish = (result: Outcome<WorkerValue>) => {
      if (finished) return;
      finished = true;
      worker.terminate();
      options.signal?.removeEventListener("abort", abort);
      resolve(result);
    };
    const abort = () => finish({ kind: "cancelled" });
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (finished) return;
      if (event.data.type === "progress") options.onProgress?.(event.data.progress);
      else finish(event.data.result);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish({ kind: "failure", code: "worker", message: "The local PDF worker failed. Your inputs are retained. Retry, or try fewer files." });
    };
    worker.onmessageerror = () => finish({ kind: "failure", code: "worker", message: "The local worker response could not be read. Retry the operation." });
    options.signal?.addEventListener("abort", abort, { once: true });
    try {
      worker.postMessage(request);
    } catch {
      finish({ kind: "failure", code: "worker", message: "The PDF inputs could not be sent to the local worker. Remove the affected files and add them again." });
    }
  });
}

export async function validatePdf(
  input: PdfInput, options: RunOptions & { limits?: PdfLimits } = {},
): Promise<Outcome<PdfInfo>> {
  const result = await run({ operation: "validate", input, limits: options.limits }, options);
  if (result.kind !== "success") return result;
  return result.value.operation === "validate"
    ? { kind: "success", value: result.value.info }
    : { kind: "failure", code: "worker", message: "The local worker returned an unexpected validation response." };
}

export async function mergePdfs(request: MergeRequest, options: RunOptions = {}): Promise<Outcome<PdfOutput>> {
  const result = await run({ operation: "merge", request }, options);
  if (result.kind !== "success") return result;
  return result.value.operation === "merge"
    ? { kind: "success", value: result.value.output }
    : { kind: "failure", code: "worker", message: "The local worker returned an unexpected merge response." };
}
