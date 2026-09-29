import { defineConfig, devices } from "@playwright/test";

const basePath = process.env.PDFBURROW_BASE_PATH ?? "/pdfburrow/";
const port = Number(process.env.PDFBURROW_TEST_PORT ?? "4173");
if (!Number.isInteger(port) || port < 1 || port > 65534) {
  throw new Error("PDFBURROW_TEST_PORT must be an integer from 1 to 65534.");
}
const origin = `http://127.0.0.1:${port}`;
const developmentOrigin = `http://127.0.0.1:${port + 1}`;

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
        "downloads.spec.ts",
        "mergeArtifacts.spec.ts",
        "split.spec.ts",
        "splitArtifacts.spec.ts",
        "pageOrdering.spec.ts",
        "previewFeedback.spec.ts",
        "previewRetry.spec.ts",
        "compressedPreviews.spec.ts",
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
        "downloads.spec.ts",
        "mergeArtifacts.spec.ts",
        "split.spec.ts",
        "splitArtifacts.spec.ts",
        "pageOrdering.spec.ts",
        "previewFeedback.spec.ts",
        "previewRetry.spec.ts",
        "compressedPreviews.spec.ts",
      ],
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "desktop-firefox",
      testMatch: [
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
      ],
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "desktop-webkit",
      testMatch: [
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
      command: `node ../../common/scripts/install-run-rushx.js preview --port ${port}`,
      url: `${origin}${basePath}`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `node ../../common/scripts/install-run-rushx.js dev --port ${port + 1}`,
      url: `${developmentOrigin}${basePath}`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
