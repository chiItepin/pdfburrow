import { expect, test } from "@playwright/test";
import { compressedScanPdf } from "./fixtures/compressedScanPdf";

test("local preview decoders and their license texts are served with the build", async ({
  request,
}) => {
  for (const file of ["jbig2_nowasm_fallback.js", "openjpeg_nowasm_fallback.js"]) {
    const response = await request.get(`./assets/pdfjs/${file}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/javascript");
    expect((await response.body()).byteLength).toBeGreaterThan(1_000);
  }
  for (const file of [
    "LICENSE",
    "LICENSE_JBIG2",
    "LICENSE_PDFJS_JBIG2",
    "LICENSE_OPENJPEG",
    "LICENSE_PDFJS_OPENJPEG",
  ]) {
    const response = await request.get(`./assets/pdfjs/${file}`);
    expect(response.status()).toBe(200);
    expect((await response.text()).length).toBeGreaterThan(100);
  }
});

for (const codec of ["JBIG2Decode", "CCITTFaxDecode"] as const) {
  test(`six-page ${codec} scans render nonblank previews with local decoder assets`, async ({
    page,
    baseURL,
  }) => {
    const warnings: string[] = [];
    const requests: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" || message.type() === "error") {
        warnings.push(message.text());
      }
    });
    page.on("request", (request) => requests.push(request.url()));
    await page.goto("./#/merge");
    const chosen = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Add PDFs", exact: true }).click();
    await (await chosen).setFiles(await compressedScanPdf(codec));
    await expect(page.getByText("Output: one PDF, 6 pages, in the order above.")).toBeVisible();
    const thumbnail = page.getByRole("img", { name: `First page of ${codec}.pdf` });
    await expect(thumbnail).toBeVisible();
    const pixels = await thumbnail.evaluate(async (image: HTMLImageElement) => {
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas context unavailable.");
      }
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let dark = 0;
      let light = 0;
      for (let index = 0; index < data.length; index += 4) {
        if (data[index]! < 100) {
          dark++;
        } else if (data[index]! > 245) {
          light++;
        }
      }
      return { dark, light };
    });
    expect(pixels.dark).toBeGreaterThan(1_000);
    expect(pixels.light).toBeGreaterThan(5_000);
    expect(warnings).toEqual([]);
    expect(requests.some((url) => url.endsWith("/pdfjs/jbig2_nowasm_fallback.js"))).toBe(true);
    expect(requests.every((url) => url.startsWith(baseURL!) || url.startsWith("blob:"))).toBe(true);
  });
}
