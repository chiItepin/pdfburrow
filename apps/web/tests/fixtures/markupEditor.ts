import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { PDFDocument, PDFName, StandardFonts, degrees } from "pdf-lib";

export const createMarkupSource = async (annotations = false) => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const angle of [0, 90]) {
    const page = document.addPage([400, 500]);
    page.setCropBox(10, 20, 360, 440);
    page.setRotation(degrees(angle));
    page.drawText("Original contract", { x: 60, y: 250, font, size: 12 });
  }
  if (annotations) {
    document
      .getPage(0)
      .node.set(
        PDFName.of("Annots"),
        document.context.obj([{ Type: "Annot", Subtype: "Link", Rect: [10, 10, 20, 20] }]),
      );
  }
  return Buffer.from(await document.save());
};

export const openMarkupEditor = async (page: Page, annotations = false) => {
  await page.goto("./sign/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "contract.pdf",
    mimeType: "application/pdf",
    buffer: await createMarkupSource(annotations),
  });
  if (!annotations) {
    await expect(
      page.getByRole("button", { name: "PDF markup canvas, page 1", exact: true }),
    ).toBeVisible();
  }
};

export const runMarkupCommand = async (page: Page, menu: string, command: string) => {
  await page.getByRole("menubar").getByRole("menuitem", { name: menu, exact: true }).click();
  await page.getByRole("menuitem", { name: command, exact: true }).click();
};

export const selectMarkupTool = async (page: Page, tool: string) => {
  await page.getByRole("menubar").getByRole("menuitem", { name: "Tools", exact: true }).click();
  await page.getByRole("menuitemradio", { name: tool, exact: true }).click();
  await expect(
    page.getByRole("menubar").getByRole("menuitem", { name: "Tools", exact: true }),
  ).toBeFocused();
};

export const setMarkupZoom = async (page: Page, zoom: string) => {
  await runMarkupCommand(page, "View", "Zoom level...");
  await page
    .getByRole("spinbutton", { name: "Zoom percentage", exact: true })
    .fill(zoom.replace("%", ""));
  await page.getByRole("button", { name: "Apply zoom", exact: true }).click();
};

export const addTestSignature = async (page: Page) => {
  await runMarkupCommand(page, "Tools", "Draw signature...");
  const pad = page.getByRole("button", { name: "Signature drawing pad", exact: true });
  await expect(pad).toBeVisible();
  const box = await pad.boundingBox();
  if (!box) {
    throw new Error("No signature pad bounds.");
  }
  await page.mouse.click(box.x + 40, box.y + 40);
  await page.mouse.move(box.x + 90, box.y + 70, { steps: 6 });
  await page.mouse.move(box.x + 130, box.y + 45, { steps: 6 });
  await page.mouse.click(box.x + 160, box.y + 60);
  await expect(page.getByText("1 completed stroke", { exact: true })).toBeVisible();
  await page.mouse.click(box.x + 100, box.y + 80);
  await page.mouse.move(box.x + 150, box.y + 95, { steps: 4 });
  await page.mouse.click(box.x + 180, box.y + 80);
  await expect(page.getByText("2 completed strokes", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Use signature", exact: true }).click();
};
