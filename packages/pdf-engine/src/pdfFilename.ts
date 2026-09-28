export const pdfStem = (name: string): string =>
  name
    .replace(/\.pdf$/iu, "")
    .replace(/\p{Cc}|[<>:"/\\|?*]/gu, "_")
    .replace(/^[. ]+|[. ]+$/gu, "")
    .trim() || "document";
