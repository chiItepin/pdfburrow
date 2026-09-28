import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { PDFDocument, PDFName, PDFString, degrees, rgb } from "pdf-lib";
import { inspectArtifact } from "./pdfArtifacts";

const require = createRequire(import.meta.url);

export const preservationPdfs = async () => {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const font = await document.embedFont(
    await readFile(require.resolve("pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf")),
    { subset: true },
  );
  const text = [
    "Page 1: \u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac",
    "Page 2: \u0420\u0443\u0441\u0441\u043a\u0438\u0439",
    "Page 3: caf\u00e9 and ordinary signature drawing",
  ];
  for (const [index, label] of text.entries()) {
    const width = 340 + index * 70;
    const height = 470 - index * 40;
    const page = document.addPage([width, height]);
    page.setRotation(degrees(index * 90));
    page.setCropBox(10, 15, width - 20, height - 30);
    page.setBleedBox(11, 16, width - 22, height - 32);
    page.setTrimBox(12, 17, width - 24, height - 34);
    page.setArtBox(13, 18, width - 26, height - 36);
    page.drawText(label, { x: 30, y: 100, size: 14, font });
    page.drawRectangle({
      x: 20,
      y: 30,
      width: 60,
      height: 40,
      color: rgb(index / 3, 0.25, 0.75),
    });
    page.drawLine({
      start: { x: 40, y: 150 },
      end: { x: width - 30, y: height - 40 },
      thickness: 3,
      color: rgb(0.1, 0.7, 0.2),
    });
  }
  document.getPage(2).node.set(PDFName.of("UserUnit"), document.context.obj(1.25));
  const annotation = document.context.register(
    document.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [30, 95, 200, 120],
      A: { S: "URI", URI: PDFString.of("https://example.invalid/fixture") },
    }),
  );
  document.getPage(0).node.set(PDFName.of("Annots"), document.context.obj([annotation]));
  document.catalog.set(
    PDFName.of("Outlines"),
    document.context.obj({ Type: "Outlines", Count: 0 }),
  );
  await document.attach(new Uint8Array([65, 66, 67]), "fixture.txt");
  const buffer = Buffer.from(await document.save());
  const rendered = await inspectArtifact(buffer);
  const first = rendered[0];
  if (!first) {
    throw new Error("Missing source page for the scan fixture.");
  }
  const scan = await PDFDocument.create();
  const image = await scan.embedPng(first.png);
  scan.addPage([first.width, first.height]).drawImage(image, {
    x: 0,
    y: 0,
    width: first.width,
    height: first.height,
  });
  return [
    { name: "embedded-text.pdf", mimeType: "application/pdf", buffer, text },
    {
      name: "scan.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await scan.save()),
      text: [""],
    },
  ];
};

export const protectedPdf = async (name: string) => ({
  name,
  mimeType: "application/pdf",
  buffer: await readFile(new URL(`../../../../tests/fixtures/${name}`, import.meta.url)),
});

export const malformedPageTree = async () => {
  const document = await PDFDocument.create();
  document.addPage([300, 400]).drawText("Must not silently succeed");
  const tree = document.catalog.Pages();
  tree.Kids().push(document.context.register(document.context.obj({ Type: "NotAPage" })));
  tree.set(PDFName.of("Count"), document.context.obj(2));
  return {
    name: "incomplete-pages.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await document.save()),
  };
};
