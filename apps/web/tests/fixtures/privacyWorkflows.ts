import { expect, type Page } from "@playwright/test";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { createRequire } from "node:module";
import { imageFixture, downloadImagePdf, generateImages, type ImageFixture } from "./imageFixtures";
import { downloadSplit, generateSplit } from "./splitHelpers";

export const privateMarker = "PRIVATE_DOCUMENT_4e91d";
const { unzipSync }: { unzipSync: (bytes: Uint8Array) => Record<string, Uint8Array> } =
  createRequire(new URL("../../../../packages/pdf-engine/package.json", import.meta.url))("fflate");

export const privacyPdf = async () => {
  const document = await PDFDocument.create();
  for (const width of [300, 400]) {
    document.addPage([width, 500]).drawText(privateMarker, { x: 20, y: 100 });
  }
  const annotation = document.context.register(
    document.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [0, 0, 100, 100],
      A: { S: "URI", URI: PDFString.of(`https://document-resource.invalid/${privateMarker}`) },
    }),
  );
  document.getPage(0).node.set(PDFName.of("Annots"), document.context.obj([annotation]));
  return {
    name: `${privateMarker}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from(await document.save()),
  };
};

export const resetPrivacyDraft = async (page: Page) => {
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByRole("listitem")).toHaveCount(0);
};

export const privacyInputs = async (page: Page) => ({
  pdf: await privacyPdf(),
  image: await imageFixture(page, `${privateMarker}.png`),
  jpeg: await imageFixture(page, `${privateMarker}.jpg`, 80, 120, "image/jpeg"),
});

export const exercisePrivateWorkflows = async (
  page: Page,
  inputs: { pdf: ImageFixture; image: ImageFixture; jpeg: ImageFixture },
) => {
  await page.getByRole("link", { name: "Merge PDFs", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(inputs.pdf);
  await expect(page.getByRole("img", { name: `First page of ${inputs.pdf.name}` })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your merged PDF is ready" })).toBeVisible();
  const merged = await downloadSplit(page);
  expect((await PDFDocument.load(merged.bytes)).getPages().map((item) => item.getWidth())).toEqual([
    300, 400,
  ]);
  await resetPrivacyDraft(page);

  await page.getByRole("link", { name: "Split / Extract", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(inputs.pdf);
  await page.getByRole("radio", { name: "Every page", exact: true }).check();
  await generateSplit(page);
  await page.getByRole("button", { name: "Prepare ZIP for all PDFs" }).click();
  const split = unzipSync((await downloadSplit(page, "Download ZIP")).bytes);
  expect(Object.keys(split)).toEqual([
    `${privateMarker}-split-001.pdf`,
    `${privateMarker}-split-002.pdf`,
  ]);
  for (const [index, bytes] of Object.values(split).entries()) {
    expect((await PDFDocument.load(bytes)).getPage(0).getWidth()).toBe(index === 0 ? 300 : 400);
  }
  await resetPrivacyDraft(page);

  await page.getByRole("link", { name: "Images to PDF", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles([inputs.image, inputs.jpeg]);
  await expect(page.getByRole("img", { name: `Preview of ${inputs.image.name}` })).toBeVisible();
  await page.getByRole("radio", { name: "One PDF per image", exact: true }).check();
  await page.getByRole("radio", { name: "Image size (96 pixels per inch)" }).check();
  await generateImages(page);
  await page.getByRole("button", { name: "Prepare ZIP for all PDFs" }).click();
  const images = unzipSync((await downloadImagePdf(page, "Download ZIP")).bytes);
  expect(Object.keys(images)).toHaveLength(2);
  for (const [index, bytes] of Object.values(images).entries()) {
    expect((await PDFDocument.load(bytes)).getPage(0).getSize()).toEqual(
      index === 0 ? { width: 90, height: 60 } : { width: 60, height: 90 },
    );
  }
  await resetPrivacyDraft(page);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      state: JSON.stringify(history.state),
    })),
  ).toEqual({ local: 0, session: 0, state: expect.not.stringContaining(privateMarker) });
};
