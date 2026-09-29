import { defineConfig, devices } from "@playwright/test";

const basePath = process.env.PDFBURROW_BASE_PATH ?? "/pdfburrow/";
const previewPort = Number(process.env.PDFBURROW_TEST_PORT ?? 4173);
const developmentPort = Number(process.env.PDFBURROW_TEST_DEV_PORT ?? 4174);
if (
  [previewPort, developmentPort].some(
    (port) => !Number.isInteger(port) || port < 1 || port > 65535,
  ) ||
  previewPort === developmentPort
) {
  throw new Error("Browser test ports must be distinct integers between 1 and 65535.");
}
const origin = `http://127.0.0.1:${previewPort}`;
const developmentOrigin = `http://127.0.0.1:${developmentPort}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: { baseURL: `${origin}${basePath}`, trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop-chromium",
      testMatch: [
        "seo.spec.ts",
        "workspace.spec.ts",
        "images.spec.ts",
        "imageLifecycle.spec.ts",
        "imageArtifacts.spec.ts",
        "navigation.spec.ts",
        "shell.spec.ts",
        "theme.spec.ts",
        "downloads.spec.ts",
        "mergeArtifacts.spec.ts",
        "split.spec.ts",
        "splitArtifacts.spec.ts",
        "pageOrdering.spec.ts",
        "previewFeedback.spec.ts",
        "previewRetry.spec.ts",
        "compressedPreviews.spec.ts",
        "resourceLimits.spec.ts",
        "privacy.spec.ts",
      ],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testMatch: [
        "seo.spec.ts",
        "workspace.spec.ts",
        "images.spec.ts",
        "imageLifecycle.spec.ts",
        "imageArtifacts.spec.ts",
        "navigation.spec.ts",
        "shell.spec.ts",
        "theme.spec.ts",
        "downloads.spec.ts",
        "mergeArtifacts.spec.ts",
        "split.spec.ts",
        "splitArtifacts.spec.ts",
        "pageOrdering.spec.ts",
        "previewFeedback.spec.ts",
        "previewRetry.spec.ts",
        "compressedPreviews.spec.ts",
        "resourceLimits.spec.ts",
        "privacy.spec.ts",
      ],
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "desktop-firefox",
      testMatch: [
        "shell.spec.ts",
        "theme.spec.ts",
        "workspace.spec.ts",
        "images.spec.ts",
        "imageLifecycle.spec.ts",
        "imageArtifacts.spec.ts",
        "mergeArtifacts.spec.ts",
        "split.spec.ts",
        "splitArtifacts.spec.ts",
        "pageOrdering.spec.ts",
        "previewFeedback.spec.ts",
        "previewRetry.spec.ts",
        "compressedPreviews.spec.ts",
        "resourceLimits.spec.ts",
        "privacy.spec.ts",
      ],
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "desktop-webkit",
      testMatch: [
        "shell.spec.ts",
        "theme.spec.ts",
        "workspace.spec.ts",
        "images.spec.ts",
        "imageLifecycle.spec.ts",
        "imageArtifacts.spec.ts",
        "mergeArtifacts.spec.ts",
        "split.spec.ts",
        "splitArtifacts.spec.ts",
        "pageOrdering.spec.ts",
        "previewFeedback.spec.ts",
        "previewRetry.spec.ts",
        "compressedPreviews.spec.ts",
        "resourceLimits.spec.ts",
        "privacy.spec.ts",
      ],
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "development-chromium",
      testMatch: ["development.spec.ts", "compressedPreviews.spec.ts", "seo.spec.ts"],
      use: { ...devices["Desktop Chrome"], baseURL: `${developmentOrigin}${basePath}` },
    },
  ],
  webServer: [
    {
      command: `node ../../common/scripts/install-run-rushx.js preview --port ${previewPort}`,
      url: `${origin}${basePath}`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `node ../../common/scripts/install-run-rushx.js dev --port ${developmentPort}`,
      url: `${developmentOrigin}${basePath}`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
