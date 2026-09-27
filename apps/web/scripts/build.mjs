import { build, context } from "esbuild";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { appDirectory, basePath, buildOptions, outputDirectory } from "./build-options.mjs";

export const tailwindExecutable = fileURLToPath(
  new URL("../node_modules/.bin/tailwindcss", import.meta.url),
);
export const tailwindArguments = [
  "-i",
  "../../packages/core-ui/src/styles.css",
  "-o",
  `${outputDirectory}/assets/styles.css`,
];

export const buildStyles = async () => {
  await promisify(execFile)(tailwindExecutable, [...tailwindArguments, "--minify"], {
    cwd: appDirectory,
  });
};

export const writeHtml = async () => {
  await mkdir(outputDirectory, { recursive: true });
  const template = await readFile(new URL("../index.html", import.meta.url), "utf8");
  await writeFile(`${outputDirectory}/index.html`, template.replaceAll("%BASE_PATH%", basePath));
};

export const buildApplication = async () => {
  await rm(`${outputDirectory}/assets`, { recursive: true, force: true });
  await Promise.all([build(buildOptions(false)), buildStyles(), writeHtml()]);
  await writeFile(`${outputDirectory}/base-path.json`, JSON.stringify(basePath));
};

export const watchApplication = async () => {
  await writeHtml();
  await buildStyles();
  const builder = await context(buildOptions(true));
  try {
    await builder.rebuild();
    await builder.watch();
    return builder;
  } catch (error) {
    await builder.dispose();
    throw error;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildApplication();
}
