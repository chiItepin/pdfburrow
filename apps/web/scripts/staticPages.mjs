import { build } from "esbuild";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { appDirectory, outputDirectory } from "./buildOptions.mjs";
import { basePath, siteDefines } from "./siteConfig.mjs";

const require = createRequire(import.meta.url);
/** @param {string} value */
const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/** @param {{title: string, description: string, url: string, robots: string}} metadata @param {unknown} schema */
const renderMetadata = ({ title, description, url, robots }, schema) => `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${escapeHtml(url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="PDFBurrow" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <script id="page-schema" type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script>`;

/** @typedef {"home" | "merge" | "split" | "images" | "not-found" | "privacy" | "notices"} PageRoute */

export const writeStaticPages = async () => {
  await mkdir(outputDirectory, { recursive: true });
  const temporary = await mkdtemp(join(appDirectory, ".prerender-"));
  const renderer = join(temporary, "render.cjs");
  try {
    await build({
      absWorkingDir: appDirectory,
      entryPoints: ["src/Prerender.tsx"],
      outfile: renderer,
      bundle: true,
      platform: "node",
      format: "cjs",
      jsx: "automatic",
      external: [
        "react",
        "react-dom",
        "react-dom/*",
        "@repo/pdf-engine/merge",
        "@repo/pdf-engine/split",
        "@repo/pdf-engine/images",
        "@repo/pdf-engine/preview",
        "@repo/pdf-engine/image-preview",
        "@repo/pdf-engine/bundle",
      ],
      define: { ...siteDefines, "process.env.NODE_ENV": '"production"' },
      logLevel: "warning",
    });
    /** @type {(route: PageRoute) => {content: string, metadata: {title: string, description: string, url: string, robots: string}, schema: unknown}} */
    const renderPage = require(renderer).renderPage;
    const template = await readFile(new URL("../index.html", import.meta.url), "utf8");
    /** @type {readonly PageRoute[]} */
    const routes = ["home", "merge", "split", "images", "privacy", "notices", "not-found"];
    const urls = [];
    for (const route of routes) {
      const disclosure = route === "privacy" || route === "notices";
      const page = disclosure
        ? await readFile(new URL(`../public/${route}.html`, import.meta.url), "utf8")
        : template;
      const { content, metadata, schema } = renderPage(route);
      const filename =
        route === "home"
          ? "index.html"
          : route === "not-found"
            ? "404.html"
            : disclosure
              ? `${route}.html`
              : `${route}/index.html`;
      const destination = join(outputDirectory, filename);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(
        destination,
        page
          .replaceAll("%BASE_PATH%", basePath)
          .replace("%PAGE_METADATA%", () => renderMetadata(metadata, schema))
          .replace("%PAGE_CONTENT%", () => content),
      );
      if (route !== "not-found") {
        urls.push(metadata.url);
      }
    }
    await writeFile(
      join(outputDirectory, "sitemap.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join("\n")}\n</urlset>\n`,
    );
    await writeFile(
      join(outputDirectory, "robots.txt"),
      `User-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap.xml", urls[0]).href}\n`,
    );
  } finally {
    delete require.cache[renderer];
    await rm(temporary, { recursive: true, force: true });
  }
};
