import { expect, type Page } from "@playwright/test";

export const openToolSettings = async (page: Page) => {
  const open = page.getByRole("button", { name: "Open settings", exact: true });
  if (await open.isVisible()) {
    await open.click();
  }
  await expect(page.getByRole("heading", { name: /settings$/ })).toBeVisible();
};

export const closeToolSettings = async (page: Page) => {
  const drawer = page.getByRole("dialog", { name: /settings$/ });
  if (await drawer.isVisible()) {
    await drawer.getByRole("button", { name: "Close settings", exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open settings", exact: true })).toBeFocused();
  }
};

export const withToolSettings = async (page: Page, action: () => Promise<unknown>) => {
  await openToolSettings(page);
  await action();
  await closeToolSettings(page);
};

export const setToolOption = async (page: Page, name: string) => {
  await withToolSettings(page, () => page.getByRole("radio", { name, exact: true }).check());
};
