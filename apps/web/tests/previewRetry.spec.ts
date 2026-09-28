import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { PDFDocument } from "pdf-lib";

let fixtureScript = "";

test.beforeAll(async () => {
  const built = await build({
    entryPoints: ["tests/fixtures/controlledPreviews.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
  });
  fixtureScript = built.outputFiles[0]?.text ?? "";
  if (!fixtureScript) {
    throw new Error("The preview fixture did not build.");
  }
});

const renderRequests = (page: Page) =>
  page.evaluate(() =>
    window.previewFixture.requests.map(({ name, signal }) => ({ name, aborted: signal.aborted })),
  );

test.beforeEach(async ({ page }) => {
  await page.route("**/assets/preview.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: fixtureScript }),
  );
  await page.goto("./#/merge");
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 400]);
  const buffer = Buffer.from(await pdf.save());
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      ["first.pdf", "second.pdf"].map((name) => ({ name, mimeType: "application/pdf", buffer })),
    );
  await expect(page.getByText("Preview unavailable", { exact: true })).toHaveCount(2);
  await page.evaluate(() => {
    window.previewFixture.fail = false;
  });
});

for (const [active, queued] of [
  ["first.pdf", "second.pdf"],
  ["second.pdf", "first.pdf"],
] as const) {
  test(`retrying ${queued} does not abort or restart an active ${active} retry`, async ({
    page,
  }) => {
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: `Retry preview of ${active}` }).click();
    await expect.poll(() => renderRequests(page)).toEqual([{ name: active, aborted: false }]);
    await expect(page.getByText("Generating preview...", { exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: `Retry preview of ${queued}` }).click();
    await expect(page.getByText("Preview queued", { exact: true })).toHaveCount(1);
    expect(await renderRequests(page)).toEqual([{ name: active, aborted: false }]);

    await page.evaluate(() => window.previewFixture.requests[0]!.complete());
    await expect(page.getByRole("img", { name: `First page of ${active}` })).toBeVisible();
    await expect
      .poll(() => renderRequests(page))
      .toEqual([
        { name: active, aborted: false },
        { name: queued, aborted: false },
      ]);
    await page.evaluate(() => window.previewFixture.requests[1]!.complete());
    await expect(page.getByRole("img", { name: `First page of ${queued}` })).toBeVisible();
    expect(await renderRequests(page)).toEqual([
      { name: active, aborted: false },
      { name: queued, aborted: false },
    ]);
    await expect(page.getByRole("checkbox")).toBeChecked();
    await expect(
      page.getByRole("list", { name: "PDF input order" }).getByRole("heading"),
    ).toHaveText(["1. first.pdf", "2. second.pdf"]);
    await expect(page.getByText("Output: one PDF, 2 pages, in the order above.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Merge PDFs", exact: true })).toBeEnabled();
  });
}

test("removal cancels active retries, rejects late results, and releases ready preview URLs", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.previewFixture.ignoreAbort = true;
  });
  await page.getByRole("button", { name: "Retry preview of first.pdf" }).click();
  await page.getByRole("button", { name: "Retry preview of second.pdf" }).click();
  await page.getByRole("button", { name: "Remove first.pdf" }).click();
  await expect
    .poll(() => renderRequests(page))
    .toEqual([
      { name: "first.pdf", aborted: true },
      { name: "second.pdf", aborted: false },
    ]);
  await page.evaluate(() => window.previewFixture.requests[0]!.complete());
  expect(await page.evaluate(() => window.previewFixture.urls)).toEqual([]);
  await expect(page.getByRole("img")).toHaveCount(0);
  await page.evaluate(() => window.previewFixture.requests[1]!.complete());
  await expect(page.getByRole("img", { name: "First page of second.pdf" })).toBeVisible();
  const urls = await page.evaluate(() => window.previewFixture.urls);
  expect(urls).toHaveLength(1);
  await page.getByRole("button", { name: "Remove second.pdf" }).click();
  await expect.poll(() => page.evaluate(() => window.previewFixture.revokedUrls)).toEqual(urls);
});

test("generation pauses pending retries and cancellation resumes a single preview loop", async ({
  page,
}) => {
  await page.route("**/merge.worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `self.onmessage = () => self.postMessage({
        type: "progress", progress: { phase: "saving", completed: 2, total: 2 }
      });`,
    }),
  );
  await page.getByRole("button", { name: "Retry preview of first.pdf" }).click();
  await page.getByRole("button", { name: "Retry preview of second.pdf" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  await expect(page.getByText("Preview paused", { exact: true })).toHaveCount(2);
  expect(await renderRequests(page)).toEqual([{ name: "first.pdf", aborted: true }]);
  await expect(page.getByRole("button", { name: /^Retry preview/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel merge" }).click();
  await expect
    .poll(() => renderRequests(page))
    .toEqual([
      { name: "first.pdf", aborted: true },
      { name: "first.pdf", aborted: false },
    ]);
  await page.evaluate(() => window.previewFixture.requests[1]!.complete());
  await expect
    .poll(() => renderRequests(page))
    .toEqual([
      { name: "first.pdf", aborted: true },
      { name: "first.pdf", aborted: false },
      { name: "second.pdf", aborted: false },
    ]);
  await page.evaluate(() => window.previewFixture.requests[2]!.complete());
  await expect(page.getByRole("img")).toHaveCount(2);
  await expect(page.getByRole("checkbox")).toBeChecked();
});

test("changing the visible window cancels retries and releases previews outside that window", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.previewFixture.fail = true;
    window.previewFixture.ignoreAbort = true;
  });
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 400]);
  const buffer = Buffer.from(await pdf.save());
  await page.locator('input[type="file"]').setInputFiles(
    Array.from({ length: 8 }, (_, index) => ({
      name: `added-${index + 3}.pdf`,
      mimeType: "application/pdf",
      buffer,
    })),
  );
  await expect(page.getByText("Output: one PDF, 10 pages, in the order above.")).toBeVisible();
  await expect(page.getByText("Preview unavailable", { exact: true })).toHaveCount(8);
  await page.evaluate(() => {
    window.previewFixture.fail = false;
  });
  await page.getByRole("button", { name: "Retry preview of first.pdf" }).click();
  await page.getByRole("button", { name: "Retry preview of second.pdf" }).click();
  await page.evaluate(() => window.previewFixture.requests[0]!.complete());
  await expect(page.getByRole("img", { name: "First page of first.pdf" })).toBeVisible();
  expect(await renderRequests(page)).toEqual([
    { name: "first.pdf", aborted: false },
    { name: "second.pdf", aborted: false },
  ]);
  const urls = await page.evaluate(() => window.previewFixture.urls);
  await page.getByRole("button", { name: "Next files", exact: true }).click();
  await expect(page.getByText("Files 9-10 of 10")).toBeVisible();
  await expect
    .poll(() => renderRequests(page))
    .toEqual([
      { name: "first.pdf", aborted: true },
      { name: "second.pdf", aborted: true },
      { name: "added-9.pdf", aborted: false },
    ]);
  await expect.poll(() => page.evaluate(() => window.previewFixture.revokedUrls)).toEqual(urls);
  await page.evaluate(() => window.previewFixture.requests[1]!.complete());
  expect(await page.evaluate(() => window.previewFixture.urls)).toEqual(urls);
  await expect(page.getByRole("img")).toHaveCount(0);
  await page.evaluate(() => window.previewFixture.requests[2]!.complete());
  await expect(page.getByRole("img", { name: "First page of added-9.pdf" })).toBeVisible();
  await expect
    .poll(() => renderRequests(page))
    .toEqual([
      { name: "first.pdf", aborted: true },
      { name: "second.pdf", aborted: true },
      { name: "added-9.pdf", aborted: false },
      { name: "added-10.pdf", aborted: false },
    ]);
});
