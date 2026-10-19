import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument, PDFName } from "pdf-lib";
import { createFillableForm } from "./fixtures/fillableForm";
import { createCompatibilityForm } from "./fixtures/formCompatibility";
import { inspectArtifact } from "./fixtures/pdfArtifacts";
import { navigateToTool } from "./fixtures/workspaceNavigation";
import { addTestSignature, runMarkupCommand } from "./fixtures/markupEditor";

const openForm = async (page: Page) => {
  await page.goto("./forms/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "private-application.pdf",
    mimeType: "application/pdf",
    buffer: await createFillableForm(),
  });
  await expect(page.getByRole("group", { name: "Form page 1", exact: true })).toBeVisible();
};
const acknowledge = (page: Page) =>
  page.getByRole("checkbox", { name: /I understand that field fonts/ }).check();
const downloadBytes = async (page: Page, label: string) => {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: label, exact: true }).click();
  const download = await pending;
  const path = await download.path();
  if (!path) {
    throw new Error("The form output download is missing.");
  }
  return { bytes: await readFile(path), name: download.suggestedFilename() };
};

test("fills actual controls, preserves editable values and passes a flattened copy to signing", async ({
  page,
  context,
}, testInfo) => {
  const failures: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  context.on("request", (request) =>
    requests.push(`${request.method()} ${request.url()} ${request.postData() ?? ""}`),
  );
  await openForm(page);
  const name = page.getByRole("textbox", { name: "Full name (required)", exact: true });
  await name.fill("Private Applicant");
  await name.press("Tab");
  await expect(page.getByRole("textbox", { name: "Notes", exact: true })).toBeFocused();
  await page.getByRole("textbox", { name: "Notes", exact: true }).fill("First line\nSecond line");
  await page.getByRole("checkbox", { name: "I agree", exact: true }).check();
  await page.getByRole("radio", { name: "Delivery: Post", exact: true }).check();
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("r");
  await expect(
    page.getByRole("textbox", { name: "Reference (read-only)", exact: true }),
  ).toBeDisabled();
  await expect(name).toHaveAttribute("maxlength", "40");
  await page
    .getByRole("region", { name: "PDF form editor", exact: true })
    .screenshot({ path: testInfo.outputPath("form-editor.png") });
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByRole("group", { name: "Form page 2", exact: true })).toBeVisible();
  await expect(name).toHaveValue("Private Applicant");
  await page.getByRole("button", { name: "Field list", exact: true }).click();
  await name.fill("Updated Applicant");
  await page.getByRole("button", { name: "Previous page", exact: true }).click();
  await expect(name).toHaveValue("Updated Applicant");
  await acknowledge(page);
  await page.getByRole("button", { name: "Generate filled PDF", exact: true }).click();
  const filled = await downloadBytes(page, "Download filled PDF");
  expect(filled.name).toBe("private-application-filled.pdf");
  const parsed = await PDFDocument.load(filled.bytes);
  const form = parsed.getForm();
  expect(form.getTextField("Full name").getText()).toBe("Updated Applicant");
  expect(form.getTextField("Notes").getText()).toBe("First line\nSecond line");
  expect(form.getCheckBox("I agree").isChecked()).toBe(true);
  expect(form.getRadioGroup("Delivery").getSelected()).toBe("Post");
  expect(form.getDropdown("Status").getSelected()).toEqual(["r"]);
  expect(form.getDropdown("Status").isEditable()).toBe(false);
  const editablePixels = await inspectArtifact(filled.bytes, undefined, true);
  await page.getByRole("button", { name: "Edit form", exact: true }).click();
  await expect(name).toHaveValue("Updated Applicant");
  await page.getByRole("button", { name: "Prepare for visual signature", exact: true }).click();
  await expect(page.getByRole("button", { name: "Keep filling", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Flatten copy", exact: true }).click();
  const flat = await downloadBytes(page, "Download flattened PDF");
  const flattened = await PDFDocument.load(flat.bytes);
  expect(flattened.getForm().getFields()).toHaveLength(0);
  const flatPixels = await inspectArtifact(flat.bytes);
  expect(flatPixels[0]!.text).toContain("Updated Applicant");
  expect(flatPixels[0]!.text).toContain("Rejected");
  for (const [index, rendered] of flatPixels.entries()) {
    expect(rendered.pixels.equals(editablePixels[index]!.pixels)).toBe(true);
  }
  await page.getByRole("button", { name: "Continue to visual signing", exact: true }).click();
  await expect(page).toHaveURL(/\/sign\/$/);
  await expect(
    page.getByRole("button", { name: "PDF markup canvas, page 1", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await addTestSignature(page);
  await page.getByRole("checkbox").check();
  await runMarkupCommand(page, "File", "Generate PDF");
  const signed = await downloadBytes(page, "Download PDF");
  const signedPages = await inspectArtifact(signed.bytes);
  expect(signedPages[0]!.text).toContain("Updated Applicant");
  expect(signedPages[0]!.pixels.equals(flatPixels[0]!.pixels)).toBe(false);
  expect(requests.every((request) => request.startsWith("GET "))).toBe(true);
  expect(requests.join("\n")).not.toMatch(
    /Private Applicant|Updated Applicant|private-application/,
  );
  expect(failures).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((key) => key !== "pdfburrow-theme")),
  ).toEqual([]);
});

test("unsupported forms fail up front; reset, generation cancellation and discard guards retain values", async ({
  page,
}) => {
  await page.goto("./forms/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "scripted.pdf",
    mimeType: "application/pdf",
    buffer: await createFillableForm(true),
  });
  await expect(page.getByText(/Scripted form behavior cannot be preserved/)).toBeVisible();
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start over", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "form.pdf",
    mimeType: "application/pdf",
    buffer: await createFillableForm(),
  });
  await expect(page.getByRole("group", { name: "Form page 1", exact: true })).toBeVisible();
  const name = page.getByRole("textbox", { name: "Full name (required)", exact: true });
  await name.fill("Retained");
  await navigateToTool(page, "Merge PDFs");
  await page.getByRole("button", { name: "Keep working", exact: true }).click();
  await expect(name).toHaveValue("Retained");
  await page.route("**/forms.worker.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "self.onmessage = () => {};" }),
  );
  await acknowledge(page);
  await page.getByRole("button", { name: "Generate filled PDF", exact: true }).click();
  await page.getByRole("button", { name: "Cancel generation", exact: true }).click();
  await expect(
    page.getByText("Generation cancelled. Your form values are retained.", { exact: true }),
  ).toBeVisible();
  await expect(name).toHaveValue("Retained");
  await page.unroute("**/forms.worker.js");
  await name.fill("中文");
  await page.getByRole("button", { name: "Generate filled PDF", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("not supported by the local form font");
  await name.fill("Recovered");
  await page.getByRole("button", { name: "Generate filled PDF", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Download filled PDF", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit form", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("generated download");
  await page.getByRole("dialog").getByRole("button", { name: "Edit form", exact: true }).click();
  await expect(name).toHaveValue("Recovered");
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start over", exact: true }).click();
  await expect(page.getByRole("button", { name: "Choose PDF form", exact: true })).toBeFocused();
  await expect(name).toHaveCount(0);
});

test("preview failures do not prevent editing and saving through the field list", async ({
  page,
}) => {
  await page.route("**/pdf.worker.min.js", (route) => route.abort());
  await page.goto("./forms/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "form.pdf",
    mimeType: "application/pdf",
    buffer: await createFillableForm(),
  });
  await expect(page.getByRole("alert")).toContainText("Field list");
  await page.getByRole("button", { name: "Field list", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Full name (required)", exact: true })
    .fill("Without preview");
  await acknowledge(page);
  await page.getByRole("button", { name: "Generate filled PDF", exact: true }).click();
  const output = await downloadBytes(page, "Download filled PDF");
  expect((await PDFDocument.load(output.bytes)).getForm().getTextField("Full name").getText()).toBe(
    "Without preview",
  );
});

test("inline input, textarea and select text follows the page overlay zoom", async ({ page }) => {
  await openForm(page);
  const controls = [
    page.getByRole("textbox", { name: "Full name (required)", exact: true }),
    page.getByRole("textbox", { name: "Notes", exact: true }),
    page.getByRole("combobox", { name: "Status", exact: true }),
  ];
  for (const zoom of ["1", "2", "1.5"]) {
    await page.getByRole("combobox", { name: "Page zoom", exact: true }).selectOption(zoom);
    for (const control of controls) {
      await expect
        .poll(() =>
          control
            .evaluate((element) => {
              const overlay = element.closest("[title]");
              if (!overlay) {
                throw new Error("The form control is missing its page overlay.");
              }
              return {
                actual: getComputedStyle(element).fontSize,
                expected: getComputedStyle(overlay).fontSize,
              };
            })
            .then(({ actual, expected }) => actual === expected),
        )
        .toBe(true);
    }
  }
  await page.getByRole("button", { name: "Field list", exact: true }).click();
  for (const control of controls) {
    expect(
      await control.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
    ).toBeGreaterThanOrEqual(14);
  }
});

test("repairs stale form metadata and edits alternate checkbox choices on the page and field list", async ({
  page,
}) => {
  const document = await createCompatibilityForm();
  await page.goto("./forms/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "compatibility.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await document.save({ updateFieldAppearances: false })),
  });
  await expect(page.getByRole("group", { name: "Form page 1", exact: true })).toBeVisible();
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  const yes = page.getByRole("checkbox", { name: "Response: Yes", exact: true });
  const no = page.getByRole("checkbox", { name: "Response: No", exact: true });
  await expect(name).toHaveValue("Current value");
  await expect(yes).not.toBeChecked();
  await expect(no).toBeChecked();
  await yes.focus();
  await yes.press("Space");
  await expect(yes).toBeChecked();
  await expect(no).not.toBeChecked();
  await page.getByRole("button", { name: "Field list", exact: true }).click();
  await expect(yes).toBeChecked();
  await yes.uncheck();
  await expect(yes).not.toBeChecked();
  await expect(no).not.toBeChecked();
  await no.check();
  await name.fill("Edited value");
  await acknowledge(page);
  await page.getByRole("button", { name: "Generate filled PDF", exact: true }).click();
  const filled = await downloadBytes(page, "Download filled PDF");
  const parsed = await PDFDocument.load(filled.bytes);
  expect(parsed.catalog.has(PDFName.of("StructTreeRoot"))).toBe(false);
  expect(parsed.getForm().getTextField("Name").getText()).toBe("Edited value");
  expect(parsed.getForm().getCheckBox("Response").acroField.getValue().decodeText()).toBe("No");
  expect(parsed.getForm().getCheckBox("Response").acroField.getFlags()).toBe(0);
  await page.getByRole("button", { name: "Edit form", exact: true }).click();
  await page.getByRole("button", { name: "Prepare for visual signature", exact: true }).click();
  await page.getByRole("button", { name: "Flatten copy", exact: true }).click();
  const flat = await downloadBytes(page, "Download flattened PDF");
  const editablePixels = await inspectArtifact(filled.bytes, undefined, true);
  const flatPixels = await inspectArtifact(flat.bytes);
  for (const [index, rendered] of flatPixels.entries()) {
    expect(rendered.pixels.equals(editablePixels[index]!.pixels)).toBe(true);
  }
});
