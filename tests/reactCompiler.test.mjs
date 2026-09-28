import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildOptions } from "../apps/web/scripts/buildOptions.mjs";
import { compileReactSource, reactCompiler } from "../apps/web/scripts/reactCompiler.mjs";

const requireWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { build } = requireWeb("esbuild");

test("React Compiler transforms typed components and hooks without manual memoization", async () => {
  const filename = fileURLToPath(new URL("../apps/web/src/CompilerFixture.tsx", import.meta.url));
  const code = await compileReactSource(
    `
    export const Greeting = ({ name }: { name: string }) => <h1>Hello {name}</h1>;
    export const useGreeting = (name: string) => ({ label: "Hello " + name });
  `,
    filename,
  );
  assert.match(code, /react\/compiler-runtime/u);
  assert.match(code, /_c\(/u);
  assert.doesNotMatch(code, /useMemo|useCallback/u);
});

test("compiler supports lazy imports and fails explicitly on invalid input", async () => {
  const filename = fileURLToPath(new URL("../apps/web/src/useCompilerFixture.ts", import.meta.url));
  const code = await compileReactSource(
    `
    export const useLazyModule = () => {
      const load = async () => await import("@repo/pdf-engine/merge");
      return { load };
    };
  `,
    filename,
  );
  assert.match(code, /import\("@repo\/pdf-engine\/merge"\)/u);
  await assert.rejects(compileReactSource("export const = ;", filename));
});

test("unsupported async cleanup is preserved and reported rather than silently optimized", async () => {
  const events = [];
  const filename = fileURLToPath(new URL("../apps/web/src/useAsyncFixture.ts", import.meta.url));
  const code = await compileReactSource(
    `
    import { useState } from "react";
    export const useAsyncFixture = (task: () => Promise<void>) => {
      const [done, setDone] = useState(false);
      const run = async () => { try { await task(); } finally { setDone(true); } };
      return { done, run };
    };
  `,
    filename,
    { logEvent: (_, event) => events.push(event) },
  );
  assert.ok(events.some((event) => event.kind === "CompileError" || event.kind === "CompileSkip"));
  assert.match(code, /finally/u);
});

test("both build modes compile real app/UI code but leave the PDF engine React-free", async () => {
  for (const development of [true, false]) {
    assert.ok(buildOptions(development).plugins.some((plugin) => plugin.name === "react-compiler"));
  }
  const app = await build({
    entryPoints: [
      fileURLToPath(new URL("../apps/web/src/workspace/ToolIntroduction.tsx", import.meta.url)),
      fileURLToPath(new URL("../packages/core-ui/src/components/PageFrame.tsx", import.meta.url)),
    ],
    outdir: "unused-test-output",
    bundle: true,
    write: false,
    metafile: true,
    format: "esm",
    jsx: "automatic",
    plugins: [reactCompiler()],
  });
  assert.ok(
    Object.keys(app.metafile.inputs).some((filename) =>
      filename.includes("react/compiler-runtime"),
    ),
  );
  for (const output of app.outputFiles) {
    assert.ok(output.text.includes("compiler-runtime"), output.path);
  }
  const engine = await build({
    entryPoints: [
      fileURLToPath(new URL("../packages/pdf-engine/src/resourceLimits.ts", import.meta.url)),
    ],
    bundle: true,
    write: false,
    metafile: true,
    format: "esm",
    plugins: [reactCompiler()],
  });
  assert.ok(Object.keys(engine.metafile.inputs).every((filename) => !filename.includes("/react/")));
});
