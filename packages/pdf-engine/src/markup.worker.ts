import { flattenMarkup, inspectMarkupPdf } from "./markupDocuments";
import { PdfError } from "./pdfError";
import type { MarkupWorkerMessage, MarkupWorkerRequest, MarkupWorkerValue } from "./markupProtocol";
const send = (message: MarkupWorkerMessage) => self.postMessage(message);
self.onmessage = async (event: MessageEvent<MarkupWorkerRequest>) => {
  try {
    const request = event.data;
    let value: MarkupWorkerValue;
    if (request.operation === "validate") {
      value = {
        operation: "validate",
        info: await inspectMarkupPdf(request.input, request.limits),
      };
    } else {
      let fontBytes = new Uint8Array();
      if (request.request.objects.some((object) => object.kind === "note")) {
        const response = await fetch(new URL("./markupFont.ttf", import.meta.url));
        if (!response.ok) {
          throw new PdfError("generation", "The local note font could not load. Retry generation.");
        }
        fontBytes = new Uint8Array(await response.arrayBuffer());
      }
      value = {
        operation: "flatten",
        output: await flattenMarkup(request.request, fontBytes, (progress) =>
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
            : "Markup processing could not finish. Your original is unchanged. Retry with a newly exported PDF.",
      },
    });
  }
};
