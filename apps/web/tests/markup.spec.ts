import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { PDFDocument, PDFName, StandardFonts, degrees } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { inspectArtifact } from "./fixtures/pdfArtifacts";
import { navigateToTool } from "./fixtures/workspaceNavigation";

const source = async (annotations = false) => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const angle of [0, 90]) {
    const page = document.addPage([400, 500]);
    page.setCropBox(10, 20, 360, 440);
    page.setRotation(degrees(angle));
    page.drawText("Original contract", { x: 60, y: 250, font, size: 12 });
  }
  if (annotations) {
    document
      .getPage(0)
      .node.set(
        PDFName.of("Annots"),
        document.context.obj([{ Type: "Annot", Subtype: "Link", Rect: [10, 10, 20, 20] }]),
      );
  }
  return Buffer.from(await document.save());
};
const open = async (page: Page, annotations = false) => {
  await page.goto("./sign/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "contract.pdf",
    mimeType: "application/pdf",
    buffer: await source(annotations),
  });
  if (!annotations) {
    await expect(
      page.getByRole("button", { name: "PDF markup canvas, page 1", exact: true }),
    ).toBeVisible();
  }
};
const menuCommand = async (page: Page, menu: string, command: string) => {
  await page.getByRole("menubar").getByRole("menuitem", { name: menu, exact: true }).click();
  await page.getByRole("menuitem", { name: command, exact: true }).click();
};
const selectTool = async (page: Page, tool: string) => {
  await page.getByRole("menubar").getByRole("menuitem", { name: "Tools", exact: true }).click();
  await page.getByRole("menuitemradio", { name: tool, exact: true }).click();
  await expect(
    page.getByRole("menubar").getByRole("menuitem", { name: "Tools", exact: true }),
  ).toBeFocused();
};
const selectZoom = async (page: Page, zoom: string) => {
  await menuCommand(page, "View", "Zoom level...");
  await page
    .getByRole("spinbutton", { name: "Zoom percentage", exact: true })
    .fill(zoom.replace("%", ""));
  await page.getByRole("button", { name: "Apply zoom", exact: true }).click();
};
const signature = async (page: Page) => {
  await menuCommand(page, "Tools", "Draw signature...");
  const pad = page.getByRole("button", { name: "Signature drawing pad", exact: true });
  await expect(pad).toBeVisible();
  const box = await pad.boundingBox();
  if (!box) {
    throw new Error("No signature pad bounds.");
  }
  await page.mouse.click(box.x + 40, box.y + 40);
  await page.mouse.move(box.x + 90, box.y + 70, { steps: 6 });
  await page.mouse.move(box.x + 130, box.y + 45, { steps: 6 });
  await page.mouse.click(box.x + 160, box.y + 60);
  await expect(page.getByText("1 completed stroke", { exact: true })).toBeVisible();
  await page.mouse.click(box.x + 100, box.y + 80);
  await page.mouse.move(box.x + 150, box.y + 95, { steps: 4 });
  await page.mouse.click(box.x + 180, box.y + 80);
  await expect(page.getByText("2 completed strokes", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Use signature", exact: true }).click();
};

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
  await page.getByRole("spinbutton", { name: "Zoom percentage", exact: true }).fill("26");
  await page.getByRole("button", { name: "Apply zoom", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Enter a zoom from 25% to 400%, in steps of 25%.",
  );
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
