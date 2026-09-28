import { runWorker } from "./workerClient";
import type { WorkerOptions } from "./workerClient";
import type { SplitRequest } from "./splitTypes";
import type { PdfOutput, PdfProgress } from "./types";

export const splitPdf = (request: SplitRequest, options: WorkerOptions<PdfProgress> = {}) =>
  runWorker<SplitRequest, readonly PdfOutput[], PdfProgress>(
    new URL("./split.worker.js", import.meta.url),
    "pdfburrow-split",
    request,
    options,
  );
