import { expect, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { closeToolSettings } from "./toolSettings";

export const addSplitSource = async (page: Page, count = 10) => {
  const document = await PDFDocument.create();
  for (let index = 0; index < count; index++) {
    document.addPage([300 + index, 400]).drawText(`Page ${index + 1}`, { x: 30, y: 100, size: 12 });
  }
  await page.locator('input[type="file"]').setInputFiles({
    name: "report.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await document.save()),
  });
  await expect(page.getByRole("checkbox", { name: "Page 1", exact: true })).toBeVisible();
};

export const generateSplit = async (page: Page) => {
  await closeToolSettings(page);
  await page
    .getByRole("checkbox", { name: "I understand these limitations for the current PDF inputs." })
    .check();
  await page.getByRole("button", { name: /^(Generate PDFs|Retry generation)$/ }).click();
  await expect(page.getByRole("heading", { name: "Your PDFs are ready" })).toBeFocused();
};

export const downloadSplit = async (page: Page, name = "Download PDF") => {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  const download = await pending;
  const path = await download.path();
  if (!path) {
    throw new Error("Expected a downloaded artifact.");
  }
  return { name: download.suggestedFilename(), bytes: await readFile(path) };
};

export const editSplit = async (page: Page) => {
  await page.getByRole("button", { name: "Edit selection" }).click();
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible()) {
    await page.getByRole("button", { name: "Discard", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "Your source PDF" })).toBeFocused();
};
