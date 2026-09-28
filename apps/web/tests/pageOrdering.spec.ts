import { expect, test, type Locator, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { addSplitSource, downloadSplit, editSplit, generateSplit } from "./fixtures/splitHelpers";

const pageOrder = (page: Page) => page.getByRole("list", { name: "Page order", exact: true });
const labels = (pages: readonly number[], offset = 0, total = pages.length) =>
  pages.map((page, index) => `Page ${page}, position ${offset + index + 1} of ${total}`);
const orderLabels = async (page: Page) =>
  pageOrder(page)
    .getByRole("listitem")
    .evaluateAll((items) => items.map((item) => item.getAttribute("aria-label")));

const drag = async (page: Page, source: Locator, target: Locator, windowTarget = false) => {
  await expect(page.locator("[data-dnd-dragging]")).toHaveCount(0);
  await target.scrollIntoViewIfNeeded();
  await source.scrollIntoViewIfNeeded();
  const start = await source.boundingBox();
  const sourceLabel = await source.locator("..").getAttribute("aria-label");
  const targetLabel = await target.locator("..").getAttribute("aria-label");
  const targetIndex = (await orderLabels(page)).indexOf(targetLabel);
  if (!start || !sourceLabel) {
    throw new Error("The drag handle and drop target must be visible.");
  }
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await expect(page.locator("[data-dnd-dragging]")).toHaveCount(1);
  const end = await target.boundingBox();
  if (!end) {
    throw new Error("The drop target disappeared after the drag started.");
  }
  await page.mouse.move(start.x + start.width / 2 + 12, start.y + start.height / 2, { steps: 3 });
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 20 });
  if (windowTarget) {
    await expect(target).toHaveClass(/border-primary/);
  } else {
    await expect(pageOrder(page).getByRole("listitem").nth(targetIndex)).toHaveAttribute(
      "aria-label",
      sourceLabel,
    );
  }
  await page.mouse.up();
  await expect(page.locator("[data-dnd-dragging]")).toHaveCount(0);
};

test("pointer drag arranges unique selected pages and the download follows the displayed order", async ({
  page,
}) => {
  await page.goto("./#/split");
  await addSplitSource(page, 4);
  await page.getByRole("checkbox", { name: "Page 1", exact: true }).check();
  await page.getByRole("checkbox", { name: "Page 3", exact: true }).check();
  await drag(
    page,
    page.getByRole("button", { name: "Drag page 3", exact: true }),
    page.getByRole("button", { name: "Drag page 1", exact: true }),
  );
  await expect.poll(() => orderLabels(page)).toEqual(labels([3, 1, 2, 4]));
  await expect(page.getByRole("checkbox", { name: "Page 3", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Page 2", exact: true })).not.toBeChecked();
  await expect(
    page.getByRole("status").filter({ hasText: "Page 3 moved to position 1" }),
  ).toBeVisible();
  await generateSplit(page);
  const output = await downloadSplit(page);
  expect((await PDFDocument.load(output.bytes)).getPages().map((item) => item.getWidth())).toEqual([
    302, 300,
  ]);
  await expect(page.getByRole("button", { name: "Drag page 3", exact: true })).toBeDisabled();
  await editSplit(page);
  await page.getByRole("radio", { name: "Every page", exact: true }).check();
  await page.getByRole("radio", { name: "Selected pages", exact: true }).check();
  await expect.poll(() => orderLabels(page)).toEqual(labels([3, 1, 2, 4]));
  await page.getByRole("checkbox", { name: "Page 3", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "Page 3", exact: true }).check();
  await expect.poll(() => orderLabels(page)).toEqual(labels([3, 1, 2, 4]));
  await page.getByRole("button", { name: "Reset page order" }).click();
  await expect.poll(() => orderLabels(page)).toEqual(labels([1, 2, 3, 4]));
  await expect(page.getByRole("checkbox", { name: "Page 3", exact: true })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("keyboard dragging commits or cancels without changing page selection", async ({ page }) => {
  await page.goto("./#/split");
  await addSplitSource(page, 4);
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  const handle = page.getByRole("button", { name: "Drag page 2", exact: true });
  await handle.focus();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-dnd-dragging]")).toHaveCount(1);
  await page.keyboard.press("ArrowLeft");
  await expect(pageOrder(page).getByRole("listitem").first()).toHaveAttribute(
    "aria-label",
    "Page 2, position 2 of 4",
  );
  await page.keyboard.press("Space");
  await expect.poll(() => orderLabels(page)).toEqual(labels([2, 1, 3, 4]));
  await expect(page.locator("[data-dnd-dragging]")).toHaveCount(0);
  await expect(handle).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-dnd-dragging]")).toHaveCount(1);
  await page.keyboard.press("ArrowRight");
  await expect(pageOrder(page).getByRole("listitem").first()).toHaveAttribute(
    "aria-label",
    "Page 1, position 2 of 4",
  );
  await page.keyboard.press("Escape");
  await expect.poll(() => orderLabels(page)).toEqual(labels([2, 1, 3, 4]));
  await expect(page.getByRole("status").filter({ hasText: "Reordering cancelled" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Output prediction" })).toContainText(
    "4 pages total.",
  );
  await generateSplit(page);
  const output = await downloadSplit(page);
  expect((await PDFDocument.load(output.bytes)).getPages().map((item) => item.getWidth())).toEqual([
    301, 300, 302, 303,
  ]);
});

test("drag drop targets and explicit buttons reorder across bounded page windows", async ({
  page,
}) => {
  await page.goto("./#/split");
  await addSplitSource(page, 10);
  await page.getByRole("checkbox", { name: "Page 8", exact: true }).check();
  await drag(
    page,
    page.getByRole("button", { name: "Drag page 8", exact: true }),
    page.getByRole("button", { name: "Next pages", exact: true }),
    true,
  );
  await expect.poll(() => orderLabels(page)).toEqual(labels([8, 10], 8, 10));
  await expect(page.getByRole("checkbox", { name: "Page 8", exact: true })).toBeChecked();
  const earlier = page.getByRole("button", { name: "Move page 8 earlier", exact: true });
  await earlier.focus();
  await page.keyboard.press("Enter");
  await expect(earlier).toBeFocused();
  await expect.poll(() => orderLabels(page)).toEqual(labels([1, 2, 3, 4, 5, 6, 7, 8], 0, 10));
  await page.getByRole("button", { name: "Move page 8 later", exact: true }).click();
  await expect.poll(() => orderLabels(page)).toEqual(labels([8, 10], 8, 10));
  await drag(
    page,
    page.getByRole("button", { name: "Drag page 8", exact: true }),
    page.getByRole("button", { name: "Previous pages", exact: true }),
    true,
  );
  await expect.poll(() => orderLabels(page)).toEqual(labels([1, 2, 3, 4, 5, 6, 7, 8], 0, 10));
  await expect(pageOrder(page).getByRole("listitem")).toHaveCount(8);
  await page.getByRole("button", { name: "Next pages", exact: true }).click();
  await page.getByRole("checkbox", { name: "Page 9", exact: true }).check();
  await page.getByRole("checkbox", { name: "Page 10", exact: true }).check();
  await drag(
    page,
    page.getByRole("button", { name: "Drag page 10", exact: true }),
    page.getByRole("button", { name: "Drag page 9", exact: true }),
  );
  await expect.poll(() => orderLabels(page)).toEqual(labels([10, 9], 8, 10));
  await generateSplit(page);
  const output = await downloadSplit(page);
  expect((await PDFDocument.load(output.bytes)).getPages().map((item) => item.getWidth())).toEqual([
    307, 309, 308,
  ]);
  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await addSplitSource(page, 2);
  await expect.poll(() => orderLabels(page)).toEqual(labels([1, 2]));
});

test("touch drag handles require a hold and cancel activation when moved too soon", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Uses a touch-enabled Chromium device profile.");
  await page.goto("./#/split");
  await addSplitSource(page, 2);
  await expect(page.getByRole("img", { name: "Preview of page 2", exact: true })).toBeVisible();
  const source = page.getByRole("button", { name: "Drag page 2", exact: true });
  const target = page.getByRole("button", { name: "Drag page 1", exact: true });
  await source.scrollIntoViewIfNeeded();
  const start = await source.boundingBox();
  const end = await target.boundingBox();
  if (!start || !end) {
    throw new Error("Touch drag handles are missing.");
  }
  const session = await page.context().newCDPSession(page);
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  const x = start.x + start.width / 2;
  const y = start.y + start.height / 2;
  const dragging = page.locator("[data-dnd-dragging]");
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  expect(await dragging.count()).toBe(0);
  await page.clock.runFor(249);
  expect(await dragging.count()).toBe(0);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x - 6, y }],
  });
  await page.clock.runFor(250);
  expect(await dragging.count()).toBe(0);
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => orderLabels(page)).toEqual(labels([1, 2]));
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await page.clock.runFor(249);
  expect(await dragging.count()).toBe(0);
  await page.clock.runFor(1);
  await page.clock.resume();
  await expect(dragging).toHaveCount(1);
  for (let step = 1; step <= 20; step++) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + ((end.x + end.width / 2 - x) * step) / 20, y }],
    });
  }
  await expect(pageOrder(page).getByRole("listitem").first()).toHaveAttribute(
    "aria-label",
    "Page 2, position 2 of 2",
  );
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
  await expect.poll(() => orderLabels(page)).toEqual(labels([2, 1]));
  await expect(page.getByRole("checkbox", { name: /^Page \d+$/, checked: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await generateSplit(page);
  const output = await downloadSplit(page);
  expect((await PDFDocument.load(output.bytes)).getPages().map((item) => item.getWidth())).toEqual([
    301, 300,
  ]);
});
