import { validateImageInput } from "./decodeImage";
import { convertImageDocuments } from "./imageDocuments";
import type { ImageWorkerRequest } from "./images";
import { PdfError } from "./pdfError";

self.onmessage = async (event: MessageEvent<ImageWorkerRequest>) => {
  try {
    const message = event.data;
    const value =
      message.operation === "validate"
        ? await validateImageInput(message.input, message.limits)
        : await convertImageDocuments(message.request, (progress) =>
            self.postMessage({ type: "progress", progress }),
          );
    self.postMessage({ type: "result", result: { kind: "success", value } });
  } catch (error) {
    self.postMessage({
      type: "result",
      result: {
        kind: "failure",
        code: error instanceof PdfError ? error.code : "generation",
        message:
          error instanceof PdfError
            ? error.message
            : "Image processing failed. Your originals are retained. Retry with fewer images or prepare smaller source files externally.",
      },
    });
  }
};
