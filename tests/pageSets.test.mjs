import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import {
  createPageSets,
  groupPages,
  orderPageSets,
  pageSetFilename,
  pageSetLabel,
  ungroupPages,
} from "../apps/web/src/split/pageSets.ts";
import { planSplit } from "../packages/pdf-engine/src/selection.ts";
import { splitDocuments } from "../packages/pdf-engine/src/splitDocuments.ts";

const require = createRequire(new URL("../packages/pdf-engine/package.json", import.meta.url));
const { PDFDocument } = require("pdf-lib");
const order = (count) => Array.from({ length: count }, (_, index) => index + 1);
const members = (state, pageOrder = order(5)) =>
  orderPageSets(state, pageOrder).map((set) => set.pages);

test("every page starts as a distinct set, including sources above the bulk output limit", () => {
  for (const count of [0, 1, 5, 60, 200]) {
    const state = createPageSets(count);
    assert.deepEqual(
      members(state, order(count)),
      order(count).map((page) => [page]),
    );
    assert.equal(new Set(state.sets.map((set) => set.id)).size, count);
    assert.equal(state.nextId, count + 1);
  }
});

test("grouping moves noncontiguous pages without changing other sets or mutating the source state", () => {
  const original = createPageSets(5);
  const grouped = groupPages(original, [4, 2], order(5));
  assert.deepEqual(members(grouped), [[1], [2, 4], [3], [5]]);
  assert.deepEqual(members(original), [[1], [2], [3], [4], [5]]);
  assert.equal(grouped.sets.find((set) => set.id === 6).pages.length, 2);
  assert.equal(grouped.nextId, 7);
  assert.equal(grouped.sets.find((set) => set.pages[0] === 3).id, 3);
});

test("regrouping preserves unselected members, removes empty sets, and never duplicates pages", () => {
  let state = groupPages(createPageSets(5), [1, 2, 3], order(5));
  state = groupPages(state, [2, 4], order(5));
  assert.deepEqual(members(state), [[1, 3], [2, 4], [5]]);
  assert.equal(state.sets.find((set) => set.id === 6).pages.length, 2);
  state = groupPages(state, [1, 3, 5], order(5));
  assert.deepEqual(members(state), [
    [1, 3, 5],
    [2, 4],
  ]);
  assert.equal(
    state.sets.some((set) => set.id === 6),
    false,
  );
});

test("ungrouping restores singleton membership with unique stable names", () => {
  const grouped = groupPages(createPageSets(5), [2, 4], order(5));
  const restored = ungroupPages(grouped, 6);
  assert.deepEqual(members(restored), [[1], [2], [3], [4], [5]]);
  assert.equal(restored.sets.find((set) => set.pages[0] === 1).id, 1);
  assert.equal(new Set(restored.sets.map((set) => set.id)).size, 5);
  assert.deepEqual(members(grouped), [[1], [2, 4], [3], [5]]);
  assert.deepEqual(members(createPageSets(2), order(2)), [[1], [2]]);
});

test("page order controls display labels, filenames and output order without changing membership", () => {
  const state = groupPages(createPageSets(5), [2, 4], order(5));
  const arranged = orderPageSets(state, [5, 4, 1, 3, 2]);
  assert.deepEqual(
    arranged.map((set) => set.pages),
    [[5], [4, 2], [1], [3]],
  );
  assert.deepEqual(
    arranged.map((set) => set.id),
    [5, 6, 1, 3],
  );
  assert.equal(pageSetFilename("report.pdf", arranged[1].pages), "report-pages-4-2.pdf");
  assert.equal(pageSetLabel(arranged[1].pages), "Pages 4 + 2");
  assert.deepEqual(members(state), [[1], [2, 4], [3], [5]]);
});

test("invalid selections, unknown groups and invalid page partitions fail explicitly", () => {
  const state = createPageSets(5);
  for (const selected of [[], [2], [2, 2], [0, 1], [1, 6], [1, 2.5], [1, NaN]]) {
    assert.throws(() => groupPages(state, selected, order(5)), /Select at least two/);
  }
  for (const id of [0, 1, 6, NaN]) {
    assert.throws(() => ungroupPages(state, id), /Choose a grouped set/);
  }
  for (const pageOrder of [
    [1, 1, 3, 4, 5],
    [1, 2, 3, 4],
    [1, 2, 3, 4, 6],
  ]) {
    assert.throws(() => orderPageSets(state, pageOrder), /exactly one/);
  }
  assert.throws(
    () => orderPageSets({ sets: [{ id: 1, pages: [] }], nextId: 2 }, []),
    /exactly one/,
  );
  for (const count of [-1, 1.5, NaN, Infinity]) {
    assert.throws(() => createPageSets(count), /source page count/);
  }
  for (const pages of [[], [0], [-1], [1.5], [NaN], [Infinity], [1, 1]]) {
    assert.throws(() => pageSetFilename("report.pdf", pages), /distinct positive/);
    assert.throws(() => pageSetLabel(pages), /distinct positive/);
  }
});

test("page-based filenames use the shared sanitizer without exposing set identifiers", () => {
  assert.equal(pageSetFilename("bad/:*name.PDF", [1, 3]), "bad___name-pages-1-3.pdf");
  assert.equal(pageSetFilename("CON.foo.pdf", [1]), "_CON.foo-page-1.pdf");
  assert.equal(pageSetFilename("... .pdf", [1]), "document-page-1.pdf");
  assert.equal(pageSetFilename("report.pdf", [1000]), "report-page-1000.pdf");
  assert.equal(pageSetFilename("report.pdf", order(200)), "report-200-pages-from-1.pdf");
  assert.equal(
    pageSetFilename("report.pdf", order(200).reverse()),
    "report-200-pages-from-200.pdf",
  );
  const state = groupPages(createPageSets(5), [1, 3], order(5));
  const filenames = orderPageSets(state, order(5)).map((set) =>
    pageSetFilename("report.pdf", set.pages),
  );
  assert.equal(new Set(filenames).size, filenames.length);
});

test("page labels describe singleton, nonconsecutive, reordered and long groups", () => {
  assert.equal(pageSetLabel([2]), "Page 2");
  assert.equal(pageSetLabel([1, 3]), "Pages 1 + 3");
  assert.equal(pageSetLabel([3, 1]), "Pages 3 + 1");
  assert.equal(pageSetLabel([1, 2]), "Pages 1 + 2");
  assert.equal(pageSetLabel([1, 2, 3, 5, 7, 8, 9]), "Pages 1-3 + 5 + 7-9");
  assert.equal(pageSetLabel(order(200)), "Pages 1-200");
  assert.equal(pageSetLabel(order(200).reverse()), "Pages 200-1");
});

test("a requested set alone plans and generates its exact ordered pages under unchanged limits", async () => {
  const source = await PDFDocument.create();
  for (const page of order(60)) {
    source.addPage([300 + page, 500 + page]);
  }
  const original = await source.save();
  const input = { id: "source", name: "report.pdf", blob: new Blob([original]) };
  const state = groupPages(createPageSets(60), [2, 59], order(60));
  const arranged = orderPageSets(state, [...order(60)].reverse());
  const set = arranged.find((value) => value.id === 61);
  const selection = { mode: "selected", pages: set.pages };
  const limits = { sourcePages: 200, totalPages: 200, outputCount: 50 };
  const plan = planSplit(input.name, 60, selection, limits);
  assert.equal(plan.outputCount, 1);
  assert.equal(plan.totalPages, 2);
  const outputs = await splitDocuments({ input, selection, limits, acknowledged: true }, () => {});
  assert.equal(outputs.length, 1);
  const pdf = await PDFDocument.load(await outputs[0].blob.arrayBuffer());
  assert.deepEqual(
    pdf.getPages().map((page) => [page.getWidth(), page.getHeight()]),
    [
      [359, 559],
      [302, 502],
    ],
  );
  assert.deepEqual(new Uint8Array(await input.blob.arrayBuffer()), original);
});
