import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { inspectDocument } from "../packages/pdf-engine/src/inspectDocument.ts";
import { loadValidatedPdf, mergeDocuments } from "../packages/pdf-engine/src/pdf.ts";
import { splitDocuments } from "../packages/pdf-engine/src/splitDocuments.ts";

const { PDFDocument, PDFName, PDFNumber } = createRequire(
  new URL("../packages/pdf-engine/package.json", import.meta.url),
)("pdf-lib");
const limits = { pageDimension: 14400 };

const makeDocument = async ({
  width = 7200,
  height = 400,
  unit = 2,
  box = "MediaBox",
  indirect = false,
  inheritedBox = false,
} = {}) => {
  const document = await PDFDocument.create();
  const page = document.addPage([300, 400]);
  const owner = inheritedBox ? page.node.Parent() : page.node;
  owner.set(PDFName.of(box), document.context.obj([0, 0, width, height]));
  if (inheritedBox) {
    page.node.delete(PDFName.of(box));
  }
  const value = document.context.obj(unit);
  page.node.set(PDFName.of("UserUnit"), indirect ? document.context.register(value) : value);
  return document;
};

const asInput = async (document) => ({
  id: "scaled",
  name: "scaled.pdf",
  blob: new Blob([await document.save()]),
});

test("all PDF boxes enforce effective point dimensions below, at and above the boundary", async () => {
  for (const box of ["MediaBox", "CropBox", "BleedBox", "TrimBox", "ArtBox"]) {
    for (const indirect of [false, true]) {
      for (const difference of [-1, 0, 1]) {
        const source = await asInput(
          await makeDocument({
            box,
            indirect,
            width: (limits.pageDimension + difference) / 2,
          }),
        );
        if (difference <= 0) {
          assert.equal((await loadValidatedPdf(source, limits)).info.pageCount, 1);
        } else {
          await assert.rejects(loadValidatedPdf(source, limits), /PDF page dimension in points/);
        }
      }
    }
  }
  await assert.rejects(
    loadValidatedPdf(await asInput(await makeDocument({ width: 400, height: 7201 })), limits),
    /PDF page dimension in points/,
  );
});

test("inherited page boxes use the page-local unit, not a Pages node's non-inheritable UserUnit", async () => {
  for (const box of ["MediaBox", "CropBox"]) {
    const document = await makeDocument({ box, inheritedBox: true, width: 10000 });
    await assert.rejects(loadValidatedPdf(await asInput(document), limits), /PDF page dimension/);
    const page = document.getPage(0);
    page.node.delete(PDFName.of("UserUnit"));
    page.node.Parent().set(PDFName.of("UserUnit"), PDFNumber.of(2));
    assert.equal((await loadValidatedPdf(await asInput(document), limits)).info.pageCount, 1);
  }
});

test("invalid PDF user units fail explicitly while an omitted or null unit defaults to one", async () => {
  for (const unit of [0, -1, "2", false]) {
    await assert.rejects(
      loadValidatedPdf(await asInput(await makeDocument({ unit })), limits),
      /invalid UserUnit/,
    );
  }
  for (const unit of [NaN, Infinity, -Infinity]) {
    const document = await makeDocument();
    document.getPage(0).node.set(PDFName.of("UserUnit"), PDFNumber.of(unit));
    assert.throws(() => inspectDocument(document, limits), /invalid UserUnit/);
  }
  const document = await makeDocument({ width: 14400, unit: null });
  assert.equal(inspectDocument(document, limits).pageCount, 1);
  document.getPage(0).node.delete(PDFName.of("UserUnit"));
  assert.equal(inspectDocument(document, limits).pageCount, 1);
});

test("merge and split reject oversized scaled pages and preserve accepted fractional units", async () => {
  const oversized = await asInput(await makeDocument({ width: 10000 }));
  for (const source of [
    oversized,
    await asInput(await makeDocument({ width: 20000, unit: 0.5 })),
  ]) {
    const merge = () => mergeDocuments({ inputs: [source], acknowledged: true, limits }, () => {});
    const split = () =>
      splitDocuments(
        {
          input: source,
          acknowledged: true,
          selection: { mode: "selected", pages: [1] },
          limits,
        },
        () => {},
      );
    if (source === oversized) {
      await assert.rejects(merge(), /PDF page dimension/);
      await assert.rejects(split(), /PDF page dimension/);
    } else {
      for (const output of [await merge(), ...(await split())]) {
        const page = (await PDFDocument.load(await output.blob.arrayBuffer())).getPage(0);
        assert.equal(page.getWidth(), 20000);
        assert.equal(page.node.lookup(PDFName.of("UserUnit"), PDFNumber).asNumber(), 0.5);
      }
    }
  }
});
