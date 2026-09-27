import type { PdfOutput } from "@repo/pdf-engine";

export const createOutputStore = () => {
  let output: (PdfOutput & { url?: string; requested: boolean }) | undefined;

  const clear = () => {
    if (output?.url) {
      URL.revokeObjectURL(output.url);
    }
    output = undefined;
  };

  return {
    clear,
    retain: (value: PdfOutput) => {
      clear();
      output = { ...value, requested: false };
    },
    needsDownload: () => Boolean(output && !output.requested),
    requestDownload: () => {
      if (!output) {
        throw new Error("No merged PDF is available. Merge your inputs first.");
      }
      const anchor = document.createElement("a");
      try {
        output.url ??= URL.createObjectURL(output.blob);
        anchor.href = output.url;
        anchor.download = output.suggestedFilename;
        document.body.append(anchor);
        anchor.click();
        output.requested = true;
      } finally {
        anchor.remove();
      }
    },
  };
};
