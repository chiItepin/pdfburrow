import type { PdfInput, PdfLimits } from "./types";

export interface PageRange {
  readonly start: number;
  readonly end: number;
}

export type SplitSelection =
  | { readonly mode: "selected"; readonly pages: readonly number[] }
  | {
      readonly mode: "ranges";
      readonly ranges: readonly PageRange[];
      readonly combined: boolean;
    }
  | { readonly mode: "fixed"; readonly size: number }
  | { readonly mode: "every" };

export interface SplitRequest {
  readonly input: PdfInput;
  readonly selection: SplitSelection;
  readonly acknowledged: boolean;
  readonly limits?: PdfLimits;
}

export interface SplitOutputPlan {
  readonly filename: string;
  readonly pageCount: number;
  readonly ranges: readonly PageRange[];
}

export interface SplitPlan {
  readonly outputCount: number;
  readonly totalPages: number;
  readonly repeatsPages: boolean;
  readonly bundleName: string;
  readonly outputAt: (index: number) => SplitOutputPlan;
}
