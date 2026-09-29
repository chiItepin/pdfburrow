import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { readRoute, routePath } from "../apps/web/src/workspace/routes.ts";

for (const basePath of ["/", "/pdfburrow/", "/nested/tools/"]) {
  test(`tool routes and legacy bookmarks stay within ${basePath}`, () => {
    for (const route of ["home", "merge", "split", "images"]) {
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
