import { build, context } from "esbuild";
import { execFile } from "node:child_process";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { licenseNoticesPlugin } from "./licenseNotices.mjs";
import {
  appDirectory,
  basePath,
  buildOptions,
  outputDirectory,
  pdfJsDirectory,
} from "./buildOptions.mjs";
import { writeStaticPages } from "./staticPages.mjs";

const copyPreviewAssets = async () => {
  const destination = `${outputDirectory}/assets/pdfjs`;
  await mkdir(destination, { recursive: true });
  await copyFile(
    `${pdfJsDirectory}/standard_fonts/LiberationSans-Regular.ttf`,
    `${outputDirectory}/assets/markupFont.ttf`,
  );
  await copyFile(
    `${pdfJsDirectory}/standard_fonts/LICENSE_LIBERATION`,
    `${destination}/LICENSE_LIBERATION`,
  );
  await Promise.all(
    [
      "wasm/jbig2_nowasm_fallback.js",
      "wasm/openjpeg_nowasm_fallback.js",
      "wasm/LICENSE_JBIG2",
      "wasm/LICENSE_PDFJS_JBIG2",
      "wasm/LICENSE_OPENJPEG",
      "wasm/LICENSE_PDFJS_OPENJPEG",
      "LICENSE",
    ].map((file) => copyFile(`${pdfJsDirectory}/${file}`, `${destination}/${basename(file)}`)),
  );
};

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

export const writeHtml = writeStaticPages;

/** @param {boolean} development */
const applicationOptions = (development) => {
  const options = buildOptions(development);
  return {
    ...options,
    metafile: true,
    plugins: [...(options.plugins ?? []), licenseNoticesPlugin(outputDirectory)],
  };
};

export const buildApplication = async () => {
  await rm(`${outputDirectory}/assets`, { recursive: true, force: true });
  await rm(`${outputDirectory}/release.json`, { force: true });
  await rm(`${outputDirectory}/release-evidence.json`, { force: true });
  await Promise.all([
    build(applicationOptions(false)),
    buildStyles(),
    writeHtml(),
    copyPreviewAssets(),
  ]);
  await writeFile(`${outputDirectory}/base-path.json`, JSON.stringify(basePath));
};

export const watchApplication = async () => {
  await copyPreviewAssets();
  await buildStyles();
  const options = applicationOptions(true);
  const builder = await context({
    ...options,
    plugins: [
      ...(options.plugins ?? []),
      {
        name: "static-pages",
        setup: (builder) => {
          builder.onEnd(async (result) => {
            if (result.errors.length === 0) {
              await writeHtml();
            }
          });
        },
      },
    ],
  });
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
