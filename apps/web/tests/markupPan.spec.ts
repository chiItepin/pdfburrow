import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import {
  openMarkupEditor,
  runMarkupCommand,
  selectMarkupTool,
  setMarkupZoom,
} from "./fixtures/markupEditor";

const scrollPosition = (viewport: Locator) =>
  viewport.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop }));
const prepare = async (page: Page, tool = "Select", mark = false) => {
  await openMarkupEditor(page);
  if (mark) {
    await runMarkupCommand(page, "Tools", "Add centered highlight");
  }
  await setMarkupZoom(page, "320%");
  if (tool !== "Select") {
    await selectMarkupTool(page, tool);
  }
  const canvas = page.getByRole("button", { name: "PDF markup canvas, page 1", exact: true });
  const viewport = canvas.locator("..");
  await viewport.scrollIntoViewIfNeeded();
  await viewport.evaluate((element) => element.scrollTo(100, 160));
  const bounds = await viewport.boundingBox();
  if (!bounds) {
    throw new Error("No document viewport bounds.");
  }
  return {
    canvas,
    viewport,
    point: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
  };
};

test("dragging empty canvas pans the PDF with the pointer without moving marks or adding history", async ({
  page,
}) => {
  const { canvas, viewport, point } = await prepare(page, "Select", true);
  const mark = page.locator("[data-markup-id]");
  const original = await mark.getAttribute("transform");
  const before = await scrollPosition(viewport);
  const workspace = page.getByRole("region", { name: "Document workspace", exact: true });
  const outside = await workspace.evaluate((element) => element.scrollTop);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(canvas).toHaveCSS("cursor", "grabbing");
  await page.mouse.move(point.x - 50, point.y - 35, { steps: 5 });
  await viewport.dispatchEvent("wheel", { deltaY: -100, cancelable: true });
  await expect(page.getByLabel("Editor view")).toContainText("320%");
  await page.mouse.up();
  expect(await scrollPosition(viewport)).toEqual({
    left: before.left + 50,
    top: before.top + 35,
  });
  expect(await workspace.evaluate((element) => element.scrollTop)).toBe(outside);
  await expect(canvas).toHaveCSS("cursor", "grab");
  await expect(mark).toHaveAttribute("transform", original!);
  await expect(page.getByRole("button", { name: "Smaller", exact: true })).toBeEnabled();
  await page.mouse.click(point.x, point.y);
  await expect(page.getByRole("combobox", { name: "Markup on this page" })).toHaveValue("");
  await runMarkupCommand(page, "Edit", "Undo");
  await expect(mark).toHaveCount(0);
});

test("Hand drags over annotations and keyboard arrows pan without editing selected marks", async ({
  page,
}) => {
  const { canvas, viewport } = await prepare(page, "Hand", true);
  await viewport.evaluate((element) => element.scrollTo(100, 500));
  const mark = page.locator("[data-markup-id]");
  const original = await mark.getAttribute("transform");
  const bounds = await mark.boundingBox();
  const view = await viewport.boundingBox();
  if (!bounds || !view) {
    throw new Error("No visible annotation bounds.");
  }
  const point = {
    x:
      (Math.max(bounds.x, view.x + 24) +
        Math.min(bounds.x + bounds.width, view.x + view.width - 24)) /
      2,
    y:
      (Math.max(bounds.y, view.y + 24) +
        Math.min(bounds.y + bounds.height, view.y + view.height - 24)) /
      2,
  };
  const before = await scrollPosition(viewport);
  await expect(page.locator("[data-markup-resize]")).toHaveCount(0);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x - 30, point.y - 20, { steps: 4 });
  await page.mouse.up();
  await expect(mark).toHaveAttribute("transform", original!);
  expect(await scrollPosition(viewport)).toEqual({ left: before.left + 30, top: before.top + 20 });
  await canvas.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  expect(await scrollPosition(viewport)).toEqual({ left: before.left + 70, top: before.top + 180 });
  await expect(mark).toHaveAttribute("transform", original!);
  await runMarkupCommand(page, "Edit", "Undo");
  await expect(mark).toHaveCount(0);
});

test("middle-button and background dragging pan in drawing tools without replacing ink input", async ({
  page,
}) => {
  const { canvas, viewport, point } = await prepare(page, "Ink");
  const before = await scrollPosition(viewport);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down({ button: "middle" });
  await page.keyboard.press("Space");
  await page.mouse.move(point.x - 30, point.y - 20, { steps: 4 });
  await page.mouse.up({ button: "middle" });
  expect(await scrollPosition(viewport)).toEqual({ left: before.left + 30, top: before.top + 20 });
  await expect(page.locator("[data-markup-id]")).toHaveCount(0);
  await canvas.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(page.locator("[data-markup-id]")).toHaveCount(1);
  await selectMarkupTool(page, "Ink");
  await viewport.scrollIntoViewIfNeeded();
  await viewport.evaluate((element) => element.scrollTo(0, 0));
  const box = await viewport.boundingBox();
  if (!box) {
    throw new Error("No canvas background bounds.");
  }
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x - 22, box.y - 12, { steps: 4 });
  await page.mouse.up();
  expect(await scrollPosition(viewport)).toEqual({ left: 30, top: 20 });
  await expect(page.locator("[data-markup-id]")).toHaveCount(1);
  const position = await scrollPosition(viewport);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 18, point.y + 12, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator("[data-markup-id]")).toHaveCount(2);
  expect(await scrollPosition(viewport)).toEqual(position);
});

test("foreign pointers cannot interrupt a pan, and Escape releases it at the current view position", async ({
  page,
}) => {
  const { canvas, viewport, point } = await prepare(page, "Hand");
  await viewport.evaluate((element) =>
    element.addEventListener(
      "pointerdown",
      (event) => {
        if (event instanceof PointerEvent) {
          element.setAttribute("data-test-pan-pointer", String(event.pointerId));
        }
      },
      { capture: true, once: true },
    ),
  );
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(viewport).toHaveAttribute("data-test-pan-pointer", /^\d+$/);
  const pointerId = Number(await viewport.getAttribute("data-test-pan-pointer"));
  await viewport.evaluate((element) => element.removeAttribute("data-test-pan-pointer"));
  await page.mouse.move(point.x - 20, point.y - 15, { steps: 3 });
  const position = await scrollPosition(viewport);
  for (const event of ["pointermove", "pointerup", "pointercancel", "lostpointercapture"]) {
    await viewport.dispatchEvent(event, { pointerId: pointerId + 1000, clientX: 0, clientY: 0 });
  }
  await expect(canvas).toHaveCSS("cursor", "grabbing");
  expect(await scrollPosition(viewport)).toEqual(position);
  await page.keyboard.press("Escape");
  await expect(canvas).toHaveCSS("cursor", "grab");
  await page.mouse.move(point.x - 40, point.y - 30);
  await page.mouse.up();
  expect(await scrollPosition(viewport)).toEqual(position);
  await expect(page.locator("[data-markup-id]")).toHaveCount(0);
  await viewport.dispatchEvent("wheel", { deltaY: -20, cancelable: true });
  await expect(page.getByLabel("Editor view")).toContainText("333%");
});

test("result previews stay pannable without unlocking edits or discarding the generated PDF", async ({
  page,
}) => {
  const { canvas, viewport } = await prepare(page, "Select", true);
  const mark = page.locator("[data-markup-id]");
  const original = await mark.getAttribute("transform");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Generate PDF", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download PDF", exact: true })).toBeEnabled();
  await viewport.scrollIntoViewIfNeeded();
  await viewport.evaluate((element) => element.scrollTo(100, 500));
  const box = await viewport.boundingBox();
  if (!box) {
    throw new Error("No result viewport bounds.");
  }
  const before = await scrollPosition(viewport);
  await page.mouse.move(box.x + box.width / 2, box.y + 150);
  await page.mouse.down();
  await expect(canvas).toHaveCSS("cursor", "grabbing");
  await page.mouse.move(box.x + box.width / 2 - 30, box.y + 130, { steps: 3 });
  await page.mouse.up();
  expect(await scrollPosition(viewport)).toEqual({ left: before.left + 30, top: before.top + 20 });
  await expect(mark).toHaveAttribute("transform", original!);
  await expect(page.getByRole("button", { name: "Smaller", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Download PDF", exact: true })).toBeEnabled();
});

test("touch dragging pans the document instead of scrolling the surrounding workspace", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium" || !test.info().project.use.hasTouch,
    "Requires a touch viewport.",
  );
  const { viewport, point } = await prepare(page);
  const before = await scrollPosition(viewport);
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: point.x, y: point.y }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: point.x - 40, y: point.y - 30 }],
  });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(await scrollPosition(viewport)).toEqual({ left: before.left + 40, top: before.top + 30 });
  await expect(page.locator("[data-markup-id]")).toHaveCount(0);
  await session.detach();
});
