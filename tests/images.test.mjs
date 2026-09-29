import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultImageSettings,
  imageLayout,
  imageOutputNames,
} from "../packages/pdf-engine/src/imageLayout.ts";
import { inspectImage } from "../packages/pdf-engine/src/inspectImage.ts";
import { createOutputStore } from "../apps/web/src/workspace/outputStore.ts";

const mm = (value) => (value * 72) / 25.4;
const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const layout = (width, height, settings = {}, rotation = 0, limits = {}) =>
  imageLayout(width, height, rotation, { ...defaultImageSettings, ...settings }, limits);

test("approved A4, Letter and image-sized examples have exact page and placement geometry", () => {
  const landscape = layout(1200, 800);
  close(landscape.pageWidth, mm(297));
  close(landscape.pageHeight, mm(210));
  close(landscape.drawWidth, mm(277));
  close(landscape.drawHeight, mm((277 * 2) / 3));
  close(landscape.x, mm(10));
  close(landscape.y, mm((210 - (277 * 2) / 3) / 2));
  const portrait = layout(1200, 800, { orientation: "portrait" });
  close(portrait.pageWidth, mm(210));
  close(portrait.drawWidth, mm(190));
  close(portrait.y, mm((297 - (190 * 2) / 3) / 2));
  const square = layout(200, 200);
  close(square.pageWidth, mm(210));
  close(square.drawHeight, mm(190));
  close(square.y, mm(53.5));
  assert.deepEqual(
    [
      layout(960, 480, { paper: "image" }).pageWidth,
      layout(960, 480, { paper: "image" }).pageHeight,
    ],
    [720, 360],
  );
  const rotated = layout(960, 480, { paper: "image", orientation: "portrait", margin: 20 }, 90);
  assert.deepEqual([rotated.pageWidth, rotated.pageHeight, rotated.x, rotated.y], [360, 720, 0, 0]);
  for (const margin of [0, 10, 20]) {
    for (const [width, height] of [
      [1, 1],
      [1, 4000],
      [4000, 1],
      [1200, 800],
    ]) {
      const value = layout(width, height, { paper: "letter", margin });
      close(value.drawWidth / value.drawHeight, width / height);
      assert.ok(value.x >= mm(margin) - 1e-8 && value.y >= mm(margin) - 1e-8);
      assert.deepEqual([value.pixelWidth, value.pixelHeight], [width, height]);
      assert.deepEqual(
        [value.pageWidth, value.pageHeight].sort((a, b) => a - b),
        [612, 792],
      );
    }
  }
});

test("invalid geometry/settings fail explicitly and calibrated boundaries are inclusive", () => {
  for (const dimensions of [
    [0, 10],
    [-1, 20],
    [NaN, 10],
    [10, Infinity],
    [1.5, 10],
  ]) {
    assert.throws(() => layout(...dimensions), /invalid pixel dimensions/);
  }
  for (const settings of [
    { paper: "a3" },
    { margin: 5 },
    { grouping: "unknown" },
    { orientation: "square" },
  ]) {
    assert.throws(() => layout(10, 10, settings), /Choose valid/);
  }
  assert.throws(() => layout(10, 10, {}, 45), /90-degree/);
  const limits = { maxDimension: 960, perImagePixels: 960 * 480, pageWidth: 720, pageHeight: 360 };
  layout(960, 480, { paper: "image" }, 0, limits);
  for (const field of Object.keys(limits)) {
    assert.throws(
      () => layout(960, 480, { paper: "image" }, 0, { ...limits, [field]: limits[field] - 1 }),
      /exceeds/,
    );
  }
});

test("image names use shared sanitization and collision handling before storage and ZIP", () => {
  assert.deepEqual(imageOutputNames(["report.pdf.png"], defaultImageSettings).filenames, [
    "report.pdf-images.pdf",
  ]);
  assert.deepEqual(imageOutputNames(["beach.jpg", "map.png"], defaultImageSettings), {
    filenames: ["beach-images.pdf"],
    bundleName: "beach-images.zip",
  });
  const names = imageOutputNames([".png", "CON.foo.jpg", "a:b.jpg", "a?b.png", "a_b-2.png"], {
    ...defaultImageSettings,
    grouping: "separate",
  });
  assert.deepEqual(names.filenames, [
    "document-converted.pdf",
    "_CON.foo-converted.pdf",
    "a_b-converted.pdf",
    "a_b-converted-2.pdf",
    "a_b-2-converted.pdf",
  ]);
  const store = createOutputStore();
  const actual = store.retain(
    names.filenames.map((suggestedFilename) => ({ suggestedFilename, blob: new Blob(["pdf"]) })),
  );
  assert.deepEqual(
    actual.map((item) => item.filename),
    names.filenames,
  );
  assert.throws(() => imageOutputNames([], defaultImageSettings), /Add at least/);
});

const chunk = (type, data = Buffer.alloc(0)) => {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length);
  header.write(type, 4);
  return Buffer.concat([header, data, Buffer.alloc(4)]);
};
const png = (width, height, extra = []) => {
  const dimensions = Buffer.alloc(13);
  dimensions.writeUInt32BE(width);
  dimensions.writeUInt32BE(height, 4);
  return new Blob([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", dimensions),
    ...extra,
    chunk("IDAT"),
    chunk("IEND"),
  ]);
};

test("header inspection rejects unsupported, animated, truncated and over-budget images before decoding", async () => {
  assert.deepEqual(await inspectImage(png(960, 480)), { format: "png", width: 960, height: 480 });
  await assert.rejects(inspectImage(png(0, 1)), /invalid pixel/);
  await assert.rejects(inspectImage(png(1, 1, [chunk("acTL")])), /Animated PNG/);
  await assert.rejects(inspectImage(png(10, 10).slice(0, 30)), /corrupt/);
  await assert.rejects(inspectImage(new Blob(["RIFF....WEBP"])), /Unsupported/);
  await assert.rejects(inspectImage(new Blob([new Uint8Array([255, 216, 255, 192])])), /corrupt/);
  const input = png(100, 200);
  await inspectImage(input, {
    perInputBytes: input.size,
    perImagePixels: 20_000,
    maxDimension: 200,
  });
  await assert.rejects(inspectImage(input, { perInputBytes: input.size - 1 }), /Image input bytes/);
  await assert.rejects(inspectImage(input, { perImagePixels: 19_999 }), /Decoded image pixels/);
  await assert.rejects(inspectImage(input, { maxDimension: 199 }), /Image dimension/);
});
