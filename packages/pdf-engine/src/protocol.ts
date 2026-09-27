import type { MergeRequest, Outcome, PdfInfo, PdfInput, PdfLimits, PdfOutput, PdfProgress } from "./types";

export type WorkerRequest =
  | { operation: "validate"; input: PdfInput; limits?: PdfLimits }
  | { operation: "merge"; request: MergeRequest };

export type WorkerValue =
  | { operation: "validate"; info: PdfInfo }
  | { operation: "merge"; output: PdfOutput };

export type WorkerMessage =
  | { type: "progress"; progress: PdfProgress }
  | { type: "result"; result: Outcome<WorkerValue> };
