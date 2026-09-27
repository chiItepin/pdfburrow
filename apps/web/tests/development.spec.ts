import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";

test("React development builds load local workers and produce a downloadable PDF", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) =>
    errors.push(`${request.url()}: ${request.failure()?.errorText}`),
  );
  const input = await PDFDocument.create();
  input.addPage([300, 400]).drawText("Development worker fixture", { x: 30, y: 100, size: 12 });
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({
    name: "development.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await input.save()),
  });
  await expect(page.getByText("Output: one PDF, 1 page, in the order above.")).toBeVisible();
  await expect(page.getByRole("img", { name: "First page of development.pdf" })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your merged PDF is ready" })).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("development-merged.pdf");
  const output = await PDFDocument.load(await readFile((await download.path())!));
  expect(output.getPageCount()).toBe(1);
  expect(output.getPage(0).getSize()).toEqual({ width: 300, height: 400 });
  expect(errors).toEqual([]);
});

test("the development server serves compiled assets only and rejects document uploads", async ({
  request,
  baseURL,
}) => {
  const entry = await request.get("./assets/main.js");
  expect(entry.status()).toBe(200);
  expect(entry.headers()["content-type"]).toContain("text/javascript");
  expect(entry.headers()["cache-control"]).toBe("no-store");
  expect((await request.head("./assets/main.js")).status()).toBe(200);
  expect((await request.get("./src/main.tsx")).status()).toBe(404);
  expect((await request.get("./package.json")).status()).toBe(404);
  expect((await request.post("./", { data: "not a document upload endpoint" })).status()).toBe(405);
  expect((await request.get(`${baseURL}%2e%2e%2fpackage.json`)).status()).toBe(404);
});
