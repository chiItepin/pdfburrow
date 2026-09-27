import { inspectPdf, mergeDocuments, PdfError } from "./pdf";
import type { WorkerMessage, WorkerRequest, WorkerValue } from "./protocol";

function send(message: WorkerMessage) {
  self.postMessage(message);
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const request = event.data;
    const value: WorkerValue = request.operation === "validate"
      ? { operation: "validate", info: await inspectPdf(request.input, request.limits) }
      : { operation: "merge", output: await mergeDocuments(request.request, (progress) => send({ type: "progress", progress })) };
    send({ type: "result", result: { kind: "success", value } });
  } catch (error) {
    send({
      type: "result",
      result: {
        kind: "failure",
        code: error instanceof PdfError ? error.code : "generation",
        message: error instanceof PdfError ? error.message : "PDF processing failed. Try fewer files or newly exported source copies.",
      },
    });
  }
};
