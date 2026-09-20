import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { configFor } from "../packages/tooling/eslint.config.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const requireTooling = createRequire(new URL("../packages/tooling/package.json", import.meta.url));
const ts = requireTooling("typescript");
const { ESLint } = requireTooling("eslint");
const readJson = async (name) => JSON.parse(await readFile(path.join(root, name), "utf8"));

test("Rush owns exactly the four approved packages and their dependency directions", async () => {
  const rush = await readJson("rush.json");
  assert.deepEqual(rush.projects.map((project) => project.packageName).sort(), [
    "@repo/core-ui", "@repo/pdf-engine", "@repo/tooling", "@repo/web",
  ]);
  const allowedRuntime = {
    "@repo/web": ["@repo/core-ui", "@repo/pdf-engine"],
    "@repo/core-ui": [],
    "@repo/pdf-engine": [],
    "@repo/tooling": [],
  };
  for (const project of rush.projects) {
    const pkg = await readJson(`${project.projectFolder}/package.json`);
    assert.equal(pkg.name, project.packageName);
    assert.equal(pkg.private, true);
    assert.deepEqual(
      Object.keys(pkg.dependencies ?? {}).filter((name) => name.startsWith("@repo/")).sort(),
      allowedRuntime[pkg.name],
    );
    if (pkg.name !== "@repo/tooling") {
      assert.equal(pkg.devDependencies["@repo/tooling"], "workspace:*");
    }
    if (pkg.name === "@repo/pdf-engine") {
      assert.equal(pkg.dependencies, undefined);
      assert.equal(pkg.peerDependencies, undefined);
    }
  }
  const pkg = await readJson("package.json");
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
  assert.equal(pkg.packageManager, `pnpm@${rush.pnpmVersion}`);
  assert.equal(pkg.scripts.build, "node common/scripts/install-run-rush.js rebuild");
});

test("UI exports, shadcn ownership, and Tailwind sources are explicit", async () => {
  const pkg = await readJson("packages/core-ui/package.json");
  assert.deepEqual(pkg.exports, {
    "./primitives/*": "./src/primitives/*.tsx",
    "./components/*": "./src/components/*.tsx",
    "./hooks/*": "./src/hooks/*.ts",
    "./lib/*": "./src/lib/*.ts",
    "./styles.css": "./src/styles.css",
  });
  const shadcn = await readJson("packages/core-ui/components.json");
  assert.equal(shadcn.aliases.ui, "@repo/core-ui/primitives");
  assert.equal(shadcn.aliases.components, "@repo/core-ui/components");
  assert.equal(shadcn.aliases.utils, "@repo/core-ui/lib/utils");
  const css = await readFile(path.join(root, "packages/core-ui/src/styles.css"), "utf8");
  assert.match(css, /@source "\.\/"/u);
  assert.match(css, /@source "\.\.\/\.\.\/\.\.\/apps\/web\/src"/u);
});

test("browser, worker and build-tool environments do not leak into each other", async () => {
  const base = await readJson("packages/tooling/typescript/base.json");
  assert.equal(base.compilerOptions.lib, undefined);
  assert.equal(base.compilerOptions.jsx, undefined);
  assert.equal(base.compilerOptions.types, undefined);
  const worker = await readJson("packages/pdf-engine/tsconfig.worker.json");
  assert.deepEqual(worker.compilerOptions.lib, ["ES2022", "WebWorker"]);
  assert.deepEqual(worker.compilerOptions.types, []);
  const node = await readJson("apps/web/tsconfig.node.json");
  assert.deepEqual(node.compilerOptions.lib, ["ES2022"]);
  assert.deepEqual(node.compilerOptions.types, ["node"]);
  const project = await readJson("apps/web/config/rush-project.json");
  assert.ok(project.operationSettings.find((operation) => operation.operationName === "build")
    .dependsOnEnvVars.includes("PDFBURROW_BASE_PATH"));
});

for (const [layer, imports] of Object.entries({
  engine: ["react", "react-dom/client", "@repo/core-ui/primitives/button", "@repo/web"],
  ui: ["@repo/pdf-engine/diagnostics", "@repo/web"],
  web: ["@repo/core-ui/src/lib/utils", "@repo/tooling/eslint"],
})) {
  test(`lint rejects prohibited ${layer} imports`, async () => {
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: configFor(layer),
    });
    for (const name of imports) {
      const [result] = await eslint.lintText(`import "${name}";`, { filePath: "src/check.ts" });
      assert.ok(result.messages.some((message) => message.ruleId === "no-restricted-imports"), name);
    }
  });
}

test("runtime imports use declared dependencies and cannot escape package boundaries", async () => {
  const rush = await readJson("rush.json");
  for (const project of rush.projects.filter((item) => item.packageName !== "@repo/tooling")) {
    const folder = path.join(root, project.projectFolder);
    const pkg = await readJson(`${project.projectFolder}/package.json`);
    const entries = await readdir(path.join(folder, "src"), { recursive: true });
    for (const entry of entries.filter((name) => /\.(ts|tsx)$/u.test(name))) {
      const filename = path.join(folder, "src", entry);
      const source = ts.createSourceFile(
        filename, await readFile(filename, "utf8"), ts.ScriptTarget.Latest, true,
      );
      const imports = [];
      function visit(node) {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
          imports.push(node.moduleSpecifier.text);
        } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          assert.ok(ts.isStringLiteral(node.arguments[0]), `Non-static import: ${filename}`);
          imports.push(node.arguments[0].text);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
      for (const specifier of imports) {
        if (specifier.startsWith(".")) {
          assert.ok(path.resolve(path.dirname(filename), specifier).startsWith(`${folder}${path.sep}`));
        } else if (specifier.startsWith("@/")) {
          assert.equal(pkg.name, "@repo/web");
        } else {
          const name = specifier.startsWith("@")
            ? specifier.split("/").slice(0, 2).join("/")
            : specifier.split("/")[0];
          assert.ok(name === pkg.name || name in (pkg.dependencies ?? {}) || name in (pkg.peerDependencies ?? {}),
            `${filename}: undeclared runtime dependency ${specifier}`);
          assert.ok(!specifier.includes("/src/"), `Private source import: ${specifier}`);
        }
      }
    }
  }
});
