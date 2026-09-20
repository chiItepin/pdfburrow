import { defineConfig, devices } from "@playwright/test";

const basePath = process.env.PDFBURROW_BASE_PATH ?? "/pdfburrow/";
const origin = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: { baseURL: `${origin}${basePath}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node ../../common/scripts/install-run-rushx.js preview --port 4173 --strictPort",
    url: `${origin}${basePath}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
