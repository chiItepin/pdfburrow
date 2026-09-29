import { expect, test } from "@playwright/test";
import { imageFixture, generateImages, downloadImagePdf } from "./fixtures/imageFixtures";

test("twenty image/edit/ZIP/reset cycles release workers and URLs and reset settings", async ({
  page,
}) => {
  test.setTimeout(120_000);
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
    Object.defineProperty(window, "imageResources", {
      get: () => ({ workers: workers.size, urls: urls.size }),
    });
  });
  await page.goto("./#/images");
  const first = await imageFixture(page);
  const second = { ...first, name: "another.png" };
  for (let cycle = 0; cycle < 20; cycle++) {
    await page.locator('input[type="file"]').setInputFiles([first, second]);
    await expect(page.getByRole("button", { name: "Convert to PDF", exact: true })).toBeEnabled();
    await page.getByRole("radio", { name: "One PDF per image" }).check();
    await page.getByRole("radio", { name: "Image size (96 pixels per inch)" }).check();
    await page.getByRole("button", { name: "Rotate picture.png right" }).click();
    await generateImages(page);
    if (cycle === 0) {
      await page.getByRole("button", { name: "Edit images and settings" }).click();
      await page.getByRole("button", { name: "Discard", exact: true }).click();
      await expect(page.getByText(/90° additional rotation/)).toBeVisible();
      await generateImages(page);
      await page.route("**/bundle.worker.js", (route) =>
        route.fulfill({
          contentType: "text/javascript",
          body: "self.onmessage = () => { while (true) {} };",
        }),
      );
      await page.getByRole("button", { name: "Prepare ZIP for all PDFs" }).click();
      await expect(page.getByRole("button", { name: "Edit images and settings" })).toBeDisabled();
      await page.getByRole("button", { name: "Cancel ZIP preparation" }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "ZIP preparation cancelled" }),
      ).toBeVisible();
      await page.unroute("**/bundle.worker.js");
    }
    await page.getByRole("button", { name: "Prepare ZIP for all PDFs" }).click();
    await expect(page.getByRole("button", { name: "Download ZIP", exact: true })).toBeVisible();
    await downloadImagePdf(page, "Download ZIP");
    await page.getByRole("button", { name: "Start over" }).click();
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(page.getByRole("button", { name: "Add images", exact: true })).toBeFocused();
    await expect(page.getByRole("radio", { name: "A4 (210 x 297 mm)", exact: true })).toBeChecked();
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, "imageResources")))
      .toEqual({ workers: 0, urls: 0 });
  }
});

test("image lists retain bounded previews, keyboard ordering and removal focus across windows", async ({
  page,
}) => {
  await page.goto("./#/images");
  const fixture = await imageFixture(page);
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      Array.from({ length: 10 }, (_, index) => ({ ...fixture, name: `image-${index + 1}.png` })),
    );
  await expect(page.getByRole("button", { name: "Convert to PDF", exact: true })).toBeEnabled();
  await expect(
    page.getByRole("list", { name: "Image input order" }).getByRole("listitem"),
  ).toHaveCount(8);
  await page.getByRole("button", { name: "Move image-8.png down", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Move image-8.png down", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("list", { name: "Image input order" }).getByRole("listitem"),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Remove image-8.png", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove image-10.png", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Previous files" }).click();
  await expect(
    page.getByRole("list", { name: "Image input order" }).getByRole("listitem").last(),
  ).toContainText("image-9.png");
});
