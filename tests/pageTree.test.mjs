import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { inspectPdf, mergeDocuments } from "../packages/pdf-engine/src/pdf.ts";

const require = createRequire(new URL("../packages/pdf-engine/package.json", import.meta.url));
const { PDFDocument, PDFName, PDFPageTree, PDFRef, degrees } = require("pdf-lib");

const fixture = async (mutate) => {
  const doc = await PDFDocument.create();
  doc.addPage([300, 500]).drawText("First page");
  doc.addPage([400, 600]).drawText("Second page");
  mutate(doc, doc.catalog.Pages());
  return {
    id: "tree",
    name: "page-tree.pdf",
    blob: new Blob([await doc.save({ useObjectStreams: false })]),
  };
};

const corruptions = {
  "unknown child type": (doc, tree) => {
    tree.Kids().set(1, doc.context.register(doc.context.obj({ Type: "NotAPage" })));
  },
  "missing child": (_doc, tree) => tree.Kids().set(1, PDFRef.of(9999)),
  "duplicate page": (_doc, tree) => tree.Kids().set(1, tree.Kids().get(0)),
  "cyclic child": (doc, tree) => tree.Kids().set(1, doc.catalog.get(PDFName.of("Pages"))),
  "cyclic parent": (doc) => doc.getPage(0).node.set(PDFName.of("Parent"), doc.getPage(0).ref),
  "wrong count": (doc, tree) => tree.set(PDFName.of("Count"), doc.context.obj(3)),
  "negative count": (doc, tree) => tree.set(PDFName.of("Count"), doc.context.obj(-1)),
  "fractional count": (doc, tree) => tree.set(PDFName.of("Count"), doc.context.obj(1.5)),
  "missing count": (_doc, tree) => tree.delete(PDFName.of("Count")),
  "invalid kids": (doc, tree) => tree.set(PDFName.of("Kids"), doc.context.obj({})),
};

for (const [name, mutate] of Object.entries(corruptions)) {
  test(`required checks reject ${name} without a partial merge`, async () => {
    const input = await fixture(mutate);
    await assert.rejects(inspectPdf(input), /page tree is invalid/);
    const valid = await fixture(() => {});
    await assert.rejects(
      mergeDocuments({ inputs: [valid, input], acknowledged: true }, () => {}),
      /page-tree\.pdf: The PDF page tree is invalid/,
    );
  });
}

test("nested page trees retain inherited geometry, rotation and resources", async () => {
  const input = await fixture((doc, root) => {
    const rootRef = doc.catalog.get(PDFName.of("Pages"));
    const branch = PDFPageTree.withContext(doc.context, rootRef);
    const branchRef = doc.context.register(branch);
    const first = doc.getPage(0);
    first.setRotation(degrees(270));
    for (const key of ["MediaBox", "CropBox", "Rotate", "Resources"]) {
      const name = PDFName.of(key);
      const value = first.node.get(name);
      if (value) {
        branch.set(name, value);
        first.node.delete(name);
      }
    }
    branch.Kids().push(first.ref);
    branch.set(PDFName.of("Count"), doc.context.obj(1));
    first.node.set(PDFName.of("Parent"), branchRef);
    root.Kids().set(0, branchRef);
  });
  assert.equal((await inspectPdf(input)).pageCount, 2);
  const result = await mergeDocuments({ inputs: [input], acknowledged: true }, () => {});
  const output = await PDFDocument.load(await result.blob.arrayBuffer());
  assert.equal(output.getPageCount(), 2);
  assert.deepEqual(
    output.getPages().map((page) => page.getSize()),
    [
      { width: 300, height: 500 },
      { width: 400, height: 600 },
    ],
  );
  assert.equal(output.getPage(0).getRotation().angle, 270);
  assert.ok(output.getPage(0).node.Resources().has(PDFName.of("Font")));
});
