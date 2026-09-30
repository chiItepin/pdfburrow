import { expect, test } from "@playwright/test";
import { navigateToTool } from "./fixtures/workspaceNavigation";

const basePath = process.env.PDFBURROW_BASE_PATH ?? "/pdfburrow/";
const siteOrigin = process.env.PDFBURROW_SITE_ORIGIN ?? "https://chiitepin.github.io";
const pages = [
  ["", "Home"],
  ["sign/", "Sign & annotate PDF"],
  ["merge/", "Merge PDFs"],
  ["split/", "Split / Extract"],
  ["images/", "Images to PDF"],
  ["privacy.html", "Your documents stay on your device"],
  ["notices.html", "Licenses and notices"],
  ["limits.html", "Provisional workload limits"],
] as const;

test("search pages contain readable content, crawlable links and unique metadata without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  try {
    for (const [path, heading] of pages) {
      const response = await page.goto(`./${path}`);
      expect(response?.status()).toBe(200);
      expect(await response!.text()).not.toMatch(/%[A-Z_]+%/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      const title = await page.title();
      titles.add(title);
      const description = await page.locator('meta[name="description"]').getAttribute("content");
      expect(description?.length).toBeGreaterThan(60);
      descriptions.add(description!);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `${siteOrigin}${basePath}${path}`,
      );
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", title);
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
        "content",
        description!,
      );
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        "content",
        `${siteOrigin}${basePath}${path}`,
      );
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary");
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
      if (!path.endsWith(".html")) {
        await expect(page.locator("noscript p")).toBeVisible();
        await expect(page.locator("noscript p")).toContainText("Enable JavaScript");
        await expect(page.getByText("Your theme could not be saved", { exact: false })).toHaveCount(
          0,
        );
        await expect(page.getByText(/This browser cannot (?:run|convert)/)).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: "Merge PDFs", exact: true, includeHidden: true }),
        ).toHaveAttribute("href", `${basePath}merge/`);
        const schema = JSON.parse((await page.locator("#page-schema").textContent())!);
        expect(schema["@type"]).toBe(path ? "SoftwareApplication" : "WebSite");
        expect(schema.url).toBe(`${siteOrigin}${basePath}${path}`);
        if (path) {
          await expect(page.getByRole("heading", { name: /^How to/ })).toBeVisible();
          const guide = page.getByRole("region", { name: /^How to/ });
          await expect(guide.getByRole("list")).toHaveJSProperty("tagName", "OL");
          await expect(guide.getByRole("listitem")).toHaveCount(3);
          expect(schema.offers.price).toBe("0");
          expect(schema.aggregateRating).toBeUndefined();
        }
      }
    }
    expect(titles.size).toBe(pages.length);
    expect(descriptions.size).toBe(pages.length);
    await page.goto("./");
    await page.getByRole("link", { name: "Open Merge PDFs" }).click();
    await expect(page).toHaveURL(new RegExp(`${basePath}merge/$`));
  } finally {
    await context.close();
  }
});

test("sitemap lists only canonical pages and missing paths return real errors", async ({
  request,
  page,
}) => {
  const sitemap = await request.get("./sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()["content-type"]).toContain("application/xml");
  const xml = await sitemap.text();
  expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])).toEqual(
    pages.map(([path]) => `${siteOrigin}${basePath}${path}`),
  );
  const robots = await request.get("./robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(`Sitemap: ${siteOrigin}${basePath}sitemap.xml`);
  expect(await robots.text()).not.toContain("Disallow: /");
  expect((await request.get("./missing-tool/")).status()).toBe(404);
  const redirect = await request.get("./merge", { maxRedirects: 0 });
  expect(redirect.status()).toBe(301);
  expect(redirect.headers().location).toBe(`${basePath}merge/`);
  await page.goto("./404.html");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  await page.getByRole("link", { name: "Open Merge PDFs" }).click();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
});

test("direct tool URLs survive refresh, stay local and keep metadata synchronized", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("requestfailed", (request) => failures.push(request.url()));
  for (const [path, heading] of pages.slice(1, 5)) {
    await page.goto(`./${path}`);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.locator('input[type="file"]')).toBeAttached();
    await expect(page.getByRole("link", { name: "Privacy", exact: true })).toHaveAttribute(
      "href",
      `${basePath}privacy.html`,
    );
    await expect(page.getByRole("link", { name: "Workload limits", exact: true })).toHaveAttribute(
      "href",
      `${basePath}limits.html`,
    );
    expect(
      await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .every((entry) => new URL(entry.name).origin === location.origin),
      ),
    ).toBe(true);
    expect(
      await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((entry) => /(?:pdf\.worker|pdf-lib|\/pdfjs\/)/.test(entry.name)),
      ),
    ).toBe(false);
  }
  await navigateToTool(page, "Merge PDFs");
  await expect(page).toHaveTitle("Merge PDFs locally, free and without uploads - PDFBurrow");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${siteOrigin}${basePath}merge/`,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    `${siteOrigin}${basePath}merge/`,
  );
  expect(failures).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
