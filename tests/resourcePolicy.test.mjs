import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import {
  bundleLimits,
  draftResourceError,
  fileAdditionError,
  imageLimits,
  pdfLimits,
} from "../apps/web/src/workspace/resourcePolicy.ts";
import { loadValidatedPdf, mergeDocuments } from "../packages/pdf-engine/src/pdf.ts";
import { splitDocuments } from "../packages/pdf-engine/src/splitDocuments.ts";
import { checkImageDimensions } from "../packages/pdf-engine/src/inspectImage.ts";
import { imageLayout, defaultImageSettings } from "../packages/pdf-engine/src/imageLayout.ts";
import { planSplit } from "../packages/pdf-engine/src/selection.ts";
import { packageOutputs } from "../packages/pdf-engine/src/zip.ts";

const { PDFDocument } = createRequire(new URL("../apps/web/package.json", import.meta.url))(
  "pdf-lib",
);
const input = async (pages = 1, width = 300) => {
  const document = await PDFDocument.create();
  for (let index = 0; index < pages; index++) document.addPage([width, 400]);
  return { id: "source", name: "source.pdf", blob: new Blob([await document.save()]) };
};

test("provisional input boundaries reject the whole addition before retaining files", () => {
  const empty = { count: 0, bytes: 0 };
  for (const difference of [-1, 0, 1]) {
    assert.equal(
      Boolean(fileAdditionError(empty, [{ size: pdfLimits.perInputBytes + difference }])),
      difference > 0,
    );
    assert.equal(
      Boolean(
        fileAdditionError(
          { count: 19, bytes: 0 },
          Array.from({ length: 1 + difference }, () => ({ size: 1 })),
        ),
      ),
      difference > 0,
    );
    assert.equal(
      Boolean(
        fileAdditionError({ count: 2, bytes: pdfLimits.totalInputBytes - 1 }, [
          { size: 1 + difference },
        ]),
      ),
      difference > 0,
    );
  }
});

test("combined page and pixel limits count all ready inputs and recover after removal", () => {
  const pdf = (pages) => ({ status: "ready", info: { pageCount: pages, warnings: [] } });
  const image = (width, height) => ({
    status: "ready",
    info: { pageCount: 1, width, height, warnings: [] },
  });
  assert.equal(draftResourceError([pdf(100), pdf(100)]), "");
  assert.match(draftResourceError([pdf(100), pdf(101)]), /200-page/);
  assert.equal(draftResourceError([image(4000, 3000), image(4000, 3000)]), "");
  assert.match(
    draftResourceError([image(4000, 3000), image(4000, 3000), image(1, 1)]),
    /24-million/,
  );
  assert.equal(draftResourceError([pdf(100)]), "");
});

test("actual configured source, selected-page and output-count boundaries are independent", async () => {
  const source = await input(pdfLimits.sourcePages);
  await loadValidatedPdf(source, pdfLimits);
  await assert.rejects(
    loadValidatedPdf(await input(pdfLimits.sourcePages + 1), pdfLimits),
    /Source page count/,
  );
  assert.equal(planSplit(source.name, 200, { mode: "fixed", size: 4 }, pdfLimits).outputCount, 50);
  assert.throws(() => planSplit(source.name, 200, { mode: "every" }, pdfLimits), /Output count/);
  assert.throws(
    () =>
      planSplit(
        source.name,
        200,
        {
          mode: "ranges",
          combined: true,
          ranges: [
            { start: 1, end: 200 },
            { start: 1, end: 1 },
          ],
        },
        pdfLimits,
      ),
    /Selected pages/,
  );
  const outputs = await splitDocuments(
    {
      input: source,
      acknowledged: true,
      selection: { mode: "selected", pages: [1] },
      limits: { ...pdfLimits, totalPages: 1 },
    },
    () => {},
  );
  assert.equal((await PDFDocument.load(await outputs[0].blob.arrayBuffer())).getPageCount(), 1);
  await assert.rejects(
    splitDocuments(
      {
        input: await input(201),
        acknowledged: true,
        selection: { mode: "selected", pages: [1] },
        limits: pdfLimits,
      },
      () => {},
    ),
    /Source page count/,
  );
  await assert.rejects(
    mergeDocuments(
      {
        inputs: [source, await input()],
        acknowledged: true,
        limits: pdfLimits,
      },
      () => {},
    ),
    /Total pages/,
  );
});

test("page and image dimensions enforce inclusive provisional boundaries", async () => {
  await loadValidatedPdf(await input(1, pdfLimits.pageDimension), pdfLimits);
  await assert.rejects(
    loadValidatedPdf(await input(1, pdfLimits.pageDimension + 1), pdfLimits),
    /PDF page dimension/,
  );
  checkImageDimensions(4000, 3000, imageLimits);
  assert.throws(() => checkImageDimensions(4001, 3000, imageLimits), /Decoded image pixels/);
  checkImageDimensions(8192, 1, imageLimits);
  assert.throws(() => checkImageDimensions(8193, 1, imageLimits), /Image dimension/);
  assert.equal(
    imageLayout(8192, 1, 0, { ...defaultImageSettings, paper: "image" }, imageLimits).pageWidth,
    6144,
  );
});

test("packaging checks configured retained bytes before reading output buffers", async () => {
  const oversized = new Blob([new Uint8Array(bundleLimits.totalOutputBytes)]);
  await assert.rejects(
    packageOutputs(
      {
        outputs: [
          { blob: oversized, suggestedFilename: "first.pdf" },
          { blob: new Blob(["x"]), suggestedFilename: "second.pdf" },
        ],
        filename: "bundle.zip",
        limits: bundleLimits,
      },
      () => {},
    ),
    /Retained output bytes/,
  );
});
