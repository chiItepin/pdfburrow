import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const appDirectory = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = resolve(appDirectory, "dist");
const evidencePath = resolve(outputDirectory, "release-evidence.json");

/** @param {string} directory */
export const artifactHashes = async (directory) => {
  const files = await readdir(directory, { withFileTypes: true, recursive: true });
  /** @type {Record<string, string>} */
  const hashes = {};
  for (const entry of files
    .filter((entry) => entry.isFile())
    .sort((a, b) =>
      resolve(a.parentPath, a.name).localeCompare(resolve(b.parentPath, b.name), "en"),
    )) {
    if (resolve(entry.parentPath, entry.name) === resolve(directory, "release-evidence.json")) {
      continue;
    }
    const filename = resolve(entry.parentPath, entry.name);
    hashes[filename.slice(directory.length + 1)] = createHash("sha256")
      .update(await readFile(filename))
      .digest("hex");
  }
  return hashes;
};

/**
 * @typedef {{ title: string, specs: { title: string, tests: {
 * projectName: string, status: string, annotations?: {type: string, description?: string}[],
 * results: {status: string, duration: number, attachments: {name: string, body?: string}[]}[]
 * }[] }[], suites?: ReportSuite[] }} ReportSuite
 */

/** @param {ReportSuite[]} suites @returns {object[]} */
const summarize = (suites) =>
  suites.flatMap((suite) => [
    ...suite.specs.flatMap((spec) =>
      spec.tests.map((test) => ({
        title: spec.title,
        project: test.projectName,
        status: test.status,
        annotations: test.annotations,
        runs: test.results.map((result) => ({
          status: result.status,
          durationMs: result.duration,
          evidence: result.attachments
            .filter((attachment) => attachment.name === "privacy-evidence")
            .map((attachment) => {
              if (!attachment.body) {
                throw new Error("Privacy evidence attachment has no inline content.");
              }
              return JSON.parse(Buffer.from(attachment.body, "base64").toString("utf8"));
            }),
        })),
      })),
    ),
    ...summarize(suite.suites ?? []),
  ]);

export const recordReleaseEvidence = async () => {
  await rm(evidencePath, { force: true });
  const before = await artifactHashes(outputDirectory);
  if (!before["index.html"] || !before["license-inventory.json"] || !before["LICENSE.txt"]) {
    throw new Error("Build the complete licensed artifact before collecting release evidence.");
  }
  const basePath = JSON.parse(await readFile(resolve(outputDirectory, "base-path.json"), "utf8"));
  if (basePath !== (process.env.PDFBURROW_BASE_PATH ?? "/pdfburrow/")) {
    throw new Error("The browser-test base path does not match the built artifact.");
  }
  const { stdout, stderr } = await execute(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "privacy.spec.ts",
      "--workers=2",
      "--reporter=json",
    ],
    { cwd: appDirectory, maxBuffer: 20 * 1024 * 1024 },
  );
  process.stderr.write(stderr);
  /** @type {{ suites: ReportSuite[], stats: { expected: number, unexpected: number, skipped: number, flaky: number }, errors: unknown[] }} */
  const report = JSON.parse(stdout);
  const offlineGaps = process.platform === "darwin" ? 1 : 0;
  if (
    report.errors.length ||
    report.stats.unexpected ||
    report.stats.flaky ||
    report.stats.expected !== 8 - offlineGaps ||
    report.stats.skipped !== offlineGaps
  ) {
    throw new Error("Privacy checks did not produce the required successful evidence.");
  }
  const after = await artifactHashes(outputDirectory);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(
      "The application artifact changed during evidence collection. Rebuild and retry.",
    );
  }
  /** @param {...string} args */
  const git = async (...args) => (await execute("git", args, { cwd: appDirectory })).stdout.trim();
  const licenses = JSON.parse(
    await readFile(resolve(outputDirectory, "license-inventory.json"), "utf8"),
  );
  const evidence = {
    schemaVersion: 1,
    recordedAt: new Date().toISOString(),
    sourceCommit: await git("rev-parse", "HEAD"),
    sourceDirty: Boolean(await git("status", "--porcelain")),
    basePath,
    artifactSha256: createHash("sha256").update(JSON.stringify(before)).digest("hex"),
    files: before,
    environment: {
      node: process.version,
      os: platform(),
      osRelease: release(),
      architecture: arch(),
      cpu: cpus()[0]?.model,
      memoryBytes: totalmem(),
    },
    stats: report.stats,
    checks: summarize(report.suites),
    releaseReady: false,
    pending: [
      "Physical iPhone/iPad/Android and current/previous stable browser-major coverage.",
      "Measured cross-device memory/performance calibration; limits are provisional estimates.",
      ...(offlineGaps
        ? ["macOS WebKit offline-mode Blob limitation; physical Safari evidence still required."]
        : []),
      "Owner confirmation of contributor licensing rights.",
      "Exact release commit/tag selection and protected-environment owner approval.",
    ],
    licenses,
  };
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(
    `Recorded ${report.stats.expected} passing privacy checks and ${report.stats.skipped} explicit gap(s).`,
  );
  console.log(`Artifact SHA-256: ${evidence.artifactSha256}`);
  console.log(`Evidence: ${evidencePath}`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await recordReleaseEvidence();
  } catch (error) {
    if (error instanceof Error && "stdout" in error) {
      process.stderr.write(String(error.stdout));
    }
    throw error;
  }
}
