import type { PdfOutput } from "./types";

export interface BundleLimits {
  readonly outputCount?: number;
  readonly totalOutputBytes?: number;
  readonly bundleBytes?: number;
}

export interface BundleRequest {
  readonly outputs: readonly PdfOutput[];
  readonly filename: string;
  readonly limits?: BundleLimits;
}

export interface BundleProgress {
  readonly completed: number;
  readonly total: number;
  readonly bytes: number;
}
