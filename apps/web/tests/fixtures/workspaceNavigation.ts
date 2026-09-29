import { expect, type Page } from "@playwright/test";

export const openToolSidebar = async (page: Page) => {
  const trigger = page.getByRole("button", { name: "Open sidebar", exact: true });
  if (await trigger.isVisible()) {
    await trigger.click();
  }
  await expect(page.getByRole("navigation", { name: "PDF tools", exact: true })).toBeVisible();
};

export const closeToolSidebar = async (page: Page) => {
  const close = page.getByRole("button", { name: "Close sidebar", exact: true });
  if (await close.isVisible()) {
    await close.click();
    await expect(page.getByRole("dialog", { name: "PDF tools", exact: true })).toHaveCount(0);
  }
};

export const navigateToTool = async (page: Page, name: string) => {
  await openToolSidebar(page);
  await page
    .getByRole("navigation", { name: "PDF tools", exact: true })
    .getByRole("link", { name, exact: true })
    .click();
};
