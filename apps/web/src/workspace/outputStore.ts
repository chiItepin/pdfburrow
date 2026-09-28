import type { PdfOutput } from "@repo/pdf-engine";

interface StoredOutput extends PdfOutput {
  url?: string;
  requested: boolean;
}

const safeStem = (filename: string, extension: string) => {
  const withoutExtension = filename.toLowerCase().endsWith(extension)
    ? filename.slice(0, -extension.length)
    : filename;
  const stem = withoutExtension
    .replace(/\p{Cc}|[<>:"/\\|?*]/gu, "_")
    .replace(/^[. ]+|[. ]+$/gu, "")
    .trim();
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(stem)
    ? `_${stem}`
    : stem || "document";
};

export const bundleFilename = (name: string) => `${safeStem(name, ".zip")}.zip`;

export const createOutputStore = () => {
  let outputs: StoredOutput[] = [];
  let bundle: StoredOutput | undefined;
  const release = (output: StoredOutput) => {
    if (output.url) {
      URL.revokeObjectURL(output.url);
    }
  };
  const clear = () => {
    outputs.forEach(release);
    if (bundle) {
      release(bundle);
    }
    outputs = [];
    bundle = undefined;
  };
  const requestDownload = (output: StoredOutput | undefined) => {
    if (!output) {
      throw new Error("No output is available. Generate it before requesting a download.");
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
  };
  return {
    clear,
    retain: (values: readonly PdfOutput[]) => {
      if (!values.length) {
        throw new Error("The operation returned no PDFs. Your inputs are retained; retry.");
      }
      const names = new Set<string>();
      const next = values.map((value): StoredOutput => {
        if (!value.blob.size) {
          throw new Error("The operation returned an empty PDF. Your inputs are retained; retry.");
        }
        const stem = safeStem(value.suggestedFilename, ".pdf");
        let filename = `${stem}.pdf`;
        let suffix = 2;
        while (names.has(filename.toLowerCase())) {
          filename = `${stem}-${suffix++}.pdf`;
        }
        names.add(filename.toLowerCase());
        return { blob: value.blob, suggestedFilename: filename, requested: false };
      });
      clear();
      outputs = next;
      return outputs.map((output) => ({
        filename: output.suggestedFilename,
        bytes: output.blob.size,
      }));
    },
    values: (): readonly PdfOutput[] =>
      outputs.map(({ blob, suggestedFilename }) => ({ blob, suggestedFilename })),
    needsDownload: () => outputs.some((output) => !output.requested),
    requestPdf: (index: number) => requestDownload(outputs[index]),
    retainBundle: (value: PdfOutput) => {
      if (bundle) {
        release(bundle);
      }
      bundle = { ...value, requested: false };
    },
    requestBundle: () => {
      requestDownload(bundle);
      outputs.forEach((output) => {
        output.requested = true;
      });
    },
    usage: () => ({
      count: outputs.length,
      bytes: outputs.reduce((sum, output) => sum + output.blob.size, 0),
      bundleBytes: bundle?.blob.size ?? 0,
    }),
  };
};
