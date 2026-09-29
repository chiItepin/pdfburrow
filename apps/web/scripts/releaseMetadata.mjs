import { execFileSync } from "node:child_process";
import { appendFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @param {string} directory
 * @param {string | undefined} ref
 * @param {string | undefined} commit
 */
export const writeReleaseMetadata = async (directory, ref, commit) => {
  if (!ref?.startsWith("refs/tags/") || ref === "refs/tags/") {
    throw new Error("Release metadata requires a tag reference.");
  }
  if (!commit || !/^[a-f0-9]{40}$/u.test(commit)) {
    throw new Error("Release metadata requires the full commit SHA.");
  }
  const metadata = { tag: ref.slice("refs/tags/".length), commit };
  await writeFile(resolve(directory, "release.json"), `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const eventSha = process.env.GITHUB_SHA;
  if (!eventSha || !/^[a-f0-9]{40}$/u.test(eventSha)) {
    throw new Error("A release must identify its triggering GitHub revision.");
  }
  /** @param {string} ref */
  const revision = (ref) =>
    execFileSync("git", ["rev-parse", `${ref}^{commit}`], { encoding: "utf8" }).trim();
  const commit = revision("HEAD");
  if (commit !== revision(eventSha)) {
    throw new Error("The checkout does not match the triggering revision.");
  }
  if (!process.env.GITHUB_OUTPUT) {
    throw new Error("A release must run inside GitHub Actions.");
  }
  await writeReleaseMetadata(
    fileURLToPath(new URL("../dist/", import.meta.url)),
    process.env.GITHUB_REF,
    commit,
  );
  await appendFile(process.env.GITHUB_OUTPUT, `commit=${commit}\n`);
}
