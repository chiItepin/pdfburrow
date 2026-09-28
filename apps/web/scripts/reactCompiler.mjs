import { transformAsync } from "@babel/core";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const compilerPlugin = createRequire(import.meta.url).resolve("babel-plugin-react-compiler");
const sourceDirectories = [
  fileURLToPath(new URL("../src/", import.meta.url)),
  fileURLToPath(new URL("../../../packages/core-ui/src/", import.meta.url)),
  fileURLToPath(new URL("../tests/fixtures/", import.meta.url)),
];

/** @type {import("babel-plugin-react-compiler").Logger} */
const compilerLogger = {
  logEvent(filename, event) {
    if (event.kind === "CompileError" || event.kind === "CompileDiagnostic") {
      console.info(`[react-compiler] Optimization skipped for ${filename}: ${event.detail.reason}`);
    } else if (event.kind === "CompileSkip") {
      console.info(`[react-compiler] Optimization skipped for ${filename}: ${event.reason}`);
    } else if (event.kind === "PipelineError") {
      console.error(`[react-compiler] ${filename}: ${event.data}`);
    }
  },
};

/** @param {string} source @param {string} filename @param {import("babel-plugin-react-compiler").Logger} logger */
export const compileReactSource = async (source, filename, logger = compilerLogger) => {
  const result = await transformAsync(source, {
    filename,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [[compilerPlugin, { target: "19", panicThreshold: "critical_errors", logger }]],
    sourceMaps: "inline",
  });
  if (!result?.code) {
    throw new Error(`React Compiler produced no code for ${filename}.`);
  }
  return result.code;
};

/** @returns {import("esbuild").Plugin} */
export const reactCompiler = () => ({
  name: "react-compiler",
  setup(build) {
    build.onLoad({ filter: /\.tsx?$/ }, async ({ path }) => {
      if (!sourceDirectories.some((directory) => path.startsWith(directory))) {
        return;
      }
      return {
        contents: await compileReactSource(await readFile(path, "utf8"), path),
        loader: extname(path) === ".tsx" ? "tsx" : "ts",
        resolveDir: dirname(path),
        watchFiles: [path],
      };
    });
  },
});
