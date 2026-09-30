import { expect, test, type Page } from "@playwright/test";
import { openToolSidebar } from "./fixtures/workspaceNavigation";

const observeErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  return errors;
};

for (const theme of ["light", "dark"]) {
  test(`hydration reuses every prerendered page with the ${theme} preference`, async ({ page }) => {
    const errors = observeErrors(page);
    await page.addInitScript((value) => localStorage.setItem("pdfburrow-theme", value), theme);
    for (const path of ["", "sign/", "merge/", "split/", "images/", "404.html"]) {
      let release = () => {};
      const moduleReady = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/assets/main.js", async (route) => {
        await moduleReady;
        await route.continue();
      });
      try {
        await page.goto(`./${path}`, { waitUntil: "commit" });
        const heading = page.locator("#page-heading");
        await expect(heading).toBeVisible();
        const original = await heading.elementHandle();
        expect(original).not.toBeNull();
        release();
        await expect.poll(() => page.evaluate(() => history.state?.owner)).toBe("pdfburrow");
        await openToolSidebar(page);
        await expect(page.getByRole("switch", { name: "Dark mode", exact: true })).toHaveAttribute(
          "aria-checked",
          String(theme === "dark"),
        );
        expect(await heading.evaluate((current, before) => current === before, original)).toBe(
          true,
        );
        await original?.dispose();
      } finally {
        release();
        await page.unroute("**/assets/main.js");
      }
    }
    expect(errors).toEqual([]);
  });
}

test("legacy bookmarks hydrate the emitted path before applying the requested tool", async ({
  page,
  baseURL,
}) => {
  const errors = observeErrors(page);
  for (const [path, tool, heading] of [
    ["", "merge", "Merge PDFs"],
    ["", "split", "Split / Extract"],
    ["", "images", "Images to PDF"],
    ["images/", "split", "Split / Extract"],
    ["", "unknown", "Tool not found"],
  ] as const) {
    await page.goto(`./${path}#/${tool}`);
    await expect(page.locator("#page-heading")).toHaveText(heading);
    await expect(page).toHaveURL(
      new URL(tool === "unknown" ? "404.html" : `${tool}/`, baseURL).href,
    );
  }
  expect(errors).toEqual([]);
});

for (const [path, capability, warning] of [
  ["merge/", "Worker", "This browser cannot run the local PDF worker."],
  ["split/", "Worker", "This browser cannot run the local PDF worker."],
  ["images/", "createImageBitmap", "This browser cannot convert images locally."],
] as const) {
  test(`${path} reports missing ${capability} after hydration without replacing the page`, async ({
    page,
  }) => {
    const errors = observeErrors(page);
    await page.addInitScript((name) => {
      Object.defineProperty(window, name, { configurable: true, value: undefined });
    }, capability);
    await page.goto(`./${path}`);
    await expect(page.getByRole("alert")).toContainText(warning);
    await expect(page.locator('input[type="file"]')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test("unavailable theme storage is reported after hydration without mismatching the tree", async ({
  page,
}) => {
  const errors = observeErrors(page);
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage unavailable", "SecurityError");
    };
  });
  await page.goto("./");
  await openToolSidebar(page);
  await expect(page.getByRole("alert")).toContainText("Your theme could not be saved");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(errors).toEqual([]);
});
