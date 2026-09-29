import { expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { ImageLimits, ImageRotation, ImageSettings } from "@repo/pdf-engine";

export interface ImageFixture {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export const imageFixture = async (
  page: Page,
  name = "picture.png",
  width = 120,
  height = 80,
  type = "image/png",
  transparent = false,
): Promise<ImageFixture> => {
  const data = await page.evaluate(
    async ({ width, height, type, transparent }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d")!;
      const colors = transparent
        ? ["rgba(255,0,0,0)", "rgba(255,0,0,0.5)", "#0000ff", "#ffff00"]
        : ["#ff0000", "#00ff00", "#0000ff", "#ffff00"];
      colors.forEach((color, index) => {
        context.fillStyle = color;
        context.fillRect(
          ((index % 2) * width) / 2,
          (Math.floor(index / 2) * height) / 2,
          width / 2,
          height / 2,
        );
      });
      context.fillStyle = "#000000";
      context.font = `${Math.max(2, Math.floor(Math.min(width, height) / 12))}px sans-serif`;
      context.fillText("TOP", width / 3, height / 10);
      context.fillText("LEFT", width / 20, height / 2);
      return canvas.toDataURL(type, 0.95).split(",")[1]!;
    },
    { width, height, type, transparent },
  );
  return { name, mimeType: type, buffer: Buffer.from(data, "base64") };
};

export const withOrientation = (fixture: ImageFixture, orientation: number): ImageFixture => {
  const segment = Buffer.alloc(36);
  segment.set([255, 225, 0, 34]);
  segment.write("Exif\0\0", 4, "binary");
  segment.write("II", 10);
  segment.writeUInt16LE(42, 12);
  segment.writeUInt32LE(8, 14);
  segment.writeUInt16LE(1, 18);
  segment.writeUInt16LE(0x112, 20);
  segment.writeUInt16LE(3, 22);
  segment.writeUInt32LE(1, 24);
  segment.writeUInt16LE(orientation, 28);
  return {
    ...fixture,
    name: `orientation-${orientation}.jpg`,
    buffer: Buffer.concat([fixture.buffer.subarray(0, 2), segment, fixture.buffer.subarray(2)]),
  };
};

export const pngChunk = (type: string, data: Buffer) => {
  const name = Buffer.from(type);
  const bytes = Buffer.concat([name, data]);
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

export const animatedPng = (fixture: ImageFixture): ImageFixture => {
  const animation = Buffer.alloc(8);
  animation.writeUInt32BE(1);
  const frame = Buffer.alloc(26);
  fixture.buffer.copy(frame, 4, 16, 24);
  frame.writeUInt16BE(1, 20);
  frame.writeUInt16BE(10, 22);
  return {
    ...fixture,
    name: "animated.png",
    buffer: Buffer.concat([
      fixture.buffer.subarray(0, 33),
      pngChunk("acTL", animation),
      pngChunk("fcTL", frame),
      fixture.buffer.subarray(33),
    ]),
  };
};

export const engineImages = async (
  page: Page,
  fixtures: readonly ImageFixture[],
  settings: ImageSettings,
  rotations: readonly ImageRotation[] = [],
  limits?: ImageLimits,
) =>
  page.evaluate(
    async ({ fixtures, settings, rotations, limits }) => {
      const { imagesToPdf } = await import(new URL("./assets/images.js", location.href).href);
      const result = await imagesToPdf({
        inputs: fixtures.map((fixture, index) => ({
          id: String(index),
          name: fixture.name,
          rotation: rotations[index] ?? 0,
          blob: new Blob([new Uint8Array(fixture.bytes)], { type: fixture.mimeType }),
        })),
        settings,
        limits,
      });
      if (result.kind !== "success") {
        return { kind: result.kind as string, message: result.message as string, outputs: [] };
      }
      const outputs: { name: string; bytes: number[] }[] = [];
      for (const output of result.value) {
        outputs.push({
          name: output.suggestedFilename,
          bytes: Array.from(new Uint8Array(await output.blob.arrayBuffer())),
        });
      }
      return { kind: "success", message: "", outputs };
    },
    {
      fixtures: fixtures.map(({ buffer, ...fixture }) => ({
        ...fixture,
        bytes: Array.from(buffer),
      })),
      settings,
      rotations,
      limits,
    },
  );

export const generateImages = async (page: Page) => {
  await page.getByRole("button", { name: /^(Convert to PDF|Retry conversion)$/ }).click();
  await expect(page.getByRole("heading", { name: "Your image PDFs are ready" })).toBeFocused();
};

export const downloadImagePdf = async (page: Page, label = "Download PDF") => {
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: label, exact: true }).click();
  const download = await downloaded;
  return { name: download.suggestedFilename(), bytes: await readFile((await download.path())!) };
};
