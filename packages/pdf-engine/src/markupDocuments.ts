import fontkit from "@pdf-lib/fontkit";
import {
  concatTransformationMatrix,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setLineCap,
  setLineJoin,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
  LineCapStyle,
  LineJoinStyle,
} from "pdf-lib";
import { loadValidatedPdf, enforceLimit } from "./pdf.ts";
import { PdfError } from "./pdfError.ts";
import { pdfStem } from "./pdfFilename.ts";
import { inspectMarkupAnnotations, inverseTransform, markupGeometry } from "./markupGeometry.ts";
import { createNoteFontFeatures, layoutNote, markupBoundsError } from "./markupLayout.ts";
import type { MarkupInfo, MarkupRequest } from "./markupTypes.ts";
import type { PdfInput, PdfLimits, PdfOutput, PdfProgress } from "./types";

export const inspectMarkupPdf = async (
  input: PdfInput,
  limits: PdfLimits = {},
): Promise<MarkupInfo> => {
  const { document, info } = await loadValidatedPdf(input, limits);
  inspectMarkupAnnotations(document);
  return { ...info, pages: document.getPages().map(markupGeometry) };
};

export const flattenMarkup = async (
  request: MarkupRequest,
  fontBytes: Uint8Array,
  progress: (value: PdfProgress) => void,
): Promise<PdfOutput> => {
  if (!request.acknowledged) {
    throw new PdfError("invalid", "Acknowledge the flattened PDF limitations before generating.");
  }
  progress({ phase: "validating", completed: 0, total: 1 });
  const { document } = await loadValidatedPdf(request.input, request.limits ?? {});
  inspectMarkupAnnotations(document);
  document.registerFontkit(fontkit);
  const font = request.objects.some((object) => object.kind === "note")
    ? await document.embedFont(fontBytes, { subset: true, features: createNoteFontFeatures() })
    : null;
  const pages = document.getPages();
  for (const [index, object] of request.objects.entries()) {
    const page = pages[object.page - 1];
    if (!Number.isInteger(object.page) || !page) {
      throw new PdfError("invalid", "Markup refers to an unavailable page.");
    }
    const geometry = markupGeometry(page);
    const error = markupBoundsError(object, geometry);
    if (error) {
      throw new PdfError("invalid", error);
    }
    const transform = inverseTransform(geometry.transform);
    // Work in physical top-left points. Notes reflect locally to keep glyphs upright.
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...transform));
    if (object.kind === "highlight") {
      page.drawRectangle({
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
        color: rgb(1, 1, 0),
        opacity: 0.3,
        borderWidth: 0,
      });
    } else if (object.kind === "note") {
      if (!font) {
        throw new PdfError("generation", "The embedded note font is unavailable.");
      }
      const layout = layoutNote(object.text, object.width, fontBytes);
      if (Math.abs(layout.height - object.height) > 0.01) {
        throw new PdfError(
          "invalid",
          "The note dimensions do not match its text. Edit and save the note again.",
        );
      }
      page.pushOperators(
        pushGraphicsState(),
        concatTransformationMatrix(1, 0, 0, -1, object.x, object.y),
      );
      layout.lines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: 0,
          y: -layout.ascent - lineIndex * 14.4,
          size: 12,
          font,
          color: rgb(0, 0, 0),
        });
      });
      page.pushOperators(popGraphicsState());
    } else {
      if (
        !Number.isFinite(object.strokeWidth) ||
        object.strokeWidth <= 0 ||
        !object.strokes.length
      ) {
        throw new PdfError("invalid", "A drawn mark has invalid strokes.");
      }
      page.pushOperators(
        setLineWidth(object.strokeWidth),
        setStrokingRgbColor(0, 0, 0),
        setLineCap(LineCapStyle.Round),
        setLineJoin(LineJoinStyle.Round),
      );
      for (const points of object.strokes) {
        const first = points[0];
        if (
          !first ||
          points.some(
            (point) =>
              !Number.isFinite(point.x) ||
              !Number.isFinite(point.y) ||
              point.x < object.strokeWidth / 2 - 0.001 ||
              point.y < object.strokeWidth / 2 - 0.001 ||
              point.x > object.width - object.strokeWidth / 2 + 0.001 ||
              point.y > object.height - object.strokeWidth / 2 + 0.001,
          )
        ) {
          throw new PdfError("invalid", "A drawn mark exceeds its bounds.");
        }
        page.pushOperators(moveTo(object.x + first.x, object.y + first.y));
        for (const point of points.slice(1)) {
          page.pushOperators(lineTo(object.x + point.x, object.y + point.y));
        }
        if (points.length === 1) {
          page.pushOperators(lineTo(object.x + first.x + 0.001, object.y + first.y));
        }
        page.pushOperators(stroke());
      }
    }
    page.pushOperators(popGraphicsState());
    progress({ phase: "copying", completed: index + 1, total: request.objects.length });
  }
  progress({ phase: "saving", completed: pages.length, total: pages.length });
  const bytes = await document.save();
  enforceLimit(
    bytes.byteLength,
    request.limits?.outputBytes,
    "Output bytes",
    "Use fewer marks or a smaller source PDF.",
  );
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    suggestedFilename: `${pdfStem(request.input.name)}-marked.pdf`,
  };
};
