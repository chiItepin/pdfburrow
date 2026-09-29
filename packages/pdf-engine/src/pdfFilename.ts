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

export const uniquePdfFilenames = (filenames: readonly string[]): string[] => {
  const names = new Set<string>();
  return filenames.map((name) => {
    const stem = pdfStem(name);
    let filename = `${stem}.pdf`;
    let suffix = 2;
    while (names.has(filename.toLowerCase())) {
      filename = `${stem}-${suffix++}.pdf`;
    }
    names.add(filename.toLowerCase());
    return filename;
  });
};
