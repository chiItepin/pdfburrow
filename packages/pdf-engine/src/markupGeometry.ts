import { PDFArray, PDFName, PDFNumber } from "pdf-lib";
import type { PDFDocument, PDFPage } from "pdf-lib";
import { PdfError } from "./pdfError.ts";
import type { MarkupGeometry } from "./markupTypes.ts";

export const inspectMarkupAnnotations = (document: PDFDocument) => {
  for (const page of document.getPages()) {
    const annotations = page.node.lookup(PDFName.of("Annots"));
    if (annotations && (!(annotations instanceof PDFArray) || annotations.size() > 0)) {
      throw new PdfError(
        "unsupported",
        "Existing page annotations or links are not supported for markup. Obtain a flattened, noninteractive source copy using another PDF tool.",
      );
    }
  }
};

export const markupGeometry = (page: PDFPage): MarkupGeometry => {
  const media = page.getMediaBox();
  const crop = page.getCropBox();
  const x = Math.max(media.x, crop.x);
  const y = Math.max(media.y, crop.y);
  const right = Math.min(media.x + media.width, crop.x + crop.width);
  const top = Math.min(media.y + media.height, crop.y + crop.height);
  const box = right > x && top > y ? { x, y, width: right - x, height: top - y } : media;
  const unitObject = page.node.lookup(PDFName.of("UserUnit"));
  const unit = unitObject instanceof PDFNumber ? unitObject.asNumber() : 1;
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const left = box.x;
  const bottom = box.y;
  const r = left + box.width;
  const t = bottom + box.height;
  const transforms: Record<number, MarkupGeometry["transform"]> = {
    0: [unit, 0, 0, -unit, -left * unit, t * unit],
    90: [0, unit, unit, 0, -bottom * unit, -left * unit],
    180: [-unit, 0, 0, unit, r * unit, -bottom * unit],
    270: [0, -unit, -unit, 0, t * unit, r * unit],
  };
  const transform = transforms[rotation];
  if (!transform) {
    throw new PdfError("invalid", "Unsupported page rotation.");
  }
  return {
    width: (rotation % 180 ? box.height : box.width) * unit,
    height: (rotation % 180 ? box.width : box.height) * unit,
    transform,
  };
};

export const inverseTransform = ([
  a,
  b,
  c,
  d,
  e,
  f,
]: MarkupGeometry["transform"]): MarkupGeometry["transform"] => {
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || determinant === 0) {
    throw new PdfError("invalid", "The PDF page coordinate transform is invalid.");
  }
  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ];
};
