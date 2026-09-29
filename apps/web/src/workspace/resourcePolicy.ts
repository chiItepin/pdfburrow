import type { BundleLimits, ImageLimits, PdfLimits } from "@repo/pdf-engine";
import type { InputRow } from "./types";

const mebibyte = 1024 * 1024;

// Provisional guardrails, not a measured memory budget or a device-support guarantee.
export const pdfLimits = {
  inputCount: 20,
  perInputBytes: 20 * mebibyte,
  totalInputBytes: 50 * mebibyte,
  sourcePages: 200,
  totalPages: 200,
  pageDimension: 14400,
  outputCount: 50,
  outputBytes: 50 * mebibyte,
} as const satisfies PdfLimits;

export const imageLimits = {
  ...pdfLimits,
  perImagePixels: 12_000_000,
  totalPixels: 24_000_000,
  maxDimension: 8192,
  pageWidth: 6144,
  pageHeight: 6144,
} as const satisfies ImageLimits;

export const bundleLimits = {
  outputCount: pdfLimits.outputCount,
  totalOutputBytes: pdfLimits.outputBytes,
  bundleBytes: 52 * mebibyte,
} as const satisfies BundleLimits;

export const fileAdditionError = (
  retained: { readonly count: number; readonly bytes: number },
  added: readonly { readonly size: number }[],
) => {
  if (retained.count + added.length > pdfLimits.inputCount) {
    return "No files added. Keep at most 20 inputs in this draft; remove files and try again.";
  }
  if (added.some((file) => file.size > pdfLimits.perInputBytes)) {
    return "No files added. Each input must be at most 20 MiB; prepare smaller source files.";
  }
  if (
    retained.bytes + added.reduce((sum, file) => sum + file.size, 0) >
    pdfLimits.totalInputBytes
  ) {
    return "No files added. Inputs must total at most 50 MiB; remove files and try again.";
  }
  return "";
};

export const draftResourceError = (inputs: readonly InputRow[]) => {
  let pages = 0;
  let pixels = 0;
  for (const input of inputs) {
    if (input.status !== "ready") {
      continue;
    }
    pages += input.info.pageCount;
    if ("width" in input.info) {
      pixels += input.info.width * input.info.height;
    }
  }
  if (pages > pdfLimits.totalPages) {
    return "This draft exceeds the provisional 200-page limit. Remove some inputs.";
  }
  if (pixels > imageLimits.totalPixels) {
    return "This draft exceeds the provisional 24-million-pixel limit. Remove some images.";
  }
  return "";
};
