import { PdfError } from "./pdfError.ts";

export const enforceLimit = (
  value: number,
  maximum: number | undefined,
  label: string,
  remedy: string,
) => {
  if (maximum === undefined) {
    return;
  }
  if (!Number.isFinite(maximum) || maximum <= 0) {
    throw new PdfError("limit", `The configured ${label} limit is invalid.`);
  }
  if (value > maximum) {
    throw new PdfError(
      "limit",
      `${label}: ${value} exceeds the configured limit of ${maximum}. ${remedy}`,
    );
  }
};
