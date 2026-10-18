import { fillPdfForm, inspectFillablePdf } from "./fillForm";
import { PdfError } from "./pdfError";
import type { FormsWorkerRequest, FormsWorkerValue } from "./formsProtocol";
import type { Outcome, PdfProgress } from "./types";

const send = (
  message:
    | { type: "result"; result: Outcome<FormsWorkerValue> }
    | { type: "progress"; progress: PdfProgress },
) => self.postMessage(message);
self.onmessage = async (event: MessageEvent<FormsWorkerRequest>) => {
  try {
    const request = event.data;
    const value: FormsWorkerValue =
      request.operation === "validate"
        ? { operation: "validate", info: await inspectFillablePdf(request.input, request.limits) }
        : {
            operation: "fill",
            output: await fillPdfForm(request.request, (progress) =>
              send({ type: "progress", progress }),
            ),
          };
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
            : "The form could not be processed safely. Your original is unchanged. Try a newly exported AcroForm PDF.",
      },
    });
  }
};
