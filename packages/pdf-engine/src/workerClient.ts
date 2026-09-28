import type { Outcome } from "./types";

export interface WorkerOptions<Progress> {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: Progress) => void;
}

export type WorkerResponse<Value, Progress> =
  | { readonly type: "progress"; readonly progress: Progress }
  | { readonly type: "result"; readonly result: Outcome<Value> };

export const runWorker = <Request, Value, Progress>(
  url: URL,
  name: string,
  request: Request,
  options: WorkerOptions<Progress>,
): Promise<Outcome<Value>> =>
  new Promise((resolve) => {
    if (options.signal?.aborted) {
      resolve({ kind: "cancelled" });
      return;
    }
    let worker: Worker;
    try {
      worker = new Worker(url, { type: "module", name });
    } catch {
      resolve({
        kind: "failure",
        code: "worker",
        message: "A local worker could not start. Use a browser with module workers and retry.",
      });
      return;
    }
    let finished = false;
    const finish = (result: Outcome<Value>) => {
      if (finished) {
        return;
      }
      finished = true;
      worker.terminate();
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      options.signal?.removeEventListener("abort", abort);
      resolve(result);
    };
    const abort = () => finish({ kind: "cancelled" });
    worker.onmessage = (event: MessageEvent<WorkerResponse<Value, Progress>>) => {
      if (finished) {
        return;
      }
      if (event.data.type === "progress") {
        options.onProgress?.(event.data.progress);
      } else {
        finish(event.data.result);
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish({
        kind: "failure",
        code: "worker",
        message: "The local worker failed. Your documents are retained. Retry with less work.",
      });
    };
    worker.onmessageerror = () =>
      finish({
        kind: "failure",
        code: "worker",
        message: "The local worker response could not be read. Retry the operation.",
      });
    options.signal?.addEventListener("abort", abort, { once: true });
    try {
      worker.postMessage(request);
    } catch {
      finish({
        kind: "failure",
        code: "worker",
        message: "Documents could not be sent to the local worker. Retry with fewer inputs.",
      });
    }
  });
