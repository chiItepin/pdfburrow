/**
 * Exercises the local worker-loading boundary without reading a document.
 * This is a workspace diagnostic, not a PDF job or a compatibility guarantee.
 */
export function checkWorker(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Worker check cancelled.", "AbortError"));
      return;
    }

    const worker = new Worker(new URL("./diagnostics.worker.ts", import.meta.url), {
      type: "module",
      name: "pdfburrow-workspace-check",
    });

    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Worker check cancelled.", "AbortError"));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("The local worker did not respond. Retry the check."));
    }, 10_000);

    worker.onmessage = (event: MessageEvent<unknown>) => {
      cleanup();
      const data = event.data;
      if (
        typeof data === "object" &&
        data !== null &&
        "type" in data &&
        data.type === "ready"
      ) {
        resolve();
      } else {
        reject(new Error("The local worker returned an unexpected response."));
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      cleanup();
      reject(new Error("The local worker could not load. Reload and retry."));
    };
    worker.onmessageerror = () => {
      cleanup();
      reject(new Error("The local worker response could not be read. Retry the check."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
