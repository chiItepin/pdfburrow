import { imageLimits, pdfLimits } from "./resourcePolicy";

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
