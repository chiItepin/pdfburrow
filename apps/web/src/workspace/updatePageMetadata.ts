import { pageMetadata, structuredData } from "./pageMetadata";
import { getPage } from "./pageRegistry";
import type { ToolRoute } from "./routes";
import { siteBasePath, siteOrigin } from "./site";

export const updatePageMetadata = (route: ToolRoute) => {
  const page = getPage(route);
  const { title, description, url, robots } = pageMetadata(page, siteBasePath, siteOrigin);
  document.title = title;
  for (const [selector, content] of [
    ['meta[name="description"]', description],
    ['meta[name="robots"]', robots],
    ['meta[property="og:title"]', title],
    ['meta[property="og:description"]', description],
    ['meta[property="og:url"]', url],
    ['meta[name="twitter:title"]', title],
    ['meta[name="twitter:description"]', description],
  ] as const) {
    document.querySelector(selector)?.setAttribute("content", content);
  }
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", url);
  const schema = document.getElementById("page-schema");
  if (schema) {
    schema.textContent = JSON.stringify(structuredData(page, siteBasePath, siteOrigin));
  }
};
