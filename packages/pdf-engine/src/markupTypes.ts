import type { PdfInfo, PdfInput, PdfLimits } from "./types";

export interface MarkupPoint {
  readonly x: number;
  readonly y: number;
}
export interface MarkupGeometry {
  readonly width: number;
  readonly height: number;
  readonly transform: readonly [number, number, number, number, number, number];
}
export interface MarkupInfo extends PdfInfo {
  readonly pages: readonly MarkupGeometry[];
}
interface MarkupBox {
  readonly id: string;
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export type MarkupObject = MarkupBox &
  (
    | { readonly kind: "highlight" }
    | { readonly kind: "note"; readonly text: string }
    | {
        readonly kind: "ink" | "signature";
        readonly strokes: readonly (readonly MarkupPoint[])[];
        readonly strokeWidth: number;
      }
  );
export interface MarkupRequest {
  readonly input: PdfInput;
  readonly objects: readonly MarkupObject[];
  readonly acknowledged: boolean;
  readonly limits?: PdfLimits;
}
