import { PdfError } from "./pdfError.ts";
import { enforceLimit } from "./resourceLimits.ts";
import type { ImageLimits } from "./imageTypes";

const invalid = () => new PdfError("invalid", "This image is corrupt. Export a new JPEG or PNG.");
const read = async (blob: Blob, offset: number, length: number) => {
  if (offset < 0 || offset + length > blob.size) {
    throw invalid();
  }
  return new DataView(await blob.slice(offset, offset + length).arrayBuffer());
};

export const checkImageDimensions = (width: number, height: number, limits: ImageLimits) => {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isSafeInteger(width * height)
  ) {
    throw new PdfError("invalid", "The image has invalid pixel dimensions. Export a new image.");
  }
  enforceLimit(
    Math.max(width, height),
    limits.maxDimension,
    "Image dimension in pixels",
    "Prepare a smaller source image externally.",
  );
  enforceLimit(
    width * height,
    limits.perImagePixels,
    "Decoded image pixels",
    "Prepare a smaller source image externally.",
  );
};

const inspectPng = async (blob: Blob) => {
  let offset = 8;
  let width = 0;
  let height = 0;
  let hasPixels = false;
  while (offset < blob.size) {
    const chunk = await read(blob, offset, 8);
    const length = chunk.getUint32(0);
    const type = chunk.getUint32(4);
    if (length > 0x7fffffff || offset + 12 + length > blob.size) {
      throw invalid();
    }
    if (offset === 8) {
      if (type !== 0x49484452 || length !== 13) {
        throw invalid();
      }
      const dimensions = await read(blob, offset + 8, 8);
      width = dimensions.getUint32(0);
      height = dimensions.getUint32(4);
    } else if (type === 0x49484452) {
      throw invalid();
    }
    if (type === 0x6163544c || type === 0x6663544c || type === 0x66644154) {
      throw new PdfError(
        "unsupported",
        "Animated PNGs are not supported. Export a still PNG or JPEG instead.",
      );
    }
    if (type === 0x49444154) {
      hasPixels = true;
    }
    if (type === 0x49454e44) {
      if (!hasPixels || length !== 0 || offset + 12 !== blob.size) {
        throw invalid();
      }
      return { format: "png" as const, width, height };
    }
    offset += 12 + length;
  }
  throw invalid();
};

const hasJpegEnd = async (blob: Blob, start: number) => {
  let previous = 0;
  for (let position = start; position < blob.size; position += 65536) {
    const bytes = new Uint8Array(await blob.slice(position, position + 65536).arrayBuffer());
    for (const byte of bytes) {
      if (previous === 0xff && byte === 0xd9) {
        return true;
      }
      previous = byte;
    }
  }
  return false;
};

const inspectJpeg = async (blob: Blob) => {
  let offset = 2;
  let width = 0;
  let height = 0;
  while (offset < blob.size) {
    const marker = await read(blob, offset, 2);
    if (marker.getUint8(0) !== 0xff) {
      throw invalid();
    }
    const type = marker.getUint8(1);
    if (type === 0xff) {
      offset++;
      continue;
    }
    const length = (await read(blob, offset + 2, 2)).getUint16(0);
    if (length < 2 || offset + 2 + length > blob.size) {
      throw invalid();
    }
    if (type === 0xda) {
      if (!width || !height || !(await hasJpegEnd(blob, offset + 2 + length))) {
        throw invalid();
      }
      return { format: "jpeg" as const, width, height };
    }
    if (type >= 0xc0 && type <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(type)) {
      if (length < 8) {
        throw invalid();
      }
      const dimensions = await read(blob, offset + 5, 4);
      height = dimensions.getUint16(0);
      width = dimensions.getUint16(2);
    }
    offset += 2 + length;
  }
  throw invalid();
};

export const inspectImage = async (blob: Blob, limits: ImageLimits = {}) => {
  enforceLimit(blob.size, limits.perInputBytes, "Image input bytes", "Use a smaller source image.");
  const header = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => header[index] === value);
  const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255;
  if (!png && !jpeg) {
    throw new PdfError("unsupported", "Unsupported image content. Choose a static JPEG or PNG.");
  }
  const info = await (png ? inspectPng(blob) : inspectJpeg(blob));
  checkImageDimensions(info.width, info.height, limits);
  return info;
};
