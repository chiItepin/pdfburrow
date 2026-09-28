import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { reactCompiler } from "./reactCompiler.mjs";

const requireEngine = createRequire(
  new URL("../../../packages/pdf-engine/package.json", import.meta.url),
);

export const appDirectory = fileURLToPath(new URL("../", import.meta.url));
const isDevelopment = process.argv[1] === fileURLToPath(new URL("./dev.mjs", import.meta.url));
export const outputDirectory = fileURLToPath(
  new URL(isDevelopment ? "../.dev" : "../dist", import.meta.url),
);
export const basePath = process.env.PDFBURROW_BASE_PATH ?? "/pdfburrow/";

if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/u.test(basePath)) {
  throw new Error("PDFBURROW_BASE_PATH must be / or a slash-delimited path such as /pdfburrow/.");
}

/** @param {boolean} development @returns {import("esbuild").BuildOptions} */
export const buildOptions = (development) => ({
  absWorkingDir: appDirectory,
  entryPoints: {
    main: "src/Main.tsx",
    merge: "../../packages/pdf-engine/src/merge/index.ts",
    split: "../../packages/pdf-engine/src/split/index.ts",
    "split.worker": "../../packages/pdf-engine/src/split.worker.ts",
    preview: "../../packages/pdf-engine/src/preview/index.ts",
    bundle: "../../packages/pdf-engine/src/bundle/index.ts",
    "bundle.worker": "../../packages/pdf-engine/src/bundle.worker.ts",
    "image-preview": "../../packages/pdf-engine/src/image-preview/index.ts",
    "image-preview.worker": "../../packages/pdf-engine/src/imagePreview.worker.ts",
    "merge.worker": "../../packages/pdf-engine/src/merge.worker.ts",
    "diagnostics.worker": "../../packages/pdf-engine/src/diagnostics.worker.ts",
    "pdf.worker.min": requireEngine.resolve("pdfjs-dist/build/pdf.worker.min.mjs"),
  },
  outdir: `${outputDirectory}/assets`,
  bundle: true,
  plugins: [reactCompiler()],
  splitting: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  minify: !development,
  sourcemap: development,
  chunkNames: "[name]-[hash]",
  assetNames: "[name]-[hash]",
  define: { "process.env.NODE_ENV": JSON.stringify(development ? "development" : "production") },
  logLevel: "warning",
});
