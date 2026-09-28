import type { BundleProgress, BundleRequest } from "./bundleTypes";
import type { PdfOutput } from "./types";
import { runWorker } from "./workerClient";
import type { WorkerOptions } from "./workerClient";

export const bundlePdfs = (request: BundleRequest, options: WorkerOptions<BundleProgress> = {}) =>
  runWorker<BundleRequest, PdfOutput, BundleProgress>(
    new URL("./bundle.worker.js", import.meta.url),
    "pdfburrow-bundle",
    request,
    options,
  );
