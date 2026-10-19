import type { FillFormRequest, FormInfo } from "./formTypes";
import type { PdfInput, PdfLimits, PdfOutput } from "./types";

export type FormsWorkerRequest =
  | { readonly operation: "validate"; readonly input: PdfInput; readonly limits?: PdfLimits }
  | { readonly operation: "fill"; readonly request: FillFormRequest };
export type FormsWorkerValue =
  | { readonly operation: "validate"; readonly info: FormInfo }
  | { readonly operation: "fill"; readonly output: PdfOutput };
