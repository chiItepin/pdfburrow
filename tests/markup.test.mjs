import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { inspectMarkupPdf, flattenMarkup } from "../packages/pdf-engine/src/markupDocuments.ts";
import { inverseTransform } from "../packages/pdf-engine/src/markupGeometry.ts";
import { layoutNote, resizeMarkup, strokeObject } from "../packages/pdf-engine/src/markupLayout.ts";
import { inspectPdf } from "../packages/pdf-engine/src/pdf.ts";
import { inspectArtifact } from "../apps/web/tests/fixtures/pdfArtifacts.ts";

const require = createRequire(new URL("../packages/pdf-engine/package.json", import.meta.url));
const {
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFArray,
  StandardFonts,
  degrees,
  rgb,
  decodePDFRawStream,
} = require("pdf-lib");
const fontBytes = new Uint8Array(
  await readFile(require.resolve("pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf")),
);
const fixture = async (mutate = () => {}) => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const origin of [0, 20, -30]) {
    for (const rotation of [0, 90, 180, 270]) {
      const page = document.addPage([400, 500]);
      page.setMediaBox(origin, origin, 400, 500);
      page.setCropBox(origin + 10, origin + 20, 360, 440);
      page.setRotation(degrees(rotation));
      page.node.set(
        PDFName.of("UserUnit"),
        PDFNumber.of(rotation === 90 ? 1.25 : rotation === 270 ? 2 : 1),
      );
      page.drawText("Original vector text", { x: origin + 140, y: origin + 210, font, size: 12 });
      page.drawRectangle({
        x: origin + 160,
        y: origin + 240,
        width: 20,
        height: 20,
        color: rgb(1, 0, 0),
      });
    }
  }
  await mutate(document);
  return { id: "source", name: "../contract.pdf", blob: new Blob([await document.save()]) };
};
const contentStreams = (document, page) => {
  const contents = page.node.Contents();
  return (contents instanceof PDFArray ? contents.asArray() : [contents]).map((item) =>
    Buffer.from(decodePDFRawStream(document.context.lookup(item)).decode()).toString("hex"),
  );
};

test("markup flattens all four types across rotated/cropped/UserUnit pages without rasterizing or losing base content", async () => {
  const input = await fixture();
  const info = await inspectMarkupPdf(input);
  const objects = info.pages.flatMap((geometry, index) => {
    const page = index + 1;
    const note = layoutNote("España — café €", 160, fontBytes);
    return [
      { id: `highlight-${page}`, page, kind: "highlight", x: 10, y: 10, width: 20, height: 12 },
      {
        id: `note-${page}`,
        page,
        kind: "note",
        x: 40,
        y: 30,
        width: 160,
        height: note.height,
        text: note.text,
      },
      strokeObject(
        "ink",
        [
          [
            { x: 20, y: 75 },
            { x: 50, y: 85 },
          ],
        ],
        `ink-${page}`,
        page,
      ),
      strokeObject(
        "signature",
        [
          [
            { x: 100, y: 100 },
            { x: 125, y: 115 },
          ],
          [
            { x: 120, y: 105 },
            { x: 145, y: 100 },
          ],
        ],
        `signature-${page}`,
        page,
      ),
    ];
  });
  const output = await flattenMarkup({ input, objects, acknowledged: true }, fontBytes, () => {});
  assert.equal(output.suggestedFilename, "_contract-marked.pdf");
  const source = await PDFDocument.load(await input.blob.arrayBuffer());
  const saved = await PDFDocument.load(await output.blob.arrayBuffer());
  assert.equal(saved.getPageCount(), 12);
  for (const [index, page] of saved.getPages().entries()) {
    const original = source.getPage(index);
    for (const method of [
      "getMediaBox",
      "getCropBox",
      "getBleedBox",
      "getTrimBox",
      "getArtBox",
      "getRotation",
    ]) {
      assert.deepEqual(page[method](), original[method]());
    }
    assert.equal(
      page.node.lookup(PDFName.of("UserUnit")).asNumber(),
      original.node.lookup(PDFName.of("UserUnit")).asNumber(),
    );
    for (const stream of contentStreams(source, original)) {
      assert.ok(contentStreams(saved, page).includes(stream), "source content stream is retained");
    }
    assert.equal(page.node.Annots()?.size() ?? 0, 0);
    const raw = contentStreams(saved, page)
      .map((hex) => Buffer.from(hex, "hex").toString())
      .join("\n");
    assert.doesNotMatch(raw, /\/Image| Do\b/);
  }
  const before = await inspectArtifact(new Uint8Array(await input.blob.arrayBuffer()));
  const after = await inspectArtifact(new Uint8Array(await output.blob.arrayBuffer()));
  for (const [index, page] of after.entries()) {
    assert.match(page.text, /Original vector text/);
    assert.match(page.text, /España — café €/);
    assert.equal(page.width, info.pages[index].width);
    assert.equal(page.height, info.pages[index].height);
    assert.deepEqual(page.view, before[index].view);
    const offset = (16 * page.width + 16) * 4;
    assert.deepEqual([...page.pixels.subarray(offset, offset + 3)], [255, 255, 179]);
    assert.notDeepEqual(page.pixels, before[index].pixels);
    const geometry = info.pages[index];
    const inverse = inverseTransform(geometry.transform);
    const [a, b, c, d, e, f] = inverse;
    const x = a * 123 + c * 80 + e,
      y = b * 123 + d * 80 + f;
    const [ta, tb, tc, td, te, tf] = geometry.transform;
    assert.ok(Math.abs(ta * x + tc * y + te - 123) < 1e-9);
    assert.ok(Math.abs(tb * x + td * y + tf - 80) < 1e-9);
  }
  assert.equal(
    (await inspectMarkupPdf({ id: "saved", name: "saved.pdf", blob: output.blob })).pageCount,
    12,
  );
});

test("annotation rejection is markup-only and empty arrays remain supported", async () => {
  const input = await fixture((document) =>
    document
      .getPage(0)
      .node.set(
        PDFName.of("Annots"),
        document.context.obj([{ Type: "Annot", Subtype: "Link", Rect: [10, 10, 20, 20] }]),
      ),
  );
  assert.equal((await inspectPdf(input)).pageCount, 12);
  await assert.rejects(inspectMarkupPdf(input), /annotations or links/);
  await assert.rejects(
    flattenMarkup({ input, objects: [], acknowledged: true }, fontBytes, () => {}),
    /annotations or links/,
  );
  assert.equal(
    (
      await inspectMarkupPdf(
        await fixture((document) =>
          document.getPage(0).node.set(PDFName.of("Annots"), document.context.obj([])),
        ),
      )
    ).pageCount,
    12,
  );
});

test("notes normalize, wrap and reject unsupported glyphs, overflow and invalid marks", async () => {
  assert.equal(layoutNote("cafe\u0301", 80, fontBytes).text, "café");
  assert.ok(layoutNote("one two three four", 30, fontBytes).lines.length > 1);
  for (const text of ["😀", "中文", "a\tb", "\u007f"]) {
    assert.throws(() => layoutNote(text, 100, fontBytes), /Unsupported note character/);
  }
  const input = await fixture();
  for (const object of [
    { id: "bad", page: 1, kind: "highlight", x: -1, y: 0, width: 10, height: 10 },
    { id: "bad", page: 1, kind: "highlight", x: 0, y: 0, width: NaN, height: 10 },
    { id: "bad", page: 99, kind: "highlight", x: 0, y: 0, width: 10, height: 10 },
    { id: "bad", page: 1, kind: "note", x: 0, y: 0, width: 40, height: 10, text: "too much text" },
  ]) {
    await assert.rejects(
      flattenMarkup({ input, objects: [object], acknowledged: true }, fontBytes, () => {}),
    );
  }
  await assert.rejects(
    flattenMarkup({ input, objects: [], acknowledged: false }, fontBytes, () => {}),
    /Acknowledge/,
  );
  await assert.rejects(inspectMarkupPdf(input, { sourcePages: 1 }), /page count/i);
  await assert.rejects(
    flattenMarkup(
      { input, objects: [], acknowledged: true, limits: { outputBytes: 1 } },
      fontBytes,
      () => {},
    ),
    /Output bytes/,
  );
  const drawn = strokeObject(
    "signature",
    [
      [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ],
    ],
    "signature",
    1,
  );
  const scaled = resizeMarkup(drawn, drawn.width * 2, 999);
  assert.equal(scaled.height, drawn.height * 2);
  assert.equal(scaled.strokeWidth, 4);
});
