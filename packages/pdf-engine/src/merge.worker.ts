import { inspectPdf, mergeDocuments, preparePdfCopy } from "./pdf";
import { PdfError } from "./pdfError";
import type { WorkerMessage, WorkerRequest, WorkerValue } from "./protocol";
const send = (message: WorkerMessage) => {
  self.postMessage(message);
};
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const request = event.data;
    let value: WorkerValue;
    if (request.operation === "validate") {
      value = { operation: "validate", info: await inspectPdf(request.input, request.limits) };
    } else if (request.operation === "prepare") {
      value = { operation: "prepare", output: await preparePdfCopy(request.input, request.limits) };
    } else {
      value = {
        operation: "merge",
        output: await mergeDocuments(request.request, (progress) =>
          send({ type: "progress", progress }),
        ),
      };
    }
    send({ type: "result", result: { kind: "success", value } });
  } catch (error) {
    send({
      type: "result",
      result: {
        kind: "failure",
        code: error instanceof PdfError ? error.code : "generation",
        message:
          error instanceof PdfError
            ? error.message
            : "PDF processing failed. Try fewer files or newly exported source copies.",
      },
    });
  }
};
