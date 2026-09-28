export const safeFilenameStem = (filename: string, extension: ".pdf" | ".zip"): string => {
  const withoutExtension = filename.toLowerCase().endsWith(extension)
    ? filename.slice(0, -extension.length)
    : filename;
  const stem = withoutExtension
    .replace(/\p{Cc}|[<>:"/\\|?*]/gu, "_")
    .replace(/^[.\s]+|[.\s]+$/gu, "");
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(stem)
    ? `_${stem}`
    : stem || "document";
};

export const pdfStem = (name: string): string => safeFilenameStem(name, ".pdf");
