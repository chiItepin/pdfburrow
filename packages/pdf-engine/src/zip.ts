import { Zip, ZipPassThrough } from "fflate";
import { PdfError } from "./pdfError.ts";
import { enforceLimit } from "./resourceLimits.ts";
import type { BundleProgress, BundleRequest } from "./bundleTypes";
import type { PdfOutput } from "./types";

export const packageOutputs = async (
  request: BundleRequest,
  progress: (value: BundleProgress) => void,
): Promise<PdfOutput> => {
  const { outputs, filename, limits = {} } = request;
  if (outputs.length < 2) {
    throw new PdfError(
      "invalid",
      "A ZIP requires multiple outputs. Download a single PDF directly.",
    );
  }
  const names = new Set<string>();
  for (const output of outputs) {
    const name = output.suggestedFilename;
    if (
      !name.toLowerCase().endsWith(".pdf") ||
      /[<>:"/\\|?*]|\p{Cc}/u.test(name) ||
      /^[. ]|[. ]$/u.test(name) ||
      names.has(name.toLowerCase())
    ) {
      throw new PdfError("invalid", "Each ZIP entry needs a unique, filesystem-safe PDF filename.");
    }
    names.add(name.toLowerCase());
  }
  if (!filename.endsWith(".zip") || /[<>:"/\\|?*]|\p{Cc}/u.test(filename)) {
    throw new PdfError("invalid", "The bundle needs a filesystem-safe ZIP filename.");
  }
  enforceLimit(outputs.length, limits.outputCount, "Output count", "Generate fewer outputs.");
  enforceLimit(
    outputs.reduce((sum, output) => sum + output.blob.size, 0),
    limits.totalOutputBytes,
    "Retained output bytes",
    "Download individual PDFs or generate fewer outputs.",
  );
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let bytes = 0;
  const zip = new Zip((error, data) => {
    if (error) {
      throw error;
    }
    bytes += data.byteLength;
    enforceLimit(
      bytes,
      limits.bundleBytes,
      "ZIP bytes",
      "Download individual PDFs or generate fewer outputs.",
    );
    chunks.push(new Uint8Array(data));
  });
  try {
    for (const [index, output] of outputs.entries()) {
      const entry = new ZipPassThrough(output.suggestedFilename);
      entry.mtime = new Date(1980, 0, 1);
      zip.add(entry);
      entry.push(new Uint8Array(await output.blob.arrayBuffer()), true);
      progress({ completed: index + 1, total: outputs.length, bytes });
    }
    zip.end();
    return {
      blob: new Blob(chunks, { type: "application/zip" }),
      suggestedFilename: filename,
    };
  } finally {
    zip.terminate();
  }
};
