import { expect, test, type BrowserContext, type Request } from "@playwright/test";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { navigateToTool } from "./fixtures/workspaceNavigation";
import {
  exercisePrivateWorkflows,
  privateMarker,
  privacyInputs,
  resetPrivacyDraft,
} from "./fixtures/privacyWorkflows";

const observeRequests = (context: BrowserContext) => {
  const requests: {
    url: string;
    method: string;
    body: string | null;
    headers: Record<string, string>;
  }[] = [];
  const record = (request: Request) =>
    requests.push({
      url: request.url(),
      method: request.method(),
      body: request.postData(),
      headers: request.headers(),
    });
  context.on("request", record);
  const sockets: string[] = [];
  context.on("page", (page) => page.on("websocket", (socket) => sockets.push(socket.url())));
  return { requests, sockets };
};

test("document success, failures, cancellation and reset request only static assets", async ({
  page,
  context,
  baseURL,
  browser,
}, testInfo) => {
  const files = await readdir(new URL("../dist/", import.meta.url), { recursive: true });
  const allowed = new Set(files.map((file) => new URL(file, baseURL).href));
  allowed.add(baseURL!);
  const observed = observeRequests(context);
  page.on("websocket", (socket) => observed.sockets.push(socket.url()));
  const forbidden: string[] = [];
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    url.hash = "";
    const localBlob = url.protocol === "blob:" && url.origin === new URL(baseURL!).origin;
    if (
      request.method() !== "GET" ||
      request.postData() !== null ||
      (!localBlob && !allowed.has(url.href))
    ) {
      forbidden.push(request.url());
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.goto("./#/merge");
  const inputs = await privacyInputs(page);
  await exercisePrivateWorkflows(page, inputs);
  await navigateToTool(page, "Merge PDFs");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Merge PDFs");
  await page.locator('input[type="file"]').setInputFiles({
    name: `${privateMarker}-corrupt.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.getByText("This file is not a PDF.", { exact: false })).toBeVisible();
  await resetPrivacyDraft(page);
  await page.locator('input[type="file"]').setInputFiles(inputs.pdf);
  await expect(page.getByRole("img", { name: `First page of ${inputs.pdf.name}` })).toBeVisible();
  // Fault injection isolates cancellation while the real validation and preview paths stay intact.
  await page.route("**/merge.worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "self.onmessage = () => { while (true) {} };",
    }),
  );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  await page.getByRole("button", { name: "Cancel merge", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Merge cancelled");
  await page.unroute("**/merge.worker.js");
  await resetPrivacyDraft(page);
  await exercisePrivateWorkflows(page, inputs);
  expect(forbidden).toEqual([]);
  expect(observed.sockets).toEqual([]);
  expect(JSON.stringify(observed.requests)).not.toContain(privateMarker);
  expect(observed.requests.every(({ method, body }) => method === "GET" && body === null)).toBe(
    true,
  );
  expect(await context.cookies()).toEqual([]);
  await testInfo.attach("privacy-evidence", {
    contentType: "application/json",
    body: JSON.stringify({
      browser: browser.version(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      fixtureSha256: Object.fromEntries(
        Object.entries(inputs).map(([name, file]) => [
          name,
          createHash("sha256").update(file.buffer).digest("hex"),
        ]),
      ),
      ...observed,
      forbidden,
      injectedFault: "nonterminating merge worker for cancellation only",
    }),
  });
});

test("warmed real workers complete PDF, image and ZIP jobs with the network offline", async ({
  page,
  context,
  browser,
  browserName,
}, testInfo) => {
  test.skip(
    browserName === "webkit" && process.platform === "darwin",
    "macOS Playwright WebKit offline mode blocks local Blob reads. Physical Safari/offline evidence remains pending.",
  );
  const observed = observeRequests(context);
  await page.goto("./#/merge");
  const inputs = await privacyInputs(page);
  await exercisePrivateWorkflows(page, inputs);
  await context.setOffline(true);
  await exercisePrivateWorkflows(page, inputs);
  expect(JSON.stringify(observed.requests)).not.toContain(privateMarker);
  await testInfo.attach("privacy-evidence", {
    contentType: "application/json",
    body: JSON.stringify({
      browser: browser.version(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      offline: true,
      mode: "real HTTP asset cache, no request replay or mocked workers",
      fixtureSha256: Object.fromEntries(
        Object.entries(inputs).map(([name, file]) => [
          name,
          createHash("sha256").update(file.buffer).digest("hex"),
        ]),
      ),
    }),
  });
});
