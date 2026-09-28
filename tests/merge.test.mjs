import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import {
  enforceLimit,
  inspectPdf,
  mergeDocuments,
  mergedFilename,
} from "../packages/pdf-engine/src/pdf.ts";

const require = createRequire(new URL("../packages/pdf-engine/package.json", import.meta.url));
const {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFRef,
  StandardFonts,
  degrees,
  rgb,
  decodePDFRawStream,
} = require("pdf-lib");

async function fixture(name = "report.pdf", mutate = () => {}, count = 2) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < count; i++) {
    const page = doc.addPage([300 + i * 100, 500 + i * 50]);
    page.setRotation(degrees(i * 90));
    page.setCropBox(10, 20, 280 + i * 100, 450 + i * 50);
    page.setBleedBox(12, 22, 270 + i * 100, 440 + i * 50);
    page.setTrimBox(15, 25, 260 + i * 100, 430 + i * 50);
    page.setArtBox(20, 30, 250 + i * 100, 420 + i * 50);
    page.drawText(`${name} page ${i + 1}`, { x: 30, y: 80, font, size: 12 });
    page.drawRectangle({ x: 50, y: 100, width: 30, height: 40, color: rgb(1, 0, 0) });
  }
  await mutate(doc);
  return { id: name, name, blob: new Blob([await doc.save({ addDefaultPage: false })]) };
}

function contents(doc, page) {
  const streams = page.node.Contents();
  const items = streams instanceof PDFArray ? streams.asArray() : [streams];
  return items.map((stream) =>
    Buffer.from(decodePDFRawStream(doc.context.lookup(stream)).decode()).toString("hex"),
  );
}

test("merge produces exactly ordered pages with unchanged boxes, rotations and text/vector streams", async () => {
  const first = await fixture("first.pdf");
  const second = await fixture("second.pdf", () => {}, 3);
  const progress = [];
  const output = await mergeDocuments({ inputs: [second, first], acknowledged: true }, (value) =>
    progress.push(value),
  );
  assert.equal(output.suggestedFilename, "second-merged.pdf");
  assert.equal(output.blob.type, "application/pdf");
  const merged = await PDFDocument.load(await output.blob.arrayBuffer());
  assert.equal(merged.getPageCount(), 5);
  let index = 0;
  for (const input of [second, first]) {
    const source = await PDFDocument.load(await input.blob.arrayBuffer());
    for (const page of source.getPages()) {
      const actual = merged.getPage(index++);
      for (const method of [
        "getMediaBox",
        "getCropBox",
        "getBleedBox",
        "getTrimBox",
        "getArtBox",
        "getRotation",
      ]) {
        assert.deepEqual(actual[method](), page[method]());
      }
      assert.deepEqual(contents(merged, actual), contents(source, page));
    }
  }
  assert.equal(progress.at(-1).phase, "saving");
  assert.equal(progress.at(-1).completed, 5);
  assert.equal((await inspectPdf(first)).pageCount, 2);
});

test("one source and repeated sources are valid without silently omitting pages", async () => {
  const input = await fixture("single.pdf", () => {}, 1);
  for (const inputs of [[input], [input, input]]) {
    const output = await mergeDocuments({ inputs, acknowledged: true }, () => {});
    assert.equal(
      (await PDFDocument.load(await output.blob.arrayBuffer())).getPageCount(),
      inputs.length,
    );
  }
});

test("reject missing acknowledgement, no input, wrong content and corrupt PDFs", async () => {
  await assert.rejects(
    mergeDocuments({ inputs: [], acknowledged: true }, () => {}),
    /Add at least/,
  );
  await assert.rejects(
    mergeDocuments({ inputs: [await fixture()], acknowledged: false }, () => {}),
    /Acknowledge/,
  );
  for (const text of ["not a pdf", "%PDF-1.7\nbroken"]) {
    await assert.rejects(
      inspectPdf({ id: "bad", name: "bad.pdf", blob: new Blob([text]) }),
      /not a PDF|structural validation/,
    );
  }
  await assert.rejects(inspectPdf(await fixture("empty.pdf", () => {}, 0)), /no pages/);
});

test("reject form fields, XFA and signatures, but not ordinary drawn signature content", async () => {
  const form = await fixture("form.pdf", (doc) => {
    doc.getForm().createTextField("name").addToPage(doc.getPage(0));
  });
  await assert.rejects(inspectPdf(form), /flattened, noninteractive/);
  const xfa = await fixture("xfa.pdf", (doc) => {
    doc.catalog.set(PDFName.of("AcroForm"), doc.context.obj({ XFA: doc.context.obj([]) }));
  });
  await assert.rejects(inspectPdf(xfa), /form fields/);
  const signed = await fixture("signed.pdf", (doc) => {
    doc.context.register(doc.context.obj({ Type: "Sig", ByteRange: [0, 100, 200, 300] }));
  });
  await assert.rejects(inspectPdf(signed), /unsigned source copy/);
  const drawn = await fixture("drawn-signature.pdf", (doc) =>
    doc.getPage(0).drawText("Signed by Example"),
  );
  assert.equal((await inspectPdf(drawn)).pageCount, 2);
});

test("reject an encryption dictionary without attempting password handling or bypass", async () => {
  const encrypted = await fixture("encrypted.pdf", (doc) => {
    doc.context.trailerInfo.Encrypt = doc.context.register(
      doc.context.obj({ Filter: "Standard", V: 1, R: 2 }),
    );
  });
  await assert.rejects(inspectPdf(encrypted), /Encrypted PDFs are not supported/);
});

test("required structural checks reject missing references and invalid geometry", async () => {
  const missing = await fixture("missing.pdf", (doc) =>
    doc.getPage(0).node.set(PDFName.of("Contents"), PDFRef.of(9999)),
  );
  await assert.rejects(inspectPdf(missing), /missing/);
  const badBox = await fixture("box.pdf", (doc) =>
    doc.getPage(0).node.set(PDFName.of("MediaBox"), doc.context.obj([0, 0, -5, 20])),
  );
  await assert.rejects(inspectPdf(badBox), /dimensions/);
});

test("warnings identify unsupported features without promising exhaustive detection", async () => {
  const input = await fixture("features.pdf", (doc) => {
    const note = doc.context.register(
      doc.context.obj({ Type: "Annot", Subtype: "Text", Rect: [10, 10, 20, 20] }),
    );
    doc.getPage(0).node.set(PDFName.of("Annots"), doc.context.obj([note]));
    doc.catalog.set(PDFName.of("Outlines"), doc.context.obj({ Type: "Outlines", Count: 0 }));
    doc.catalog.set(PDFName.of("Names"), doc.context.obj({ EmbeddedFiles: { Names: [] } }));
    doc.catalog.set(PDFName.of("StructTreeRoot"), doc.context.obj({ Type: "StructTreeRoot" }));
    doc.catalog.set(PDFName.of("OutputIntents"), doc.context.obj([]));
  });
  const { warnings } = await inspectPdf(input);
  assert.ok(warnings.some((warning) => warning.includes("Annotations")));
  assert.ok(warnings.some((warning) => warning.includes("Document features")));
  const plain = await fixture();
  assert.ok(!(await inspectPdf(plain)).warnings.some((warning) => warning.includes("Annotations")));
});

test("calibrated-limit enforcement rejects above but permits at the boundary", async () => {
  const input = await fixture();
  assert.doesNotThrow(() => enforceLimit(100, 100, "Bytes", "Remove files."));
  assert.throws(() => enforceLimit(101, 100, "Bytes", "Remove files."), /101 exceeds.*100/);
  assert.throws(() => enforceLimit(1, NaN, "Bytes", ""), /invalid/);
  await inspectPdf(input, { perInputBytes: input.blob.size, totalPages: 2 });
  await assert.rejects(inspectPdf(input, { perInputBytes: input.blob.size - 1 }), /input bytes/);
  await assert.rejects(
    mergeDocuments(
      { inputs: [input, input], acknowledged: true, limits: { totalPages: 3 } },
      () => {},
    ),
    /Total pages/,
  );
  await assert.rejects(
    mergeDocuments({ inputs: [input], acknowledged: true, limits: { outputBytes: 1 } }, () => {}),
    /Output bytes/,
  );
});

test("merge filenames are deterministic and filesystem-safe with an empty-stem fallback", () => {
  assert.equal(mergedFilename("report.pdf"), "report-merged.pdf");
  assert.equal(mergedFilename(".report.pdf"), "report-merged.pdf");
  assert.equal(mergedFilename("  . .report.PDF"), "report-merged.pdf");
  assert.equal(mergedFilename(".pdf"), "document-merged.pdf");
  assert.equal(mergedFilename("bad/:*name.PDF"), "bad___name-merged.pdf");
  assert.equal(mergedFilename("... .pdf"), "document-merged.pdf");
});

test("merge enforces combined input limits at and above each configured boundary", async () => {
  const input = await fixture();
  const inputs = [input, input];
  const limits = {
    inputCount: 2,
    perInputBytes: input.blob.size,
    totalInputBytes: input.blob.size * 2,
    totalPages: 4,
  };
  const result = await mergeDocuments({ inputs, acknowledged: true, limits }, () => {});
  assert.equal((await PDFDocument.load(await result.blob.arrayBuffer())).getPageCount(), 4);
  for (const [key, label] of [
    ["inputCount", /Input count/],
    ["perInputBytes", /input bytes/],
    ["totalInputBytes", /Total input bytes/],
    ["totalPages", /Total pages/],
  ]) {
    const progress = [];
    await assert.rejects(
      mergeDocuments(
        { inputs, acknowledged: true, limits: { ...limits, [key]: limits[key] - 1 } },
        (value) => progress.push(value),
      ),
      label,
    );
    if (key !== "totalPages") {
      assert.equal(progress.length, 0, "Known input limits fail before parsing/copying.");
    }
    assert.ok(progress.every((value) => value.phase !== "saving"));
  }
});
