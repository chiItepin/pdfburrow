import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, PDFName, StandardFonts, degrees } from "pdf-lib";
import { readFile } from "node:fs/promises";

async function pdf(name: string, pages = 1, form = false) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pages; index++) {
    const page = document.addPage([300 + index * 100, 500]);
    page.setRotation(degrees(index * 90));
    page.drawText(`${name} page ${index + 1}`, { x: 30, y: 100, font });
  }
  if (form) {
    document.getForm().createTextField("name").addToPage(document.getPage(0));
  }
  return { name, mimeType: "application/pdf", buffer: Buffer.from(await document.save()) };
}

async function ready(page: Page, supplied?: Awaited<ReturnType<typeof pdf>>[]) {
  const files = supplied ?? [await pdf("first.pdf"), await pdf("second.pdf", 2)];
  await page.locator('input[type="file"]').setInputFiles(files);
  await expect(
    page.getByText(`Output: one PDF, ${files.length === 2 ? 3 : 1} page`, { exact: false }),
  ).toBeVisible();
}

async function merge(page: Page) {
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your merged PDF is ready" })).toBeFocused();
}

test("real merge downloads ordered pages and works locally without document requests", async ({
  page,
  baseURL,
  browserName,
}) => {
  const requests: { url: string; method: string }[] = [];
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
  await page.goto("./#/merge");
  expect(requests.some((request) => request.url.includes("merge.js"))).toBe(false);
  expect(requests.some((request) => request.url.includes("preview.js"))).toBe(false);
  await expect(page.getByRole("button", { name: "Add PDFs" })).toHaveCSS(
    "background-color",
    "rgb(147, 212, 183)",
  );
  await page.getByRole("heading", { name: "Merge PDFs", exact: true }).focus();
  // macOS WebKit uses Option-Tab to include buttons in native keyboard navigation.
  await page.keyboard.press(
    browserName === "webkit" && process.platform === "darwin" ? "Alt+Tab" : "Tab",
  );
  await expect(page.getByRole("button", { name: /^(Open|Close) settings$/ })).toBeFocused();
  await page.keyboard.press(
    browserName === "webkit" && process.platform === "darwin" ? "Alt+Tab" : "Tab",
  );
  if (browserName === "firefox") {
    await expect(
      page.getByRole("region", { name: "Document workspace", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
  }
  await expect(page.getByRole("button", { name: "Add PDFs" })).toBeFocused();
  await ready(page);
  await page.getByRole("checkbox").check();
  const up = page.getByRole("button", { name: "Move second.pdf up" });
  await up.focus();
  await page.keyboard.press("Enter");
  await expect(up).toBeFocused();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await expect(
    page.locator("[data-workspace-content]").getByRole("listitem").first(),
  ).toContainText("second.pdf");
  await expect(page.getByRole("img", { name: "First page of second.pdf" })).toBeVisible();
  const originalPreview = await page
    .getByRole("img", { name: "First page of second.pdf" })
    .evaluate(async (image: HTMLImageElement) =>
      Array.from(new Uint8Array(await (await fetch(image.src)).arrayBuffer())),
    );
  await merge(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("second-merged.pdf");
  const output = await PDFDocument.load(await readFile((await download.path())!));
  expect(output.getPageCount()).toBe(3);
  expect(output.getPages().map((item) => item.getWidth())).toEqual([300, 400, 300]);
  expect(output.getPages().map((item) => item.getRotation().angle)).toEqual([0, 90, 0]);
  expect(requests.some((request) => request.url.includes("merge.worker.js"))).toBe(true);
  expect(
    requests.every(
      (request) =>
        request.method === "GET" &&
        (request.url.startsWith(baseURL!) || request.url.startsWith("blob:")),
    ),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "merged.pdf",
    mimeType: "application/pdf",
    buffer: await readFile((await download.path())!),
  });
  const mergedPreview = page.getByRole("img", { name: "First page of merged.pdf" });
  await expect(mergedPreview).toBeVisible();
  expect(
    await mergedPreview.evaluate(async (image: HTMLImageElement) =>
      Array.from(new Uint8Array(await (await fetch(image.src)).arrayBuffer())),
    ),
  ).toEqual(originalPreview);
});

test("unsupported input blocks merging and removal resets acknowledgement and preserves valid files", async ({
  page,
}) => {
  await page.goto("./#/merge");
  await ready(page, [await pdf("valid.pdf")]);
  await page.getByRole("checkbox").check();
  await page.locator('input[type="file"]').setInputFiles([await pdf("form.pdf", 1, true)]);
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(page.getByText(/Interactive form fields detected/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Merge PDFs", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Remove form.pdf" }).click();
  await expect(page.getByRole("button", { name: "Remove valid.pdf" })).toBeFocused();
  await expect(page.locator("[data-workspace-content]").getByRole("listitem")).toHaveCount(1);
  await merge(page);
});

test("required worker failure can be explicitly retried without re-adding files", async ({
  page,
}) => {
  await page.route("**/merge.worker.js", (route) => route.abort());
  await page.goto("./#/merge");
  await page.locator('input[type="file"]').setInputFiles([await pdf("retry.pdf")]);
  await expect(page.getByText(/local worker failed/)).toBeVisible();
  await page.unroute("**/merge.worker.js");
  await page.getByRole("button", { name: "Retry validation of retry.pdf" }).click();
  await expect(page.getByText("Output: one PDF, 1 page, in the order above.")).toBeVisible();
  await merge(page);
});

test("cancellation stops synchronous worker execution and restores the unchanged draft", async ({
  page,
}) => {
  await page.goto("./#/merge");
  await ready(page);
  await page.route("**/merge.worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "self.onmessage = () => { while (true) {} };",
    }),
  );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add PDFs" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Start over" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel merge" }).click();
  await expect(page.getByRole("status")).toContainText("Merge cancelled");
  await expect(page.getByRole("heading", { name: "Your PDFs", exact: true })).toBeFocused();
  await expect(page.locator("[data-workspace-content]").getByRole("listitem")).toHaveCount(2);
  await page.unroute("**/merge.worker.js");
  await merge(page);
});

test("unsaved results and reset use safe discard confirmation", async ({ page }) => {
  await page.goto("./#/merge");
  await ready(page);
  await merge(page);
  await page.getByRole("button", { name: "Edit inputs" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep working" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Edit inputs" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
  await page.getByRole("button", { name: "Edit inputs" }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download PDF" })).toHaveCount(0);
  await expect(page.locator("[data-workspace-content]").getByRole("listitem")).toHaveCount(2);
  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.locator("[data-workspace-content]").getByRole("listitem")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add PDFs" })).toBeFocused();
});

test("preview failures do not override required validation or prevent merging", async ({
  page,
}) => {
  await page.route("**/preview.js", (route) => route.abort());
  await page.goto("./#/merge");
  await ready(page, [await pdf("preview.pdf")]);
  await expect(page.getByText("Preview unavailable", { exact: true })).toBeVisible();
  await merge(page);
});

test("a failed preview worker does not hang the preview queue or block merging", async ({
  page,
}) => {
  await page.route("**/pdf.worker.min.js", (route) => route.abort());
  await page.goto("./#/merge");
  await ready(page, [await pdf("preview-worker.pdf")]);
  await expect(page.getByText("Preview unavailable", { exact: true })).toBeVisible();
  await merge(page);
});

test("repeated jobs release app-owned workers and URLs after reset", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const activeWorkers = new Set<Worker>();
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        activeWorkers.add(this);
      }
      terminate() {
        activeWorkers.delete(this);
        super.terminate();
      }
    };
    const urls = new Set<string>();
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (object) => {
      const url = create(object);
      urls.add(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      urls.delete(url);
      revoke(url);
    };
    Object.defineProperty(window, "mergeResources", {
      get: () => ({ workers: activeWorkers.size, urls: urls.size }),
    });
  });
  const input = await pdf("repeat.pdf");
  await page.goto("./#/merge");
  for (let i = 0; i < 20; i++) {
    await ready(page, [input]);
    await merge(page);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF" }).click();
    await download;
    await page.getByRole("button", { name: "Start over" }).click();
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, "mergeResources")))
      .toEqual({ workers: 0, urls: 0 });
  }
});

test("download failures retain the output for explicit retry", async ({ page }) => {
  await page.goto("./#/merge");
  await ready(page, [await pdf("download.pdf")]);
  await merge(page);
  await page.evaluate(() => {
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      HTMLAnchorElement.prototype.click = original;
      throw new Error("Injected download error");
    };
  });
  await page.getByRole("button", { name: "Download PDF" }).click();
  await expect(page.getByRole("alert")).toContainText("still available");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  expect((await downloaded).suggestedFilename()).toBe("download-merged.pdf");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("corrupt and signature-bearing inputs fail visibly", async ({ page }) => {
  const signed = await PDFDocument.create();
  signed.addPage();
  signed.context.register(
    signed.context.obj({ Type: PDFName.of("Sig"), ByteRange: [0, 100, 200, 300] }),
  );
  await page.goto("./#/merge");
  await page.locator('input[type="file"]').setInputFiles([
    { name: "corrupt.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nbad") },
    {
      name: "signature.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await signed.save()),
    },
  ]);
  await expect(page.getByText(/could not pass structural validation/)).toBeVisible();
  await expect(page.getByText(/Digital signatures detected/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Merge PDFs", exact: true })).toBeDisabled();
});

test("native dragging crosses input-list pages without cancelling the drag", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Native HTML dragging requires a desktop pointer.");
  const files = await Promise.all(
    Array.from({ length: 9 }, async (_, index) => {
      const document = await PDFDocument.create();
      document.addPage([300 + index * 10, 500]);
      return {
        name: `input-${index + 1}.pdf`,
        mimeType: "application/pdf",
        buffer: Buffer.from(await document.save()),
      };
    }),
  );
  await page.goto("./#/merge");
  await page.locator('input[type="file"]').setInputFiles(files);
  await expect(page.getByText("Output: one PDF, 9 pages, in the order above.")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.evaluate(() => {
    for (const type of ["dragstart", "dragend", "drop"]) {
      document.addEventListener(type, (event) => {
        if (event.isTrusted) {
          document.documentElement.dataset.nativeDragEvent = type;
        }
      });
    }
  });

  const dragAcrossPage = async (direction: "Next" | "Previous", position: number) => {
    const target = page.getByRole("button", { name: `${direction} files`, exact: true });
    await target.scrollIntoViewIfNeeded();
    const source = page.getByRole("heading", { name: /^\d+\. input-8\.pdf$/ });
    await source.scrollIntoViewIfNeeded();
    const sourceBounds = await source.boundingBox();
    const targetBounds = await target.boundingBox();
    if (!sourceBounds || !targetBounds) {
      throw new Error("The drag source and pagination drop target must be visible.");
    }
    await page.mouse.move(sourceBounds.x + 10, sourceBounds.y + 10);
    await page.mouse.down();
    await page.mouse.move(sourceBounds.x + 20, sourceBounds.y + 15);
    await page.mouse.move(targetBounds.x + 10, targetBounds.y + 10, { steps: 10 });
    await page.mouse.move(targetBounds.x + 15, targetBounds.y + 15);
    await expect(page.locator("html")).toHaveAttribute("data-native-drag-event", "dragstart");
    await expect(source).toBeAttached();
    await page.mouse.up();
    await expect(page.getByRole("status")).toContainText(
      `input-8.pdf moved to position ${position} of 9.`,
    );
    await expect(page.locator("html")).toHaveAttribute("data-native-drag-event", "dragend");
    await expect(page.getByRole("checkbox")).toBeChecked();
    expect(
      await page.locator("[data-workspace-content]").getByRole("listitem").count(),
    ).toBeLessThanOrEqual(8);
    expect(await page.getByRole("img").count()).toBeLessThanOrEqual(8);
  };

  await dragAcrossPage("Next", 9);
  await expect(page.locator("[data-workspace-content]").getByRole("listitem")).toHaveCount(1);
  await expect(page.locator("[data-workspace-content]").getByRole("listitem")).toContainText(
    "9. input-8.pdf",
  );
  await dragAcrossPage("Previous", 8);
  await expect(page.locator("[data-workspace-content]").getByRole("listitem")).toHaveCount(8);
  await expect(page.locator("[data-workspace-content]").getByRole("listitem").last()).toContainText(
    "8. input-8.pdf",
  );
  await dragAcrossPage("Next", 9);
  await merge(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  const output = await PDFDocument.load(await readFile((await download.path())!));
  expect(output.getPages().map((item) => item.getWidth())).toEqual([
    300, 310, 320, 330, 340, 350, 360, 380, 370,
  ]);
});

test("cross-page keyboard ordering and file-upload drops remain independent", async ({ page }) => {
  await page.goto("./#/merge");
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      await Promise.all(Array.from({ length: 9 }, (_, index) => pdf(`input-${index + 1}.pdf`))),
    );
  await expect(page.getByText("Output: one PDF, 9 pages, in the order above.")).toBeVisible();
  await page.getByRole("checkbox").check();
  const down = page.getByRole("button", { name: "Move input-8.pdf down" });
  await down.focus();
  await page.keyboard.press("Enter");
  await expect(down).toBeFocused();
  await expect(page.locator("[data-workspace-content]").getByRole("listitem")).toHaveCount(1);
  await expect(page.locator("[data-workspace-content]").getByRole("listitem")).toContainText(
    "9. input-8.pdf",
  );
  const up = page.getByRole("button", { name: "Move input-8.pdf up" });
  await up.focus();
  await page.keyboard.press("Enter");
  await expect(up).toBeFocused();
  await expect(page.locator("[data-workspace-content]").getByRole("listitem")).toHaveCount(8);
  await expect(page.locator("[data-workspace-content]").getByRole("listitem").last()).toContainText(
    "8. input-8.pdf",
  );
  await expect(page.getByRole("checkbox")).toBeChecked();

  const file = await pdf("uploaded.pdf");
  const transfer = await page.evaluateHandle((bytes) => {
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array(bytes)], "uploaded.pdf", { type: "application/pdf" }));
    return data;
  }, Array.from(file.buffer));
  const next = page.getByRole("button", { name: "Next files", exact: true });
  await next.dispatchEvent("dragover", { dataTransfer: transfer });
  await next.dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.getByText("Files 1-8 of 9")).toBeVisible();
  await expect(page.getByRole("checkbox")).toBeChecked();
  const picker = page.getByRole("region", { name: "Add PDF files" });
  await picker.dispatchEvent("dragover", { dataTransfer: transfer });
  await picker.dispatchEvent("drop", { dataTransfer: transfer });
  await transfer.dispose();
  await expect(page.getByText("Output: one PDF, 10 pages, in the order above.")).toBeVisible();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await next.click();
  await expect(page.locator("[data-workspace-content]").getByRole("listitem")).toHaveCount(2);
  await expect(
    page.locator("[data-workspace-content]").getByRole("listitem").first(),
  ).toContainText("9. input-9.pdf");
  await expect(page.locator("[data-workspace-content]").getByRole("listitem").last()).toContainText(
    "10. uploaded.pdf",
  );
});
