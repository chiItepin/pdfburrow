import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import test from "node:test";
import { validatePng } from "../packages/pdf-engine/src/validatePng.ts";
import { inspectImage } from "../packages/pdf-engine/src/inspectImage.ts";

const chunk = (type, data) => {
  const bytes = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, bytes, checksum]);
};
const png = (
  data,
  { depth = 8, color = 2, interlace = 0, compressed = deflateSync(data) } = {},
) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = depth;
  header[9] = color;
  header[12] = interlace;
  return new Blob([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

test("PNG integrity verifies compressed scanline counts and all supported color depths", async () => {
  for (const color of [0, 2, 3, 4, 6]) {
    const channels = color === 0 || color === 3 ? 1 : color === 2 ? 3 : color === 4 ? 2 : 4;
    for (const depth of color === 0 ? [1, 2, 4, 8, 16] : color === 3 ? [1, 2, 4, 8] : [8, 16]) {
      for (const interlace of [0, 1]) {
        const image = png(Buffer.alloc(1 + Math.ceil((channels * depth) / 8)), {
          color,
          depth,
          interlace,
        });
        await inspectImage(image);
        await validatePng(image);
      }
    }
  }
});

test("PNG corruption cannot be repaired into a blank image by a permissive browser decoder", async () => {
  for (const data of [
    Buffer.alloc(0),
    Buffer.alloc(3),
    Buffer.alloc(5),
    Buffer.from([5, 0, 0, 0]),
  ]) {
    await assert.rejects(validatePng(png(data)), /corrupt pixel data/);
  }
  await assert.rejects(
    validatePng(png(Buffer.alloc(4), { compressed: Buffer.from([0, 0, 0]) })),
    /corrupt pixel data/,
  );
  const compressed = deflateSync(Buffer.alloc(4));
  compressed[compressed.length - 1] ^= 1;
  await assert.rejects(validatePng(png(Buffer.alloc(4), { compressed })), /corrupt pixel data/);
  const bytes = new Uint8Array(await png(Buffer.alloc(4)).arrayBuffer());
  bytes[29] ^= 1;
  await assert.rejects(validatePng(new Blob([bytes])), /corrupt pixel data/);
});
