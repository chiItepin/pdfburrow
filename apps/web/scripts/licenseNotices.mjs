import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const appDirectory = fileURLToPath(new URL("../", import.meta.url));
const requireApp = createRequire(new URL("../package.json", import.meta.url));
const supported = new Set(["MIT", "Apache-2.0", "ISC", "(MIT AND Zlib)", "0BSD"]);

/** @param {string} filename */
export const isDependencyPath = (filename) => /(?:^|[\\/])node_modules[\\/]/u.test(filename);

/** @param {string} filename */
const owningPackage = async (filename) => {
  let directory = dirname(filename);
  while (directory !== dirname(directory)) {
    try {
      const manifest = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8"));
      if (typeof manifest.name === "string" && typeof manifest.version === "string") {
        return {
          directory,
          name: manifest.name,
          version: manifest.version,
          license: manifest.license,
        };
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
    directory = dirname(directory);
  }
  throw new Error(`No package identity for bundled input: ${filename}`);
};

/**
 * @param {import("esbuild").Metafile} metafile
 * @param {string} outputDirectory
 */
export const writeLicenseNotices = async (metafile, outputDirectory) => {
  const bundled = new Set(
    Object.values(metafile.outputs).flatMap((output) =>
      Object.entries(output.inputs)
        .filter(([, input]) => input.bytesInOutput > 0)
        .map(([filename]) => filename),
    ),
  );
  /** @type {Map<string, Awaited<ReturnType<typeof owningPackage>>>} */
  const packages = new Map();
  for (const filename of [...bundled].filter(isDependencyPath)) {
    const item = await owningPackage(resolve(appDirectory, filename));
    packages.set(item.directory, item);
  }
  const tailwind = await owningPackage(requireApp.resolve("tailwindcss/package.json"));
  packages.set(tailwind.directory, tailwind);
  const sections = ["PDFBurrow distributed third-party notices\n"];
  /** @type {{ name: string, version: string, license: string, notices: { file: string, sha256: string }[], provenance: string }[]} */
  const inventory = [];
  const sorted = [...packages.values()].sort((a, b) =>
    `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`, "en"),
  );
  for (const item of sorted) {
    if (!supported.has(item.license)) {
      throw new Error(
        `Review the license before bundling ${item.name}@${item.version}: ${item.license}`,
      );
    }
    const names = (await readdir(item.directory))
      .filter(
        (name) =>
          /^(?:licen[cs]e|notice|copyright)(?:[._-]|$)/iu.test(name) ||
          name === "CopyrightNotice.txt",
      )
      .sort();
    /** @type {{ file: string, text: string }[]} */
    const notices = [];
    let provenance = "installed package";
    for (const name of names) {
      const text = await readFile(resolve(item.directory, name), "utf8");
      if (!text.trim()) {
        throw new Error(`Empty upstream notice: ${item.name}@${item.version}/${name}`);
      }
      notices.push({ file: name, text });
    }
    // This published version omits LICENSE; retain the author's upstream text, pinned for review.
    if (
      !notices.length &&
      item.name === "react-remove-scroll-bar" &&
      item.version === "2.3.8" &&
      item.license === "MIT"
    ) {
      provenance =
        "https://github.com/theKashey/react-remove-scroll-bar/blob/7301c160fda44cb8cf2b9fdfde61efad35736196/LICENSE";
      const text = await readFile(
        new URL("../licenses/reactRemoveScrollBar.txt", import.meta.url),
        "utf8",
      );
      if (!text.trim()) {
        throw new Error("Empty vendored react-remove-scroll-bar license.");
      }
      notices.push({ file: "LICENSE", text });
    }
    if (!notices.length) {
      throw new Error(`No redistributable license text for ${item.name}@${item.version}`);
    }
    if (item.name === "pdfjs-dist") {
      for (const name of (await readdir(resolve(item.directory, "wasm")))
        .filter((name) => name.startsWith("LICENSE"))
        .sort()) {
        notices.push({
          file: `wasm/${name}`,
          text: await readFile(resolve(item.directory, "wasm", name), "utf8"),
        });
      }
    }
    inventory.push({
      name: item.name,
      version: item.version,
      license: item.license,
      provenance,
      notices: notices.map(({ file, text }) => ({
        file,
        sha256: createHash("sha256").update(text).digest("hex"),
      })),
    });
    sections.push(`\n=== ${item.name}@${item.version} (${item.license}) ===\n`);
    for (const notice of notices) {
      sections.push(`\n--- ${notice.file} ---\n${notice.text}`);
    }
  }
  sections.push(
    "\n=== Copied shadcn/ui components (adapted imports and local styling) ===\n",
    await readFile(new URL("../../../packages/core-ui/NOTICE.txt", import.meta.url), "utf8"),
  );
  for (const filename of Object.keys(metafile.outputs)
    .filter((name) => name.endsWith(".LEGAL.txt"))
    .sort()) {
    sections.push(
      `\n=== Bundled legal comments: ${basename(filename)} ===\n`,
      await readFile(resolve(appDirectory, filename), "utf8"),
    );
  }
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDirectory, "third-party-notices.txt"), sections.join("\n")),
    writeFile(
      resolve(outputDirectory, "license-inventory.json"),
      `${JSON.stringify(inventory, null, 2)}\n`,
    ),
    writeFile(
      resolve(outputDirectory, "LICENSE.txt"),
      await readFile(new URL("../../../LICENSE", import.meta.url)),
    ),
  ]);
};

/** @param {string} outputDirectory @returns {import("esbuild").Plugin} */
export const licenseNoticesPlugin = (outputDirectory) => ({
  name: "distributed-license-notices",
  setup(builder) {
    builder.onEnd(async (result) => {
      if (result.errors.length) {
        return;
      }
      if (!result.metafile) {
        throw new Error("License inventory requires esbuild metadata.");
      }
      await writeLicenseNotices(result.metafile, outputDirectory);
    });
  },
});
