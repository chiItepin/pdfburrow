import { expect, test } from "@playwright/test";
import type { Download, Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { createPublicKey, verify } from "node:crypto";
import { createSealKey, createPersonalSeal } from "../../../packages/pdf-engine/src/personalSeal";
import { parseProof, recordBytes } from "../../../packages/pdf-engine/src/sealFormat";
import { navigateToTool } from "./fixtures/workspaceNavigation";

const password = "a unique private browser passphrase";
const source = async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 400]);
  return Buffer.from(await pdf.save());
};
const downloadedBytes = async (download: Download) => {
  const path = await download.path();
  if (!path) {
    throw new Error("The requested download is missing.");
  }
  return readFile(path);
};
const choosePdf = (page: Page, bytes: Buffer) =>
  page.getByLabel("PDF to seal or verify").setInputFiles({
    name: "private-contract.pdf",
    mimeType: "application/pdf",
    buffer: bytes,
  });
const reset = async (page: Page) => {
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start over", exact: true }).click();
};
const verifyFiles = async (page: Page, pdf: Buffer, proof: Buffer, fingerprint = "") => {
  await page.getByRole("radio", { name: "Verify seal", exact: true }).check();
  await choosePdf(page, pdf);
  await page.getByLabel("Seal proof file", { exact: true }).setInputFiles({
    name: "private-contract.proof.json",
    mimeType: "application/json",
    buffer: proof,
  });
  await page.getByLabel("Trusted signer fingerprint (optional)").fill(fingerprint);
  await page.getByRole("button", { name: "Verify proof", exact: true }).click();
};

test("create an encrypted key and independently verifiable proof with explicit downloads, no storage or uploads", async ({
  page,
  context,
  browserName,
}, testInfo) => {
  const requests: string[] = [];
  const failures: string[] = [];
  const downloads: Download[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" || request.postData() !== null) {
      failures.push(request.url());
    }
    requests.push(request.url());
  });
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("download", (download) => downloads.push(download));
  const pdf = await source();
  await page.goto("./");
  await page.getByRole("link", { name: "Open Personal seal", exact: true }).click();
  await choosePdf(page, pdf);
  await page.getByLabel("Key password", { exact: true }).fill(password);
  await page.getByLabel("Repeat password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create signing key", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download encrypted key" })).toBeEnabled();
  const fingerprint = await page
    .locator("p")
    .filter({ hasText: /^SHA256:[a-f0-9]{64}$/ })
    .innerText();
  expect(downloads).toHaveLength(0);
  await expect(page.getByRole("button", { name: "Create proof", exact: true })).toBeDisabled();
  const keyDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download encrypted key" }).click();
  const key = await downloadedBytes(await keyDownload);
  expect(key.toString()).not.toContain(password);
  await page.getByRole("button", { name: "Create proof", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download proof", exact: true })).toBeEnabled();
  expect(downloads).toHaveLength(1);
  const proofDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download proof", exact: true }).click();
  const output = await proofDownload;
  expect(output.suggestedFilename()).toBe("private-contract.proof.json");
  const proof = await downloadedBytes(output);
  const parsed = parseProof(JSON.parse(proof.toString()));
  expect(
    verify(
      "sha256",
      recordBytes(parsed),
      {
        key: createPublicKey({
          key: Buffer.from(parsed.publicKey, "base64"),
          type: "spki",
          format: "der",
        }),
        dsaEncoding: "ieee-p1363",
      },
      Buffer.from(parsed.signature, "base64"),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
  ).toEqual({ local: 0, session: 0 });
  await reset(page);
  if (!(browserName === "webkit" && process.platform === "darwin")) {
    await context.setOffline(true);
  }
  await verifyFiles(page, pdf, proof, fingerprint);
  await expect(
    page.getByRole("heading", { name: "Document unchanged. Trusted key matched." }),
  ).toBeVisible();
  await page.getByRole("region", { name: "Seal the bytes, not just the page" }).screenshot({
    path: testInfo.outputPath("personal-seal.png"),
  });
  expect(requests.join(" ")).not.toContain("private-contract");
  expect(requests.join(" ")).not.toContain(password);
  expect(failures).toEqual([]);
});

test("import a reusable encrypted key, reject wrong passwords, verify tampering and signer substitution", async ({
  page,
}) => {
  const pdf = await source();
  const key = await createSealKey(password);
  const proof = Buffer.from(
    await (await createPersonalSeal(new Blob([new Uint8Array(pdf)]), key.signer)).arrayBuffer(),
  );
  await page.goto("./seal/");
  await choosePdf(page, pdf);
  await page.getByLabel("Encrypted key file (optional)").setInputFiles({
    name: "personal-seal-key.json",
    mimeType: "application/json",
    buffer: Buffer.from(await key.backup.arrayBuffer()),
  });
  await page.getByLabel("Key password", { exact: true }).fill("a wrong but lengthy password");
  await page.getByRole("button", { name: "Unlock signing key", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("password is incorrect");
  await expect(page.getByRole("alert")).toBeFocused();
  await page.getByLabel("Key password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Unlock signing key", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create proof", exact: true })).toBeEnabled();
  await expect(page.getByText(key.signer.fingerprint, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create proof", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download proof", exact: true })).toBeEnabled();
  await reset(page);
  const changed = Buffer.from(pdf);
  changed[changed.length - 5] = changed[changed.length - 5]! ^ 1;
  await verifyFiles(page, changed, proof);
  await expect(page.getByRole("alert")).toContainText("Document mismatch");
  await reset(page);
  await verifyFiles(page, pdf, proof);
  await expect(
    page.getByRole("heading", { name: "Document unchanged. Signer identity unconfirmed." }),
  ).toBeVisible();
  await page.getByLabel("Trusted signer fingerprint (optional)").fill("0".repeat(64));
  await expect(page.getByRole("heading", { name: /Document unchanged/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Verify proof", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Document unchanged, but signer key does not match." }),
  ).toBeVisible();
  await page.getByLabel("Trusted signer fingerprint (optional)").fill("SHA256:");
  await page.getByRole("button", { name: "Verify proof", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("exactly 64 hexadecimal");
});

test("navigation and reset protect key drafts, and confirmed discard or reload clears all local work", async ({
  page,
}) => {
  await page.goto("./seal/");
  await page.getByLabel("Key password", { exact: true }).fill(password);
  await navigateToTool(page, "Merge PDFs");
  await expect(page.getByRole("button", { name: "Keep working", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Keep working", exact: true }).click();
  await expect(page.getByLabel("Key password", { exact: true })).toHaveValue(password);
  await navigateToTool(page, "Merge PDFs");
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await navigateToTool(page, "Personal seal");
  await expect(page.getByLabel("Key password", { exact: true })).toHaveValue("");
  await page.getByLabel("Key password", { exact: true }).fill(password);
  await page.reload();
  await expect(page.getByLabel("Key password", { exact: true })).toHaveValue("");
  await choosePdf(page, await source());
  await reset(page);
  await expect(page.getByLabel("PDF to seal or verify")).toBeFocused();
  await expect(page.getByLabel("PDF to seal or verify")).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("malformed proofs, oversized inputs, unsupported Web Crypto and mismatched passwords fail explicitly", async ({
  page,
}) => {
  await page.goto("./seal/");
  await page.getByLabel("Key password", { exact: true }).fill(password);
  await page.getByLabel("Repeat password", { exact: true }).fill("a different long password");
  await page.getByRole("button", { name: "Create signing key", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("passwords do not match");
  await reset(page);
  await verifyFiles(page, await source(), Buffer.from("{}"));
  await expect(page.getByRole("alert")).toContainText("Invalid seal proof fields");
  await page.getByLabel("Seal proof file", { exact: true }).setInputFiles({
    name: "too-big.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(16385),
  });
  await expect(page.getByRole("alert")).toContainText("16 KiB");
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, "subtle", { configurable: true, value: undefined });
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("local Web Crypto");
  await expect(page.getByLabel("PDF to seal or verify")).toBeDisabled();
});

test("seal form uses shadcn primitives with labelled inputs and keyboard radio navigation", async ({
  page,
}) => {
  await page.goto("./seal/");
  const create = page.getByRole("radio", { name: "Create seal", exact: true });
  const verify = page.getByRole("radio", { name: "Verify seal", exact: true });
  await expect(page.getByRole("radiogroup", { name: "Personal seal operation" })).toHaveAttribute(
    "data-slot",
    "radio-group",
  );
  for (const label of [
    "PDF to seal or verify",
    "Encrypted key file (optional)",
    "Key password",
    "Repeat password",
  ]) {
    const input = page.getByLabel(label, { exact: true });
    await expect(input).toHaveAttribute("data-slot", "input");
    await expect(input).toHaveAccessibleName(label);
  }
  await expect(create).toHaveAttribute("data-slot", "radio-group-item");
  await expect(verify).toHaveAttribute("data-slot", "radio-group-item");
  await create.focus();
  // Radix moves focus asynchronously and selects while the arrow key is held.
  await page.keyboard.down("ArrowRight");
  try {
    await expect(verify).toBeFocused();
    await expect(verify).toBeChecked();
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  for (const label of ["Seal proof file", "Trusted signer fingerprint (optional)"]) {
    await expect(page.getByLabel(label, { exact: true })).toHaveAttribute("data-slot", "input");
  }
  await page.keyboard.down("ArrowLeft");
  try {
    await expect(create).toBeFocused();
    await expect(create).toBeChecked();
  } finally {
    await page.keyboard.up("ArrowLeft");
  }
  await page.getByText("Key password", { exact: true }).click();
  await expect(page.getByLabel("Key password", { exact: true })).toBeFocused();
});

test("shadcn controls remain locked while a signing key is generated", async ({ page }) => {
  await page.addInitScript(() => {
    const deriveKey = crypto.subtle.deriveKey.bind(crypto.subtle);
    crypto.subtle.deriveKey = async (...args) => {
      await new Promise<void>((resolve) => {
        document.addEventListener("release-key-generation", () => resolve(), { once: true });
      });
      return deriveKey(...args);
    };
  });
  await page.goto("./seal/");
  await page.getByLabel("Key password", { exact: true }).fill(password);
  await page.getByLabel("Repeat password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create signing key", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Working locally");
  for (const mode of ["Create seal", "Verify seal"]) {
    await expect(page.getByRole("radio", { name: mode, exact: true })).toBeDisabled();
  }
  for (const label of ["PDF to seal or verify", "Key password", "Repeat password"]) {
    await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
  }
  await page.evaluate(() => document.dispatchEvent(new Event("release-key-generation")));
  await expect(page.getByRole("button", { name: "Download encrypted key" })).toBeEnabled();
  await expect(page.getByRole("radio", { name: "Verify seal", exact: true })).toBeEnabled();
});

test("password hints appear below inputs, are accessible, and explain the 12-character threshold", async ({
  page,
}) => {
  await page.goto("./seal/");
  for (const [label, hint] of [
    ["Key password", "Use at least 12 characters. A long, unique passphrase is safer."],
    ["Repeat password", "Enter the same password again."],
  ] as const) {
    const input = page.getByLabel(label, { exact: true });
    const description = page.getByText(hint, { exact: true });
    await expect(description).toBeVisible();
    await expect(description).toHaveAttribute("data-slot", "field-description");
    await expect(input).toHaveAccessibleDescription(hint);
    const field = page.locator('[data-slot="field"]').filter({ has: input });
    await expect(field.locator('[data-slot="field-label"]')).toHaveText(label);
    const inputBox = await input.boundingBox();
    const descriptionBox = await description.boundingBox();
    expect(inputBox).not.toBeNull();
    expect(descriptionBox).not.toBeNull();
    expect(descriptionBox!.y).toBeGreaterThanOrEqual(inputBox!.y + inputBox!.height);
  }
  const input = page.getByLabel("Key password", { exact: true });
  const repeat = page.getByLabel("Repeat password", { exact: true });
  const create = page.getByRole("button", { name: "Create signing key", exact: true });
  await input.fill("a".repeat(11));
  await repeat.fill("a".repeat(11));
  await expect(create).toBeDisabled();
  await input.fill("a".repeat(12));
  await repeat.fill("a".repeat(12));
  await expect(create).toBeEnabled();

  await page.getByLabel("Encrypted key file (optional)").setInputFiles({
    name: "key.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(repeat).toHaveCount(0);
  await expect(page.getByText("Enter the same password again.", { exact: true })).toHaveCount(0);
  await expect(input).toHaveAccessibleDescription(
    "Use at least 12 characters. A long, unique passphrase is safer.",
  );
  await expect(page.getByRole("button", { name: "Unlock signing key", exact: true })).toBeEnabled();
});
