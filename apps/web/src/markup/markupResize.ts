import type { MarkupGeometry, MarkupObject, MarkupPoint } from "@repo/pdf-engine";
import { resizeMarkup } from "@repo/pdf-engine/markup-layout";

export const markupResizeCorners = ["nw", "ne", "sw", "se"] as const;
export type MarkupResizeCorner = (typeof markupResizeCorners)[number];
export type ResizableMarkup = MarkupObject & { kind: "ink" | "signature" | "highlight" };

export const markupCornerPosition = (
  object: MarkupObject,
  corner: MarkupResizeCorner,
): MarkupPoint => ({
  x: object.x + (corner.endsWith("e") ? object.width : 0),
  y: object.y + (corner.startsWith("s") ? object.height : 0),
});

export const nearestMarkupResizeCorner = (object: MarkupObject, position: MarkupPoint) =>
  markupResizeCorners.reduce<MarkupResizeCorner>((nearest, corner) => {
    const current = markupCornerPosition(object, nearest);
    const candidate = markupCornerPosition(object, corner);
    const distance = (point: MarkupPoint) =>
      (point.x - position.x) ** 2 + (point.y - position.y) ** 2;
    return distance(candidate) < distance(current) ? corner : nearest;
  }, "nw");

export const resizeMarkupAtCorner = (
  object: ResizableMarkup,
  corner: MarkupResizeCorner,
  position: MarkupPoint,
  page: MarkupGeometry,
): MarkupObject => {
  const left = corner.endsWith("w");
  const top = corner.startsWith("n");
  const fixedX = object.x + (left ? object.width : 0);
  const fixedY = object.y + (top ? object.height : 0);
  const maximumWidth = left ? fixedX : page.width - fixedX;
  const maximumHeight = top ? fixedY : page.height - fixedY;
  const minimumWidth = Math.min(1, object.width);
  const minimumHeight = Math.min(1, object.height);
  const width = Math.max(minimumWidth, left ? fixedX - position.x : position.x - fixedX);
  const height = Math.max(minimumHeight, top ? fixedY - position.y : position.y - fixedY);
  let resized: MarkupObject;
  if (object.kind === "highlight") {
    resized = resizeMarkup(object, Math.min(maximumWidth, width), Math.min(maximumHeight, height));
  } else {
    const projection =
      (width * object.width + height * object.height) / (object.width ** 2 + object.height ** 2);
    const factor = Math.min(
      maximumWidth / object.width,
      maximumHeight / object.height,
      Math.max(minimumWidth / object.width, minimumHeight / object.height, projection),
    );
    resized = resizeMarkup(object, object.width * factor, object.height * factor);
  }
  return {
    ...resized,
    x: left ? fixedX - resized.width : fixedX,
    y: top ? fixedY - resized.height : fixedY,
  };
};

export const getMarkupResizeOptions = (object: MarkupObject | undefined, page: MarkupGeometry) => {
  if (!object || object.kind === "note") {
    return { smaller: undefined, bigger: undefined };
  }
  const resize = (factor: number) => {
    const candidate = resizeMarkupAtCorner(
      object,
      "se",
      { x: object.x + object.width * factor, y: object.y + object.height * factor },
      page,
    );
    return candidate.width === object.width && candidate.height === object.height
      ? undefined
      : candidate;
  };
  return { smaller: resize(1 / 1.1), bigger: resize(1.1) };
};
