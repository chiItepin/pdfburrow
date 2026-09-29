import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { inspectArtifact } from "./fixtures/pdfArtifacts";
import { malformedPageTree, preservationPdfs, protectedPdf } from "./fixtures/preservationPdfs";

test("download preserves every page's embedded text, pixels, boxes and rotation in file order", async ({
  page,
}) => {
  const inputs = await preservationPdfs();
  const expected = [];
  for (const input of [...inputs].reverse()) {
    const pages = await inspectArtifact(input.buffer);
    expect(pages.map((item) => item.text)).toEqual(input.text);
    for (const item of pages) {
      expect(
        item.pixels.filter((value, index) => index % 4 !== 3 && value < 240).length,
      ).toBeGreaterThan(1000);
    }
    expected.push(...pages);
  }
  await page.goto("./#/merge");
  await page.locator('input[type="file"]').setInputFiles(inputs);
  await expect(page.getByText("Output: one PDF, 4 pages, in the order above.")).toBeVisible();
  await expect(
    page.locator("[data-workspace-content]").getByRole("listitem").first(),
  ).toContainText("Annotations or links detected");
  await expect(
    page.locator("[data-workspace-content]").getByRole("listitem").first(),
  ).toContainText("Document features detected");
  await expect(page.getByRole("button", { name: "Merge PDFs", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Move scan.pdf up" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your merged PDF is ready" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("scan-merged.pdf");
  const path = await download.path();
  if (!path) {
    throw new Error("The merged PDF download is missing.");
  }
  const bytes = await readFile(path);
  const actual = await inspectArtifact(bytes);
  expect(actual).toHaveLength(expected.length);
  for (const [index, target] of expected.entries()) {
    expect(actual[index], `Downloaded page ${index + 1}`).toEqual(target);
  }
  const merged = await PDFDocument.load(bytes);
  let index = 0;
  for (const input of [...inputs].reverse()) {
    const original = await PDFDocument.load(input.buffer);
    for (const source of original.getPages()) {
      const target = merged.getPage(index++);
      expect([
        target.getMediaBox(),
        target.getCropBox(),
        target.getBleedBox(),
        target.getTrimBox(),
        target.getArtBox(),
        target.getRotation(),
      ]).toEqual([
        source.getMediaBox(),
        source.getCropBox(),
        source.getBleedBox(),
        source.getTrimBox(),
        source.getArtBox(),
        source.getRotation(),
      ]);
    }
  }
});

test("real encrypted and signed inputs cannot be acknowledged away, while valid inputs survive", async ({
  page,
}) => {
  const emptyPassword = await protectedPdf("encryptedEmpty.pdf");
  const openingPassword = await protectedPdf("encryptedOpen.pdf");
  const signed = await protectedPdf("signed.pdf");
  expect((await inspectArtifact(emptyPassword.buffer))[0]?.text).toBe("Protected fixture page");
  await expect(inspectArtifact(openingPassword.buffer)).rejects.toThrow(/password/i);
  expect((await inspectArtifact(openingPassword.buffer, "fixture-open"))[0]?.text).toBe(
    "Protected fixture page",
  );
  expect((await inspectArtifact(signed.buffer))[0]?.text).toBe("Locally signed test document");

  const valid = await PDFDocument.create();
  valid.addPage([300, 400]).drawText("Retained valid page");
  await page.goto("./#/merge");
  await page
    .locator('input[type="file"]')
    .setInputFiles([
      { name: "valid.pdf", mimeType: "application/pdf", buffer: Buffer.from(await valid.save()) },
      emptyPassword,
      openingPassword,
      signed,
      await malformedPageTree(),
    ]);
  await expect(page.getByText(/Encrypted PDFs are not supported/)).toHaveCount(2);
  await expect(page.getByText(/Digital signatures detected/)).toBeVisible();
  await expect(page.getByText(/page tree is invalid/)).toBeVisible();
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Merge PDFs", exact: true })).toBeDisabled();
  for (const name of [
    emptyPassword.name,
    openingPassword.name,
    signed.name,
    "incomplete-pages.pdf",
  ]) {
    await page.getByRole("button", { name: `Remove ${name}`, exact: true }).click();
  }
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(page.getByText("Output: one PDF, 1 page, in the order above.")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) {
    throw new Error("The recovered merge download is missing.");
  }
  const output = await inspectArtifact(await readFile(path));
  expect(output.map((item) => item.text)).toEqual(["Retained valid page"]);
});
