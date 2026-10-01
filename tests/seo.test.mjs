import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access } from "node:fs/promises";
import test from "node:test";
import { readRoute, routePath } from "../apps/web/src/workspace/routes.ts";
import {
  getPage,
  pageFilename,
  pagePath,
  pageRegistry,
} from "../apps/web/src/workspace/pageRegistry.ts";
import { pageMetadata, structuredData } from "../apps/web/src/workspace/pageMetadata.ts";

test("registered pages have unique routes, public paths, output files and existing HTML sources", async () => {
  for (const values of [
    pageRegistry.map((page) => page.route),
    pageRegistry.map((page) => page.path),
    pageRegistry.map(pageFilename),
  ]) {
    assert.equal(new Set(values).size, pageRegistry.length);
  }
  for (const page of pageRegistry) {
    assert.equal(getPage(page.route), page);
    assert.doesNotMatch(page.path, /^(?:\/)|(?:\.\.|[?#])/u);
    if (page.source === "html") {
      await access(new URL(`../apps/web/public/${page.template}`, import.meta.url));
    }
  }
  assert.throws(() => getPage("unregistered"), /Unknown page route: unregistered/);
});

for (const basePath of ["/", "/pdfburrow/", "/nested/tools/"]) {
  test(`registry paths, metadata and routing agree under ${basePath}`, () => {
    const origin = "https://pdf.example";
    for (const page of pageRegistry) {
      const path = pagePath(page, basePath);
      const metadata = pageMetadata(page, basePath, origin);
      assert.equal(metadata.url, `${origin}${path}`);
      assert.equal(metadata.title, page.title);
      assert.equal(metadata.description, page.description);
      assert.equal(metadata.robots, page.indexable ? "index, follow" : "noindex, follow");
      const schema = structuredData(page, basePath, origin);
      if (page.schema) {
        assert.equal(schema.url, metadata.url);
        assert.equal(schema["@type"], page.schema.type);
        assert.equal(schema.name, page.schema.name);
      } else {
        assert.equal(schema, null);
      }
      if (page.source === "react") {
        assert.equal(routePath(page.route, basePath), path);
        assert.equal(readRoute({ pathname: path, hash: "" }, basePath), page.route);
        assert.equal(
          readRoute({ pathname: `${basePath}${pageFilename(page)}`, hash: "" }, basePath),
          page.route,
        );
        if (page.legacyHash) {
          assert.equal(
            readRoute({ pathname: basePath, hash: page.legacyHash }, basePath),
            page.route,
          );
        }
      } else {
        assert.equal(readRoute({ pathname: path, hash: "" }, basePath), "not-found");
      }
    }
  });

  test(`tool routes and legacy bookmarks stay within ${basePath}`, () => {
    for (const route of ["home", "markup", "merge", "split", "remove", "images"]) {
      const path = routePath(route, basePath);
      assert.equal(readRoute({ pathname: path, hash: "" }, basePath), route);
      assert.equal(readRoute({ pathname: `${path}index.html`, hash: "" }, basePath), route);
      assert.equal(
        readRoute({ pathname: basePath, hash: route === "home" ? "#/" : `#/${route}` }, basePath),
        route,
      );
    }
    for (const hash of [
      "#/unknown",
      "#merge",
      "#xmerge",
      "#/merge?filename=private.pdf",
      "#/merge/",
    ]) {
      assert.equal(readRoute({ pathname: basePath, hash }, basePath), "not-found");
    }
    assert.equal(readRoute({ pathname: `${basePath}missing/`, hash: "" }, basePath), "not-found");
    assert.equal(readRoute({ pathname: `${basePath}images/`, hash: "#/split" }, basePath), "split");
  });
}

test("new page definitions control paths, schemas and indexing without route-name exceptions", () => {
  const help = {
    route: "help",
    path: "support/getting-started/",
    source: "html",
    template: "help.html",
    title: "Getting started - PDFBurrow",
    description: "Learn how to use PDFBurrow.",
    indexable: false,
    schema: null,
  };
  assert.equal(pageFilename(help), "support/getting-started/index.html");
  assert.deepEqual(pageMetadata(help, "/tools/", "https://pdf.example"), {
    title: help.title,
    description: help.description,
    url: "https://pdf.example/tools/support/getting-started/",
    robots: "noindex, follow",
  });
  assert.equal(structuredData(help, "/", "https://pdf.example"), null);

  const tool = {
    ...help,
    route: "rotate",
    path: "rotate.html",
    source: "react",
    legacyHash: null,
    indexable: true,
    schema: { type: "SoftwareApplication", name: "PDFBurrow - Rotate PDF" },
  };
  assert.equal(pageFilename(tool), "rotate.html");
  assert.equal(pageMetadata(tool, "/", "https://pdf.example").robots, "index, follow");
  assert.deepEqual(structuredData(tool, "/", "https://pdf.example"), {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.schema.name,
    url: "https://pdf.example/rotate.html",
    description: tool.description,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web browser",
    browserRequirements: "Requires JavaScript, module workers, and local file support.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  });
});

test("canonical configuration rejects unsafe or ambiguous origins and base paths", () => {
  const config = new URL("../apps/web/scripts/siteConfig.mjs", import.meta.url).href;
  const readConfig = (origin, base = "/") =>
    execFileSync(
      process.execPath,
      ["--input-type=module", "-e", `await import(${JSON.stringify(config)})`],
      {
        env: { ...process.env, PDFBURROW_SITE_ORIGIN: origin, PDFBURROW_BASE_PATH: base },
        stdio: "pipe",
      },
    );
  assert.doesNotThrow(() => readConfig("https://pdf.example", "/nested/tools/"));
  for (const origin of [
    "http://pdf.example",
    "https://pdf.example/",
    "https://pdf.example/path",
    "https://pdf.example?query",
    "https://pdf.example#hash",
    "https://user:password@pdf.example",
    "invalid",
  ]) {
    assert.throws(() => readConfig(origin), undefined, origin);
  }
  for (const base of ["pdfburrow/", "//", "/../", "/tools?query/", '/"><script>/']) {
    assert.throws(() => readConfig("https://pdf.example", base), undefined, base);
  }
});
