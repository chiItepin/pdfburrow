import { expect, test } from "@playwright/test";
import { PDFDocument, PDFName } from "pdf-lib";
import { imageFixture, pngChunk } from "./fixtures/imageFixtures";
import { addSplitSource } from "./fixtures/splitHelpers";
import { withToolSettings } from "./fixtures/toolSettings";

for (const tool of ["merge", "split"]) {
  test(`${tool} validation rejects oversized UserUnit-scaled pages and accepts the exact boundary`, async ({
    page,
  }) => {
    await page.goto(`./#/${tool}`);
    const document = await PDFDocument.create();
    const sourcePage = document.addPage([10000, 400]);
    sourcePage.node.set(PDFName.of("UserUnit"), document.context.obj(2));
    const upload = async () =>
      page.locator('input[type="file"]').setInputFiles({
        name: "scaled.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(await document.save()),
      });
    await upload();
    await expect(
      page.getByText(/PDF page dimension in points: 20000 exceeds the configured limit of 14400/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: tool === "merge" ? "Merge PDFs" : "Generate PDFs",
        exact: true,
      }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Remove scaled.pdf" }).click();
    sourcePage.setWidth(7200);
    await upload();
    if (tool === "merge") {
      await expect(page.getByText("Output: one PDF, 1 page, in the order above.")).toBeVisible();
    } else {
      await expect(page.getByRole("checkbox", { name: "Page 1", exact: true })).toBeEnabled();
    }
    await expect(page.getByRole("button", { name: "Retry validation of scaled.pdf" })).toHaveCount(
      0,
    );
  });
}

test("draft admission rejects oversized batches without losing existing inputs", async ({
  page,
}) => {
  await page.goto("./#/merge");
  const document = await PDFDocument.create();
  document.addPage();
  const file = {
    name: "kept.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await document.save()),
  };
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByText("Output: one PDF, 1 page, in the order above.")).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      Array.from({ length: 20 }, (_, index) => ({ ...file, name: `extra-${index}.pdf` })),
    );
  await expect(page.getByRole("status")).toContainText("No files added. Keep at most 20 inputs");
  await expect(page.locator("[data-workspace-content]").getByRole("listitem")).toHaveCount(1);
  await page.locator('input[type="file"]').setInputFiles({
    ...file,
    name: "too-large.pdf",
    buffer: Buffer.alloc(20 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole("status")).toContainText("Each input must be at most 20 MiB");
  await expect(page.locator("[data-workspace-content]").getByRole("listitem")).toHaveCount(1);
});

test("split prediction enforces the production output count before starting a job", async ({
  page,
}) => {
  await page.goto("./#/split");
  await addSplitSource(page, 51);
  await withToolSettings(page, async () => {
    await page.getByRole("radio", { name: "Every page", exact: true }).check();
    await expect(
      page.getByText(/Output count: 51 exceeds the configured limit of 50/),
    ).toBeVisible();
  });
  await expect(page.getByRole("button", { name: "Generate PDFs", exact: true })).toBeDisabled();
});

test("image header limits reject before pixel decoding and removing it restores editing", async ({
  page,
}) => {
  await page.goto("./#/images");
  const valid = await imageFixture(page);
  const dimensions = Buffer.from(valid.buffer.subarray(16, 29));
  dimensions.writeUInt32BE(8193, 0);
  const oversized = {
    ...valid,
    name: "oversized.png",
    buffer: Buffer.concat([
      valid.buffer.subarray(0, 8),
      pngChunk("IHDR", dimensions),
      valid.buffer.subarray(33),
    ]),
  };
  await page.locator('input[type="file"]').setInputFiles([valid, oversized]);
  await expect(
    page.getByText(/Image dimension in pixels: 8193 exceeds the configured limit of 8192/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Convert to PDF", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Remove oversized.png" }).click();
  await expect(page.getByRole("button", { name: "Convert to PDF", exact: true })).toBeEnabled();
});

test("distributed notices and provisional-limit disclosures are readable at this base path", async ({
  page,
  request,
}, testInfo) => {
  for (const name of ["notices", "limits"]) {
    await page.goto(`./${name}.html`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name)) {
      await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
    }
  }
  const license = await request.get("./LICENSE.txt");
  expect(license.headers()["content-type"]).toContain("text/plain");
  expect(await license.text()).toContain("2026 PDFBurrow contributors");
  const notices = await request.get("./third-party-notices.txt");
  expect(notices.status()).toBe(200);
  expect(await notices.text()).toContain("Copyright (c) 2023 shadcn");
  expect(await notices.text()).toContain("pdf-lib@1.17.1");
  const inventory = await request.get("./license-inventory.json");
  expect(inventory.status()).toBe(200);
  expect(await inventory.json()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "pdfjs-dist", version: "5.7.284", license: "Apache-2.0" }),
      expect.objectContaining({ name: "tailwindcss", license: "MIT" }),
    ]),
  );
});
