import type { MarkupGeometry, MarkupObject, MarkupPoint } from "@repo/pdf-engine";
import { markupCornerPosition, resizeMarkupAtCorner } from "./markupResize";
import type { MarkupResizeCorner, ResizableMarkup } from "./markupResize";

export const getMarkupPoint = (
  geometry: MarkupGeometry,
  bounds: Readonly<{ left: number; top: number; width: number; height: number }>,
  position: MarkupPoint,
): MarkupPoint => ({
  x: Math.max(
    1,
    Math.min(geometry.width - 1, ((position.x - bounds.left) * geometry.width) / bounds.width),
  ),
  y: Math.max(
    1,
    Math.min(geometry.height - 1, ((position.y - bounds.top) * geometry.height) / bounds.height),
  ),
});

export type MarkupGesture =
  | { kind: "ink"; points: readonly MarkupPoint[]; pointerId: number | null }
  | { kind: "highlight"; start: MarkupPoint; end: MarkupPoint; pointerId: number }
  | {
      kind: "move";
      start: MarkupPoint;
      original: MarkupObject;
      candidate: MarkupObject;
      pointerId: number | null;
    }
  | {
      kind: "resize";
      start: MarkupPoint;
      corner: MarkupResizeCorner;
      original: ResizableMarkup;
      candidate: MarkupObject;
      pointerId: number;
    };

export const moveMarkupGesture = (
  gesture: MarkupGesture,
  position: MarkupPoint,
  page: MarkupGeometry,
): MarkupGesture => {
  if (gesture.kind === "ink") {
    return { ...gesture, points: [...gesture.points, position] };
  }
  if (gesture.kind === "highlight") {
    return { ...gesture, end: position };
  }
  if (gesture.kind === "resize") {
    const corner = markupCornerPosition(gesture.original, gesture.corner);
    return {
      ...gesture,
      candidate: resizeMarkupAtCorner(
        gesture.original,
        gesture.corner,
        {
          x: corner.x + position.x - gesture.start.x,
          y: corner.y + position.y - gesture.start.y,
        },
        page,
      ),
    };
  }
  return {
    ...gesture,
    candidate: {
      ...gesture.original,
      x: Math.max(
        0,
        Math.min(
          page.width - gesture.original.width,
          gesture.original.x + position.x - gesture.start.x,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          page.height - gesture.original.height,
          gesture.original.y + position.y - gesture.start.y,
        ),
      ),
    },
  };
};
