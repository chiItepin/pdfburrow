import type { PdfInput } from "@repo/pdf-engine";
import type { DocumentTask } from "../workspace/types";
import { pdfLimits } from "../workspace/resourcePolicy";

export const mergeTask =
  (inputs: readonly PdfInput[], acknowledged: boolean): DocumentTask =>
  async (options) => {
    const { mergePdfs } = await import("@repo/pdf-engine/merge");
    const result = await mergePdfs({ acknowledged, inputs, limits: pdfLimits }, options);
    return result.kind === "success" ? { kind: "success", value: [result.value] } : result;
  };
