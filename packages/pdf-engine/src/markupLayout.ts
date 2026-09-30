import fontkit from "@pdf-lib/fontkit";
import { PdfError } from "./pdfError.ts";
import type { MarkupGeometry, MarkupObject, MarkupPoint } from "./markupTypes.ts";

// Fontkit expands feature maps in place; each shaping operation needs its own map.
export const createNoteFontFeatures = () => ({
  kern: false,
  liga: false,
  clig: false,
  dlig: false,
  hlig: false,
});

export const layoutNote = (text: string, width: number, bytes: Uint8Array) => {
  const font = fontkit.create(bytes);
  if (!("unitsPerEm" in font)) {
    throw new PdfError("generation", "The local note font is not a single font.");
  }
  const normalized = text.normalize("NFC");
  if (!normalized.trim() || !Number.isFinite(width) || width <= 0) {
    throw new PdfError("invalid", "Enter note text and a positive width.");
  }
  for (const character of normalized) {
    const code = character.codePointAt(0) ?? 0;
    if (character === "\n") {
      continue;
    }
    const allowed =
      (code >= 32 && code <= 126) || (code >= 160 && code <= 383) || "–—‘’“”…€".includes(character);
    if (!allowed || !font.hasGlyphForCodePoint(code)) {
      throw new PdfError(
        "unsupported",
        `Unsupported note character ${JSON.stringify(character)} (U+${code.toString(16).toUpperCase()}). Use Western European text and supported punctuation.`,
      );
    }
  }
  const measure = (value: string) =>
    (font
      .layout(value, createNoteFontFeatures())
      .glyphs.reduce((sum, glyph) => sum + glyph.advanceWidth, 0) *
      12) /
    font.unitsPerEm;
  const lines: string[] = [];
  for (const paragraph of normalized.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/(?<= )/u)) {
      if (line && measure(line + word) > width) {
        lines.push(line.trimEnd());
        line = "";
      }
      for (const character of word) {
        if (measure(character) > width) {
          throw new PdfError("invalid", "The note width is too small for its characters.");
        }
        if (line && measure(line + character) > width) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    lines.push(line.trimEnd());
  }
  const ascent = (font.ascent * 12) / font.unitsPerEm;
  const descent = (-font.descent * 12) / font.unitsPerEm;
  return { text: normalized, lines, ascent, height: ascent + descent + (lines.length - 1) * 14.4 };
};

export const markupBoundsError = (object: MarkupObject, page: MarkupGeometry) => {
  const values = [object.x, object.y, object.width, object.height];
  if (!values.every(Number.isFinite) || object.width <= 0 || object.height <= 0) {
    return "Markup needs finite, positive dimensions.";
  }
  if (
    object.x < 0 ||
    object.y < 0 ||
    object.x + object.width > page.width + 0.001 ||
    object.y + object.height > page.height + 0.001
  ) {
    return "This markup would overflow the visible page. Move it or reduce its size.";
  }
  return "";
};

export const strokeObject = (
  kind: "ink" | "signature",
  strokes: readonly (readonly MarkupPoint[])[],
  id: string,
  page: number,
): MarkupObject => {
  const points = strokes.flat();
  if (
    !points.length ||
    points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))
  ) {
    throw new PdfError("invalid", "Draw at least one complete stroke.");
  }
  const bounds = points.reduce(
    (bounds, point) => ({
      left: Math.min(bounds.left, point.x),
      top: Math.min(bounds.top, point.y),
      right: Math.max(bounds.right, point.x),
      bottom: Math.max(bounds.bottom, point.y),
    }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
  );
  const x = bounds.left - 1;
  const y = bounds.top - 1;
  const width = bounds.right - x + 1;
  const height = bounds.bottom - y + 1;
  return {
    id,
    page,
    kind,
    x,
    y,
    width,
    height,
    strokeWidth: 2,
    strokes: strokes.map((stroke) => stroke.map((point) => ({ x: point.x - x, y: point.y - y }))),
  };
};

export const resizeMarkup = (object: MarkupObject, width: number, height: number): MarkupObject => {
  if (object.kind === "highlight") {
    return { ...object, width, height };
  }
  if (object.kind === "note") {
    return { ...object, width };
  }
  const scale = width / object.width;
  return {
    ...object,
    width,
    height: object.height * scale,
    strokeWidth: object.strokeWidth * scale,
    strokes: object.strokes.map((stroke) =>
      stroke.map((point) => ({ x: point.x * scale, y: point.y * scale })),
    ),
  };
};
