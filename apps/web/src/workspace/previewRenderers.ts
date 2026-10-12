import { imageLimits, pdfLimits } from "./resourcePolicy";
import type { InputRow } from "./types";

export const formPreviewSources = (inputs: readonly InputRow[]) =>
  inputs.flatMap((input) =>
    input.status === "ready" && "hasEditableForms" in input.info && input.info.hasEditableForms
      ? [input.id]
      : [],
  );

export const prepareFormPreview = async (file: File, signal: AbortSignal) => {
  const { preparePdfPreview } = await import("@repo/pdf-engine/preview");
  return new File([await preparePdfPreview(file, signal, pdfLimits)], file.name, {
    type: "application/pdf",
  });
};

const pdfPreviewLimits = {
  inputBytes: pdfLimits.perInputBytes,
};

export const renderPdfPreview = async (file: File, signal: AbortSignal) => {
  const { previewPdf } = await import("@repo/pdf-engine/preview");
  return previewPdf(file, signal, 1, pdfPreviewLimits);
};

export const renderImagePreview = async (file: File, signal: AbortSignal) => {
  const { previewImage } = await import("@repo/pdf-engine/image-preview");
  return previewImage(file, signal, {
    inputBytes: imageLimits.perInputBytes,
    decodedPixels: imageLimits.perImagePixels,
    width: imageLimits.maxDimension,
    height: imageLimits.maxDimension,
  });
};

export const renderPdfPagePreview = async (file: File, signal: AbortSignal, page: string) => {
  const { previewPdf } = await import("@repo/pdf-engine/preview");
  return previewPdf(file, signal, Number(page), pdfPreviewLimits);
};
