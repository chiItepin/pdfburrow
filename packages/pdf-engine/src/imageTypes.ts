import type { PdfInfo, PdfInput, PdfLimits } from "./types";

export type ImageRotation = 0 | 90 | 180 | 270;

export interface ImageInfo extends PdfInfo {
  readonly pageCount: 1;
  readonly format: "jpeg" | "png";
  readonly width: number;
  readonly height: number;
}

export interface ImageSettings {
  readonly grouping: "combined" | "separate";
  readonly paper: "a4" | "letter" | "image";
  readonly orientation: "auto" | "portrait" | "landscape";
  readonly margin: 0 | 10 | 20;
}

export interface ImageLimits extends PdfLimits {
  readonly perImagePixels?: number;
  readonly totalPixels?: number;
  readonly maxDimension?: number;
  readonly pageWidth?: number;
  readonly pageHeight?: number;
}

export interface ImageInput extends PdfInput {
  readonly rotation: ImageRotation;
}

export interface ImagesRequest {
  readonly inputs: readonly ImageInput[];
  readonly settings: ImageSettings;
  readonly limits?: ImageLimits;
}
