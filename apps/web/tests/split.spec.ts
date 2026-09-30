import { expect, test } from "@playwright/test";
import { closeToolSidebar, navigateToTool, openToolSidebar } from "./fixtures/workspaceNavigation";
import { PDFDocument } from "pdf-lib";
import { addSplitSource, downloadSplit, editSplit, generateSplit } from "./fixtures/splitHelpers";
import { protectedPdf, malformedPageTree } from "./fixtures/preservationPdfs";
import {
  openToolSettings,
  closeToolSettings,
  setToolOption,
  withToolSettings,
} from "./fixtures/toolSettings";

for (const tool of ["split", "remove"] as const) {
  for (const phase of ["copying", "saving"] as const) {
    test(`${tool} job status uses operation-specific ${phase} wording`, async ({ page }) => {
      const removing = tool === "remove";
      const total = removing ? 9 : 1;
      await page.goto(`./${tool}/`);
      await addSplitSource(page);
      await page.getByRole("checkbox", { name: "Page 1", exact: true }).check();
      await closeToolSettings(page);
      await page.route("**/split.worker.js", (route) =>
        route.fulfill({
          contentType: "text/javascript",
          body: `self.onmessage = () => self.postMessage(${JSON.stringify({
            type: "progress",
            progress: { phase, completed: total, total },
          })});`,
        }),
      );
      await page.getByRole("checkbox", { name: /I understand these limitations/ }).check();
      await page
        .getByRole("button", { name: removing ? "Remove pages" : "Generate PDFs", exact: true })
        .click();
      const status = page
        .getByRole("region", { name: removing ? "Removal output" : "Split output" })
        .getByRole("status")
        .last();
      await expect(status).toHaveText(
        phase === "copying"
          ? `Copied ${total} of ${total} ${removing ? "kept" : "selected"} pages...`
          : removing
            ? "Saving PDF locally..."
            : "Saving PDFs locally...",
      );
      await page.getByRole("button", { name: "Cancel generation" }).click();
      await expect(status).toHaveText(
        "Generation cancelled. Your source and selection are unchanged.",
      );
      await expect(page.getByRole("checkbox", { name: "Page 1", exact: true })).toBeChecked();
    });
  }
}

test("bounded page windows, source-order toggles, Clear and single-source guards", async ({
  page,
}) => {
  await page.goto("./#/split");
  const dropped = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["x"], "one.pdf"));
    transfer.items.add(new File(["x"], "two.pdf"));
    return transfer;
  });
  await page
    .getByRole("region", { name: "Add a source PDF" })
    .dispatchEvent("drop", { dataTransfer: dropped });
  await dropped.dispose();
  await expect(page.getByRole("status")).toContainText("Choose exactly one PDF");
  await expect(page.getByRole("list", { name: "Source PDF" })).toHaveCount(0);
  await addSplitSource(page);
  await expect(page.getByRole("button", { name: "Add PDF", exact: true })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: /^Page \d+$/ })).toHaveCount(8);
  await page.getByRole("button", { name: "Next pages" }).click();
  await page.getByRole("checkbox", { name: "Page 10", exact: true }).check();
  await page.getByRole("button", { name: "Previous pages" }).click();
  const first = page.getByRole("checkbox", { name: "Page 1", exact: true });
  await first.focus();
  await page.keyboard.press("Space");
  await expect(first).toBeFocused();
  await expect(page.getByRole("img", { name: "Preview of page 1", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Output prediction" })).toContainText(
    "2 pages total.",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await generateSplit(page);
  const artifact = await downloadSplit(page);
  expect(
    (await PDFDocument.load(artifact.bytes)).getPages().map((item) => item.getWidth()),
  ).toEqual([300, 309]);
  await editSplit(page);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByRole("region", { name: "Output prediction" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Generate PDFs" })).toBeDisabled();
  await page.getByRole("button", { name: "Select all" }).click();
  await expect(page.getByRole("region", { name: "Output prediction" })).toContainText(
    "10 pages total.",
  );
});

test("range ordering, invalid settings and shorter final groups never show stale predictions", async ({
  page,
}) => {
  await page.goto("./#/split");
  await addSplitSource(page);
  await openToolSettings(page);
  await page.getByRole("radio", { name: "Custom ranges" }).check();
  await expect(page.getByText("Add at least one range.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add range" }).click();
  await expect(page.getByRole("spinbutton", { name: "Range 1 start page" })).toBeFocused();
  await page.getByRole("spinbutton", { name: "Range 1 start page" }).fill("5");
  await page.getByRole("spinbutton", { name: "Range 1 end page" }).fill("7");
  await page.getByRole("button", { name: "Add range" }).click();
  await page.getByRole("spinbutton", { name: "Range 2 start page" }).fill("2");
  await page.getByRole("spinbutton", { name: "Range 2 end page" }).fill("2");
  await page.getByRole("button", { name: "Move range 2 up" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Move range 1 up" })).toBeFocused();
  await generateSplit(page);
  const artifact = await downloadSplit(page);
  expect(
    (await PDFDocument.load(artifact.bytes)).getPages().map((item) => item.getWidth()),
  ).toEqual([301, 304, 305, 306]);
  await editSplit(page);
  for (const value of ["", "0", "11", "1.5", "3"]) {
    await withToolSettings(page, () =>
      page.getByRole("spinbutton", { name: "Range 1 start page" }).fill(value),
    );
    await expect(page.getByRole("region", { name: "Output prediction" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Generate PDFs" })).toBeDisabled();
  }
  await openToolSettings(page);
  await page.getByRole("button", { name: "Remove range 1" }).click();
  await expect(page.getByRole("spinbutton", { name: "Range 1 start page" })).toBeFocused();
  await page.getByRole("button", { name: "Remove range 1" }).click();
  await expect(page.getByRole("button", { name: "Add range" })).toBeFocused();
  await closeToolSettings(page);
  await expect(page.getByRole("region", { name: "Output prediction" })).toHaveCount(0);
  await setToolOption(page, "Fixed page-count groups");
  for (const value of ["", "0", "11", "1.5"]) {
    await withToolSettings(page, () =>
      page.getByRole("spinbutton", { name: "Pages per PDF" }).fill(value),
    );
    await expect(page.getByRole("region", { name: "Output prediction" })).toHaveCount(0);
  }
  await withToolSettings(page, () =>
    page.getByRole("spinbutton", { name: "Pages per PDF" }).fill("4"),
  );
  await expect(page.getByRole("region", { name: "Output prediction" })).toContainText(
    "report-split-003.pdf · 2 pages",
  );
  await withToolSettings(page, () =>
    page.getByRole("spinbutton", { name: "Pages per PDF" }).fill("10"),
  );
  await generateSplit(page);
  expect((await downloadSplit(page)).name).toBe("report-split-001.pdf");
  await expect(page.getByRole("button", { name: "Prepare ZIP for all PDFs" })).toHaveCount(0);
});

test("cancellation, worker/resource failures and optional preview errors preserve the draft", async ({
  page,
}) => {
  await page.route("**/pdf.worker.min.js", (route) => route.abort());
  await page.goto("./#/split");
  await addSplitSource(page, 1);
  await expect(page.getByText(/Preview unavailable. You can still select/)).toBeVisible();
  await page.getByRole("checkbox", { name: "Page 1", exact: true }).check();
  await page.route("**/split.worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "self.onmessage = () => { while (true) {} };",
    }),
  );
  await page.getByRole("checkbox", { name: /I understand these limitations/ }).check();
  await page.getByRole("button", { name: "Generate PDFs" }).click();
  await expect(page.getByRole("button", { name: "Drag page 1", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Move page 1 later", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Retry preview of page 1" })).toBeDisabled();
  await withToolSettings(page, () =>
    expect(page.getByRole("radio", { name: "Every page", exact: true })).toBeDisabled(),
  );
  await openToolSidebar(page);
  await expect(page.getByRole("link", { name: "Merge PDFs", exact: true })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await closeToolSidebar(page);
  await page.evaluate(() => {
    location.hash = "#/merge";
  });
  await expect(page).toHaveURL(/\/split\/$/);
  await page.getByRole("button", { name: "Cancel generation" }).click();
  await expect(
    page.getByRole("region", { name: "Split output" }).getByRole("status"),
  ).toContainText("Generation cancelled");
  await expect(page.getByRole("heading", { name: "Your source PDF" })).toBeFocused();
  await expect(page.getByRole("checkbox", { name: "Page 1", exact: true })).toBeChecked();
  await page.unroute("**/pdf.worker.min.js");
  await page.getByRole("button", { name: "Retry preview of page 1" }).click();
  await expect(page.getByRole("img", { name: "Preview of page 1", exact: true })).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Page 1, position 1 of 1" })).toBeFocused();
  await expect(page.getByRole("checkbox", { name: "Page 1", exact: true })).toBeChecked();
  await page.unroute("**/split.worker.js");
  await page.route("**/split.worker.js", (route) => route.abort());
  await page.getByRole("button", { name: "Generate PDFs" }).click();
  await expect(page.getByText(/The local worker failed/)).toBeFocused();
  await page.unroute("**/split.worker.js");
  await page.route("**/split.worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'self.onmessage = () => self.postMessage({type:"result",result:{kind:"failure",code:"limit",message:"Selected pages exceed the configured limit. Select fewer pages."}});',
    }),
  );
  await page.getByRole("button", { name: "Retry generation" }).click();
  await expect(page.getByText(/Selected pages exceed/)).toBeFocused();
  await page.unroute("**/split.worker.js");
  await generateSplit(page);
  expect((await downloadSplit(page)).name).toBe("report-extracted.pdf");
});

test("repeated split and ZIP cycles release workers and URLs, with explicit recovery", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const workers = new Set<Worker>();
    const urls = new Set<string>();
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        workers.add(this);
      }
      terminate() {
        workers.delete(this);
        super.terminate();
      }
    };
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
    Object.defineProperty(window, "splitResources", {
      get: () => ({ workers: workers.size, urls: urls.size }),
    });
  });
  await page.goto("./#/split");
  for (let cycle = 0; cycle < 5; cycle++) {
    await addSplitSource(page, 10);
    await setToolOption(page, "Every page");
    await expect(
      page.getByRole("region", { name: "Output prediction" }).getByRole("listitem"),
    ).toHaveCount(8);
    await page.getByRole("button", { name: "Next predictions" }).click();
    await expect(page.getByRole("region", { name: "Output prediction" })).toContainText(
      "report-split-010.pdf",
    );
    await generateSplit(page);
    await page.getByRole("button", { name: "Next outputs" }).click();
    expect((await downloadSplit(page, "Download report-split-010.pdf")).name).toBe(
      "report-split-010.pdf",
    );
    if (cycle === 0) {
      await page.route("**/bundle.worker.js", (route) => route.abort());
      await page.getByRole("button", { name: "Prepare ZIP for all PDFs" }).click();
      await expect(page.getByRole("alert")).toContainText("worker failed");
      await page.unroute("**/bundle.worker.js");
      await page.route("**/bundle.worker.js", (route) =>
        route.fulfill({
          contentType: "text/javascript",
          body: "self.onmessage = () => { while (true) {} };",
        }),
      );
      await page.getByRole("button", { name: "Prepare ZIP for all PDFs" }).click();
      await expect(page.getByRole("button", { name: "Edit selection" })).toBeDisabled();
      await page.getByRole("button", { name: "Cancel ZIP preparation" }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "ZIP preparation cancelled" }),
      ).toBeVisible();
      await page.unroute("**/bundle.worker.js");
    }
    await page.getByRole("button", { name: "Prepare ZIP for all PDFs" }).click();
    await expect(page.getByRole("button", { name: "Download ZIP" })).toBeVisible();
    if (cycle === 0) {
      await page.evaluate(() => {
        const original = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
          HTMLAnchorElement.prototype.click = original;
          throw new Error("Test download failure");
        };
      });
      await page.getByRole("button", { name: "Download ZIP" }).click();
      await expect(page.getByRole("alert")).toContainText("still available");
    }
    expect((await downloadSplit(page, "Download ZIP")).name).toBe("report-split.zip");
    await page.getByRole("button", { name: "Start over" }).click();
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(page.getByRole("button", { name: "Add PDF", exact: true })).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, "splitResources")))
      .toEqual({ workers: 0, urls: 0 });
  }
});

test("unsupported sources stay visible and cannot be acknowledged away", async ({ page }) => {
  await page.goto("./#/split");
  for (const source of [
    await protectedPdf("encryptedEmpty.pdf"),
    await protectedPdf("signed.pdf"),
    await malformedPageTree(),
  ]) {
    await page.locator('input[type="file"]').setInputFiles(source);
    await expect(
      page.getByRole("button", { name: `Retry validation of ${source.name}` }),
    ).toBeVisible();
    await page.getByRole("checkbox", { name: /I understand these limitations/ }).check();
    await expect(page.getByRole("button", { name: "Generate PDFs" })).toBeDisabled();
    await page.getByRole("button", { name: `Remove ${source.name}`, exact: true }).click();
    await expect(page.getByRole("button", { name: "Add PDF", exact: true })).toBeFocused();
  }
  await addSplitSource(page, 1);
  await setToolOption(page, "Every page");
  await generateSplit(page);
  await page.getByRole("button", { name: "Edit selection" }).click();
  await expect(page.getByRole("button", { name: "Keep working" })).toBeFocused();
  await page.getByRole("button", { name: "Keep working" }).click();
  await navigateToTool(page, "Merge PDFs");
  await page.getByRole("button", { name: "Keep working" }).click();
  await expect(page.getByRole("button", { name: "Download PDF", exact: true })).toBeVisible();
  await navigateToTool(page, "Merge PDFs");
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(/\/merge\/$/);
  await expect(page.locator("[data-workspace-content]").getByRole("listitem")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/split\/$/);
  await addSplitSource(page, 1);
  await withToolSettings(page, () =>
    expect(page.getByRole("radio", { name: "Selected pages", exact: true })).toBeChecked(),
  );
  await expect(page.getByRole("checkbox", { name: "Page 1", exact: true })).not.toBeChecked();
});
