import { expect, test } from "@playwright/test";
import { addSplitSource, downloadSplit } from "./fixtures/splitHelpers";
import { installPageSetDiagnostics } from "./fixtures/pageSetDiagnostics";
import { setToolOption, withToolSettings } from "./fixtures/toolSettings";
import { navigateToTool, openToolSidebar, closeToolSidebar } from "./fixtures/workspaceNavigation";

test("cancellation and worker failures preserve sets, selection and explicit retry", async ({
  page,
}) => {
  await installPageSetDiagnostics(page);
  const downloads: string[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  await page.goto("./split/");
  await addSplitSource(page, 5);
  await setToolOption(page, "Page sets");
  await page.getByRole("checkbox", { name: "Page 2", exact: true }).check();
  await page.getByRole("checkbox", { name: "Page 4", exact: true }).check();
  await page.getByRole("button", { name: "Group into one PDF" }).click();
  await page.getByRole("checkbox", { name: "Page 1", exact: true }).check();
  await page.getByRole("checkbox", { name: /I understand these limitations/ }).check();
  await page.route("**/split.worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "self.onmessage = () => { while (true) {} };",
    }),
  );
  await page.getByRole("button", { name: "Download PDF: Pages 2 + 4", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Download PDF: Page 1", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Group into one PDF" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Separate pages: Pages 2 + 4" })).toBeDisabled();
  await withToolSettings(page, () =>
    expect(page.getByRole("radio", { name: "Selected pages" })).toBeDisabled(),
  );
  await openToolSidebar(page);
  await expect(page.getByRole("link", { name: "Merge PDFs", exact: true })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await closeToolSidebar(page);
  await page.getByRole("button", { name: "Cancel generation" }).click();
  await expect(
    page.getByRole("region", { name: "Your downloads", exact: true }).getByRole("status"),
  ).toContainText("Your page groups are unchanged");
  await expect(page.getByRole("checkbox", { name: "Page 1", exact: true })).toBeChecked();
  await expect(page.getByRole("heading", { name: "Your source PDF" })).toBeFocused();
  expect(downloads).toEqual([]);
  await page.unroute("**/split.worker.js");
  await page.route("**/split.worker.js", (route) => route.abort());
  await page.getByRole("button", { name: "Download PDF: Pages 2 + 4", exact: true }).click();
  await expect(page.getByText(/The local worker failed/)).toBeFocused();
  await expect(page.getByRole("listitem", { name: "Pages 2 + 4", exact: true })).toContainText(
    "Combined PDF (2 pages)",
  );
  expect(downloads).toEqual([]);
  await page.unroute("**/split.worker.js");
  const output = await downloadSplit(page, "Download PDF: Pages 2 + 4");
  expect(output.name).toBe("report-pages-2-4.pdf");
  expect(downloads).toEqual([output.name]);
});

test("download errors retain the latest set for retry and require confirmation before discarding it", async ({
  page,
}) => {
  await installPageSetDiagnostics(page);
  await page.goto("./split/");
  await addSplitSource(page, 3);
  await setToolOption(page, "Page sets");
  await page.getByRole("checkbox", { name: /I understand these limitations/ }).check();
  await page.evaluate(() => {
    window.pageSetFailDownload = true;
  });
  await page.getByRole("button", { name: "Download PDF: Page 2", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("The download could not be requested");
  await expect(page.getByRole("listitem", { name: "Page 2", exact: true })).toContainText(
    "PDF ready",
  );
  await page.getByRole("button", { name: "Download PDF: Page 1", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("download has not been requested");
  await page.getByRole("button", { name: "Keep working", exact: true }).click();
  expect(await page.evaluate(() => window.pageSetDiagnostics.selections)).toEqual([
    { mode: "selected", pages: [2] },
  ]);
  await page.evaluate(() => {
    window.pageSetFailDownload = false;
  });
  expect((await downloadSplit(page, "Download PDF: Page 2")).name).toBe("report-page-2.pdf");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => window.pageSetDiagnostics.selections)).toHaveLength(1);
  expect((await downloadSplit(page, "Download PDF: Page 1")).name).toBe("report-page-1.pdf");
  await page.evaluate(() => {
    window.pageSetFailDownload = true;
  });
  await page.getByRole("button", { name: "Download PDF: Page 1", exact: true }).click();
  await page.getByRole("checkbox", { name: "Page 1", exact: true }).check();
  await page.getByRole("checkbox", { name: "Page 3", exact: true }).check();
  await page.getByRole("button", { name: "Group into one PDF" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("listitem", { name: "Pages 1 + 3", exact: true })).toContainText(
    "Combined PDF (2 pages)",
  );
});

test("unrequested output discard continues the chosen set, and source changes release all resources", async ({
  page,
}) => {
  await installPageSetDiagnostics(page);
  await page.goto("./split/");
  await addSplitSource(page, 3);
  await setToolOption(page, "Page sets");
  await page.getByRole("checkbox", { name: /I understand these limitations/ }).check();
  await page.evaluate(() => {
    window.pageSetFailDownload = true;
  });

  await page.getByRole("button", { name: "Download PDF: Page 1", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Download PDF: Page 2", exact: true }).click();
  await expect(page.getByRole("button", { name: "Keep working", exact: true })).toBeFocused();
  await page.evaluate(() => {
    window.pageSetFailDownload = false;
  });
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  expect((await pending).suggestedFilename()).toBe("report-page-2.pdf");
  for (const id of [3, 1, 2]) {
    expect((await downloadSplit(page, `Download PDF: Page ${id}`)).name).toBe(
      `report-page-${id}.pdf`,
    );
  }
  await expect.poll(() => page.evaluate(() => window.pageSetDiagnostics.workers)).toBe(0);
  expect(await page.evaluate(() => window.pageSetDiagnostics.urls)).toBeLessThanOrEqual(4);
  await page.getByRole("checkbox", { name: "Page 1", exact: true }).check();
  await page.getByRole("checkbox", { name: "Page 3", exact: true }).check();
  await page.getByRole("button", { name: "Group into one PDF" }).click();
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await page.getByRole("button", { name: "Keep working", exact: true }).click();
  await expect(page.getByRole("listitem", { name: "Pages 1 + 3", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.pageSetDiagnostics.urls)).toBe(0);
  await addSplitSource(page, 2);
  await setToolOption(page, "Page sets");
  await expect(
    page.getByRole("list", { name: "PDFs to download" }).getByRole("listitem"),
  ).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Download PDF: Page 1", exact: true }),
  ).toBeDisabled();
  await navigateToTool(page, "Merge PDFs");
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Merge PDFs", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.pageSetDiagnostics.urls)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.pageSetDiagnostics.workers)).toBe(0);
});

test("grouping and separation toasts confirm applied changes, not pending or cancelled edits", async ({
  page,
}) => {
  await installPageSetDiagnostics(page);
  await page.goto("./split/");
  await addSplitSource(page, 3);
  await setToolOption(page, "Page sets");
  await page.getByRole("checkbox", { name: /I understand these limitations/ }).check();
  await page.evaluate(() => {
    window.pageSetFailDownload = true;
  });
  await page.getByRole("button", { name: "Download PDF: Page 2", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("The download could not be requested");
  await page.getByRole("checkbox", { name: "Page 1", exact: true }).check();
  await page.getByRole("checkbox", { name: "Page 3", exact: true }).check();
  const group = page.getByRole("button", { name: "Group into one PDF", exact: true });
  const groupingToast = page.locator("[data-sonner-toast]").filter({ hasText: "Pages grouped." });
  const separationToast = page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Pages separated." });
  const outputs = page.getByRole("list", { name: "PDFs to download", exact: true });
  await group.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(groupingToast).toHaveCount(0);
  await expect(outputs.getByRole("listitem")).toHaveCount(3);
  await page.getByRole("button", { name: "Keep working", exact: true }).click();
  await expect(groupingToast).toHaveCount(0);
  await group.click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(groupingToast).toBeVisible();
  await expect(outputs.getByRole("listitem")).toHaveCount(2);
  await page.getByRole("button", { name: "Download PDF: Pages 1 + 3", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("The download could not be requested");
  const separate = page.getByRole("button", { name: "Separate pages: Pages 1 + 3", exact: true });
  await separate.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(separationToast).toHaveCount(0);
  await expect(outputs.getByRole("listitem")).toHaveCount(2);
  await page.getByRole("button", { name: "Keep working", exact: true }).click();
  await expect(separationToast).toHaveCount(0);
  await separate.click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(separationToast).toBeVisible();
  await expect(outputs.getByRole("listitem")).toHaveCount(3);
  expect(await page.evaluate(() => window.pageSetDiagnostics.selections)).toEqual([
    { mode: "selected", pages: [2] },
    { mode: "selected", pages: [1, 3] },
  ]);
});

test("reorder and reset effects wait for discard confirmation and preserve cancelled windows and focus", async ({
  page,
}) => {
  await installPageSetDiagnostics(page);
  await page.goto("./split/");
  await addSplitSource(page, 9);
  await setToolOption(page, "Page sets");
  await page.getByRole("checkbox", { name: /I understand these limitations/ }).check();
  await page.evaluate(() => {
    window.pageSetFailDownload = true;
  });
  await page.getByRole("button", { name: "Download PDF: Page 8", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("The download could not be requested");
  const sourcePages = page.getByRole("list", { name: "Page order", exact: true });
  const notices = page.getByRole("status");
  const later = page.getByRole("button", { name: "Move page 8 later", exact: true });
  await later.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(sourcePages.getByRole("listitem").last()).toHaveAttribute(
    "aria-label",
    "Page 8, position 8 of 9",
  );
  await expect(notices.filter({ hasText: "Page 8 moved" })).toHaveCount(0);
  await page.getByRole("button", { name: "Keep working", exact: true }).click();
  await expect(later).toBeFocused();
  await expect(sourcePages.getByRole("listitem")).toHaveCount(8);
  await expect(notices.filter({ hasText: "Page 8 moved" })).toHaveCount(0);
  await later.click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(sourcePages.getByRole("listitem")).toHaveCount(1);
  await expect(sourcePages.getByRole("listitem")).toHaveAttribute(
    "aria-label",
    "Page 8, position 9 of 9",
  );
  await expect(notices.filter({ hasText: "Page 8 moved to position 9" })).toBeVisible();
  await expect(later).toBeFocused();
  await page.getByRole("button", { name: "Download PDF: Page 1", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("The download could not be requested");
  const reset = page.getByRole("button", { name: "Reset page order", exact: true });
  await reset.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(sourcePages.getByRole("listitem")).toHaveCount(1);
  await expect(notices.filter({ hasText: "Source page order restored" })).toHaveCount(0);
  await page.getByRole("button", { name: "Keep working", exact: true }).click();
  await expect(reset).toBeFocused();
  await expect(sourcePages.getByRole("listitem")).toHaveAttribute(
    "aria-label",
    "Page 8, position 9 of 9",
  );
  await expect(notices.filter({ hasText: "Source page order restored" })).toHaveCount(0);
  await reset.click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(sourcePages.getByRole("listitem")).toHaveCount(8);
  await expect(sourcePages.getByRole("listitem").last()).toHaveAttribute(
    "aria-label",
    "Page 8, position 8 of 9",
  );
  await expect(notices.filter({ hasText: "Source page order restored" })).toBeVisible();
});
