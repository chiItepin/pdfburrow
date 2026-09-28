import { runWorker } from "./workerClient";

export interface ImagePreviewLimits {
  readonly inputBytes?: number;
  readonly decodedPixels?: number;
  readonly width?: number;
  readonly height?: number;
}

export interface ImagePreviewRequest {
  readonly blob: Blob;
  readonly limits?: ImagePreviewLimits;
}

export const previewImage = async (
  blob: Blob,
  signal: AbortSignal,
  limits?: ImagePreviewLimits,
): Promise<Blob> => {
  const result = await runWorker<ImagePreviewRequest, Blob, never>(
    new URL("./image-preview.worker.js", import.meta.url),
    "pdfburrow-image-preview",
    { blob, limits },
    { signal },
  );
  if (result.kind === "cancelled") {
    throw new DOMException("Image preview cancelled.", "AbortError");
  }
  if (result.kind === "failure") {
    throw new Error(result.message);
  }
  return result.value;
};
