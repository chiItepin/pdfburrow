import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createSealSession } from "../apps/web/src/seal/sealSession.ts";

test("seal session owns explicit downloads, reuses URLs and releases keys, inputs and outputs on reset", async (t) => {
  const created = [];
  const revoked = [];
  const downloads = [];
  t.mock.method(URL, "createObjectURL", (blob) => {
    assert.equal(blob.type, "application/json");
    const url = `blob:seal-${created.length}`;
    created.push(url);
    return url;
  });
  t.mock.method(URL, "revokeObjectURL", (url) => revoked.push(url));
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: (tag) => {
      assert.equal(tag, "a");
      const anchor = { href: "", download: "", remove: () => {} };
      anchor.click = () => downloads.push({ url: anchor.href, name: anchor.download });
      return anchor;
    },
    body: { append: () => {} },
  };
  t.after(() => {
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }
  });
  const session = createSealSession();
  assert.equal(session.snapshot().hasWork, false);
  await assert.rejects(session.seal(), /Choose a PDF/);
  session.select("pdf", new File(["%PDF-1.7\noriginal"], "../contract.pdf"));
  await session.createKey("a long unique passphrase");
  const fingerprint = session.snapshot().fingerprint;
  assert.equal(session.snapshot().backupReady, true);
  assert.equal(session.snapshot().backupRequested, false);
  assert.deepEqual(downloads, []);
  await assert.rejects(session.seal(), /Download your encrypted key/);
  session.download("key");
  session.download("key");
  assert.equal(created.length, 1);
  assert.equal(session.snapshot().backupRequested, true);
  await session.seal();
  assert.equal(session.snapshot().proofReady, true);
  assert.equal(downloads.length, 2);
  session.download("proof");
  assert.equal(created.length, 2);
  assert.equal(downloads.at(-1).name.endsWith(".proof.json"), true);
  assert.equal(downloads.at(-1).name.includes("/"), false);
  session.select("pdf", new File(["%PDF-1.7\nchanged"], "changed.pdf"));
  assert.equal(session.snapshot().proofReady, false);
  assert.equal(session.snapshot().fingerprint, fingerprint);
  assert.deepEqual(revoked, ["blob:seal-1"]);
  session.clear();
  assert.deepEqual(revoked, ["blob:seal-1", "blob:seal-0"]);
  assert.deepEqual(session.snapshot(), {
    pdfName: "",
    keyFileName: "",
    proofFileName: "",
    fingerprint: "",
    backupReady: false,
    backupRequested: false,
    proofReady: false,
    verification: null,
    hasWork: false,
  });
  assert.throws(() => session.download("proof"), /No download is available/);
});

test("rejected oversized sidecars preserve retained files and session state", () => {
  const session = createSealSession();
  session.select("proof", new File(["{}"], "retained.proof.json"));
  assert.throws(
    () => session.select("proof", new File([new Uint8Array(16385)], "oversized.json")),
    /16 KiB/,
  );
  assert.equal(session.snapshot().proofFileName, "retained.proof.json");
  assert.throws(() => session.select("key", new File([], "empty.json")), /nonempty/);
  assert.equal(session.snapshot().keyFileName, "");
  session.clear();
});

test("seal sessions load limits eagerly but defer cryptographic capability modules", async () => {
  const requireWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
  const { build } = requireWeb("esbuild");
  const { metafile } = await build({
    entryPoints: [fileURLToPath(new URL("../apps/web/src/seal/sealSession.ts", import.meta.url))],
    outdir: "unused-seal-test-output",
    bundle: true,
    splitting: true,
    format: "esm",
    write: false,
    metafile: true,
  });
  const entry = Object.entries(metafile.outputs).find(([, output]) =>
    output.entryPoint?.endsWith("/sealSession.ts"),
  );
  assert.ok(entry);
  const initial = new Set();
  const visit = (path) => {
    if (initial.has(path)) {
      return;
    }
    initial.add(path);
    const output = metafile.outputs[path];
    assert.ok(output);
    for (const dependency of output.imports) {
      if (!dependency.external && dependency.kind !== "dynamic-import") {
        visit(dependency.path);
      }
    }
  };
  visit(entry[0]);
  const eagerInputs = [...initial].flatMap((path) => Object.keys(metafile.outputs[path].inputs));
  const deferredInputs = Object.entries(metafile.outputs)
    .filter(([path]) => !initial.has(path))
    .flatMap(([, output]) => Object.keys(output.inputs));
  for (const filename of ["personalSeal.ts", "sealKeys.ts", "sealFormat.ts"]) {
    assert.ok(!eagerInputs.some((path) => path.endsWith(`/${filename}`)), `${filename} is eager`);
    assert.ok(
      deferredInputs.some((path) => path.endsWith(`/${filename}`)),
      `${filename} is not deferred`,
    );
  }
  assert.ok(eagerInputs.some((path) => path.endsWith("/sealPolicy.ts")));
});
