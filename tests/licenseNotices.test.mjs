import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { isDependencyPath, writeLicenseNotices } from "../apps/web/scripts/licenseNotices.mjs";
import { artifactHashes } from "../apps/web/scripts/releaseEvidence.mjs";

test("dependency discovery recognizes full path segments with either platform separator", () => {
  for (const filename of [
    "/workspace/node_modules/package/index.js",
    String.raw`C:\workspace\node_modules\package\index.js`,
    String.raw`\\server\workspace\node_modules\package\index.js`,
    String.raw`..\node_modules\@scope\package\index.js`,
    "node_modules/package/index.js",
    String.raw`node_modules\package/index.js`,
  ]) {
    assert.equal(isDependencyPath(filename), true, filename);
  }
  for (const filename of [
    "/workspace/src/index.js",
    "/workspace/not_node_modules/package/index.js",
    String.raw`C:\workspace\not_node_modules\package\index.js`,
    "/workspace/node_modules.ts",
  ]) {
    assert.equal(isDependencyPath(filename), false, filename);
  }
});

test("distributed notices retain full upstream text and fail closed for missing or unfamiliar licenses", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pdfburrow-notices-"));
  try {
    const pkg = join(directory, "node_modules", "fixture-package");
    const output = join(directory, "output");
    await mkdir(pkg, { recursive: true });
    await writeFile(
      join(pkg, "package.json"),
      JSON.stringify({ name: "fixture-package", version: "1.0.0", license: "MIT" }),
    );
    const metadata = {
      inputs: {},
      outputs: {
        "fixture.js": {
          imports: [],
          exports: [],
          bytes: 1,
          inputs: { [join(pkg, "index.js")]: { bytesInOutput: 1 } },
        },
      },
    };
    await assert.rejects(writeLicenseNotices(metadata, output), /No redistributable license text/);
    await writeFile(join(pkg, "LICENSE"), "MIT License\nCopyright Fixture Author\n");
    await writeLicenseNotices(metadata, output);
    assert.match(
      await readFile(join(output, "third-party-notices.txt"), "utf8"),
      /Copyright Fixture Author/,
    );
    assert.match(
      await readFile(join(output, "third-party-notices.txt"), "utf8"),
      /Copyright \(c\) 2023 shadcn/,
    );
    assert.match(
      await readFile(join(output, "LICENSE.txt"), "utf8"),
      /2026 PDFBurrow contributors/,
    );
    const inventory = JSON.parse(await readFile(join(output, "license-inventory.json"), "utf8"));
    assert.ok(inventory.some((item) => item.name === "tailwindcss"));
    assert.equal(
      inventory.find((item) => item.name === "fixture-package").notices[0].sha256.length,
      64,
    );
    await writeFile(
      join(pkg, "package.json"),
      JSON.stringify({ name: "fixture-package", version: "2.0.0", license: "UNLICENSED" }),
    );
    await assert.rejects(writeLicenseNotices(metadata, output), /Review the license/);
    await rm(join(pkg, "LICENSE"));
    await writeFile(
      join(pkg, "package.json"),
      JSON.stringify({ name: "react-remove-scroll-bar", version: "2.3.8", license: "MIT" }),
    );
    await writeLicenseNotices(metadata, output);
    assert.match(
      await readFile(join(output, "third-party-notices.txt"), "utf8"),
      /Copyright \(c\) 2025 Anton Korzunov/,
    );
    const supplemented = JSON.parse(
      await readFile(join(output, "license-inventory.json"), "utf8"),
    ).find((item) => item.name === "react-remove-scroll-bar");
    assert.match(supplemented.provenance, /7301c160fda44cb8cf2b9fdfde61efad35736196\/LICENSE$/);
    await writeFile(
      join(pkg, "package.json"),
      JSON.stringify({ name: "react-remove-scroll-bar", version: "2.3.9", license: "MIT" }),
    );
    await assert.rejects(writeLicenseNotices(metadata, output), /No redistributable license text/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("artifact evidence hashes every delivered file and excludes only its own root record", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pdfburrow-evidence-"));
  try {
    await writeFile(join(directory, "index.html"), "original");
    await writeFile(join(directory, "release-evidence.json"), "old evidence");
    const before = await artifactHashes(directory);
    assert.deepEqual(Object.keys(before), ["index.html"]);
    await writeFile(join(directory, "index.html"), "changed");
    assert.notDeepEqual(await artifactHashes(directory), before);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
