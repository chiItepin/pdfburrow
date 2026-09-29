import type { ImageInfo, ImageLimits, ImageRotation } from "./imageTypes";
import { checkImageDimensions, inspectImage } from "./inspectImage";
import { PdfError } from "./pdfError";
import type { PdfInput } from "./types";
import { validatePng } from "./validatePng";

export const decodeImage = async (input: PdfInput, limits: ImageLimits = {}) => {
  const header = await inspectImage(input.blob, limits);
  if (header.format === "png") {
    await validatePng(input.blob);
  }
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") {
    throw new PdfError(
      "unsupported",
      "This browser cannot decode images locally in a worker. Use a current browser with image bitmap and offscreen canvas support.",
    );
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(
      input.blob.slice(0, input.blob.size, `image/${header.format}`),
      { imageOrientation: "from-image" },
    );
  } catch {
    throw new PdfError(
      "invalid",
      "This image could not be decoded. Export a new static JPEG or PNG, or prepare a smaller source image.",
    );
  }
  try {
    checkImageDimensions(bitmap.width, bitmap.height, limits);
    if (
      !(bitmap.width === header.width && bitmap.height === header.height) &&
      !(bitmap.width === header.height && bitmap.height === header.width)
    ) {
      throw new PdfError(
        "unsupported",
        "The browser changed the decoded pixel dimensions. This image cannot be converted without resizing; use a different source or browser.",
      );
    }
    const extensionMatches =
      header.format === "jpeg" ? /\.jpe?g$/iu.test(input.name) : /\.png$/iu.test(input.name);
    const mimeMatches =
      !input.blob.type || input.blob.type.toLowerCase() === `image/${header.format}`;
    const info: ImageInfo = {
      pageCount: 1,
      format: header.format,
      width: bitmap.width,
      height: bitmap.height,
      warnings:
        extensionMatches && mimeMatches
          ? []
          : [
              `Format mismatch: this file contains ${header.format.toUpperCase()}, regardless of its filename or file type label.`,
            ],
    };
    return { bitmap, info };
  } catch (error) {
    bitmap.close();
    throw error;
  }
};

export const validateImageInput = async (input: PdfInput, limits?: ImageLimits) => {
  const { bitmap, info } = await decodeImage(input, limits);
  bitmap.close();
  return info;
};

const drawImageOnWhite = (bitmap: ImageBitmap, rotation: ImageRotation, scale: number) => {
  const sideways = rotation === 90 || rotation === 270;
  const width = sideways ? bitmap.height : bitmap.width;
  const height = sideways ? bitmap.width : bitmap.height;
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(width * scale)),
    Math.max(1, Math.round(height * scale)),
  );
  const context = canvas.getContext("2d");
  if (!context) {
    throw new PdfError("unsupported", "The browser cannot draw this image. Try another browser.");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.scale(canvas.width / width, canvas.height / height);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  return canvas;
};

export const imagePng = async (bitmap: ImageBitmap, rotation: ImageRotation, scale = 1) => {
  const canvas = drawImageOnWhite(bitmap, rotation, scale);
  try {
    return await canvas.convertToBlob({ type: "image/png" });
  } finally {
    canvas.width = canvas.height = 0;
  }
};
