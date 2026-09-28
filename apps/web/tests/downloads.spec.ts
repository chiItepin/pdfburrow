import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { reactCompiler } from "../scripts/reactCompiler.mjs";

const requireEngine = createRequire(
  new URL("../../../packages/pdf-engine/package.json", import.meta.url),
);
const { unzipSync }: { unzipSync: (bytes: Uint8Array) => Record<string, Uint8Array> } =
  requireEngine("fflate");
let fixtureScript = "";

test.beforeAll(async () => {
  const built = await build({
    entryPoints: ["tests/fixtures/DownloadsFixture.tsx"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    plugins: [
      reactCompiler(),
      {
        name: "use-production-bundle-worker",
        setup(builder) {
          builder.onResolve({ filter: /^@repo\/pdf-engine\/bundle$/ }, () => ({
            path: `${process.env.PDFBURROW_BASE_PATH ?? "/pdfburrow/"}assets/bundle.js`,
            external: true,
          }));
        },
      },
    ],
  });
  fixtureScript = built.outputFiles[0]?.text ?? "";
  if (!fixtureScript) {
    throw new Error("The download fixture did not build.");
  }
});

const loadFixture = async (page: Page) => {
  const outputs = await Promise.all(
    [300, 500].map(async (width, index) => {
      const pdf = await PDFDocument.create();
      pdf.addPage([width, 400]);
      return { bytes: Array.from(await pdf.save()), filename: `report-split-00${index + 1}.pdf` };
    }),
  );
  await page.addInitScript((values) => {
    window.fixtureOutputs = values;
  }, outputs);
  await page.route("**/downloads-fixture.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: fixtureScript }),
  );
  await page.route("**/downloads-fixture.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><body><div id="root"></div><script type="module" src="downloads-fixture.js"></script></body></html>',
    }),
  );
  await page.goto("./downloads-fixture.html");
  await page.getByRole("button", { name: "Generate fixture outputs" }).click();
  await expect(page.getByTestId("job-phase")).toHaveText("complete");
};

test("shared downloads package real PDFs locally and require a second explicit download gesture", async ({
  page,
  baseURL,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await loadFixture(page);
  expect(requests.some((url) => url.includes("/bundle.js"))).toBe(false);
  const downloads: string[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  await page.getByRole("button", { name: "Prepare ZIP for all PDFs" }).click();
  await expect(page.getByRole("button", { name: "Download ZIP" })).toBeFocused();
  expect(downloads).toEqual([]);
  await expect(page.getByTestId("needs-download")).toHaveText("true");
  const zipDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download ZIP" }).click();
  const zip = await zipDownload;
  expect(zip.suggestedFilename()).toBe("report-split.zip");
  const entries = unzipSync(await readFile((await zip.path())!));
  expect(Object.keys(entries)).toEqual(["report-split-001.pdf", "report-split-002.pdf"]);
  const first = await PDFDocument.load(entries["report-split-001.pdf"]!);
  const second = await PDFDocument.load(entries["report-split-002.pdf"]!);
  expect([first.getPage(0).getWidth(), second.getPage(0).getWidth()]).toEqual([300, 500]);
  await expect(page.getByTestId("needs-download")).toHaveText("false");
  expect(requests.every((url) => url.startsWith(baseURL!))).toBe(true);
  expect(requests.some((url) => /report-split|private/.test(url))).toBe(false);
});

test("ZIP worker failure, cancellation and download failure retain individual outputs for retry", async ({
  page,
}) => {
  await loadFixture(page);
  await page.route("**/bundle.worker.js", (route) => route.abort());
  await page.getByRole("button", { name: "Prepare ZIP for all PDFs" }).click();
  await expect(page.getByRole("alert")).toContainText("worker failed");
  await expect(page.getByRole("button", { name: "Download report-split-001.pdf" })).toBeEnabled();
  await page.unroute("**/bundle.worker.js");
  await page.route("**/bundle.worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "self.onmessage = () => { while (true) {} };",
    }),
  );
  await page.getByRole("button", { name: "Prepare ZIP for all PDFs" }).click();
  await expect(page.getByRole("button", { name: "Clear fixture outputs" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel ZIP preparation" }).click();
  await expect(page.getByTestId("notice")).toContainText("ZIP preparation cancelled");
  await expect(page.getByRole("button", { name: "Clear fixture outputs" })).toBeEnabled();
  await page.unroute("**/bundle.worker.js");
  await page.getByRole("button", { name: "Prepare ZIP for all PDFs" }).click();
  await expect(page.getByRole("button", { name: "Download ZIP" })).toBeVisible();
  await page.evaluate(() => {
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      HTMLAnchorElement.prototype.click = original;
      throw new Error("Test download failure");
    };
  });
  await page.getByRole("button", { name: "Download ZIP" }).click();
  await expect(page.getByRole("alert")).toContainText("still available");
  await expect(page.getByTestId("needs-download")).toHaveText("true");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download ZIP" }).click();
  await downloaded;
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("repeated packaging cycles release workers and object URLs", async ({ page }) => {
  test.setTimeout(60_000);
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
    Object.defineProperty(window, "downloadResources", {
      get: () => ({ workers: workers.size, urls: urls.size }),
    });
  });
  await loadFixture(page);
  for (let cycle = 0; cycle < 20; cycle++) {
    await page.getByRole("button", { name: "Prepare ZIP for all PDFs" }).click();
    await expect(page.getByRole("button", { name: "Download ZIP" })).toBeVisible();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download ZIP" }).click();
    await downloaded;
    await page.getByRole("button", { name: "Clear fixture outputs" }).click();
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, "downloadResources")))
      .toEqual({ workers: 0, urls: 0 });
    await page.getByRole("button", { name: "Generate fixture outputs" }).click();
  }
});

test("optional JPEG/PNG previews use a local bounded worker and enforce provided pixel limits", async ({
  page,
}) => {
  await page.goto("./");
  const result = await page.evaluate(async () => {
    const moduleUrl = new URL("./assets/image-preview.js", location.href);
    const { previewImage } = await import(moduleUrl.href);
    const source = document.createElement("canvas");
    source.width = 400;
    source.height = 200;
    const context = source.getContext("2d");
    if (!context) {
      throw new Error("Fixture canvas unavailable");
    }
    context.fillStyle = "#ff0000";
    context.fillRect(0, 0, 200, 200);
    const images: { type: string; width: number; height: number }[] = [];
    for (const type of ["image/png", "image/jpeg"]) {
      const input = await new Promise<Blob>((resolve, reject) =>
        source.toBlob(
          (value) => (value ? resolve(value) : reject(new Error("Fixture encoding failed"))),
          type,
        ),
      );
      const output = await previewImage(input, new AbortController().signal, {
        decodedPixels: 80_000,
      });
      const decoded = await createImageBitmap(output);
      images.push({ type: output.type, width: decoded.width, height: decoded.height });
      decoded.close();
      let rejected = false;
      try {
        await previewImage(input, new AbortController().signal, { decodedPixels: 79_999 });
      } catch (error) {
        rejected = error instanceof Error && error.message.includes("Decoded image pixels");
      }
      if (!rejected) {
        throw new Error("Pixel limit was not enforced");
      }
    }
    source.width = source.height = 0;
    return images;
  });
  expect(result).toEqual([
    { type: "image/png", width: 144, height: 72 },
    { type: "image/png", width: 144, height: 72 },
  ]);
});
