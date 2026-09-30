import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { addSplitSource, downloadSplit, editSplit } from "./fixtures/splitHelpers";
import { generateRemoval } from "./fixtures/removalHelpers";
import { inspectArtifact } from "./fixtures/pdfArtifacts";
import { preservationPdfs, protectedPdf } from "./fixtures/preservationPdfs";
import { navigateToTool } from "./fixtures/workspaceNavigation";

test("marked pages are omitted across windows, with empty/all selections blocked", async ({
  page,
}) => {
  const automaticDownloads: string[] = [];
  page.on("download", (download) => automaticDownloads.push(download.suggestedFilename()));
  await page.goto("./");
  await page.getByRole("link", { name: "Open Remove pages" }).click();
  await expect(page).toHaveURL(/\/remove\/$/);
  await addSplitSource(page);
  const generate = page.getByRole("button", { name: "Remove pages", exact: true });
  const prediction = page.getByRole("region", { name: "Output prediction" });
  await expect(generate).toBeDisabled();
  await expect(
    page.getByText("Select at least one page to remove.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /^Page \d+$/ })).toHaveCount(8);
  await expect(
    page.getByRole("button", { name: /^(Drag page|Move page|Reset page order)/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Next pages" }).click();
  await page.getByRole("checkbox", { name: "Page 10", exact: true }).check();
  await page.getByRole("button", { name: "Previous pages" }).click();
  const first = page.getByRole("checkbox", { name: "Page 1", exact: true });
  await first.focus();
  await page.keyboard.press("Space");
  await expect(first).toBeFocused();
  await expect(page.locator("#page-1")).toContainText("Will remove");
  await expect(prediction).toContainText("report-removed.pdf");
  await expect(prediction).toContainText("8 pages total.");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(prediction).toHaveCount(0);
  await expect(generate).toBeDisabled();
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await expect(page.getByText(/Keep at least one page\. Clear/)).toBeVisible();
  await expect(prediction).toHaveCount(0);
  await expect(generate).toBeDisabled();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await first.check();
  await page.getByRole("button", { name: "Next pages" }).click();
  await page.getByRole("checkbox", { name: "Page 10", exact: true }).check();
  await generateRemoval(page);
  expect(automaticDownloads).toEqual([]);
  await expect(page.getByRole("button", { name: "Prepare ZIP for all PDFs" })).toHaveCount(0);
  const artifact = await downloadSplit(page);
  expect(artifact.name).toBe("report-removed.pdf");
  expect(
    (await PDFDocument.load(artifact.bytes)).getPages().map((item) => item.getWidth()),
  ).toEqual([301, 302, 303, 304, 305, 306, 307, 308]);
  await editSplit(page);
  await expect(page.getByRole("checkbox", { name: "Page 10", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Previous pages" }).click();
  await expect(first).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("downloaded removal preserves kept text, pixels and geometry without uploading", async ({
  page,
  baseURL,
}) => {
  const requests: { url: string; method: string }[] = [];
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
  const input = (await preservationPdfs())[0]!;
  const source = await inspectArtifact(input.buffer);
  await page.goto("./remove/");
  await page.locator('input[type="file"]').setInputFiles(input);
  await page.getByRole("checkbox", { name: "Page 2", exact: true }).check();
  await generateRemoval(page);
  const artifact = await downloadSplit(page);
  expect(artifact.name).toBe("embedded-text-removed.pdf");
  expect(await inspectArtifact(artifact.bytes)).toEqual([source[0], source[2]]);
  expect(requests.some(({ url }) => url.includes("/split.worker.js"))).toBe(true);
  expect(
    requests.every(
      ({ url, method }) =>
        method === "GET" && (url.startsWith(baseURL!) || url.startsWith("blob:")),
    ),
  ).toBe(true);
  expect(requests.some(({ url }) => url.includes("embedded-text"))).toBe(false);
});

test("preview failures, cancellation and worker failure retain selection for retry", async ({
  page,
}) => {
  await page.route("**/pdf.worker.min.js", (route) => route.abort());
  await page.goto("./remove/");
  await addSplitSource(page, 2);
  await expect(page.getByText(/Preview unavailable. You can still select/).first()).toBeVisible();
  const first = page.getByRole("checkbox", { name: "Page 1", exact: true });
  await first.check();
  await page.route("**/split.worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "self.onmessage = () => { while (true) {} };",
    }),
  );
  await page.getByRole("checkbox", { name: /I understand these limitations/ }).check();
  await page.getByRole("button", { name: "Remove pages", exact: true }).click();
  await expect(first).toBeDisabled();
  await expect(page.getByRole("button", { name: "Retry preview of page 1" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel generation" }).click();
  await expect(
    page.getByRole("region", { name: "Removal output" }).getByRole("status").last(),
  ).toContainText("Generation cancelled");
  await expect(page.getByRole("heading", { name: "Your source PDF" })).toBeFocused();
  await expect(first).toBeChecked();
  await page.unroute("**/pdf.worker.min.js");
  await page.getByRole("button", { name: "Retry preview of page 1" }).click();
  await expect(page.getByRole("img", { name: "Preview of page 1", exact: true })).toBeVisible();
  await expect(page.locator("#page-1")).toBeFocused();
  await page.unroute("**/split.worker.js");
  await page.route("**/split.worker.js", (route) => route.abort());
  await page.getByRole("button", { name: "Remove pages", exact: true }).click();
  await expect(page.getByText(/The local worker failed/)).toBeFocused();
  await expect(first).toBeChecked();
  await page.unroute("**/split.worker.js");
  await generateRemoval(page);
  expect((await PDFDocument.load((await downloadSplit(page)).bytes)).getPage(0).getWidth()).toBe(
    301,
  );
});

test("unsupported and single-page sources cannot generate; source/tool changes clear selection safely", async ({
  page,
}) => {
  await page.goto("./#/remove");
  const protectedSource = await protectedPdf("encryptedOpen.pdf");
  await page.locator('input[type="file"]').setInputFiles(protectedSource);
  await expect(
    page.getByRole("button", { name: `Retry validation of ${protectedSource.name}` }),
  ).toBeVisible();
  await page.getByRole("button", { name: `Remove ${protectedSource.name}`, exact: true }).click();
  await addSplitSource(page, 1);
  await page.getByRole("checkbox", { name: "Page 1", exact: true }).check();
  await expect(page.getByText(/Keep at least one page\. Clear/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove pages", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Remove report.pdf", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add PDF", exact: true })).toBeFocused();
  await addSplitSource(page, 2);
  await expect(page.getByRole("checkbox", { name: "Page 1", exact: true })).not.toBeChecked();
  await page.getByRole("checkbox", { name: "Page 2", exact: true }).check();
  await generateRemoval(page);
  await page.getByRole("button", { name: "Edit selection" }).click();
  await expect(page.getByRole("button", { name: "Keep working" })).toBeFocused();
  await page.getByRole("button", { name: "Keep working" }).click();
  await navigateToTool(page, "Split / Extract");
  await page.getByRole("button", { name: "Keep working" }).click();
  await expect(page).toHaveURL(/\/remove\/$/);
  await expect(page.getByRole("button", { name: "Download PDF", exact: true })).toBeVisible();
  await navigateToTool(page, "Split / Extract");
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await addSplitSource(page, 2);
  await expect(page.getByRole("checkbox", { name: "Page 2", exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await navigateToTool(page, "Remove pages");
  await addSplitSource(page, 2);
  await expect(page.getByRole("checkbox", { name: "Page 2", exact: true })).not.toBeChecked();
});

test("repeated removal and reset release workers and output/preview URLs", async ({ page }) => {
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
    Object.defineProperty(window, "removalResources", {
      get: () => ({ workers: workers.size, urls: urls.size }),
    });
  });
  await page.goto("./remove/");
  for (let cycle = 0; cycle < 3; cycle++) {
    await addSplitSource(page, 2);
    await page.getByRole("checkbox", { name: "Page 1", exact: true }).check();
    await generateRemoval(page);
    expect((await downloadSplit(page)).name).toBe("report-removed.pdf");
    await page.getByRole("button", { name: "Start over" }).click();
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(page.getByRole("button", { name: "Add PDF", exact: true })).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, "removalResources")))
      .toEqual({ workers: 0, urls: 0 });
  }
});
