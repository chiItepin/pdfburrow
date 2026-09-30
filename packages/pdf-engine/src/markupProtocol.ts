import type { WorkerResponse } from "./workerClient";
import type { MarkupInfo, MarkupRequest } from "./markupTypes";
import type { PdfInput, PdfLimits, PdfOutput, PdfProgress } from "./types";
export type MarkupWorkerRequest =
  | { readonly operation: "validate"; readonly input: PdfInput; readonly limits?: PdfLimits }
  | { readonly operation: "flatten"; readonly request: MarkupRequest };
export type MarkupWorkerValue =
  | { readonly operation: "validate"; readonly info: MarkupInfo }
  | { readonly operation: "flatten"; readonly output: PdfOutput };
export type MarkupWorkerMessage = WorkerResponse<MarkupWorkerValue, PdfProgress>;
