import { expect, test } from "@playwright/test";
import { PDFDict, PDFDocument, PDFName, PDFRef } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { inspectArtifact } from "./fixtures/pdfArtifacts";
import { setToolOption } from "./fixtures/toolSettings";

const filledForm = async () => {
  const document = await PDFDocument.create();
  const fields = [];
  for (let index = 1; index <= 2; index++) {
    const source = document.addPage([300, 400]);
    source.drawText(`Synthetic content ${index}`, { x: 30, y: 350 });
    const field = document.getForm().createTextField(`field${index}`);
    field.setText(`Old value ${index}`);
    field.addToPage(source, { x: 30, y: 200, width: 220, height: 30 });
    fields.push(field);
  }
  document.getForm().updateFieldAppearances();
  fields.forEach((field, index) => field.setText(`Current filled value ${index + 1}`));
  document.catalog.set(
    PDFName.of("StructTreeRoot"),
    document.context.register(
      document.context.obj({ Type: "StructTreeRoot", IDTree: PDFRef.of(9999) }),
    ),
  );
  return {
    name: "synthetic.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await document.save({ updateFieldAppearances: false })),
  };
};

test("a filled form can download a grouped page set directly with both current values", async ({
  page,
}) => {
  await page.goto("./split/");
  await page.locator('input[type="file"]').setInputFiles(await filledForm());
  await expect(page.getByText(/Form fields on exported pages stay editable/)).toBeVisible();
  await setToolOption(page, "Page sets");
  await page.getByRole("checkbox", { name: "Page 1", exact: true }).check();
  await page.getByRole("checkbox", { name: "Page 2", exact: true }).check();
  await page.getByRole("button", { name: "Group into one PDF", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Download PDF: Pages 1 + 2", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: /I understand these limitations/ }).check();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF: Pages 1 + 2", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) {
    throw new Error("The generated set PDF is unavailable.");
  }
  const bytes = await readFile(path);
  const saved = await PDFDocument.load(bytes);
  expect(saved.getPageCount()).toBe(2);
  expect(saved.catalog.has(PDFName.of("AcroForm"))).toBe(true);
  expect(saved.getForm().getTextField("field1").getText()).toBe("Current filled value 1");
  expect(saved.getForm().getTextField("field2").getText()).toBe("Current filled value 2");
  saved.getForm().getTextField("field1").setText("Edited after export");
  const edited = await PDFDocument.load(await saved.save());
  expect(edited.getForm().getTextField("field1").getText()).toBe("Edited after export");
});

for (const tool of ["merge", "split", "remove"] as const) {
  test(`${tool} downloads editable form values despite stale appearances and accessibility references`, async ({
    page,
    baseURL,
  }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      expect(request.method()).toBe("GET");
      requests.push(request.url());
    });
    await page.goto(`./${tool}/`);
    await page.locator('input[type="file"]').setInputFiles(await filledForm());
    await expect(page.getByText(/Form fields on exported pages stay editable/)).toBeVisible();
    await expect(page.getByText(/A required PDF object is missing/)).toHaveCount(0);
    if (tool !== "merge") {
      await page
        .getByRole("checkbox", { name: `Page ${tool === "remove" ? 2 : 1}`, exact: true })
        .check();
    }

    const generate = page.getByRole("button", {
      name: tool === "merge" ? "Merge PDFs" : tool === "remove" ? "Remove pages" : "Generate PDFs",
      exact: true,
    });
    await expect(generate).toBeDisabled();
    const preview = page.getByRole("img", {
      name: tool === "merge" ? "First page of synthetic.pdf" : "Preview of page 1",
    });
    await expect(preview).toBeVisible();
    const previewPixels = await preview.evaluate(async (image: HTMLImageElement) =>
      Array.from(new Uint8Array(await (await fetch(image.src)).arrayBuffer())),
    );
    await page.getByRole("checkbox", { name: /I understand these limitations/ }).check();
    await generate.click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF", exact: true }).click();
    const download = await downloadPromise;
    const path = await download.path();
    if (!path) {
      throw new Error("The generated form PDF is unavailable.");
    }
    const bytes = await readFile(path);
    const saved = await PDFDocument.load(bytes);
    expect(saved.getPageCount()).toBe(tool === "merge" ? 2 : 1);
    expect(saved.catalog.has(PDFName.of("AcroForm"))).toBe(true);
    expect(saved.getForm().getTextField("field1").getText()).toBe("Current filled value 1");
    expect(saved.getForm().getFields()).toHaveLength(tool === "merge" ? 2 : 1);
    const artifact = await inspectArtifact(bytes);
    expect(artifact[0]?.text).toContain("Synthetic content 1");
    expect(artifact[0]?.text).not.toContain("Old value");
    const generatedPreview = await page.evaluate(
      async ({ data, url }) => {
        const { previewPdf } = await import(url);
        const blob = await previewPdf(
          new Blob([new Uint8Array(data)]),
          new AbortController().signal,
        );
        return Array.from(new Uint8Array(await blob.arrayBuffer()));
      },
      { data: Array.from(bytes), url: new URL("assets/preview.js", baseURL).href },
    );
    expect(generatedPreview).toEqual(previewPixels);
    saved.getForm().getTextField("field1").setText("Edited after export");
    const edited = await PDFDocument.load(await saved.save());
    expect(edited.getForm().getTextField("field1").getText()).toBe("Edited after export");
    expect(requests.every((url) => url.startsWith(baseURL!) || url.startsWith("blob:"))).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test(`${tool} still blocks XFA even with missing accessibility objects`, async ({ page }) => {
    const document = await PDFDocument.create();
    document.addPage([300, 400]);
    document.getForm().createTextField("value").addToPage(document.getPage(0));
    document.catalog
      .lookup(PDFName.of("AcroForm"), PDFDict)
      .set(PDFName.of("XFA"), document.context.obj([]));
    document.catalog.set(
      PDFName.of("StructTreeRoot"),
      document.context.obj({ IDTree: PDFRef.of(9999) }),
    );
    await page.goto(`./${tool}/`);
    await page.locator('input[type="file"]').setInputFiles({
      name: "unsupported.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await document.save({ updateFieldAppearances: false })),
    });
    await expect(page.getByText(/Interactive form fields use XFA/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retry validation of unsupported.pdf" }),
    ).toBeVisible();
  });
}
