import type { BundleProgress, BundleRequest } from "./bundleTypes";
import { PdfError } from "./pdfError";
import { packageOutputs } from "./zip";
import type { PdfOutput } from "./types";
import type { WorkerResponse } from "./workerClient";

const send = (message: WorkerResponse<PdfOutput, BundleProgress>) => self.postMessage(message);

self.onmessage = async (event: MessageEvent<BundleRequest>) => {
  try {
    const value = await packageOutputs(event.data, (progress) =>
      send({ type: "progress", progress }),
    );
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
            : "ZIP packaging failed. Your PDFs are retained. Retry or download them individually.",
      },
    });
  }
};
