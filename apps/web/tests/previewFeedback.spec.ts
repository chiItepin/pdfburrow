import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, rgb } from "pdf-lib";

const pdf = async (name: string) => {
  const document = await PDFDocument.create();
  document
    .addPage([300, 400])
    .drawRectangle({ x: 30, y: 100, width: 200, height: 150, color: rgb(0.2, 0.6, 0.3) });
  return { name, mimeType: "application/pdf", buffer: Buffer.from(await document.save()) };
};

const choose = async (page: Page, files: Awaited<ReturnType<typeof pdf>>[]) => {
  const opened = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Add PDFs", exact: true }).click();
  await (await opened).setFiles(files);
};

test.beforeEach(async ({ page }) => {
  await page.goto("./#/merge");
});

test("the PDF picker produces a nonblank first-page thumbnail", async ({ page }) => {
  await choose(page, [await pdf("picked.pdf")]);
  const image = page.getByRole("img", { name: "First page of picked.pdf" });
  await expect(image).toBeVisible();
  const pixels = await image.evaluate(async (image: HTMLImageElement) => {
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas context unavailable.");
    }
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let marked = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index]! < 240 || data[index + 1]! < 240 || data[index + 2]! < 240) {
        marked++;
      }
    }
    return { width: canvas.width, height: canvas.height, marked };
  });
  expect(pixels.width).toBe(108);
  expect(pixels.height).toBe(144);
  expect(pixels.marked).toBeGreaterThan(1_000);
  await expect(image).toHaveCSS("object-fit", "contain");
});

test("preview rendering and queued work have distinct visible states", async ({ page }) => {
  let resume!: () => void;
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  await page.route("**/pdf.worker.min.js", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await choose(page, [await pdf("first.pdf"), await pdf("second.pdf")]);
    await expect(page.getByText("Output: one PDF, 2 pages, in the order above.")).toBeVisible();
    await expect(page.getByText("Generating preview...", { exact: true })).toBeVisible();
    await expect(page.getByText("Preview queued", { exact: true })).toBeVisible();
  } finally {
    resume();
  }
  await expect(page.getByRole("img")).toHaveCount(2);
  await expect(page.getByText("Generating preview...", { exact: true })).toHaveCount(0);
});

test("retrying a failed preview preserves validation, order, and acknowledgement", async ({
  page,
}) => {
  await page.route("**/pdf.worker.min.js", (route) => route.abort());
  await choose(page, [await pdf("retry.pdf"), await pdf("keep-error.pdf")]);
  await expect(page.getByText("Preview unavailable", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Output: one PDF, 2 pages, in the order above.")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.unroute("**/pdf.worker.min.js");
  await page.getByRole("button", { name: "Retry preview of retry.pdf" }).click();
  await expect(page.getByRole("img", { name: "First page of retry.pdf" })).toBeVisible();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await expect(
    page.getByRole("list", { name: "PDF input order" }).getByRole("listitem"),
  ).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "1. retry.pdf" })).toBeFocused();
  await expect(page.getByText("Preview unavailable", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Retry preview of keep-error.pdf" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Merge PDFs", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Retry validation of retry.pdf" })).toHaveCount(0);
});

test("PNG selection cannot bypass PDF validation even with a PDF filename and MIME type", async ({
  page,
}) => {
  await expect(page.locator('input[type="file"]')).toHaveAttribute(
    "accept",
    ".pdf,application/pdf",
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  await choose(page, [
    { name: "image.png", mimeType: "image/png", buffer: png },
    { name: "disguised.pdf", mimeType: "application/pdf", buffer: png },
  ]);
  await expect(page.getByText("This file is not a PDF.", { exact: false })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Merge PDFs", exact: true })).toBeDisabled();
  await expect(page.getByRole("img")).toHaveCount(0);
});

test("page-copy progress uses the complete draft total and exposes numeric accessibility state", async ({
  page,
}) => {
  await choose(page, [await pdf("one.pdf"), await pdf("two.pdf"), await pdf("three.pdf")]);
  await expect(page.getByText("Output: one PDF, 3 pages, in the order above.")).toBeVisible();
  await page.route("**/merge.worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `self.onmessage = () => self.postMessage({
        type: "progress", progress: { phase: "copying", completed: 1, total: 1 }
      });`,
    }),
  );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  const progress = page.getByRole("progressbar", { name: "Pages copied" });
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  await expect(progress).toHaveAttribute("aria-valuemax", "3");
  await expect(progress).toHaveAttribute("aria-valuetext", "1 of 3 pages copied");
  await expect(progress.locator('[data-slot="progress-indicator"]')).toHaveAttribute(
    "style",
    /translateX\(-66\.6/,
  );
  await page.getByRole("button", { name: "Cancel merge" }).click();
  await expect(progress).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Merge status" })).toContainText("Merge cancelled");
});

test("saving is indeterminate and reduced motion retains a static spinner and status text", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await choose(page, [await pdf("save.pdf")]);
  await expect(page.getByText("Output: one PDF, 1 page, in the order above.")).toBeVisible();
  await page.route("**/merge.worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `self.onmessage = () => self.postMessage({
        type: "progress", progress: { phase: "saving", completed: 1, total: 1 }
      });`,
    }),
  );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  const status = page.getByRole("status", { name: "Merge status" });
  await expect(status).toContainText("Saving the merged PDF...");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(status.locator('[data-slot="spinner"]')).toHaveCSS("animation-name", "none");
  await page.getByRole("button", { name: "Cancel merge" }).click();
  await expect(status).toContainText("Merge cancelled");
});

test("completion and download toasts are selective and do not claim that a file was saved", async ({
  page,
}) => {
  await choose(page, [await pdf("notice.pdf")]);
  await expect(page.getByText("Output: one PDF, 1 page, in the order above.")).toBeVisible();
  const toasts = page.locator("[data-sonner-toast]");
  await expect(toasts).toHaveCount(0);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  await expect(toasts).toContainText("Your PDF is ready.");
  await expect(page.getByRole("heading", { name: "Your merged PDF is ready" })).toBeFocused();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  await downloaded;
  await expect(toasts.filter({ hasText: "Download requested." })).toContainText(
    "does not confirm the file was saved",
  );
  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(toasts).toHaveCount(0);
});

test("mobile and coarse-pointer file controls have touch-sized targets", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Checks the mobile layout and coarse-pointer variant.");
  await choose(page, [await pdf("touch.pdf")]);
  for (const name of ["Add PDFs", "Move touch.pdf up", "Move touch.pdf down", "Remove touch.pdf"]) {
    const bounds = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
