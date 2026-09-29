import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { createRequire } from "node:module";
import {
  imageFixture,
  animatedPng,
  downloadImagePdf,
  generateImages,
  pngChunk,
} from "./fixtures/imageFixtures";

const requireEngine = createRequire(
  new URL("../../../packages/pdf-engine/package.json", import.meta.url),
);
const { unzipSync }: { unzipSync: (bytes: Uint8Array) => Record<string, Uint8Array> } =
  requireEngine("fflate");

test("image workspace orders and rotates actual combined/separate PDFs with shared downloads", async ({
  page,
  baseURL,
}) => {
  const requests: { url: string; method: string }[] = [];
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
  await page.goto("./#/images");
  expect(requests.some(({ url }) => url.includes("/images.js"))).toBe(false);
  const first = await imageFixture(page, "beach.jpg", 120, 80, "image/jpeg");
  const second = await imageFixture(page, "map.png", 80, 120);
  const third = await imageFixture(page, "map.png", 40, 40);
  await page.locator('input[type="file"]').setInputFiles([first, second, third]);
  await expect(page.getByRole("button", { name: "Convert to PDF", exact: true })).toBeEnabled();
  await expect(page.getByRole("radio", { name: "One combined PDF" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "A4 (210 x 297 mm)", exact: true })).toBeChecked();
  await page.getByRole("radio", { name: "Image size (96 pixels per inch)" }).check();
  await expect(page.getByRole("group", { name: "Page orientation", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Move beach.jpg down" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Move beach.jpg down" })).toBeFocused();
  await page.getByRole("button", { name: "Rotate beach.jpg right" }).click();
  await expect(page.getByRole("img", { name: "Preview of beach.jpg" })).toHaveCSS(
    "transform",
    "matrix(0, 1, -1, 0, 0, 0)",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const downloads: string[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  await generateImages(page);
  expect(downloads).toEqual([]);
  const combined = await downloadImagePdf(page);
  expect(combined.name).toBe("map-images.pdf");
  const doc = await PDFDocument.load(combined.bytes);
  expect(doc.getPages().map((item) => item.getSize())).toEqual([
    { width: 60, height: 90 },
    { width: 60, height: 90 },
    { width: 30, height: 30 },
  ]);
  await page.getByRole("button", { name: "Edit images and settings" }).click();
  await page.getByRole("radio", { name: "One PDF per image" }).check();
  await generateImages(page);
  for (const name of ["map-converted.pdf", "beach-converted.pdf", "map-converted-2.pdf"]) {
    await expect(page.getByRole("button", { name: `Download ${name}`, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Prepare ZIP for all PDFs" }).click();
  await expect(page.getByRole("button", { name: "Download ZIP", exact: true })).toBeFocused();
  expect(downloads).toEqual(["map-images.pdf"]);
  const zip = await downloadImagePdf(page, "Download ZIP");
  expect(zip.name).toBe("map-images.zip");
  const entries = unzipSync(zip.bytes);
  expect(Object.keys(entries)).toEqual([
    "map-converted.pdf",
    "beach-converted.pdf",
    "map-converted-2.pdf",
  ]);
  for (const bytes of Object.values(entries)) {
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  }
  expect(
    requests.every(
      ({ url, method }) =>
        (url.startsWith(baseURL!) || url.startsWith(`blob:${new URL(baseURL!).origin}/`)) &&
        method === "GET",
    ),
  ).toBe(true);
  expect(requests.some(({ url }) => /beach|map\.png/.test(url))).toBe(false);
  expect(
    requests.some(({ url }) => url.includes("/pdf.worker") || url.includes("/merge.worker")),
  ).toBe(false);
});

test("unsupported, animated and undecodable inputs block generation; mislabeled JPEG is accepted visibly", async ({
  page,
}) => {
  await page.goto("./#/images");
  const jpeg = await imageFixture(page, "photo.png", 120, 80, "image/jpeg");
  jpeg.mimeType = "image/png";
  await page.locator('input[type="file"]').setInputFiles(jpeg);
  await expect(page.getByText(/Format mismatch: this file contains JPEG/)).toBeVisible();
  const png = await imageFixture(page);
  const invalid = [
    { name: "fake.jpg", mimeType: "image/jpeg", buffer: Buffer.from("RIFF....WEBP") },
    { name: "corrupt.jpg", mimeType: "image/jpeg", buffer: jpeg.buffer.subarray(0, -2) },
    animatedPng(png),
    {
      name: "undecodable.png",
      mimeType: "image/png",
      buffer: Buffer.concat([
        png.buffer.subarray(0, 33),
        pngChunk("IDAT", Buffer.from([0, 0, 0])),
        png.buffer.subarray(-12),
      ]),
    },
  ];
  await page.locator('input[type="file"]').setInputFiles(invalid);
  await expect(page.getByRole("button", { name: /Retry validation of/ })).toHaveCount(4);
  await expect(page.getByText(/Unsupported image content/)).toBeVisible();
  await expect(page.getByText(/Animated PNGs are not supported/)).toBeVisible();
  await expect(page.getByText(/This PNG has corrupt pixel data/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Convert to PDF", exact: true })).toBeDisabled();
  for (const file of invalid) {
    await page.getByRole("button", { name: `Remove ${file.name}`, exact: true }).click();
  }
  await page.getByRole("radio", { name: "One PDF per image" }).check();
  await generateImages(page);
  expect((await downloadImagePdf(page)).name).toBe("photo-converted.pdf");
  await expect(page.getByRole("button", { name: "Prepare ZIP for all PDFs" })).toHaveCount(0);
});

test("cancellation, preview/worker/download failures and guarded navigation retain the image draft", async ({
  page,
}) => {
  await page.route("**/image-preview.worker.js", (route) => route.abort());
  await page.goto("./#/images");
  await page.locator('input[type="file"]').setInputFiles(await imageFixture(page));
  await expect(page.getByRole("button", { name: "Convert to PDF", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Retry preview of picture.png" })).toBeVisible();
  await page.getByRole("button", { name: "Rotate picture.png left" }).click();
  await page.getByRole("radio", { name: "Letter (8.5 x 11 inches)" }).check();
  await page.route("**/images.worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "self.onmessage = () => { while (true) {} };",
    }),
  );
  await page.getByRole("button", { name: "Convert to PDF", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rotate picture.png left" })).toBeDisabled();
  await expect(page.getByRole("radio", { name: "One PDF per image" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Retry preview of picture.png" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel conversion" }).click();
  await expect(page.getByRole("status", { name: "Image conversion status" })).toContainText(
    "Conversion cancelled",
  );
  await expect(page.getByRole("heading", { name: "Your images", exact: true })).toBeFocused();
  await expect(page.getByText(/270° additional rotation/)).toBeVisible();
  await expect(page.getByRole("radio", { name: "Letter (8.5 x 11 inches)" })).toBeChecked();
  await page.unroute("**/images.worker.js");
  await page.route("**/images.worker.js", (route) => route.abort());
  await page.getByRole("button", { name: "Convert to PDF", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("worker failed");
  await page.unroute("**/images.worker.js");
  await page.unroute("**/image-preview.worker.js");
  await page.getByRole("button", { name: "Retry preview of picture.png" }).click();
  await expect(page.getByRole("img", { name: "Preview of picture.png" })).toBeVisible();
  await generateImages(page);
  await page.getByRole("button", { name: "Edit images and settings" }).click();
  await expect(page.getByRole("button", { name: "Keep working" })).toBeFocused();
  await page.getByRole("button", { name: "Keep working" }).click();
  await page.evaluate(() => {
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      HTMLAnchorElement.prototype.click = original;
      throw new Error("Test download failure");
    };
  });
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("still available");
  await downloadImagePdf(page);
  await page.getByRole("link", { name: "Merge PDFs", exact: true }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(/#\/merge$/);
  await expect(page.getByRole("listitem")).toHaveCount(0);
  await page.getByRole("link", { name: "Images to PDF", exact: true }).click();
  await expect(page.getByRole("radio", { name: "A4 (210 x 297 mm)", exact: true })).toBeChecked();
});
