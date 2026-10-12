import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { addSplitSource, downloadSplit } from "./fixtures/splitHelpers";
import { setToolOption, withToolSettings } from "./fixtures/toolSettings";
import { preservationPdfs } from "./fixtures/preservationPdfs";
import { inspectArtifact } from "./fixtures/pdfArtifacts";
import { installPageSetDiagnostics } from "./fixtures/pageSetDiagnostics";

test("page sets is optional, groups without downloads, and preserves membership between operations", async ({
  page,
}, testInfo) => {
  const downloads: string[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  await installPageSetDiagnostics(page);
  await page.goto("./split/");
  await addSplitSource(page, 5);
  await withToolSettings(page, () =>
    expect(page.getByRole("radio", { name: "Selected pages", exact: true })).toBeChecked(),
  );
  await expect(page.getByRole("region", { name: "Your downloads", exact: true })).toHaveCount(0);
  await setToolOption(page, "Page sets");
  await expect(page.getByText(/^Select pages to group\./)).toBeVisible();
  const sets = page.getByRole("list", { name: "PDFs to download" });
  await expect(sets.getByRole("listitem")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Generate PDFs" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Prepare ZIP for all PDFs" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Download PDF: Page 1", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Group into one PDF" })).toBeDisabled();
  const groupingToast = page.locator("[data-sonner-toast]").filter({ hasText: "Pages grouped." });
  const separationToast = page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Pages separated." });
  await expect(groupingToast).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Page 4", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("checkbox", { name: "Page 2", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(groupingToast).toHaveCount(0);
  await page.getByRole("button", { name: "Group into one PDF" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Your downloads" })).toBeFocused();
  await expect(sets.getByRole("listitem")).toHaveCount(4);
  await expect(sets.getByRole("listitem", { name: "Pages 2 + 4", exact: true })).toContainText(
    "Combined PDF (2 pages)",
  );
  await expect(sets.getByRole("listitem", { name: "Page 3", exact: true })).toContainText(
    "Single-page PDF",
  );
  await expect(page.getByRole("region", { name: "Your downloads", exact: true })).toContainText(
    "4 PDFs.",
  );
  await expect(
    page.getByRole("region", { name: "Your downloads", exact: true }).getByRole("status"),
  ).toHaveText("Pages 2 + 4 will download together.");
  await expect(groupingToast).toBeVisible();
  await expect(groupingToast).toContainText("2 pages will download together.");
  const pageCards = page.getByRole("list", { name: "Page order", exact: true });
  await expect(pageCards).not.toContainText("PDF:");
  await expect(pageCards).not.toContainText("Single-page PDF");
  await expect(page.getByText(/\bSet \d+\b/)).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Page 2", exact: true })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Download PDF: Page 2", exact: true })).toHaveCount(
    0,
  );
  await setToolOption(page, "Fixed page-count groups");
  await setToolOption(page, "Page sets");
  await expect(sets.getByRole("listitem", { name: "Pages 2 + 4", exact: true })).toContainText(
    "Combined PDF (2 pages)",
  );
  expect(downloads).toEqual([]);
  expect(await page.evaluate(() => window.pageSetDiagnostics.selections)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (
    process.env.PDFBURROW_PAGE_SET_SCREENSHOTS &&
    ["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name)
  ) {
    await page.getByRole("heading", { name: "Your downloads" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("page-sets.png") });
  }
  await page.getByRole("button", { name: "Separate pages: Pages 2 + 4" }).click();
  await expect(separationToast).toBeVisible();
  await expect(separationToast).toContainText("2 pages are now available as individual PDFs");
  await expect(sets.getByRole("listitem")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "Your downloads" })).toBeFocused();
  await expect(sets.getByRole("listitem", { name: "Page 2", exact: true })).toContainText(
    "report-page-2.pdf",
  );
  await expect(sets.getByRole("listitem", { name: "Page 4", exact: true })).toContainText(
    "report-page-4.pdf",
  );
  await expect(sets.getByRole("button", { name: /Separate pages/ })).toHaveCount(0);
  await expect(page.getByText(/\bSet \d+\b/)).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Page 2", exact: true }).check();
  await page.getByRole("checkbox", { name: "Page 4", exact: true }).check();
  await page.getByRole("button", { name: "Group into one PDF" }).click();
  await expect(sets.getByRole("listitem", { name: "Pages 2 + 4", exact: true })).toContainText(
    "report-pages-2-4.pdf",
  );
  expect(downloads).toEqual([]);
});

test("one clicked set downloads exact arranged content, pixels and geometry; other sets are not processed", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90_000);
  await installPageSetDiagnostics(page);
  const downloads: string[] = [];
  const requests: { url: string; method: string }[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
  const input = (await preservationPdfs())[0]!;
  const original = await inspectArtifact(input.buffer);
  await page.goto("./split/");
  await page.locator('input[type="file"]').setInputFiles(input);
  await expect(page.getByRole("checkbox", { name: "Page 1", exact: true })).toBeVisible();
  await setToolOption(page, "Page sets");
  await page.getByRole("button", { name: "Move page 3 earlier" }).click();
  await page.getByRole("button", { name: "Move page 3 earlier" }).click();
  await page.getByRole("checkbox", { name: "Page 1", exact: true }).check();
  await page.getByRole("checkbox", { name: "Page 3", exact: true }).check();
  await page.getByRole("button", { name: "Group into one PDF" }).click();
  await expect(page.getByRole("listitem", { name: "Pages 3 + 1", exact: true })).toContainText(
    "Combined PDF (2 pages)",
  );
  await page.getByRole("checkbox", { name: /I understand these limitations/ }).check();
  expect(downloads).toEqual([]);
  const grouped = await downloadSplit(page, "Download PDF: Pages 3 + 1");
  expect(grouped.name).toBe("embedded-text-pages-3-1.pdf");
  expect(await inspectArtifact(grouped.bytes)).toEqual([original[2], original[0]]);
  await expect(
    page.getByRole("button", { name: "Download PDF: Pages 3 + 1", exact: true }),
  ).toBeFocused();
  expect(await page.evaluate(() => window.pageSetDiagnostics.selections)).toEqual([
    { mode: "selected", pages: [3, 1] },
  ]);
  const repeated = await downloadSplit(page, "Download PDF: Pages 3 + 1");
  expect(repeated.bytes).toEqual(grouped.bytes);
  expect(await page.evaluate(() => window.pageSetDiagnostics.selections)).toHaveLength(1);
  const singleton = await downloadSplit(page, "Download PDF: Page 2");
  expect(singleton.name).toBe("embedded-text-page-2.pdf");
  expect(await inspectArtifact(singleton.bytes)).toEqual([original[1]]);
  expect(downloads).toEqual([grouped.name, grouped.name, singleton.name]);
  expect(await page.evaluate(() => window.pageSetDiagnostics.selections)).toEqual([
    { mode: "selected", pages: [3, 1] },
    { mode: "selected", pages: [2] },
  ]);
  expect(
    requests.every(
      ({ url, method }) =>
        method === "GET" && (url.startsWith(baseURL!) || url.startsWith("blob:")),
    ),
  ).toBe(true);
});

test("windowed selection and more than 50 conceptual sets still generate only the requested PDF", async ({
  page,
}) => {
  await installPageSetDiagnostics(page);
  await page.goto("./split/");
  await addSplitSource(page, 60, `${"long-document-name-".repeat(7)}report.pdf`);
  await setToolOption(page, "Page sets");
  await expect(page.getByRole("region", { name: "Your downloads", exact: true })).toContainText(
    "60 PDFs.",
  );
  await expect(
    page.getByRole("list", { name: "PDFs to download" }).getByRole("listitem"),
  ).toHaveCount(8);
  await page.getByRole("checkbox", { name: "Page 1", exact: true }).check();
  await page.getByRole("button", { name: "Next pages" }).click();
  await page.getByRole("checkbox", { name: "Page 10", exact: true }).check();
  await page.getByRole("button", { name: "Group into one PDF" }).click();
  await expect(page.getByRole("listitem", { name: "Pages 1 + 10", exact: true })).toContainText(
    "Combined PDF (2 pages)",
  );
  await page.getByRole("checkbox", { name: /I understand these limitations/ }).check();
  const output = await downloadSplit(page, "Download PDF: Pages 1 + 10");
  expect((await PDFDocument.load(output.bytes)).getPages().map((item) => item.getWidth())).toEqual([
    300, 309,
  ]);
  expect(await page.evaluate(() => window.pageSetDiagnostics.selections)).toEqual([
    { mode: "selected", pages: [1, 10] },
  ]);
  await page.getByRole("button", { name: "Next PDFs" }).click();
  await expect(page.getByRole("navigation", { name: "Download list pages" })).toContainText(
    "9-16 of 59",
  );
  await page.getByRole("button", { name: "Previous pages" }).click();
  await expect(page.getByRole("listitem", { name: "Page 1, position 1 of 60" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Page order", exact: true })).not.toContainText(
    "PDF:",
  );
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await page.getByRole("button", { name: "Group into one PDF" }).click();
  const downloads = page.getByRole("region", { name: "Your downloads", exact: true });
  await expect(downloads).toContainText("1 PDF.");
  await expect(downloads.getByRole("listitem", { name: "Pages 1-60", exact: true })).toContainText(
    "Combined PDF (60 pages)",
  );
  await expect(downloads).toContainText("report-60-pages-from-1.pdf");
  await expect(downloads.getByRole("navigation")).toHaveCount(0);
  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.locator("html").evaluate((element) => {
    element.style.zoom = "2";
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
