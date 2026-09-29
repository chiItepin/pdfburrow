import { PdfError } from "./pdfError.ts";

const corrupt = () =>
  new PdfError(
    "invalid",
    "This PNG has corrupt pixel data or checksums. Export a new still PNG or JPEG.",
  );
const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let value = byte;
  for (let bit = 0; bit < 8; bit++) {
    value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return value >>> 0;
});
const updateCrc = (crc: number, bytes: Uint8Array) => {
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8);
  }
  return crc;
};

const scanlineValidator = (header: DataView) => {
  const width = header.getUint32(0);
  const height = header.getUint32(4);
  const depth = header.getUint8(8);
  const color = header.getUint8(9);
  const interlace = header.getUint8(12);
  const channels =
    color === 0 || color === 3 ? 1 : color === 2 ? 3 : color === 4 ? 2 : color === 6 ? 4 : 0;
  const depths = color === 0 ? [1, 2, 4, 8, 16] : color === 3 ? [1, 2, 4, 8] : [8, 16];
  if (
    !width ||
    !height ||
    !channels ||
    !depths.includes(depth) ||
    header.getUint8(10) !== 0 ||
    header.getUint8(11) !== 0 ||
    interlace > 1
  ) {
    throw corrupt();
  }
  const steps = interlace
    ? [
        [0, 0, 8, 8],
        [4, 0, 8, 8],
        [0, 4, 4, 8],
        [2, 0, 4, 4],
        [0, 2, 2, 4],
        [1, 0, 2, 2],
        [0, 1, 1, 2],
      ]
    : [[0, 0, 1, 1]];
  const passes = steps
    .map(([x, y, dx, dy]) => ({
      width: Math.max(0, Math.ceil((width - x!) / dx!)),
      height: Math.max(0, Math.ceil((height - y!) / dy!)),
    }))
    .filter((pass) => pass.width && pass.height)
    .map((pass) => ({
      bytes: 1 + Math.ceil((pass.width * channels * depth) / 8),
      rows: pass.height,
    }));
  let passIndex = 0;
  let row = 0;
  let offset = 0;
  return {
    accept: (data: Uint8Array) => {
      let cursor = 0;
      while (cursor < data.length) {
        const pass = passes[passIndex];
        if (!pass || (offset === 0 && data[cursor]! > 4)) {
          throw corrupt();
        }
        const length = Math.min(data.length - cursor, pass.bytes - offset);
        cursor += length;
        offset += length;
        if (offset === pass.bytes) {
          offset = 0;
          if (++row === pass.rows) {
            passIndex++;
            row = 0;
          }
        }
      }
    },
    finish: () => {
      if (passIndex !== passes.length || offset !== 0) {
        throw corrupt();
      }
    },
  };
};

export const validatePng = async (blob: Blob) => {
  const header = new DataView(await blob.slice(16, 29).arrayBuffer());
  const scanlines = scanlineValidator(header);
  const parts: Blob[] = [];
  let endedPixels = false;
  for (let offset = 8; offset < blob.size;) {
    const chunk = new DataView(await blob.slice(offset, offset + 8).arrayBuffer());
    const length = chunk.getUint32(0);
    const type = chunk.getUint32(4);
    const end = offset + 8 + length;
    if (end + 4 > blob.size) {
      throw corrupt();
    }
    let crc = 0xffffffff;
    for (let position = offset + 4; position < end; position += 65536) {
      crc = updateCrc(
        crc,
        new Uint8Array(await blob.slice(position, Math.min(end, position + 65536)).arrayBuffer()),
      );
    }
    const checksum = new DataView(await blob.slice(end, end + 4).arrayBuffer()).getUint32(0);
    if ((crc ^ 0xffffffff) >>> 0 !== checksum) {
      throw corrupt();
    }
    if (type === 0x49444154) {
      if (endedPixels) {
        throw corrupt();
      }
      parts.push(blob.slice(offset + 8, end));
    } else if (parts.length) {
      endedPixels = true;
    }
    offset = end + 4;
  }
  if (typeof DecompressionStream !== "function") {
    throw new PdfError(
      "unsupported",
      "This browser cannot verify PNG pixel data locally. Use a current browser with decompression stream support.",
    );
  }
  try {
    await new Blob(parts)
      .stream()
      .pipeThrough(new DecompressionStream("deflate"))
      .pipeTo(new WritableStream({ write: scanlines.accept, close: scanlines.finish }));
  } catch {
    throw corrupt();
  }
};
