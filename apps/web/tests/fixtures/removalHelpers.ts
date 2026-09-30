import { expect, type Page } from "@playwright/test";
import { closeToolSettings } from "./toolSettings";

export const generateRemoval = async (page: Page) => {
  await closeToolSettings(page);
  await page.getByRole("checkbox", { name: /I understand these limitations/ }).check();
  await page.getByRole("button", { name: /^(Remove pages|Retry generation)$/ }).click();
  await expect(page.getByRole("heading", { name: "Your PDF is ready", exact: true })).toBeFocused();
};
