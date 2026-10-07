import assert from "node:assert/strict";
import test from "node:test";
import { markupBoundsError } from "../packages/pdf-engine/src/markupLayout.ts";
import {
  markupCornerPosition,
  markupResizeCorners,
  resizeMarkupAtCorner,
  getMarkupResizeOptions,
} from "../apps/web/src/markup/markupResize.ts";

const page = { width: 360, height: 440, transform: [1, 0, 0, 1, 0, 0] };
const highlight = {
  id: "shape",
  page: 1,
  kind: "highlight",
  x: 100,
  y: 120,
  width: 80,
  height: 40,
};
const signature = {
  ...highlight,
  kind: "signature",
  strokeWidth: 2,
  strokes: [
    [
      { x: 1, y: 1 },
      { x: 79, y: 39 },
    ],
  ],
};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9);
const opposite = { nw: "se", ne: "sw", sw: "ne", se: "nw" };

test("highlight resizing anchors the opposite corner and changes both dimensions independently", () => {
  for (const [corner, point, expected] of [
    ["nw", { x: 80, y: 110 }, { x: 80, y: 110 }],
    ["ne", { x: 200, y: 110 }, { x: 100, y: 110 }],
    ["sw", { x: 80, y: 170 }, { x: 80, y: 120 }],
    ["se", { x: 200, y: 170 }, { x: 100, y: 120 }],
  ]) {
    const resized = resizeMarkupAtCorner(highlight, corner, point, page);
    assert.equal(resized.x, expected.x);
    assert.equal(resized.y, expected.y);
    assert.equal(resized.width, 100);
    assert.equal(resized.height, 50);
    assert.deepEqual(
      markupCornerPosition(resized, opposite[corner]),
      markupCornerPosition(highlight, opposite[corner]),
    );
  }
});

test("ink and signatures resize proportionally, including every stroke and stroke width", () => {
  for (const kind of ["ink", "signature"]) {
    const original = { ...signature, kind };
    const resized = resizeMarkupAtCorner(original, "ne", { x: 220, y: 100 }, page);
    close(resized.width, 120);
    close(resized.height, 60);
    close(resized.strokeWidth, 3);
    assert.deepEqual(resized.strokes, [
      [
        { x: 1.5, y: 1.5 },
        { x: 118.5, y: 58.5 },
      ],
    ]);
    close(resized.x, 100);
    close(resized.y, 100);
    assert.equal(markupBoundsError(resized, page), "");
    assert.equal(original.width, 80);
    assert.equal(original.strokeWidth, 2);
  }
});

test("every resize corner stays within the page, preserves its fixed corner and never flips", () => {
  for (const original of [
    highlight,
    signature,
    { ...highlight, x: 92.1, y: 110.2, width: 171.4, height: 57.3 },
    { ...signature, x: 92.1, y: 110.2, width: 171.4, height: 57.3 },
  ]) {
    for (const corner of markupResizeCorners) {
      for (const x of [-1000, 0, 125, 360, 1000]) {
        for (const y of [-1000, 0, 150, 440, 1000]) {
          const resized = resizeMarkupAtCorner(original, corner, { x, y }, page);
          assert.equal(markupBoundsError(resized, page), "");
          assert.ok(resized.width >= 1);
          assert.ok(resized.height >= 1);
          const fixed = markupCornerPosition(original, opposite[corner]);
          const actual = markupCornerPosition(resized, opposite[corner]);
          close(actual.x, fixed.x);
          close(actual.y, fixed.y);
          if (original.kind === "signature") {
            close(resized.width / resized.height, original.width / original.height);
          }
        }
      }
    }
  }
});

test("existing sub-point shapes do not get larger when made smaller", () => {
  const original = { ...highlight, width: 0.25, height: 0.5 };
  const resized = resizeMarkupAtCorner(original, "se", { x: 100, y: 120 }, page);
  assert.equal(resized.width, original.width);
  assert.equal(resized.height, original.height);
});

test("quick resize options disable unavailable sizes and do not change fixed-size note text", () => {
  const fullPage = { ...highlight, x: 0, y: 0, width: page.width, height: page.height };
  const maximum = getMarkupResizeOptions(fullPage, page);
  assert.equal(maximum.bigger, undefined);
  assert.ok(maximum.smaller.width < fullPage.width);
  const minimum = getMarkupResizeOptions({ ...highlight, width: 1, height: 1 }, page);
  assert.equal(minimum.smaller, undefined);
  assert.ok(minimum.bigger.width > 1);
  const note = getMarkupResizeOptions({ ...highlight, kind: "note", text: "A note" }, page);
  assert.deepEqual(note, { smaller: undefined, bigger: undefined });
  assert.deepEqual(getMarkupResizeOptions(undefined, page), note);
});
