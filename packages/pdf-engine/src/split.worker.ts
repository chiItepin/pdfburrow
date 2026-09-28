import { PdfError } from "./pdfError";
import { splitDocuments } from "./splitDocuments";
import type { SplitRequest } from "./splitTypes";

self.onmessage = async (event: MessageEvent<SplitRequest>) => {
  try {
    const value = await splitDocuments(event.data, (progress) =>
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
            : "PDF generation failed. Select fewer pages or try a newly exported source copy.",
      },
    });
  }
};
