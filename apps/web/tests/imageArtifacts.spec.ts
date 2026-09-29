import { expect, test } from "@playwright/test";
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { defaultImageSettings, imageLayout } from "@repo/pdf-engine/image-layout";
import type { ImageRotation } from "@repo/pdf-engine";
import { inspectArtifact } from "./fixtures/pdfArtifacts";
import { engineImages, imageFixture, pngChunk, withOrientation } from "./fixtures/imageFixtures";

const colors = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 0],
];
const orientations = [
  [0, 1, 2, 3],
  [1, 0, 3, 2],
  [3, 2, 1, 0],
  [2, 3, 0, 1],
  [0, 2, 1, 3],
  [2, 0, 3, 1],
  [3, 1, 2, 0],
  [1, 3, 0, 2],
];
const assertColors = (
  pixels: Uint8Array,
  width: number,
  height: number,
  expected: readonly number[][],
) => {
  expected.forEach((color, index) => {
    const x = Math.floor(width * (index % 2 ? 0.75 : 0.25));
    const y = Math.floor(height * (index < 2 ? 0.25 : 0.75));
    for (let channel = 0; channel < 3; channel++) {
      expect(
        Math.abs(pixels[(y * width + x) * 4 + channel]! - color[channel]!),
      ).toBeLessThanOrEqual(5);
    }
  });
};

test("all EXIF variants and manual quarter turns agree in previews and rendered PDFs", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("./");
  const jpeg = await imageFixture(page, "portrait.jpg", 400, 800, "image/jpeg");
  for (let orientation = 1; orientation <= 8; orientation++) {
    const fixture = withOrientation(jpeg, orientation);
    const output = await engineImages(page, [fixture], { ...defaultImageSettings, paper: "image" });
    expect(output.kind, output.message).toBe("success");
    const bytes = new Uint8Array(output.outputs[0]!.bytes);
    const [rendered] = await inspectArtifact(bytes);
    expect([rendered!.width, rendered!.height]).toEqual(orientation >= 5 ? [600, 300] : [300, 600]);
    const expected = orientations[orientation - 1]!.map((index) => colors[index]!);
    assertColors(rendered!.pixels, rendered!.width, rendered!.height, expected);
    const preview = await page.evaluate(async (bytes) => {
      const { previewImage } = await import(
        new URL("./assets/image-preview.js", location.href).href
      );
      const blob = await previewImage(
        new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
        new AbortController().signal,
      );
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const result = {
        width: bitmap.width,
        height: bitmap.height,
        pixels: Array.from(context.getImageData(0, 0, bitmap.width, bitmap.height).data),
      };
      bitmap.close();
      return result;
    }, Array.from(fixture.buffer));
    assertColors(new Uint8Array(preview.pixels), preview.width, preview.height, expected);
    const doc = await PDFDocument.load(bytes);
    const images = doc.getPage(0).node.Resources()!.lookup(PDFName.of("XObject"));
    expect(images?.toString()).toContain("Image");
    for (const rotation of [90, 180, 270] satisfies ImageRotation[]) {
      const rotated = await engineImages(
        page,
        [fixture],
        { ...defaultImageSettings, paper: "image" },
        [rotation],
      );
      expect(rotated.kind, rotated.message).toBe("success");
      const [artifact] = await inspectArtifact(new Uint8Array(rotated.outputs[0]!.bytes));
      let turned = expected;
      for (let turn = 0; turn < rotation / 90; turn++) {
        turned = [turned[2]!, turned[0]!, turned[3]!, turned[1]!];
      }
      assertColors(artifact!.pixels, artifact!.width, artifact!.height, turned);
    }
  }
});

test("actual PDFs retain native pixels with exact paper geometry, placement and white compositing", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("./");
  const source = await imageFixture(page, "landscape.png", 1200, 800);
  const cases = [
    defaultImageSettings,
    { ...defaultImageSettings, orientation: "portrait" as const },
    { ...defaultImageSettings, paper: "letter" as const, margin: 20 as const },
    { ...defaultImageSettings, paper: "letter" as const, margin: 0 as const },
  ];
  for (const settings of cases) {
    const result = await engineImages(page, [source], settings);
    expect(result.kind, result.message).toBe("success");
    const doc = await PDFDocument.load(new Uint8Array(result.outputs[0]!.bytes));
    const actual = doc.getPage(0);
    const expected = imageLayout(1200, 800, 0, settings);
    expect(actual.getWidth()).toBeCloseTo(expected.pageWidth, 8);
    expect(actual.getHeight()).toBeCloseTo(expected.pageHeight, 8);
    const contents = actual.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray() : [contents];
    const text = streams
      .map((ref) => {
        const stream = doc.context.lookup(ref);
        if (!(stream instanceof PDFRawStream)) {
          throw new Error("Expected a generated PDF content stream.");
        }
        return Buffer.from(decodePDFRawStream(stream).decode()).toString();
      })
      .join("\n");
    expect(text).toContain(`${expected.x} ${expected.y} cm`);
    expect(text).toContain(`${expected.drawWidth} 0 0 ${expected.drawHeight} 0 0 cm`);
    const imageStreams = doc.context
      .enumerateIndirectObjects()
      .map(([, object]) => object)
      .filter(
        (object) =>
          object instanceof PDFRawStream &&
          object.dict.get(PDFName.of("Subtype"))?.toString() === "/Image",
      );
    expect(imageStreams.length).toBeGreaterThan(0);
    for (const image of imageStreams) {
      expect(image).toBeInstanceOf(PDFRawStream);
      if (image instanceof PDFRawStream) {
        expect(image.dict.get(PDFName.of("Width"))?.toString()).toBe("1200");
        expect(image.dict.get(PDFName.of("Height"))?.toString()).toBe("800");
        expect(image.dict.get(PDFName.of("Filter"))?.toString()).toBe("/FlateDecode");
      }
    }
    const [rendered] = await inspectArtifact(new Uint8Array(result.outputs[0]!.bytes));
    if (settings.margin) {
      expect(rendered!.pixels.subarray(0, 4)).toEqual(Buffer.from([255, 255, 255, 255]));
    }
  }
  const transparent = await imageFixture(page, "transparent.png", 120, 80, "image/png", true);
  const result = await engineImages(page, [transparent], {
    ...defaultImageSettings,
    paper: "image",
  });
  const [artifact] = await inspectArtifact(new Uint8Array(result.outputs[0]!.bytes));
  assertColors(artifact!.pixels, artifact!.width, artifact!.height, [
    [255, 255, 255],
    [255, 127, 127],
    [0, 0, 255],
    [255, 255, 0],
  ]);
  const dpi = Buffer.alloc(9);
  dpi.writeUInt32BE(11811, 0);
  dpi.writeUInt32BE(11811, 4);
  dpi[8] = 1;
  const wide = await imageFixture(page, "dpi.png", 960, 480);
  wide.buffer = Buffer.concat([
    wide.buffer.subarray(0, 33),
    pngChunk("pHYs", dpi),
    wide.buffer.subarray(33),
  ]);
  const imageSize = await engineImages(page, [wide], { ...defaultImageSettings, paper: "image" });
  const doc = await PDFDocument.load(new Uint8Array(imageSize.outputs[0]!.bytes));
  expect(doc.getPage(0).getSize()).toEqual({ width: 720, height: 360 });
  for (const [width, height] of [
    [1, 1],
    [1, 4000],
    [4000, 1],
  ]) {
    const tiny = await imageFixture(page, "extreme.png", width!, height!);
    const result = await engineImages(page, [tiny], defaultImageSettings);
    expect(result.kind, result.message).toBe("success");
    expect((await PDFDocument.load(new Uint8Array(result.outputs[0]!.bytes))).getPageCount()).toBe(
      1,
    );
  }
});

test("image worker enforces supplied limits at their actual boundaries without partial outputs", async ({
  page,
}) => {
  await page.goto("./");
  const source = await imageFixture(page);
  const settings = { ...defaultImageSettings, paper: "image" as const };
  const successful = await engineImages(page, [source], settings);
  expect(successful.kind, successful.message).toBe("success");
  const limits = {
    inputCount: 1,
    totalPages: 1,
    outputCount: 1,
    perInputBytes: source.buffer.length,
    totalInputBytes: source.buffer.length,
    perImagePixels: 9600,
    totalPixels: 9600,
    maxDimension: 120,
    pageWidth: 90,
    pageHeight: 60,
  };
  expect((await engineImages(page, [source], settings, [], limits)).kind).toBe("success");
  for (const [key, value] of Object.entries(limits)) {
    const failure = await engineImages(page, [source], settings, [], {
      ...limits,
      [key]: value - 1,
    });
    expect(failure.kind).toBe("failure");
    expect(failure.message).toMatch(/limit/);
    expect(failure.outputs).toEqual([]);
  }
  const byteLimit = await engineImages(page, [source], settings, [], { outputBytes: 1 });
  expect(byteLimit.kind).toBe("failure");
  expect(byteLimit.message).toContain("Total generated PDF bytes");
  const aggregate = await engineImages(
    page,
    [source, source],
    { ...settings, grouping: "separate" },
    [],
    { totalPixels: 19199 },
  );
  expect(aggregate.kind).toBe("failure");
  expect(aggregate.outputs).toEqual([]);
});

test("embedded native-resolution RGB equals browser-decoded pixels without lossy recompression", async ({
  page,
}) => {
  await page.goto("./");
  for (const type of ["image/jpeg", "image/png"]) {
    const fixture = await imageFixture(
      page,
      type === "image/jpeg" ? "original.jpg" : "original.png",
      120,
      80,
      type,
      true,
    );
    const expected = await page.evaluate(
      async ({ bytes, type }) => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type }), {
          imageOrientation: "from-image",
        });
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, bitmap.width, bitmap.height);
        context.drawImage(bitmap, 0, 0);
        const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
        const rgb: number[] = [];
        for (let index = 0; index < rgba.length; index += 4) {
          rgb.push(rgba[index]!, rgba[index + 1]!, rgba[index + 2]!);
        }
        bitmap.close();
        return rgb;
      },
      { bytes: Array.from(fixture.buffer), type },
    );
    const result = await engineImages(page, [fixture], defaultImageSettings);
    expect(result.kind, result.message).toBe("success");
    const doc = await PDFDocument.load(new Uint8Array(result.outputs[0]!.bytes));
    const stream = doc.context
      .enumerateIndirectObjects()
      .map(([, object]) => object)
      .find(
        (object) =>
          object instanceof PDFRawStream &&
          object.dict.get(PDFName.of("Subtype"))?.toString() === "/Image" &&
          object.dict.get(PDFName.of("ColorSpace"))?.toString() === "/DeviceRGB",
      );
    if (!(stream instanceof PDFRawStream)) {
      throw new Error("Expected native RGB image stream.");
    }
    expect(stream.dict.get(PDFName.of("Filter"))?.toString()).toBe("/FlateDecode");
    expect(stream.dict.get(PDFName.of("Width"))?.toString()).toBe("120");
    expect(stream.dict.get(PDFName.of("Height"))?.toString()).toBe("80");
    expect(Buffer.from(decodePDFRawStream(stream).decode())).toEqual(Buffer.from(expected));
  }
});
