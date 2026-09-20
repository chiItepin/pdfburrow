import { expect, test } from "@playwright/test";

test("shared UI renders with production styles and keyboard access", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "PDFBurrow", exact: true })).toBeVisible();
  await expect(page.getByText("Merge, split, and image conversion", { exact: false })).toBeVisible();
  const button = page.getByRole("button", { name: "Check local worker" });
  await expect(button).toHaveCSS("background-color", "rgb(32, 91, 73)");
  await expect(page.getByRole("main")).toHaveCSS("max-width", "768px");
  await expect(page.getByRole("heading", { name: "Workspace foundation" })).toHaveCSS("font-size", "20px");
  await page.keyboard.press("Tab");
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Local worker responded. No documents were processed.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("engine is lazy and the emitted worker loads locally under the configured base", async ({ page, baseURL }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("./");
  expect(requests.some((url) => url.includes("diagnostics"))).toBe(false);
  await page.getByRole("button", { name: "Check local worker" }).click();
  await expect(page.getByRole("status")).toHaveText("Local worker responded. No documents were processed.");
  expect(requests.some((url) => url.includes("diagnostics.worker-"))).toBe(true);
  expect(requests.some((url) => /\/diagnostics-[^/]+\.js$/u.test(url))).toBe(true);
  expect(requests.every((url) => url.startsWith(baseURL!))).toBe(true);
  await page.getByRole("button", { name: "Check local worker" }).click();
  await expect(page.getByRole("status")).toHaveText("Local worker responded. No documents were processed.");
});

test("worker loading failures are visible and recover on retry", async ({ page }) => {
  await page.route("**/diagnostics.worker-*.js", (route) => route.abort());
  await page.goto("./");
  await page.getByRole("button", { name: "Check local worker" }).click();
  await expect(page.getByRole("status")).toContainText("could not load");
  await expect(page.getByRole("button", { name: "Check local worker" })).toBeEnabled();
  await page.unroute("**/diagnostics.worker-*.js");
  await page.getByRole("button", { name: "Check local worker" }).click();
  await expect(page.getByRole("status")).toHaveText("Local worker responded. No documents were processed.");
});

test("worker timeouts are visible rather than leaving the control stuck", async ({ page }) => {
  await page.route("**/diagnostics.worker-*.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "/* deliberately silent test worker */" }));
  await page.goto("./");
  await page.clock.install();
  const workerRequest = page.waitForRequest("**/diagnostics.worker-*.js");
  await page.getByRole("button", { name: "Check local worker" }).click();
  await workerRequest;
  await expect(page.getByRole("button", { name: "Checking worker..." })).toBeDisabled();
  await page.clock.fastForward(10_001);
  await expect(page.getByRole("status")).toContainText("did not respond");
  await expect(page.getByRole("button", { name: "Check local worker" })).toBeEnabled();
});
