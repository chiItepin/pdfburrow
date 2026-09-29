export interface DocumentInput {
  readonly id: string;
  readonly blob: Blob;
}

export interface PdfOutput {
  readonly blob: Blob;
  readonly suggestedFilename: string;
}

export interface PdfInput extends DocumentInput {
  readonly name: string;
}

export interface PdfInfo {
  readonly pageCount: number;
  readonly warnings: readonly string[];
}

export type FailureCode = "unsupported" | "invalid" | "limit" | "worker" | "generation";

export type Outcome<T> =
  | { readonly kind: "success"; readonly value: T }
  | { readonly kind: "cancelled" }
  | { readonly kind: "failure"; readonly code: FailureCode; readonly message: string };

/** Explicit workload guardrails; these do not measure available browser memory. */
export interface PdfLimits {
  readonly inputCount?: number;
  readonly perInputBytes?: number;
  readonly totalInputBytes?: number;
  readonly totalPages?: number;
  readonly sourcePages?: number;
  readonly pageDimension?: number;
  readonly outputBytes?: number;
  readonly outputCount?: number;
}

export interface MergeRequest {
  readonly inputs: readonly PdfInput[];
  readonly acknowledged: boolean;
  readonly limits?: PdfLimits;
}

export interface PdfProgress {
  readonly phase: "validating" | "copying" | "converting" | "saving";
  readonly completed: number;
  readonly total: number;
}
