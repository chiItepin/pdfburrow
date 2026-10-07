import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { inspectArtifact } from "./fixtures/pdfArtifacts";
import { navigateToTool } from "./fixtures/workspaceNavigation";
import {
  createMarkupSource as source,
  openMarkupEditor as open,
  runMarkupCommand as menuCommand,
  selectMarkupTool as selectTool,
  setMarkupZoom as selectZoom,
  addTestSignature as signature,
} from "./fixtures/markupEditor";

test("Home CTA leads to a complete no-hold signing, note, ink, highlight and flattened download workflow", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.goto("./");
  await page.getByRole("link", { name: "Open Sign & annotate PDF", exact: true }).click();
  await expect(page).toHaveURL(/\/sign\/$/);
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "contract.pdf", mimeType: "application/pdf", buffer: await source() });
  const canvas = page.getByRole("button", { name: "PDF markup canvas, page 1", exact: true });
  await expect(canvas).toBeVisible();
  await signature(page);
  await expect(page.locator("[data-markup-id]")).toHaveCount(1);
  await selectTool(page, "Highlight");
  await menuCommand(page, "Tools", "Add centered highlight");
  await selectTool(page, "Note");
  await menuCommand(page, "Tools", "Place note at center");
  await page.getByRole("textbox", { name: "Note text", exact: true }).fill("España — café €");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await selectTool(page, "Ink");
  await canvas.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await expect(page.locator("[data-markup-id]")).toHaveCount(4);
  await menuCommand(page, "Edit", "Undo");
  await expect(page.locator("[data-markup-id]")).toHaveCount(3);
  await menuCommand(page, "Edit", "Redo");
  await expect(page.locator("[data-markup-id]")).toHaveCount(4);
  await menuCommand(page, "View", "Next page");
  await expect(
    page.getByRole("button", { name: "PDF markup canvas, page 2", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-markup-id]")).toHaveCount(0);
  await selectZoom(page, "200%");
  await menuCommand(page, "View", "Previous page");
  await expect(canvas).toBeVisible();
  await expect(page.locator("[data-markup-id]")).toHaveCount(4);
  await page.getByRole("menubar").getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Fit page", exact: true }).click();
  await page
    .getByRole("region", { name: "PDF markup editor", exact: true })
    .screenshot({ path: test.info().outputPath("markup.png") });
  await page.getByRole("checkbox").check();
  await menuCommand(page, "File", "Generate PDF");
  await expect(page.getByRole("button", { name: "Download PDF", exact: true })).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await menuCommand(page, "File", "Download PDF");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("contract-marked.pdf");
  const path = await download.path();
  if (!path) {
    throw new Error("The output download is missing.");
  }
  const artifact = await inspectArtifact(new Uint8Array(await readFile(path)));
  expect(artifact).toHaveLength(2);
  expect(artifact[0]!.text).toContain("Original contract");
  expect(artifact[0]!.text).toContain("España — café €");
  const parsed = await PDFDocument.load(await readFile(path));
  expect(parsed.getPage(0).node.Annots()?.size() ?? 0).toBe(0);
  await page.getByRole("button", { name: "Edit markup", exact: true }).click();
  await expect(page.locator("[data-markup-id]")).toHaveCount(4);
  await page
    .getByRole("combobox", { name: "Markup on this page", exact: true })
    .selectOption({ index: 1 });
  await menuCommand(page, "Edit", "Delete selected");
  await expect(page.locator("[data-markup-id]")).toHaveCount(3);
  expect(failures).toEqual([]);
});

test("signature interruption, local history, keyboard capture and document reset remain separate", async ({
  page,
}) => {
  await open(page);
  await menuCommand(page, "Tools", "Draw signature...");
  const pad = page.getByRole("button", { name: "Signature drawing pad", exact: true });
  await pad.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.getByText("1 completed stroke", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo stroke", exact: true }).click();
  await expect(page.getByRole("button", { name: "Use signature", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Redo stroke", exact: true }).click();
  await page.getByRole("button", { name: "Cancel signature", exact: true }).click();
  await expect(page.locator("[data-markup-id]")).toHaveCount(0);
  await signature(page);
  const mark = page.locator("[data-markup-id]");
  const before = await mark.getAttribute("transform");
  const canvas = page.getByRole("button", { name: "PDF markup canvas, page 1", exact: true });
  await canvas.focus();
  await page.keyboard.down("ArrowRight");
  await page.keyboard.up("ArrowRight");
  expect(await mark.getAttribute("transform")).not.toBe(before);
  await canvas.focus();
  await page.keyboard.press("Control+z");
  await expect(mark).toHaveAttribute("transform", before!);
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await expect(page.getByRole("button", { name: "Keep editing", exact: true })).toBeFocused();
  await page.getByRole("dialog").getByRole("button", { name: "Start over", exact: true }).click();
  await expect(page.getByRole("button", { name: "Choose PDF", exact: true })).toBeEnabled();
  await expect(mark).toHaveCount(0);
});

test("dragged shapes keep their released position through repeated drags, undo and redo", async ({
  page,
}) => {
  await open(page);
  await menuCommand(page, "Tools", "Add centered highlight");
  await selectZoom(page, "100%");
  const mark = page.locator("[data-markup-id]");
  for (const [dx, dy] of [
    [40, 30],
    [-20, 10],
    [10, -20],
  ] as const) {
    await mark.scrollIntoViewIfNeeded();
    const before = await mark.getAttribute("transform");
    const bounds = await mark.boundingBox();
    if (!bounds) {
      throw new Error("No shape bounds for dragging.");
    }
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + dx, bounds.y + bounds.height / 2 + dy, {
      steps: 4,
    });
    const released = await mark.getAttribute("transform");
    expect(released).not.toBe(before);
    await page.mouse.up();
    await page.mouse.move(bounds.x + bounds.width / 2 + dx + 5, bounds.y + bounds.height / 2 + dy);
    await expect(mark).toHaveAttribute("transform", released!);
    await menuCommand(page, "Edit", "Undo");
    await expect(mark).toHaveAttribute("transform", before!);
    await menuCommand(page, "Edit", "Redo");
    await expect(mark).toHaveAttribute("transform", released!);
  }
});

test("dragged shapes keep the last visible position when release coordinates lag behind the pointer", async ({
  page,
}) => {
  await open(page);
  await menuCommand(page, "Tools", "Add centered highlight");
  const canvas = page.getByRole("button", { name: "PDF markup canvas, page 1", exact: true });
  const mark = page.locator("[data-markup-id]");
  await mark.scrollIntoViewIfNeeded();
  const bounds = await mark.boundingBox();
  if (!bounds) {
    throw new Error("No shape bounds for release regression.");
  }
  const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  await canvas.evaluate((element) =>
    element.addEventListener(
      "pointerdown",
      (event) => {
        if (event instanceof PointerEvent) {
          element.setAttribute("data-test-pointer-id", String(event.pointerId));
        }
      },
      { once: true },
    ),
  );
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await expect(canvas).toHaveAttribute("data-test-pointer-id", /^\d+$/);
  const pointerId = Number(await canvas.getAttribute("data-test-pointer-id"));
  await canvas.evaluate((element) => element.removeAttribute("data-test-pointer-id"));
  await page.mouse.move(start.x + 40, start.y + 30, { steps: 4 });
  const released = await mark.getAttribute("transform");
  for (const type of ["pointermove", "pointerup", "pointercancel", "lostpointercapture"]) {
    await canvas.dispatchEvent(type, {
      pointerId: pointerId + 1000,
      pointerType: "touch",
      clientX: start.x,
      clientY: start.y,
    });
  }
  await expect(mark).toHaveAttribute("transform", released!);
  await canvas.dispatchEvent("pointerup", {
    pointerId,
    pointerType: "mouse",
    button: 0,
    clientX: start.x,
    clientY: start.y,
  });
  await page.mouse.up();
  await expect(mark).toHaveAttribute("transform", released!);
});

test("unsupported notes and annotated inputs are rejected while merge keeps its existing policy", async ({
  page,
}) => {
  await open(page);
  await selectTool(page, "Note");
  await menuCommand(page, "Tools", "Place note at center");
  await page.getByRole("textbox", { name: "Note text", exact: true }).fill("hello 😀");
  await expect(page.getByRole("alert")).toContainText("Unsupported note character");
  await expect(page.getByRole("button", { name: "Save note", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel note", exact: true }).click();
  await open(page, true);
  await expect(
    page.getByText(/Existing page annotations or links are not supported/),
  ).toBeVisible();
  await navigateToTool(page, "Merge PDFs");
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "linked.pdf", mimeType: "application/pdf", buffer: await source(true) });
  await expect(page.getByText(/Annotations or links detected/)).toBeVisible();
  await expect(page.getByText(/Existing page annotations or links are not supported/)).toHaveCount(
    0,
  );
});

test("markup editor stays usable at narrow widths and only adds same-origin resources", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .every((entry) => new URL(entry.name).origin === location.origin),
    ),
  ).toBe(true);
});

test("scrolling over the page or canvas background zooms from the fitted scale without scrolling the workspace", async ({
  page,
}) => {
  await open(page);
  const canvas = page.getByRole("button", { name: "PDF markup canvas, page 1", exact: true });
  const viewport = canvas.locator("..");
  const workspace = page.getByRole("region", { name: "Document workspace", exact: true });
  const wheelScale = test.info().project.use.isMobile
    ? (test.info().project.use.deviceScaleFactor ?? 1)
    : 1;
  await viewport.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (!bounds) {
    throw new Error("No markup canvas bounds.");
  }
  const workspaceScroll = await workspace.evaluate((element) => element.scrollTop);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, -100);
  const expected = Math.round((bounds.width / 360) * 100 * Math.exp(0.2 / wheelScale));
  await expect(page.getByLabel("Editor view")).toContainText(`${expected}%`);
  expect(await workspace.evaluate((element) => element.scrollTop)).toBe(workspaceScroll);

  const background = await viewport.boundingBox();
  if (!background) {
    throw new Error("No markup viewport bounds.");
  }
  await page.mouse.move(background.x + 8, background.y + 8);
  await page.mouse.wheel(0, -100);
  await expect(page.getByLabel("Editor view")).toContainText(
    `${Math.min(400, Math.round(expected * Math.exp(0.2 / wheelScale)))}%`,
  );
  expect(await workspace.evaluate((element) => element.scrollTop)).toBe(workspaceScroll);

  for (const [zoom, delta] of [
    [400, -100],
    [25, 100],
  ] as const) {
    await selectZoom(page, `${zoom}%`);
    await viewport.scrollIntoViewIfNeeded();
    const corner = await viewport.boundingBox();
    if (!corner) {
      throw new Error("No markup viewport bounds at zoom limit.");
    }
    const before = await viewport.evaluate((element) => ({
      left: element.scrollLeft,
      top: element.scrollTop,
    }));
    const outside = await workspace.evaluate((element) => element.scrollTop);
    await page.mouse.move(corner.x + 8, corner.y + 8);
    await page.mouse.wheel(0, delta);
    await expect(page.getByLabel("Editor view")).toContainText(`${zoom}%`);
    expect(
      await viewport.evaluate((element) => ({
        left: element.scrollLeft,
        top: element.scrollTop,
      })),
    ).toEqual(before);
    expect(await workspace.evaluate((element) => element.scrollTop)).toBe(outside);
  }
  await selectZoom(page, "126%");
  await expect(page.getByLabel("Editor view")).toContainText("126%");
  await page.getByRole("menubar").getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Fit page", exact: true }).click();
  await expect(page.getByLabel("Editor view")).toContainText("Fit page");
  await expect
    .poll(async () => Math.abs((await canvas.boundingBox())!.width - bounds.width))
    .toBeLessThan(1);

  const help = page.locator("#markup-canvas-help");
  await help.scrollIntoViewIfNeeded();
  const helpBounds = await help.boundingBox();
  if (!helpBounds) {
    throw new Error("No canvas instructions bounds.");
  }
  const outside = await workspace.evaluate((element) => element.scrollTop);
  await page.mouse.move(helpBounds.x + 8, helpBounds.y + 8);
  await page.mouse.wheel(0, 100);
  await expect
    .poll(() => workspace.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(outside);
  await expect(page.getByLabel("Editor view")).toContainText("Fit page");
});

test("wheel zoom keeps the same PDF point under the pointer and leaves markup geometry unchanged", async ({
  page,
}) => {
  await open(page);
  await menuCommand(page, "Tools", "Add centered highlight");
  const mark = page.locator("[data-markup-id]");
  const geometry = await mark.getAttribute("transform");
  await selectZoom(page, "320%");
  const canvas = page.getByRole("button", { name: "PDF markup canvas, page 1", exact: true });
  const viewport = canvas.locator("..");
  const wheelScale = test.info().project.use.isMobile
    ? (test.info().project.use.deviceScaleFactor ?? 1)
    : 1;
  await viewport.scrollIntoViewIfNeeded();
  await viewport.evaluate((element) => {
    element.scrollLeft = 150;
    element.scrollTop = 350;
  });
  const box = await viewport.boundingBox();
  if (!box) {
    throw new Error("No markup viewport bounds.");
  }
  const pointer = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const pointAtPointer = () =>
    canvas.evaluate((element, position) => {
      const bounds = element.getBoundingClientRect();
      return {
        x: ((position.x - bounds.left) * 360) / bounds.width,
        y: ((position.y - bounds.top) * 440) / bounds.height,
      };
    }, pointer);
  const before = await pointAtPointer();
  await page.mouse.move(pointer.x, pointer.y);
  let zoom = 320;
  for (const delta of [-60, 60]) {
    zoom = Math.round(zoom * Math.exp((-delta * 0.002) / wheelScale));
    await page.mouse.wheel(0, delta);
    await expect(page.getByLabel("Editor view")).toContainText(`${zoom}%`);
    const after = await pointAtPointer();
    expect(Math.abs(after.x - before.x)).toBeLessThan(1);
    expect(Math.abs(after.y - before.y)).toBeLessThan(1);
    await expect(mark).toHaveAttribute("transform", geometry!);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await viewport.screenshot({ path: test.info().outputPath("canvasZoom.png") });

  await selectTool(page, "Highlight");
  await viewport.scrollIntoViewIfNeeded();
  const visible = await viewport.boundingBox();
  const enlarged = await canvas.boundingBox();
  if (!visible || !enlarged) {
    throw new Error("No zoomed canvas bounds for drawing.");
  }
  const start = { x: visible.x + visible.width / 2, y: visible.y + visible.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 40, start.y + 24, { steps: 4 });
  await page.mouse.up();
  await expect(mark).toHaveCount(2);
  const placed = await mark.last().evaluate((element) => {
    if (!(element instanceof SVGGraphicsElement)) {
      throw new Error("No SVG markup object.");
    }
    const transform = element.transform.baseVal.consolidate()?.matrix;
    const rectangle = element.querySelector("rect");
    if (!transform || !rectangle) {
      throw new Error("No highlight geometry.");
    }
    return {
      x: transform.e,
      y: transform.f,
      width: Number(rectangle.getAttribute("width")),
      height: Number(rectangle.getAttribute("height")),
    };
  });
  const scale = enlarged.width / 360;
  expect(Math.abs(placed.x - (start.x - enlarged.x) / scale)).toBeLessThan(0.5);
  expect(Math.abs(placed.y - (start.y - enlarged.y) / scale)).toBeLessThan(0.5);
  expect(placed.width).toBeCloseTo(40 / scale, 1);
  expect(placed.height).toBeCloseTo(24 / scale, 1);
});

test("trackpad and line/page wheel input respect zoom bounds, panning and unfinished edits", async ({
  page,
}) => {
  await open(page);
  await selectZoom(page, "200%");
  const canvas = page.getByRole("button", { name: "PDF markup canvas, page 1", exact: true });
  const viewport = canvas.locator("..");
  const height = await viewport.evaluate((element) => element.clientHeight);
  let zoom = 200;
  for (const event of [
    { deltaY: -3, deltaMode: 1 },
    { deltaY: 1, deltaMode: 2 },
    { deltaY: -5, deltaMode: 0, ctrlKey: true },
    { deltaY: -10000, deltaMode: 0 },
    { deltaY: 10000, deltaMode: 0 },
  ]) {
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
    zoom = Math.round(Math.max(25, Math.min(400, zoom * Math.exp(-pixels * 0.002))));
    const cancelled = await viewport.evaluate(
      (element, options) =>
        !element.dispatchEvent(new WheelEvent("wheel", { ...options, cancelable: true })),
      event,
    );
    expect(cancelled).toBe(true);
    await expect(page.getByLabel("Editor view")).toContainText(`${zoom}%`);
  }
  for (const event of [
    { deltaY: 0, deltaX: 50 },
    { deltaY: -50, shiftKey: true },
  ]) {
    expect(
      await viewport.evaluate(
        (element, options) =>
          element.dispatchEvent(new WheelEvent("wheel", { ...options, cancelable: true })),
        event,
      ),
    ).toBe(true);
    await expect(page.getByLabel("Editor view")).toContainText("25%");
  }
  await selectZoom(page, "100%");
  await selectTool(page, "Ink");
  await canvas.focus();
  await page.keyboard.press("Space");
  await viewport.dispatchEvent("wheel", { deltaY: -100, cancelable: true });
  await expect(page.getByLabel("Editor view")).toContainText("100%");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(page.locator("[data-markup-id]")).toHaveCount(1);
  await viewport.dispatchEvent("wheel", { deltaY: -100, cancelable: true });
  await expect(page.getByLabel("Editor view")).toContainText("122%");
  await viewport.evaluate((element) => {
    for (let index = 0; index < 50; index++) {
      element.dispatchEvent(new WheelEvent("wheel", { deltaY: -0.1, cancelable: true }));
    }
  });
  await expect(page.getByLabel("Editor view")).toContainText("123%");
  await menuCommand(page, "View", "Zoom level...");
  await expect(page.getByRole("spinbutton", { name: "Zoom percentage" })).toHaveValue("123");
  await viewport.dispatchEvent("wheel", { deltaY: -100, cancelable: true });
  await expect(page.getByLabel("Editor view")).toContainText("123%");
  await page.keyboard.press("Escape");
});

test("move, resize, note overflow, undownloaded-output guards and new-edit redo clearing work", async ({
  page,
}) => {
  await open(page);
  await selectTool(page, "Highlight");
  await menuCommand(page, "Tools", "Add centered highlight");
  await menuCommand(page, "Edit", "Move / size...");
  await page.getByRole("spinbutton", { name: "X (points)", exact: true }).fill("20");
  await page.getByRole("spinbutton", { name: "Y (points)", exact: true }).fill("30");
  await page.getByRole("spinbutton", { name: "WIDTH (points)", exact: true }).fill("80");
  await page.getByRole("spinbutton", { name: "HEIGHT (points)", exact: true }).fill("20");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator("[data-markup-id]")).toHaveAttribute("transform", "translate(20 30)");
  await menuCommand(page, "Edit", "Undo");
  await selectTool(page, "Highlight");
  await menuCommand(page, "Tools", "Add centered highlight");
  await page.getByRole("menubar").getByRole("menuitem", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Redo", exact: true })).toHaveAttribute(
    "data-disabled",
    "",
  );
  await page.keyboard.press("Escape");
  await selectTool(page, "Note");
  await menuCommand(page, "Tools", "Place note at center");
  await page.getByRole("textbox", { name: "Note text", exact: true }).fill("line\n".repeat(100));
  await expect(page.getByRole("alert")).toContainText("overflow the visible page");
  await expect(page.getByRole("button", { name: "Save note", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel note", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Generate PDF", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your marked PDF is ready", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Edit markup", exact: true }).click();
  await expect(page.getByRole("button", { name: "Keep editing", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download PDF", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Edit markup", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Edit markup", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download PDF", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-markup-id]")).toHaveCount(2);
});

test("generation cancellation terminates its worker and restores editing without losing markup", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      private writer = false;
      override postMessage(
        message: unknown,
        options?: StructuredSerializeOptions | Transferable[],
      ) {
        if (
          typeof message === "object" &&
          message !== null &&
          "operation" in message &&
          message.operation === "flatten"
        ) {
          this.writer = true;
          return;
        }
        if (Array.isArray(options)) {
          super.postMessage(message, options);
        } else {
          super.postMessage(message, options);
        }
      }
      override terminate() {
        if (this.writer) {
          document.documentElement.dataset.markupWriterStopped = "yes";
        }
        super.terminate();
      }
    };
  });
  await open(page);
  await selectTool(page, "Highlight");
  await menuCommand(page, "Tools", "Add centered highlight");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Generate PDF", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancel generation", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Cancel generation", exact: true }).click();
  await expect(
    page.getByText("Generation cancelled. Your markup is unchanged.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-markup-writer-stopped", "yes");
  await expect(page.locator("[data-markup-id]")).toHaveCount(1);
  await page.getByRole("menubar").getByRole("menuitem", { name: "Tools", exact: true }).click();
  await expect(page.getByRole("menuitemradio", { name: "Ink", exact: true })).toBeEnabled();
});

test("missing local note fonts fail visibly and can be retried", async ({ page }) => {
  await page.route("**/assets/markupFont.ttf", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await open(page);
  await expect(page.getByRole("alert")).toContainText("local note font could not load");
  await page.getByRole("menubar").getByRole("menuitem", { name: "Tools", exact: true }).click();
  await expect(page.getByRole("menuitemradio", { name: "Note", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.unroute("**/assets/markupFont.ttf");
  await page.getByRole("button", { name: "Retry note font", exact: true }).click();
  await page.getByRole("menubar").getByRole("menuitem", { name: "Tools", exact: true }).click();
  await expect(page.getByRole("menuitemradio", { name: "Note", exact: true })).toBeEnabled();
});

test("compact menubar supports keyboard tools, page jumping, zoom bounds and safe focus restoration", async ({
  page,
}) => {
  await open(page);
  const bar = page.getByRole("menubar", { name: "Markup commands" });
  await expect(bar.getByRole("menuitem")).toHaveText(["File", "Edit", "Tools", "View"]);
  const height = await bar.evaluate((element) => element.getBoundingClientRect().height);
  expect(height).toBeLessThanOrEqual(44);
  await bar.getByRole("menuitem", { name: "File", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(bar.getByRole("menuitem", { name: "Edit", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(bar.getByRole("menuitem", { name: "Tools", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "Select", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "Hand", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "Ink", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Editor view")).toContainText("Ink");
  await bar.getByRole("menuitem", { name: "Tools", exact: true }).click();
  await expect(page.getByRole("menuitemradio", { name: "Ink", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(bar.getByRole("menuitem", { name: "Tools", exact: true })).toBeFocused();
  await menuCommand(page, "Tools", "Draw signature...");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(bar.getByRole("menuitem", { name: "Tools", exact: true })).toBeFocused();
  await menuCommand(page, "View", "Go to page...");
  const input = page.getByRole("spinbutton", { name: "Page number", exact: true });
  await expect(input).toBeFocused();
  await input.fill("0");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toHaveText("Enter a page from 1 to 2.");
  await input.fill("2");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Editor view")).toContainText("Page 2 of 2");
  await bar.getByRole("menuitem", { name: "View", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Next page", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await selectZoom(page, "25%");
  await bar.getByRole("menuitem", { name: "View", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Zoom out", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await menuCommand(page, "View", "Zoom in");
  await expect(page.getByLabel("Editor view")).toContainText("50%");
  await selectZoom(page, "400%");
  await bar.getByRole("menuitem", { name: "View", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Zoom in", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await menuCommand(page, "View", "Zoom level...");
  await page.getByRole("spinbutton", { name: "Zoom percentage", exact: true }).fill("24");
  await page.getByRole("button", { name: "Apply zoom", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Enter a whole-number zoom from 25% to 400%.");
  await page.keyboard.press("Escape");
  await expect(bar.getByRole("menuitem", { name: "View", exact: true })).toBeFocused();
  await expect(page.getByLabel("Editor view")).toContainText("400%");
  await menuCommand(page, "File", "Start over");
  await expect(page.getByRole("button", { name: "Keep editing", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByLabel("Editor view")).toContainText("400%");
});

test("Edit menu edits notes and reaches overlapping markup through the object picker", async ({
  page,
}) => {
  await open(page);
  await menuCommand(page, "Tools", "Place note at center");
  await page.getByRole("textbox", { name: "Note text", exact: true }).fill("First note");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await menuCommand(page, "Edit", "Edit note...");
  await page.getByRole("textbox", { name: "Note text", exact: true }).fill("Edited note");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await menuCommand(page, "Tools", "Add centered highlight");
  await page
    .getByRole("combobox", { name: "Markup on this page", exact: true })
    .selectOption({ index: 1 });
  await menuCommand(page, "Edit", "Edit note...");
  await expect(page.getByRole("textbox", { name: "Note text", exact: true })).toHaveValue(
    "Edited note",
  );
  await page.getByRole("button", { name: "Cancel note", exact: true }).click();
  await menuCommand(page, "Edit", "Delete selected");
  await expect(page.locator("[data-markup-id]")).toHaveCount(1);
});

test("markup picker keeps its chevron inset and centered with long values at desktop and mobile widths", async ({
  page,
}) => {
  await open(page);
  const picker = page.getByRole("combobox", { name: "Markup on this page", exact: true });
  await expect(picker).toHaveCSS("appearance", "none");
  await menuCommand(page, "Tools", "Place note at center");
  await page
    .getByRole("textbox", { name: "Note text", exact: true })
    .fill("A longer note for the selector");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 812 });
    const metrics = await picker.evaluate((element) => {
      const wrapper = element.closest('[data-slot="native-select-wrapper"]');
      const icon = wrapper?.querySelector('[data-slot="native-select-icon"]');
      if (!icon) {
        throw new Error("The shadcn native select chevron is missing.");
      }
      const control = element.getBoundingClientRect();
      const chevron = icon.getBoundingClientRect();
      return {
        inset: control.right - chevron.right,
        centerOffset: Math.abs(control.top + control.height / 2 - chevron.top - chevron.height / 2),
        width: chevron.width,
        height: chevron.height,
        pointerEvents: getComputedStyle(icon).pointerEvents,
      };
    });
    expect(metrics.inset).toBeCloseTo(14, 0);
    expect(metrics.centerOffset).toBeLessThanOrEqual(1);
    expect(metrics.width).toBe(16);
    expect(metrics.height).toBe(16);
    expect(metrics.pointerEvents).toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await picker
      .locator("..")
      .screenshot({ path: test.info().outputPath(`markupSelect-${width}.png`) });
  }
  await page.getByText("Markup on this page", { exact: true }).click();
  await expect(picker).toBeFocused();
  await picker.selectOption("");
  await page.getByRole("menubar").getByRole("menuitem", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Edit note...", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
});

test("note preview and downloaded PDF use matching unkerned glyph spacing", async ({ page }) => {
  await open(page);
  const text = "AV To Wa office affine ffi ffl";
  await menuCommand(page, "Tools", "Place note at center");
  await page.getByRole("textbox", { name: "Note text", exact: true }).fill(text);
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  const line = page.locator("[data-markup-id] tspan");
  await expect(line).toHaveCount(1);
  const previewWidth = await line.evaluate((element) => {
    if (!(element instanceof SVGTextContentElement)) {
      throw new Error("The note preview is not SVG text.");
    }
    return element.getComputedTextLength();
  });
  await page.getByRole("checkbox").check();
  await menuCommand(page, "File", "Generate PDF");
  await expect(page.getByRole("button", { name: "Download PDF", exact: true })).toBeEnabled();
  const pending = page.waitForEvent("download");
  await menuCommand(page, "File", "Download PDF");
  const path = await (await pending).path();
  if (!path) {
    throw new Error("The note PDF download is missing.");
  }
  const artifact = await inspectArtifact(new Uint8Array(await readFile(path)));
  const items = artifact[0]!.textItems.filter((item) => item.text === text);
  expect(items).toHaveLength(1);
  expect(Math.abs(items[0]!.width - previewWidth)).toBeLessThan(0.25);
});
