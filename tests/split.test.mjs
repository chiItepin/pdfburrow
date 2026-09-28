import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { planSplit } from "../packages/pdf-engine/src/selection.ts";
import { splitDocuments } from "../packages/pdf-engine/src/splitDocuments.ts";
import { inspectPdf } from "../packages/pdf-engine/src/pdf.ts";
import { packageOutputs } from "../packages/pdf-engine/src/zip.ts";

const require = createRequire(new URL("../packages/pdf-engine/package.json", import.meta.url));
const { PDFDocument, PDFArray, StandardFonts, degrees, decodePDFRawStream } = require("pdf-lib");
const { unzipSync } = require("fflate");
const selected = (pages) => ({ mode: "selected", pages });
const ranges = (items, combined = true) => ({
  mode: "ranges",
  ranges: items.map(([start, end]) => ({ start, end })),
  combined,
});
const pagesOf = (output) =>
  output.ranges.flatMap(({ start, end }) =>
    Array.from({ length: end - start + 1 }, (_, index) => start + index),
  );
const fixture = async (count = 10, name = "report.pdf") => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < count; index++) {
    const page = doc.addPage([300 + index, 500 + index]);
    page.setCropBox(10, 20, 280 + index, 450);
    page.setBleedBox(12, 22, 270 + index, 440);
    page.setTrimBox(15, 25, 260 + index, 430);
    page.setArtBox(20, 30, 250 + index, 420);
    page.setRotation(degrees((index % 4) * 90));
    page.drawText(`Page ${index + 1}`, { x: 30, y: 80, font, size: 12 });
    page.drawRectangle({ x: 40, y: 100, width: 30, height: 40 });
  }
  return { id: "source", name, blob: new Blob([await doc.save()]) };
};
const contents = (doc, page) => {
  const streams = page.node.Contents();
  return (streams instanceof PDFArray ? streams.asArray() : [streams]).map((stream) =>
    Buffer.from(decodePDFRawStream(doc.context.lookup(stream)).decode()).toString("hex"),
  );
};
const examples = [
  [selected([7, 2, 5]), [[7, 2, 5]]],
  [
    ranges([
      [5, 7],
      [2, 2],
    ]),
    [[5, 6, 7, 2]],
  ],
  [
    ranges(
      [
        [5, 7],
        [2, 2],
      ],
      false,
    ),
    [[5, 6, 7], [2]],
  ],
  [
    ranges([
      [2, 4],
      [4, 5],
    ]),
    [[2, 3, 4, 4, 5]],
  ],
  [
    ranges(
      [
        [2, 2],
        [2, 2],
      ],
      false,
    ),
    [[2], [2]],
  ],
  [
    { mode: "fixed", size: 4 },
    [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10],
    ],
  ],
  [{ mode: "fixed", size: 10 }, [Array.from({ length: 10 }, (_, index) => index + 1)]],
  [{ mode: "every" }, Array.from({ length: 10 }, (_, index) => [index + 1])],
];

test("all agreed selection examples predict and generate exact pages, names, boxes and text streams", async () => {
  const input = await fixture();
  const source = await PDFDocument.load(await input.blob.arrayBuffer());
  for (const [selection, expected] of examples) {
    const plan = planSplit(input.name, 10, selection);
    assert.equal(plan.outputCount, expected.length);
    assert.equal(plan.totalPages, expected.flat().length);
    const outputs = await splitDocuments({ input, selection, acknowledged: true }, () => {});
    assert.equal(outputs.length, plan.outputCount);
    for (const [index, output] of outputs.entries()) {
      const planned = plan.outputAt(index);
      assert.deepEqual(pagesOf(planned), expected[index]);
      assert.equal(planned.pageCount, expected[index].length);
      assert.equal(output.suggestedFilename, planned.filename);
      assert.equal(output.blob.type, "application/pdf");
      const actual = await PDFDocument.load(await output.blob.arrayBuffer());
      assert.equal(actual.getPageCount(), planned.pageCount);
      assert.equal(
        (await inspectPdf({ ...input, blob: output.blob })).pageCount,
        planned.pageCount,
      );
      for (const [offset, sourcePage] of expected[index].entries()) {
        const page = source.getPage(sourcePage - 1);
        const copied = actual.getPage(offset);
        for (const method of [
          "getMediaBox",
          "getCropBox",
          "getBleedBox",
          "getTrimBox",
          "getArtBox",
          "getRotation",
        ]) {
          assert.deepEqual(copied[method](), page[method]());
        }
        assert.deepEqual(contents(actual, copied), contents(source, page));
      }
    }
    if (outputs.length > 1) {
      const bundle = await packageOutputs({ outputs, filename: plan.bundleName }, () => {});
      const entries = unzipSync(new Uint8Array(await bundle.blob.arrayBuffer()));
      assert.equal(bundle.suggestedFilename, "report-split.zip");
      assert.deepEqual(
        Object.keys(entries),
        outputs.map((output) => output.suggestedFilename),
      );
      for (const output of outputs) {
        assert.deepEqual(
          entries[output.suggestedFilename],
          new Uint8Array(await output.blob.arrayBuffer()),
        );
      }
    }
  }
});

test("one-page sources generate exactly one PDF in every mode", async () => {
  const input = await fixture(1);
  for (const selection of [
    selected([1]),
    ranges([[1, 1]]),
    ranges([[1, 1]], false),
    { mode: "fixed", size: 1 },
    { mode: "every" },
  ]) {
    const plan = planSplit(input.name, 1, selection);
    assert.equal(plan.outputCount, 1);
    const outputs = await splitDocuments({ input, selection, acknowledged: true }, () => {});
    assert.equal(outputs.length, 1);
    assert.equal((await PDFDocument.load(await outputs[0].blob.arrayBuffer())).getPageCount(), 1);
  }
});

test("invalid, incomplete, reversed and duplicate selected requests reject instead of clipping", async () => {
  const bad = [
    undefined,
    null,
    {},
    { mode: "unknown" },
    selected([]),
    selected([1, 1]),
    selected(null),
    selected(Array(1)),
    { mode: "ranges", ranges: Array(1), combined: true },
    ranges([]),
    { mode: "ranges", ranges: [null], combined: true },
    { mode: "ranges", ranges: [{ start: 1 }], combined: true },
    { mode: "ranges", ranges: [{ start: 1, end: 2 }] },
    ranges([[7, 5]]),
    { mode: "fixed" },
  ];
  for (const value of [0, -1, 1.5, 11, NaN, Infinity, "2", undefined, null]) {
    bad.push(selected([value]), ranges([[1, value]]), ranges([[value, 10]]), {
      mode: "fixed",
      size: value,
    });
  }
  const input = await fixture();
  for (const selection of bad) {
    assert.throws(() => planSplit("report.pdf", 10, selection), { code: "invalid" });
    await assert.rejects(
      splitDocuments({ input, selection, acknowledged: true }, () => {}),
      { code: "invalid" },
    );
  }
  for (const count of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => planSplit("report.pdf", count, { mode: "every" }), { code: "invalid" });
  }
});

test("overlap warning detects inclusive endpoints but never changes row order", () => {
  for (const items of [
    [
      [2, 4],
      [4, 5],
    ],
    [
      [1, 10],
      [3, 4],
    ],
    [
      [2, 2],
      [2, 2],
    ],
  ]) {
    const plan = planSplit("report.pdf", 10, ranges(items));
    assert.equal(plan.repeatsPages, true);
    assert.deepEqual(plan.outputAt(0).ranges, ranges(items).ranges);
  }
  assert.equal(
    planSplit(
      "report.pdf",
      10,
      ranges([
        [5, 7],
        [1, 4],
      ]),
    ).repeatsPages,
    false,
  );
});

test("filenames are deterministic, sanitized and unique beyond 999 outputs", () => {
  assert.equal(planSplit(".pdf", 1, selected([1])).outputAt(0).filename, "document-extracted.pdf");
  assert.equal(planSplit("... .pdf", 1, { mode: "every" }).bundleName, "document-split.zip");
  const plan = planSplit("bad/:*name.PDF", 1001, { mode: "every" });
  assert.equal(plan.outputAt(0).filename, "bad___name-split-001.pdf");
  assert.equal(plan.outputAt(999).filename, "bad___name-split-1000.pdf");
  assert.equal(
    new Set(Array.from({ length: 1001 }, (_, index) => plan.outputAt(index).filename)).size,
    1001,
  );
  for (const index of [-1, 1001, 1.5, NaN]) {
    assert.throws(() => plan.outputAt(index), { code: "invalid" });
  }
});

test("actual numbered PDFs and ZIP entries expand beyond 999 without collisions", async () => {
  const input = await fixture(1, ".pdf");
  const selection = ranges(
    Array.from({ length: 1001 }, () => [1, 1]),
    false,
  );
  const outputs = await splitDocuments({ input, selection, acknowledged: true }, () => {});
  assert.equal(outputs.length, 1001);
  assert.equal(outputs[0].suggestedFilename, "document-split-001.pdf");
  assert.equal(outputs[1000].suggestedFilename, "document-split-1001.pdf");
  const bundle = await packageOutputs({ outputs, filename: "document-split.zip" }, () => {});
  const entries = unzipSync(new Uint8Array(await bundle.blob.arrayBuffer()));
  assert.deepEqual(
    Object.keys(entries),
    outputs.map((output) => output.suggestedFilename),
  );
  for (const name of [
    "document-split-001.pdf",
    "document-split-999.pdf",
    "document-split-1000.pdf",
    "document-split-1001.pdf",
  ]) {
    assert.equal((await PDFDocument.load(entries[name])).getPageCount(), 1);
  }
});

test("source support, acknowledgement and calibrated resource limits remain enforced", async () => {
  const input = await fixture(2);
  const request = { input, selection: { mode: "every" }, acknowledged: true };
  await assert.rejects(
    splitDocuments({ ...request, acknowledged: false }, () => {}),
    /Acknowledge/,
  );
  await assert.rejects(
    splitDocuments({ ...request, input: undefined }, () => {}),
    /source PDF/,
  );
  for (const filename of ["encryptedEmpty.pdf", "encryptedOpen.pdf", "signed.pdf"]) {
    const blob = new Blob([await readFile(new URL(`./fixtures/${filename}`, import.meta.url))]);
    await assert.rejects(
      splitDocuments({ ...request, input: { ...input, blob } }, () => {}),
      { code: "unsupported" },
    );
  }
  for (const limits of [
    { totalPages: 1 },
    { outputCount: 1 },
    { perInputBytes: 1 },
    { outputBytes: 1 },
  ]) {
    await assert.rejects(
      splitDocuments({ ...request, limits }, () => {}),
      { code: "limit" },
    );
  }
  await assert.rejects(
    splitDocuments(
      {
        ...request,
        selection: ranges([
          [1, 2],
          [1, 2],
        ]),
        limits: { totalPages: 3 },
      },
      () => {},
    ),
    /Selected pages/,
  );
  const outputs = await splitDocuments(request, () => {});
  const bytes = outputs.reduce((sum, output) => sum + output.blob.size, 0);
  assert.equal(
    (await splitDocuments({ ...request, limits: { outputBytes: bytes, outputCount: 2 } }, () => {}))
      .length,
    2,
  );
  await assert.rejects(
    splitDocuments({ ...request, limits: { outputBytes: bytes - 1 } }, () => {}),
    /Output bytes/,
  );
});
