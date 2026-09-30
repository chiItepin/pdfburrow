import { expect, test } from "@playwright/test";
import { closeToolSidebar, navigateToTool, openToolSidebar } from "./fixtures/workspaceNavigation";
import { addSplitSource } from "./fixtures/splitHelpers";
import {
  closeToolSettings,
  openToolSettings,
  setToolOption,
  withToolSettings,
} from "./fixtures/toolSettings";

test("sidebar and page breadcrumbs identify every tool without a top navigation bar", async ({
  page,
}) => {
  await page.goto("./");
  for (const name of [
    "Sign & annotate PDF",
    "Merge PDFs",
    "Split / Extract",
    "Images to PDF",
    "Home",
  ]) {
    await navigateToTool(page, name);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(page.locator("header").getByRole("navigation")).toHaveCount(1);
    await openToolSidebar(page);
    const nav = page.getByRole("navigation", { name: "PDF tools", exact: true });
    await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link")).toHaveCount(5);
    await closeToolSidebar(page);
  }
});

test("theme switch works by keyboard, persists, and follows the user across tools", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("pdfburrow-theme"))).toBeNull();
  await openToolSidebar(page);
  const themeSwitch = page.getByRole("switch", { name: "Dark mode", exact: true });
  await themeSwitch.focus();
  await page.keyboard.press("Space");
  await expect(themeSwitch).not.toBeChecked();
  await closeToolSidebar(page);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await openToolSidebar(page);
  await themeSwitch.focus();
  await page.keyboard.press("Space");
  await expect(themeSwitch).toBeChecked();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await closeToolSidebar(page);
  await navigateToTool(page, "Split / Extract");
  await addSplitSource(page, 2);
  await expect(page.locator("#page-1")).toHaveCSS("background-color", "rgb(32, 37, 41)");
  await withToolSettings(page, async () => {
    await page.getByRole("radio", { name: "Fixed page-count groups", exact: true }).check();
    await expect(page.getByRole("spinbutton", { name: "Pages per PDF" })).toHaveCSS(
      "background-color",
      "rgb(32, 37, 41)",
    );
  });
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCSS("color", "rgb(237, 240, 242)");
  await expect(page.getByRole("button", { name: "Discard", exact: true })).toHaveCSS(
    "color",
    "rgb(25, 29, 32)",
  );
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await openToolSidebar(page);
  await expect(themeSwitch).toBeChecked();
  await themeSwitch.focus();
  await page.keyboard.press("Space");
  await expect(themeSwitch).not.toBeChecked();
  await closeToolSidebar(page);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
});

test("unavailable preference storage is reported without breaking the theme switch", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage unavailable", "SecurityError");
    };
  });
  await page.goto("./");
  await openToolSidebar(page);
  await page.getByRole("switch", { name: "Dark mode", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.getByRole("alert")).toContainText("Your theme could not be saved");
});

test("compact breadcrumbs preserve discard confirmation and restore focus", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("./#/split");
  await addSplitSource(page, 1);
  const more = page.getByRole("button", { name: "Show breadcrumb navigation" });
  await more.click();
  await page.getByRole("menuitem", { name: "PDFBurrow home" }).click();
  await expect(page.getByRole("button", { name: "Keep working" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await expect(page).toHaveURL(/\/split\/$/);
  await more.click();
  await page.getByRole("menuitem", { name: "PDFBurrow home" }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(new URL("./", test.info().project.use.baseURL).href);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
});

test("mobile drawer traps focus, dismisses safely, and adapts when resized", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("./#/merge");
  const trigger = page.getByRole("button", { name: "Open sidebar", exact: true });
  await expect(trigger.locator("svg")).toHaveClass(/lucide-panel-left-open/);
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "PDF tools", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleDescription(
    "Choose a document tool or change the color theme.",
  );
  await expect(page.locator('[data-slot="sidebar-trigger"] svg')).toHaveClass(
    /lucide-panel-left-close/,
  );
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press("Tab");
    await expect(dialog.locator(":focus")).toHaveCount(1);
  }
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/merge\/$/);
  await trigger.click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "PDF tools", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add PDFs" }).focus();
  await expect(page.getByRole("button", { name: "Add PDFs" })).toBeFocused();
});

test("tool layout fits narrow, tablet, and desktop widths without horizontal overflow", async ({
  page,
}) => {
  await page.goto("./#/merge");
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await expect(page.locator("[data-settings-docked]")).toHaveCount(width >= 1280 ? 1 : 0);
    await expect(page.getByRole("button", { name: "Open settings", exact: true })).toBeVisible({
      visible: width < 1280,
    });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (width >= 768) {
      const leftHeader = await page.locator('[data-slot="sidebar-header"]').boundingBox();
      const mainHeader = await page.locator("main > header").boundingBox();
      expect(mainHeader!.y + mainHeader!.height).toBe(leftHeader!.y + leftHeader!.height);
      await expect(page.locator('[data-slot="sidebar-wrapper"]')).toHaveCSS(
        "border-top-width",
        "0px",
      );
      await expect(page.locator('[data-slot="sidebar-wrapper"]')).toHaveCSS(
        "border-bottom-width",
        "0px",
      );
      await expect(page.locator("main footer")).toHaveCSS("border-top-width", "0px");
    }
    await expect(page.getByRole("button", { name: "Show breadcrumb navigation" })).toBeVisible({
      visible: width < 640,
    });
  }
});

test("right settings sidebar can be collapsed, scrolled independently, and reopened without resetting options", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 720 });
  await page.goto("./#/images");
  const dock = page.getByRole("complementary", { name: "Image PDF settings", exact: true });
  await expect(dock).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close settings", exact: true }).locator("svg"),
  ).toHaveClass(/lucide-panel-right-close/);
  const content = page.locator("[data-workspace-content]");
  const narrow = await content.boundingBox();
  await setToolOption(page, "One PDF per image");
  await setToolOption(page, "Large (20 mm)");
  expect(
    await dock
      .locator("div")
      .first()
      .evaluate((el) => el.scrollTop),
  ).toBeGreaterThan(0);
  expect(await page.locator("[data-workspace-scroll]").evaluate((el) => el.scrollTop)).toBe(0);
  await page.getByRole("button", { name: "Close settings", exact: true }).click();
  await expect(dock).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open settings", exact: true }).locator("svg"),
  ).toHaveClass(/lucide-panel-right-open/);
  const wide = await content.boundingBox();
  expect(wide!.width - narrow!.width).toBeGreaterThan(250);
  await openToolSettings(page);
  await expect(page.getByRole("radio", { name: "One PDF per image", exact: true })).toBeChecked();
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.getByRole("button", { name: "Open settings", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await openToolSettings(page);
  const drawer = page.getByRole("dialog", { name: "Image PDF settings", exact: true });
  await expect(drawer).toBeVisible();
  await expect(page.getByRole("radio", { name: "Large (20 mm)", exact: true })).toBeChecked();
  await page.getByRole("radio", { name: "Image size (96 pixels per inch)", exact: true }).check();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open settings", exact: true })).toBeFocused();
  await openToolSettings(page);
  await expect(
    page.getByRole("radio", { name: "Image size (96 pixels per inch)", exact: true }),
  ).toBeChecked();
  await closeToolSettings(page);
  await expect(page.getByRole("button", { name: "Convert to PDF", exact: true })).toBeVisible();
});

test("scrolling stays inside the rounded shell without moving headers or painting through corners", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto("./");
  const shell = page.locator('[data-slot="sidebar-wrapper"]');
  const header = page.locator("main > header");
  const content = page.locator("[data-workspace-scroll]");
  const initialShell = await shell.boundingBox();
  const initialHeader = await header.boundingBox();
  await page.mouse.move(850, 400);
  await page.mouse.wheel(0, 1400);
  await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(await shell.boundingBox()).toEqual(initialShell);
  expect(await header.boundingBox()).toEqual(initialHeader);
  expect(initialShell!.y + initialShell!.height).toBe(584);
  expect(
    await shell.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return [
        [rect.right - 1, rect.top + 1],
        [rect.right - 1, rect.bottom - 1],
      ].every(([x, y]) => !el.contains(document.elementFromPoint(x!, y!)));
    }),
  ).toBe(true);
});
