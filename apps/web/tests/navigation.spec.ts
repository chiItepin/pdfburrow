import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const addPdf = async (page: Page) => {
  const document = await PDFDocument.create();
  document.addPage([300, 400]);
  await page.locator('input[type="file"]').setInputFiles({
    name: "private-document.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await document.save()),
  });
  await expect(page.getByText("Output: one PDF, 1 page, in the order above.")).toBeVisible();
};

test("tool-first entry, bookmarks and local disclosures are truthful and base-aware", async ({
  page,
  request,
}) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "PDF tools that run on your device. No uploads.",
  );
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Open Merge PDFs" }).click();
  await expect(page).toHaveURL(/#\/merge$/);
  await expect(page.getByRole("heading", { name: "Merge PDFs", exact: true })).toBeFocused();
  await expect(page.getByRole("link", { name: "Privacy", exact: true })).toHaveAttribute(
    "target",
    "_blank",
  );
  for (const name of ["privacy", "notices"]) {
    const response = await request.get(`./${name}.html`);
    expect(response.status()).toBe(200);
    expect(await response.text()).not.toContain("%BASE_PATH%");
  }
  await page.goto("./#/split");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Split / Extract");
  await expect(page.getByRole("button", { name: "Add PDF", exact: true })).toBeEnabled();
  await expect(page.locator('input[type="file"]')).not.toHaveAttribute("multiple");
  await page.goto("./#/images");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Images to PDF");
  await page.goto("./#/unknown?filename=private.pdf");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tool not found");
  await expect(page).toHaveURL(/#\/not-found$/);
});

test("tool changes keep work by default and discard it only after confirmation", async ({
  page,
}) => {
  await page.goto("./#/merge");
  await addPdf(page);
  const home = page.getByRole("link", { name: "Home", exact: true });
  await home.click();
  await expect(page.getByRole("button", { name: "Keep working" })).toBeFocused();
  await expect(page).toHaveURL(/#\/merge$/);
  await page.keyboard.press("Escape");
  await expect(home).toBeFocused();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("link", { name: "Split / Extract", exact: true }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(/#\/split$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.getByRole("link", { name: "Merge PDFs", exact: true }).click();
  await expect(page.getByRole("listitem")).toHaveCount(0);
  expect(page.url()).not.toContain("private-document");
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain(
    "private-document",
  );
});

test("Back and Forward preserve history entries when a dirty navigation is refused", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Open Merge PDFs" }).click();
  await addPdf(page);
  await page.goBack();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/#\/merge$/);
  await page.getByRole("button", { name: "Keep working" }).click();
  await page.goBack();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/#\/merge$/);
  await expect(page.getByRole("listitem")).toHaveCount(0);
  await page.getByRole("link", { name: "Split / Extract", exact: true }).click();
  await page.goBack();
  await addPdf(page);
  await page.goForward();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/#\/merge$/);
  await page.getByRole("button", { name: "Keep working" }).click();
  await page.goForward();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(/#\/split$/);
});

test("manual hash changes cannot bypass confirmation or carry files to another tool", async ({
  page,
}) => {
  await page.goto("./#/merge");
  await addPdf(page);
  await page.evaluate(() => {
    location.hash = "#/images";
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/#\/merge$/);
  await page.getByRole("button", { name: "Keep working" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await page.goForward();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(/#\/images$/);
});

test("processing locks tool navigation and history until confirmed cancellation", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Open Merge PDFs" }).click();
  await addPdf(page);
  await page.route("**/merge.worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "self.onmessage = () => { while (true) {} };",
    }),
  );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  await expect(page.getByRole("link", { name: "Home", exact: true })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await page.goBack();
  await expect(page).toHaveURL(/#\/merge$/);
  await expect(page.getByRole("alert")).toContainText("Navigation is locked");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel merge" }).click();
  await expect(page.getByRole("status")).toContainText("Merge cancelled");
  await page.goBack();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
});

test("downloaded results still require confirmation before leaving, while refresh loses drafts", async ({
  page,
}) => {
  await page.goto("./#/merge");
  await addPdf(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your merged PDF is ready" })).toBeFocused();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  await downloaded;
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep working" }).click();
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
  page.on("dialog", (dialog) => void dialog.accept());
  await page.reload();
  await expect(page).toHaveURL(/#\/merge$/);
  await expect(page.getByRole("listitem")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download PDF" })).toHaveCount(0);
});
