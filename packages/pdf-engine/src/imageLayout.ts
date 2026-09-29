import type { ImageLimits, ImageRotation, ImageSettings } from "./imageTypes";
import { checkImageDimensions } from "./inspectImage.ts";
import { PdfError } from "./pdfError.ts";
import { enforceLimit } from "./resourceLimits.ts";
import { safeFilenameStem, uniquePdfFilenames } from "./pdfFilename.ts";

export const defaultImageSettings: ImageSettings = {
  grouping: "combined",
  paper: "a4",
  orientation: "auto",
  margin: 10,
};

export const validateImageSettings = (settings: ImageSettings) => {
  if (
    !["combined", "separate"].includes(settings.grouping) ||
    !["a4", "letter", "image"].includes(settings.paper) ||
    !["auto", "portrait", "landscape"].includes(settings.orientation) ||
    ![0, 10, 20].includes(settings.margin)
  ) {
    throw new PdfError(
      "invalid",
      "Choose valid image output, paper, orientation and margin settings.",
    );
  }
};

export const imageLayout = (
  width: number,
  height: number,
  rotation: ImageRotation,
  settings: ImageSettings,
  limits: ImageLimits = {},
) => {
  validateImageSettings(settings);
  checkImageDimensions(width, height, limits);
  if (![0, 90, 180, 270].includes(rotation)) {
    throw new PdfError("invalid", "Image rotation must be in 90-degree steps.");
  }
  const sideways = rotation === 90 || rotation === 270;
  const pixelWidth = sideways ? height : width;
  const pixelHeight = sideways ? width : height;
  let pageWidth = pixelWidth * 0.75;
  let pageHeight = pixelHeight * 0.75;
  const margin = settings.paper === "image" ? 0 : (settings.margin * 72) / 25.4;
  if (settings.paper !== "image") {
    const portrait: readonly [number, number] =
      settings.paper === "a4" ? [(210 * 72) / 25.4, (297 * 72) / 25.4] : [612, 792];
    const landscape =
      settings.orientation === "landscape" ||
      (settings.orientation === "auto" && pixelWidth > pixelHeight);
    pageWidth = portrait[landscape ? 1 : 0];
    pageHeight = portrait[landscape ? 0 : 1];
  }
  enforceLimit(
    pageWidth,
    limits.pageWidth,
    "PDF page width in points",
    "Choose A4 or Letter paper.",
  );
  enforceLimit(
    pageHeight,
    limits.pageHeight,
    "PDF page height in points",
    "Choose A4 or Letter paper.",
  );
  const scale = Math.min(
    (pageWidth - 2 * margin) / pixelWidth,
    (pageHeight - 2 * margin) / pixelHeight,
  );
  const drawWidth = pixelWidth * scale;
  const drawHeight = pixelHeight * scale;
  return {
    pixelWidth,
    pixelHeight,
    pageWidth,
    pageHeight,
    drawWidth,
    drawHeight,
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
  };
};

export const imageOutputNames = (names: readonly string[], settings: ImageSettings) => {
  validateImageSettings(settings);
  if (!names.length) {
    throw new PdfError("invalid", "Add at least one JPEG or PNG.");
  }
  const stems = names.map((name) =>
    safeFilenameStem(`${name.replace(/\.[^.]*$/u, "")}.pdf`, ".pdf"),
  );
  return {
    filenames: uniquePdfFilenames(
      settings.grouping === "combined"
        ? [`${stems[0]}-images.pdf`]
        : stems.map((stem) => `${stem}-converted.pdf`),
    ),
    bundleName: `${stems[0]}-images.zip`,
  };
};
