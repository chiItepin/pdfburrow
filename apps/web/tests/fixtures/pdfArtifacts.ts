import { createRequire } from "node:module";
import { dirname, sep } from "node:path";
import { AnnotationMode, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);
const standardFontDataUrl =
  dirname(require.resolve("pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf")) + sep;

export const inspectArtifact = async (bytes: Uint8Array, password?: string) => {
  const task = getDocument({
    data: new Uint8Array(bytes),
    password,
    standardFontDataUrl,
    useSystemFonts: false,
    disableFontFace: true,
    useWasm: false,
    stopAtErrors: true,
  });
  try {
    const document = await task.promise;
    const factory = document.canvasFactory;
    if (
      !("create" in factory) ||
      typeof factory.create !== "function" ||
      !("destroy" in factory) ||
      typeof factory.destroy !== "function"
    ) {
      throw new Error("PDF.js did not provide its Node canvas factory.");
    }
    const pages = [];
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index);
      const text = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });
      const target = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
      try {
        await page.render({
          canvas: target.canvas,
          canvasContext: target.context,
          viewport,
          annotationMode: AnnotationMode.DISABLE,
          background: "white",
        }).promise;
        const pixels: Uint8ClampedArray = target.context.getImageData(
          0,
          0,
          target.canvas.width,
          target.canvas.height,
        ).data;
        pages.push({
          textItems: text.items.flatMap((item) =>
            "str" in item ? [{ text: item.str, width: item.width }] : [],
          ),
          text: text.items
            .filter((item) => "str" in item)
            .map((item) => item.str)
            .join(" ")
            .trim(),
          view: page.view,
          rotation: page.rotate,
          userUnit: page.userUnit,
          width: Math.ceil(viewport.width),
          height: Math.ceil(viewport.height),
          pixels: Buffer.from(pixels),
          png: Buffer.from(target.canvas.toBuffer("image/png")),
        });
      } finally {
        factory.destroy(target);
      }
    }
    return pages;
  } finally {
    await task.destroy();
  }
};
