export const renderPdfPreview = async (file: File, signal: AbortSignal) => {
  const { previewPdf } = await import("@repo/pdf-engine/preview");
  return previewPdf(file, signal);
};

export const renderImagePreview = async (file: File, signal: AbortSignal) => {
  const { previewImage } = await import("@repo/pdf-engine/image-preview");
  return previewImage(file, signal);
};

export const renderPdfPagePreview = async (file: File, signal: AbortSignal, page: string) => {
  const { previewPdf } = await import("@repo/pdf-engine/preview");
  return previewPdf(file, signal, Number(page));
};
