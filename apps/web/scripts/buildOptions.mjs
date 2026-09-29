import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { reactCompiler } from "./reactCompiler.mjs";
import { siteDefines } from "./siteConfig.mjs";
export { basePath } from "./siteConfig.mjs";

const requireEngine = createRequire(
  new URL("../../../packages/pdf-engine/package.json", import.meta.url),
);
export const pdfJsDirectory = dirname(requireEngine.resolve("pdfjs-dist/package.json"));

export const appDirectory = fileURLToPath(new URL("../", import.meta.url));
const isDevelopment = process.argv[1] === fileURLToPath(new URL("./dev.mjs", import.meta.url));
export const outputDirectory = fileURLToPath(
  new URL(isDevelopment ? "../.dev" : "../dist", import.meta.url),
);

/** @param {boolean} development @returns {import("esbuild").BuildOptions} */
export const buildOptions = (development) => ({
  absWorkingDir: appDirectory,
  entryPoints: {
    main: "src/Main.tsx",
    merge: "../../packages/pdf-engine/src/merge/index.ts",
    split: "../../packages/pdf-engine/src/split/index.ts",
    "split.worker": "../../packages/pdf-engine/src/split.worker.ts",
    images: "../../packages/pdf-engine/src/images/index.ts",
    "images.worker": "../../packages/pdf-engine/src/images.worker.ts",
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
  define: {
    ...siteDefines,
    "process.env.NODE_ENV": JSON.stringify(development ? "development" : "production"),
  },
  logLevel: "warning",
});
