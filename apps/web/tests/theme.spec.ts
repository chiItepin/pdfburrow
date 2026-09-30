import { expect, test } from "@playwright/test";
import { openToolSidebar } from "./fixtures/workspaceNavigation";
import { addSplitSource } from "./fixtures/splitHelpers";
import { openToolSettings } from "./fixtures/toolSettings";

const luminance = (color: string) => {
  const channels = color.match(/\d+(?:\.\d+)?/g);
  if (!channels || channels.length !== 3) {
    throw new Error(`Expected an opaque RGB color, received ${color}`);
  }
  return channels.reduce((sum, channel, index) => {
    const value = Number(channel) / 255;
    const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    const weight = index === 0 ? 0.2126 : index === 1 ? 0.7152 : 0.0722;
    return sum + linear * weight;
  }, 0);
};

for (const preference of [null, "light", "dark", "invalid"]) {
  test(`saved theme ${preference ?? "unset"} applies before the app module loads`, async ({
    page,
  }) => {
    await page.addInitScript((value) => {
      if (value !== null) {
        localStorage.setItem("pdfburrow-theme", value);
      }
    }, preference);
    await page.route("**/assets/main.js", (route) => route.abort());
    await page.goto("./");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Home");
    if (preference === "light") {
      await expect(page.locator("html")).not.toHaveClass(/dark/);
    } else {
      await expect(page.locator("html")).toHaveClass(/dark/);
    }
    await expect(page.locator("html")).toHaveCSS(
      "color-scheme",
      preference === "light" ? "light" : "dark",
    );
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      preference === "light" ? "#ffffff" : "#191d20",
    );
  });
}

test("theme color follows toggles, reloads, and cross-tab preference changes", async ({
  page,
  context,
}) => {
  await page.goto("./");
  const other = await context.newPage();
  await other.goto("./");
  await openToolSidebar(page);
  const toggle = page.getByRole("switch", { name: "Dark mode", exact: true });
  await toggle.click();
  for (const tab of [page, other]) {
    await expect(tab.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#ffffff");
    await expect(tab.locator("html")).toHaveCSS("color-scheme", "light");
  }
  await page.reload();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#ffffff");
  await other.evaluate(() => localStorage.clear());
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#191d20");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
});

test("unreadable theme storage keeps the dark default and reports the failure", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage unavailable", "SecurityError");
    };
  });
  await page.goto("./");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#191d20");
  await openToolSidebar(page);
  await expect(page.getByRole("alert")).toContainText("Your theme could not be saved");
});

for (const theme of ["light", "dark"]) {
  test(`${theme} input boundaries have at least 3:1 contrast`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("pdfburrow-theme", value), theme);
    await page.goto("./#/split");
    await addSplitSource(page, 1);
    await openToolSettings(page);
    await page.getByRole("radio", { name: "Fixed page-count groups", exact: true }).check();
    const input = page.getByRole("spinbutton", { name: "Pages per PDF" });
    const colors = await input.evaluate((element) => {
      const style = getComputedStyle(element);
      return { border: style.borderTopColor, background: style.backgroundColor };
    });
    const border = luminance(colors.border);
    const background = luminance(colors.background);
    const contrast = (Math.max(border, background) + 0.05) / (Math.min(border, background) + 0.05);
    expect(contrast).toBeGreaterThanOrEqual(3);
    await page.getByRole("radio", { name: "Custom ranges", exact: true }).check();
    const addRange = page.getByRole("button", { name: "Add range", exact: true });
    await expect(addRange).toHaveCSS("border-top-color", colors.border);
    await addRange.click();
    for (const field of ["start", "end"]) {
      await expect(page.getByRole("spinbutton", { name: `Range 1 ${field} page` })).toHaveCSS(
        "border-top-color",
        colors.border,
      );
    }
  });
}
