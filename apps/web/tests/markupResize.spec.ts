import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { inspectArtifact } from "./fixtures/pdfArtifacts";
import {
  openMarkupEditor,
  runMarkupCommand,
  selectMarkupTool,
  setMarkupZoom,
  addTestSignature,
} from "./fixtures/markupEditor";

test("corner handles resize highlights at different zooms, cancel safely and create one history edit", async ({
  page,
}) => {
  for (const zoom of [25, 100, 200]) {
    await openMarkupEditor(page);
    await runMarkupCommand(page, "Tools", "Add centered highlight");
    await setMarkupZoom(page, `${zoom}%`);
    const mark = page.locator("[data-markup-id]");
    const rectangle = mark.locator('rect[fill="yellow"]');
    const handle = page.locator('[data-markup-resize="se"]');
    const viewport = page
      .getByRole("button", { name: "PDF markup canvas, page 1", exact: true })
      .locator("..");
    await expect(page.locator("[data-markup-resize]")).toHaveCount(4);
    const workspace = page.getByRole("region", { name: "Document workspace", exact: true });
    for (const cancel of [true, false]) {
      await viewport.scrollIntoViewIfNeeded();
      await handle.scrollIntoViewIfNeeded();
      const box = await handle.boundingBox();
      if (!box) {
        throw new Error("No resize handle bounds.");
      }
      const hitArea = await handle
        .locator("rect")
        .first()
        .evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return { width: bounds.width, height: bounds.height };
        });
      expect(hitArea.width).toBeCloseTo(24, 0);
      expect(hitArea.height).toBeCloseTo(24, 0);
      const scroll = await workspace.evaluate((element) => element.scrollTop);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      expect(await workspace.evaluate((element) => element.scrollTop)).toBe(scroll);
      await page.mouse.move(box.x + box.width / 2 + 18, box.y + box.height / 2 + 12, {
        steps: 4,
      });
      await expect
        .poll(async () => Number(await rectangle.getAttribute("width")))
        .toBeGreaterThan(180);
      const width = await rectangle.getAttribute("width");
      const height = await rectangle.getAttribute("height");
      if (cancel) {
        await page.keyboard.press("Escape");
      }
      await page.mouse.up();
      await expect(rectangle).toHaveAttribute("width", cancel ? "180" : width!);
      await expect(rectangle).toHaveAttribute("height", cancel ? "24" : height!);
      if (!cancel) {
        expect(Number(width)).toBeCloseTo(180 + 18 / (zoom / 100), 0);
        expect(Number(height)).toBeCloseTo(24 + 12 / (zoom / 100), 0);
        await runMarkupCommand(page, "Edit", "Undo");
        await expect(rectangle).toHaveAttribute("width", "180");
        await expect(rectangle).toHaveAttribute("height", "24");
        await runMarkupCommand(page, "Edit", "Redo");
        await expect(rectangle).toHaveAttribute("width", width!);
        await expect(rectangle).toHaveAttribute("height", height!);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test("visible size controls work by keyboard and resized highlights are preserved in downloaded PDFs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await openMarkupEditor(page);
  await runMarkupCommand(page, "Tools", "Add centered highlight");
  const mark = page.locator("[data-markup-id]");
  const rectangle = mark.locator('rect[fill="yellow"]');
  const smaller = page.getByRole("button", { name: "Smaller", exact: true });
  const bigger = page.getByRole("button", { name: "Bigger", exact: true });
  await expect(
    page.getByRole("menubar").getByRole("menuitem", { name: "Tools", exact: true }),
  ).toBeFocused();
  await smaller.focus();
  await page.keyboard.press("Enter");
  await expect(smaller).toBeFocused();
  expect(Number(await rectangle.getAttribute("width"))).toBeCloseTo(180 / 1.1, 3);
  await bigger.focus();
  await page.keyboard.press("Enter");
  expect(Number(await rectangle.getAttribute("width"))).toBeCloseTo(180, 3);
  await page.getByRole("button", { name: "Move / size", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Move / size markup" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await bigger.click();
  expect(Number(await rectangle.getAttribute("width"))).toBeCloseTo(198, 3);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Generate PDF", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download PDF", exact: true })).toBeEnabled();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const path = await (await pending).path();
  if (!path) {
    throw new Error("No resized markup PDF download.");
  }
  const pages = await inspectArtifact(new Uint8Array(await readFile(path)));
  expect(pages).toHaveLength(2);
  expect(pages[0]!.text).toContain("Original contract");
  const pixel = (211 * pages[0]!.width + 280) * 4;
  expect([...pages[0]!.pixels.subarray(pixel, pixel + 3)]).toEqual([255, 255, 179]);
  const outside = (211 * pages[0]!.width + 290) * 4;
  expect([...pages[0]!.pixels.subarray(outside, outside + 3)]).toEqual([255, 255, 255]);
});

test("small shapes resize from the intended corner even when handle hit areas overlap", async ({
  page,
}) => {
  await openMarkupEditor(page);
  await runMarkupCommand(page, "Tools", "Add centered highlight");
  await setMarkupZoom(page, "25%");
  const rectangle = page.locator('[data-markup-id] rect[fill="yellow"]');
  for (const corner of ["nw", "ne", "sw", "se"]) {
    await page
      .getByRole("combobox", { name: "Markup on this page", exact: true })
      .selectOption({ index: 1 });
    const handle = page.locator(`[data-markup-resize="${corner}"]`);
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    if (!box) {
      throw new Error("No small-shape resize handle.");
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + (corner.endsWith("w") ? -6 : 6),
      box.y + box.height / 2 + (corner.startsWith("n") ? -3 : 3),
      { steps: 3 },
    );
    await page.mouse.up();
    expect(Number(await rectangle.getAttribute("width"))).toBeCloseTo(204, 0);
    expect(Number(await rectangle.getAttribute("height"))).toBeCloseTo(36, 0);
    await runMarkupCommand(page, "Edit", "Undo");
    await expect(rectangle).toHaveAttribute("width", "180");
    await expect(rectangle).toHaveAttribute("height", "24");
  }
});

test("drawn signatures resize proportionally with visible handles and size buttons", async ({
  page,
}) => {
  await openMarkupEditor(page);
  await addTestSignature(page);
  await setMarkupZoom(page, "100%");
  const mark = page.locator("[data-markup-id]");
  const outline = mark.locator("rect");
  const width = Number(await outline.getAttribute("width"));
  const height = Number(await outline.getAttribute("height"));
  const stroke = Number(await mark.locator("polyline").first().getAttribute("stroke-width"));
  await page.getByRole("button", { name: "Bigger", exact: true }).click();
  expect(Number(await outline.getAttribute("width"))).toBeCloseTo(width * 1.1, 3);
  expect(Number(await outline.getAttribute("height"))).toBeCloseTo(height * 1.1, 3);
  expect(Number(await mark.locator("polyline").first().getAttribute("stroke-width"))).toBeCloseTo(
    stroke * 1.1,
    3,
  );
  const handle = page.locator('[data-markup-resize="nw"]');
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  if (!box) {
    throw new Error("No signature resize handle.");
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 20, box.y + box.height / 2 - 10, { steps: 4 });
  await page.mouse.up();
  const nextWidth = Number(await outline.getAttribute("width"));
  const nextHeight = Number(await outline.getAttribute("height"));
  expect(nextWidth).toBeGreaterThan(width * 1.1);
  expect(nextWidth / nextHeight).toBeCloseTo(width / height, 4);
  await page.getByRole("region", { name: "PDF markup editor", exact: true }).screenshot({
    path: test.info().outputPath("shapeResize.png"),
  });
  await runMarkupCommand(page, "Edit", "Undo");
  expect(Number(await outline.getAttribute("width"))).toBeCloseTo(width * 1.1, 3);
});

test("a resize keeps its visible size when capture, focus or the pointer ends before pointerup", async ({
  page,
}) => {
  for (const ending of ["capture", "focus", "cancel"]) {
    await openMarkupEditor(page);
    await runMarkupCommand(page, "Tools", "Add centered highlight");
    await setMarkupZoom(page, "122%");
    const canvas = page.getByRole("button", { name: "PDF markup canvas, page 1", exact: true });
    const viewport = canvas.locator("..");
    const rectangle = page.locator('[data-markup-id] rect[fill="yellow"]');
    const handle = page.locator('[data-markup-resize="se"]');
    await viewport.scrollIntoViewIfNeeded();
    await handle.scrollIntoViewIfNeeded();
    const bounds = await handle.boundingBox();
    if (!bounds) {
      throw new Error("No handle bounds for the recorded resize regression.");
    }
    await canvas.evaluate((element) =>
      element.addEventListener(
        "pointerdown",
        (event) => {
          if (event instanceof PointerEvent) {
            element.setAttribute("data-test-resize-pointer", String(event.pointerId));
          }
        },
        { once: true },
      ),
    );
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await expect(canvas).toHaveAttribute("data-test-resize-pointer", /^\d+$/);
    const pointerId = Number(await canvas.getAttribute("data-test-resize-pointer"));
    await canvas.evaluate((element) => element.removeAttribute("data-test-resize-pointer"));
    await page.mouse.move(bounds.x + bounds.width / 2 + 40, bounds.y + bounds.height / 2, {
      steps: 4,
    });
    const visible = await rectangle.getAttribute("width");
    expect(Number(visible)).toBeGreaterThan(180);
    await canvas.evaluate(
      (element, { ending, pointerId }) => {
        if (!(element instanceof HTMLElement)) {
          throw new Error("No canvas element.");
        }
        if (ending === "capture") {
          element.releasePointerCapture(pointerId);
        } else if (ending === "focus") {
          element.blur();
        } else {
          element.dispatchEvent(new PointerEvent("pointercancel", { pointerId, bubbles: true }));
        }
      },
      { ending, pointerId },
    );
    await page.mouse.up();
    await expect(rectangle).toHaveAttribute("width", visible!);
    await runMarkupCommand(page, "Edit", "Undo");
    await expect(rectangle).toHaveAttribute("width", "180");
    await runMarkupCommand(page, "Edit", "Redo");
    await expect(rectangle).toHaveAttribute("width", visible!);
  }
});

test("interrupted moves keep visible geometry, while Escape cancels without adding history", async ({
  page,
}) => {
  for (const ending of ["focus", "escape"]) {
    await openMarkupEditor(page);
    await runMarkupCommand(page, "Tools", "Add centered highlight");
    const canvas = page.getByRole("button", { name: "PDF markup canvas, page 1", exact: true });
    const mark = page.locator("[data-markup-id]");
    await mark.scrollIntoViewIfNeeded();
    const before = await mark.getAttribute("transform");
    const bounds = await mark.boundingBox();
    if (!bounds) {
      throw new Error("No mark bounds for the interrupted move regression.");
    }
    const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 30, start.y + 20, { steps: 4 });
    const visible = await mark.getAttribute("transform");
    expect(visible).not.toBe(before);
    if (ending === "focus") {
      await canvas.evaluate((element) => {
        if (!(element instanceof HTMLElement)) {
          throw new Error("No markup canvas.");
        }
        element.blur();
      });
    } else {
      await page.keyboard.press("Escape");
    }
    await page.mouse.up();
    await expect(mark).toHaveAttribute("transform", ending === "escape" ? before! : visible!);
    await runMarkupCommand(page, "Edit", "Undo");
    if (ending === "escape") {
      await expect(mark).toHaveCount(0);
    } else {
      await expect(mark).toHaveAttribute("transform", before!);
      await runMarkupCommand(page, "Edit", "Redo");
      await expect(mark).toHaveAttribute("transform", visible!);
    }
  }
});

test("interrupted new ink and highlights are discarded and leave the editor ready for another draw", async ({
  page,
}) => {
  for (const tool of ["Ink", "Highlight"]) {
    await openMarkupEditor(page);
    await selectMarkupTool(page, tool);
    const canvas = page.getByRole("button", { name: "PDF markup canvas, page 1", exact: true });
    await canvas.scrollIntoViewIfNeeded();
    const bounds = await canvas.boundingBox();
    if (!bounds) {
      throw new Error("No canvas bounds for the interrupted drawing regression.");
    }
    const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    for (const ending of ["focus", "capture"]) {
      await canvas.evaluate((element) =>
        element.addEventListener(
          "pointerdown",
          (event) => {
            if (event instanceof PointerEvent) {
              element.setAttribute("data-test-draw-pointer", String(event.pointerId));
            }
          },
          { once: true },
        ),
      );
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await expect(canvas).toHaveAttribute("data-test-draw-pointer", /^\d+$/);
      const pointerId = Number(await canvas.getAttribute("data-test-draw-pointer"));
      await canvas.evaluate((element) => element.removeAttribute("data-test-draw-pointer"));
      await page.mouse.move(start.x + 20, start.y + 15, { steps: 4 });
      await canvas.evaluate(
        (element, { ending, pointerId }) => {
          if (!(element instanceof HTMLElement)) {
            throw new Error("No markup canvas.");
          }
          if (ending === "capture") {
            element.releasePointerCapture(pointerId);
          } else {
            element.blur();
          }
        },
        { ending, pointerId },
      );
      await page.mouse.up();
      await expect(page.locator("[data-markup-id]")).toHaveCount(0);
    }
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 20, start.y + 15, { steps: 4 });
    await page.mouse.up();
    await expect(page.locator("[data-markup-id]")).toHaveCount(1);
    await runMarkupCommand(page, "Edit", "Undo");
    await expect(page.locator("[data-markup-id]")).toHaveCount(0);
  }
});

test("size controls respect page limits and notes retain their text-width editor", async ({
  page,
}) => {
  await openMarkupEditor(page);
  await runMarkupCommand(page, "Tools", "Add centered highlight");
  await page.getByRole("button", { name: "Move / size", exact: true }).click();
  for (const [label, value] of [
    ["X (points)", "0"],
    ["Y (points)", "0"],
    ["WIDTH (points)", "360"],
    ["HEIGHT (points)", "440"],
  ] as const) {
    await page.getByRole("spinbutton", { name: label, exact: true }).fill(value);
  }
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bigger", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Smaller", exact: true })).toBeEnabled();
  await runMarkupCommand(page, "Tools", "Place note at center");
  await page
    .getByRole("textbox", { name: "Note text", exact: true })
    .fill("A note keeps readable text");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.locator("[data-markup-resize]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bigger", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Smaller", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Move / size", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "WIDTH (points)", exact: true })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "HEIGHT (points)", exact: true })).toHaveCount(
    0,
  );
});
