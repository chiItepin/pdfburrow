import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import { inspectArtifact } from "./fixtures/pdfArtifacts";
import { preservationPdfs } from "./fixtures/preservationPdfs";
import { downloadSplit, editSplit, generateSplit } from "./fixtures/splitHelpers";

const requireEngine = createRequire(
  new URL("../../../packages/pdf-engine/package.json", import.meta.url),
);
const { unzipSync }: { unzipSync: (bytes: Uint8Array) => Record<string, Uint8Array> } =
  requireEngine("fflate");

test("downloads preserve selected and repeated page text, pixels and geometry in every mode", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const requests: { url: string; method: string }[] = [];
  const automaticDownloads: string[] = [];
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
  page.on("download", (download) => automaticDownloads.push(download.suggestedFilename()));
  const input = (await preservationPdfs())[0]!;
  const source = await inspectArtifact(input.buffer);
  await page.goto("./#/split");
  expect(requests.some(({ url }) => url.includes("/split.js"))).toBe(false);
  await page.locator('input[type="file"]').setInputFiles(input);
  await expect(page.getByText(/Annotations or links detected/)).toBeVisible();
  await page.getByRole("checkbox", { name: "Page 3", exact: true }).check();
  await page.getByRole("checkbox", { name: "Page 1", exact: true }).check();
  await expect(page.getByRole("region", { name: "Output prediction" })).toContainText(
    "Output: 1 PDF, 2 pages total.",
  );
  await generateSplit(page);
  expect(automaticDownloads).toEqual([]);
  let artifact = await downloadSplit(page);
  expect(artifact.name).toBe("embedded-text-extracted.pdf");
  expect(await inspectArtifact(artifact.bytes)).toEqual([source[0], source[2]]);
  await expect(page.getByRole("button", { name: "Prepare ZIP for all PDFs" })).toHaveCount(0);
  await editSplit(page);
  await page.getByRole("radio", { name: "Custom ranges" }).check();
  await page.getByRole("button", { name: "Add range" }).click();
  await page.getByRole("spinbutton", { name: "Range 1 start page" }).fill("2");
  await page.getByRole("button", { name: "Add range" }).click();
  await page.getByRole("spinbutton", { name: "Range 2 end page" }).fill("2");
  await expect(page.getByText(/Overlapping ranges repeat pages/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Output prediction" })).toContainText(
    "Output: 1 PDF, 4 pages total.",
  );
  await generateSplit(page);
  artifact = await downloadSplit(page);
  expect(await inspectArtifact(artifact.bytes)).toEqual([
    source[1],
    source[2],
    source[0],
    source[1],
  ]);
  await editSplit(page);
  await page.getByRole("checkbox", { name: "Combine ranges into one PDF" }).uncheck();
  await expect(page.getByRole("region", { name: "Output prediction" })).toContainText(
    "Output: 2 PDFs, 4 pages total.",
  );
  await generateSplit(page);
  const first = await downloadSplit(page, "Download embedded-text-split-001.pdf");
  const second = await downloadSplit(page, "Download embedded-text-split-002.pdf");
  expect(await inspectArtifact(first.bytes)).toEqual([source[1], source[2]]);
  expect(await inspectArtifact(second.bytes)).toEqual([source[0], source[1]]);
  const downloadCount = automaticDownloads.length;
  await page.getByRole("button", { name: "Prepare ZIP for all PDFs" }).click();
  await expect(page.getByRole("button", { name: "Download ZIP" })).toBeFocused();
  expect(automaticDownloads).toHaveLength(downloadCount);
  const zip = await downloadSplit(page, "Download ZIP");
  expect(zip.name).toBe("embedded-text-split.zip");
  const entries = unzipSync(zip.bytes);
  expect(Object.keys(entries)).toEqual([first.name, second.name]);
  expect(Buffer.from(entries[first.name]!)).toEqual(first.bytes);
  expect(Buffer.from(entries[second.name]!)).toEqual(second.bytes);

  for (const mode of ["Fixed page-count groups", "Every page"]) {
    await editSplit(page);
    await page.getByRole("radio", { name: mode, exact: true }).check();
    if (mode === "Fixed page-count groups") {
      await page.getByRole("spinbutton", { name: "Pages per PDF" }).fill("2");
    }
    const expected =
      mode === "Every page"
        ? [[source[0]], [source[1]], [source[2]]]
        : [[source[0], source[1]], [source[2]]];
    await expect(page.getByRole("region", { name: "Output prediction" })).toContainText(
      `Output: ${expected.length} PDFs, 3 pages total.`,
    );
    await generateSplit(page);
    for (const [index, pages] of expected.entries()) {
      const pdf = await downloadSplit(page, `Download embedded-text-split-00${index + 1}.pdf`);
      expect(await inspectArtifact(pdf.bytes)).toEqual(pages);
    }
  }
  expect(requests.some(({ url }) => url.includes("/split.worker.js"))).toBe(true);
  expect(
    requests.every(
      ({ url, method }) =>
        method === "GET" && (url.startsWith(baseURL!) || url.startsWith("blob:")),
    ),
  ).toBe(true);
  expect(requests.some(({ url }) => url.includes("embedded-text"))).toBe(false);
});
