import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { packageOutputs } from "../packages/pdf-engine/src/zip.ts";
import { safeFilenameStem } from "../packages/pdf-engine/src/pdfFilename.ts";
import { bundleFilename, createOutputStore } from "../apps/web/src/workspace/outputStore.ts";
import { createFileRegistry } from "../apps/web/src/workspace/fileRegistry.ts";

const requireEngine = createRequire(
  new URL("../packages/pdf-engine/package.json", import.meta.url),
);
const { PDFDocument } = requireEngine("pdf-lib");
const { unzipSync } = requireEngine("fflate");

const outputsFixture = async () =>
  Promise.all(
    [300, 500].map(async (width, index) => {
      const pdf = await PDFDocument.create();
      pdf.addPage([width, 400]);
      return {
        blob: new Blob([await pdf.save()], { type: "application/pdf" }),
        suggestedFilename: `report-split-00${index + 1}.pdf`,
      };
    }),
  );

test("ZIPs contain the exact generated PDFs, names and order, with deterministic packaging", async () => {
  const outputs = await outputsFixture();
  const progress = [];
  const result = await packageOutputs({ outputs, filename: "report-split.zip" }, (value) =>
    progress.push(value),
  );
  assert.equal(result.blob.type, "application/zip");
  assert.equal(result.suggestedFilename, "report-split.zip");
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  const entries = unzipSync(bytes);
  assert.deepEqual(
    Object.keys(entries),
    outputs.map((output) => output.suggestedFilename),
  );
  for (const [index, output] of outputs.entries()) {
    assert.deepEqual(
      entries[output.suggestedFilename],
      new Uint8Array(await output.blob.arrayBuffer()),
    );
    const pdf = await PDFDocument.load(entries[output.suggestedFilename]);
    assert.equal(pdf.getPageCount(), 1);
    assert.equal(pdf.getPage(0).getWidth(), index ? 500 : 300);
  }
  assert.deepEqual(
    progress.map((value) => value.completed),
    [1, 2],
  );
  assert.ok(progress.every((value) => value.bytes > 0 && value.total === 2));
  const again = await packageOutputs({ outputs, filename: "report-split.zip" }, () => {});
  assert.deepEqual(new Uint8Array(await again.blob.arrayBuffer()), bytes);
});

test("ZIP limits permit exact boundaries and reject above them before returning an artifact", async () => {
  const outputs = await outputsFixture();
  const request = { outputs, filename: "report.zip" };
  const bundle = await packageOutputs(request, () => {});
  const totalOutputBytes = outputs.reduce((sum, output) => sum + output.blob.size, 0);
  await packageOutputs(
    { ...request, limits: { outputCount: 2, totalOutputBytes, bundleBytes: bundle.blob.size } },
    () => {},
  );
  for (const limits of [
    { outputCount: 1 },
    { totalOutputBytes: totalOutputBytes - 1 },
    { bundleBytes: bundle.blob.size - 1 },
    { bundleBytes: NaN },
  ]) {
    await assert.rejects(
      packageOutputs({ ...request, limits }, () => {}),
      /limit/,
    );
  }
  await assert.rejects(
    packageOutputs({ ...request, outputs: [outputs[0]] }, () => {}),
    /multiple outputs/,
  );
  for (const filename of ["../bad.pdf", "duplicate.pdf"]) {
    const invalid = outputs.map((output) => ({ ...output, suggestedFilename: filename }));
    await assert.rejects(
      packageOutputs({ ...request, outputs: invalid }, () => {}),
      /filesystem-safe/,
    );
  }
});

test("output storage keeps names consistent and resources until explicit download/clear", async (t) => {
  const clicked = [];
  const created = [];
  const revoked = [];
  let fail = false;
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        href: "",
        download: "",
        click() {
          if (fail) throw new Error("download unavailable");
          clicked.push(this.download);
        },
        remove() {},
      }),
      body: { append() {} },
    },
  });
  t.after(() => {
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else delete globalThis.document;
  });
  t.mock.method(URL, "createObjectURL", () => {
    const url = `blob:${created.length}`;
    created.push(url);
    return url;
  });
  t.mock.method(URL, "revokeObjectURL", (url) => revoked.push(url));
  const store = createOutputStore();
  const source = new Blob(["pdf"]);
  const summaries = store.retain(
    ["a/b.pdf", "a_b.pdf", "a_b-2.pdf", ".pdf", "CON.pdf"].map((suggestedFilename) => ({
      blob: source,
      suggestedFilename,
    })),
  );
  assert.deepEqual(
    summaries.map((value) => value.filename),
    ["a_b.pdf", "a_b-2.pdf", "a_b-2-2.pdf", "document.pdf", "_CON.pdf"],
  );
  assert.equal(created.length, 0);
  assert.equal(store.needsDownload(), true);
  fail = true;
  assert.throws(() => store.requestPdf(0), /download unavailable/);
  assert.equal(store.needsDownload(), true);
  fail = false;
  store.requestPdf(0);
  assert.equal(store.needsDownload(), true);
  assert.equal(created.length, 1);
  const bundle = await packageOutputs(
    { outputs: store.values(), filename: bundleFilename("a/b.zip") },
    () => {},
  );
  store.retainBundle(bundle);
  assert.equal(store.needsDownload(), true);
  store.requestBundle();
  assert.equal(store.needsDownload(), false);
  assert.deepEqual(clicked, ["a_b.pdf", "a_b.zip"]);
  assert.equal(store.usage().count, 5);
  store.clear();
  assert.deepEqual(revoked, created);
  assert.deepEqual(store.usage(), { count: 0, bytes: 0, bundleBytes: 0 });
  assert.throws(() => store.requestPdf(0), /No output/);
  assert.throws(() => store.retain([]), /no PDFs/);
});

test("shared filename normalization handles reserved stems and stays stable on repeated calls", () => {
  const reserved = [
    "CON",
    "prn",
    "AuX",
    "NUL",
    ...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`),
    ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
  ];
  for (const extension of [".pdf", ".zip"]) {
    for (const name of reserved) {
      for (const suffix of ["", ".notes"]) {
        const stem = `${name}${suffix}`;
        for (const prefix of ["", " . .", "\u00a0 . "]) {
          const normalized = safeFilenameStem(`${prefix}${stem}${extension}`, extension);
          assert.equal(normalized, `_${stem}`);
          assert.equal(safeFilenameStem(`${normalized}${extension}`, extension), normalized);
        }
      }
    }
    for (const name of ["CONTRACT", "COM0", "COM10", "LPT0", "LPT10"]) {
      assert.equal(safeFilenameStem(`${name}.notes${extension}`, extension), `${name}.notes`);
    }
  }
});

test("file registry reports raw retained bytes and releases originals on abandonment", () => {
  const registry = createFileRegistry();
  registry.retain("first", new File(["abc"], "first.pdf"));
  registry.retain("second", new File(["defg"], "second.pdf"));
  assert.deepEqual(registry.usage(), { count: 2, bytes: 7 });
  registry.release("first");
  assert.equal(registry.get("first"), undefined);
  registry.releaseAll();
  assert.deepEqual(registry.usage(), { count: 0, bytes: 0 });
});
