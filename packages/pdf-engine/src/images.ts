import type { ImageInfo, ImageLimits, ImagesRequest } from "./imageTypes";
import type { PdfInput, PdfOutput, PdfProgress } from "./types";
import { runWorker } from "./workerClient";
import type { WorkerOptions } from "./workerClient";

export type ImageWorkerRequest =
  | { readonly operation: "validate"; readonly input: PdfInput; readonly limits?: ImageLimits }
  | { readonly operation: "convert"; readonly request: ImagesRequest };

export const validateImage = (
  input: PdfInput,
  options: WorkerOptions<never> = {},
  limits?: ImageLimits,
) =>
  runWorker<ImageWorkerRequest, ImageInfo, never>(
    new URL("./images.worker.js", import.meta.url),
    "pdfburrow-image-validation",
    { operation: "validate", input, limits },
    options,
  );

export const imagesToPdf = (request: ImagesRequest, options: WorkerOptions<PdfProgress> = {}) =>
  runWorker<ImageWorkerRequest, readonly PdfOutput[], PdfProgress>(
    new URL("./images.worker.js", import.meta.url),
    "pdfburrow-images",
    { operation: "convert", request },
    options,
  );
