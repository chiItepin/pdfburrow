import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { MarkupGeometry, MarkupObject, MarkupPoint } from "@repo/pdf-engine";
import { markupBoundsError, strokeObject } from "@repo/pdf-engine/markup-layout";
import { getMarkupPoint, moveMarkupGesture } from "./markupGesture";
import type { MarkupGesture } from "./markupGesture";
import { markupResizeCorners, nearestMarkupResizeCorner } from "./markupResize";

export type MarkupTool = "select" | "hand" | "ink" | "highlight" | "note";
interface Options {
  readonly page: number;
  readonly geometry: MarkupGeometry;
  readonly tool: MarkupTool;
  readonly disabled: boolean;
  readonly objects: readonly MarkupObject[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string | null) => void;
  readonly onAdd: (object: MarkupObject) => void;
  readonly onUpdate: (object: MarkupObject) => void;
  readonly onNote: (position: MarkupPoint) => void;
  readonly onBusy: (busy: boolean) => void;
  readonly onAdded: () => void;
  readonly onError: (message: string) => void;
}
export const usePageGestures = (options: Options) => {
  const { geometry, tool, disabled, page } = options;
  const [gesture, setGesture] = useState<MarkupGesture | null>(null);
  const current = useRef<MarkupGesture | null>(null);
  const capture = useRef<{ element: HTMLDivElement; pointerId: number } | null>(null);
  const [cursor, setCursor] = useState<MarkupPoint>({
    x: geometry.width / 2,
    y: geometry.height / 2,
  });
  const set = (next: MarkupGesture | null) => {
    current.current = next;
    setGesture(next);
    if (!next && capture.current) {
      const { element, pointerId } = capture.current;
      capture.current = null;
      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
    }
    options.onBusy(Boolean(next));
  };
  const cancel = () => set(null);
  const point = (event: PointerEvent) =>
    getMarkupPoint(geometry, event.currentTarget.getBoundingClientRect(), {
      x: event.clientX,
      y: event.clientY,
    });
  const finish = () => {
    const value = current.current;
    set(null);
    if (!value) {
      return;
    }
    if (value.kind === "move" || value.kind === "resize") {
      if (
        value.candidate.x !== value.original.x ||
        value.candidate.y !== value.original.y ||
        value.candidate.width !== value.original.width ||
        value.candidate.height !== value.original.height
      ) {
        options.onUpdate(value.candidate);
      }
      return;
    }
    const id = crypto.randomUUID();
    const object: MarkupObject =
      value.kind === "ink"
        ? strokeObject("ink", [value.points], id, page)
        : {
            id,
            kind: "highlight",
            page,
            x: Math.min(value.start.x, value.end.x),
            y: Math.min(value.start.y, value.end.y),
            width: Math.max(1, Math.abs(value.end.x - value.start.x)),
            height: Math.max(1, Math.abs(value.end.y - value.start.y)),
          };
    const error = markupBoundsError(object, geometry);
    if (!error) {
      options.onAdd(object);
      options.onAdded();
    } else {
      options.onError(error);
    }
  };
  const interrupt = () => {
    if (current.current?.kind === "move" || current.current?.kind === "resize") {
      finish();
    } else if (current.current) {
      cancel();
    }
  };
  const move = (position: MarkupPoint) => {
    const value = current.current;
    if (!value) {
      return;
    }
    set(moveMarkupGesture(value, position, geometry));
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || tool === "hand" || event.button !== 0 || current.current) {
      return;
    }
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    const position = point(event);
    setCursor(position);
    if (tool === "note") {
      options.onNote(position);
      return;
    }
    if (tool === "ink") {
      set({ kind: "ink", points: [position], pointerId: event.pointerId });
    } else if (tool === "highlight") {
      set({ kind: "highlight", start: position, end: position, pointerId: event.pointerId });
    } else {
      const target =
        event.target instanceof Element
          ? event.target.closest("[data-markup-id],[data-markup-selection]")
          : null;
      const id =
        target?.getAttribute("data-markup-id") ??
        target?.getAttribute("data-markup-selection") ??
        null;
      options.onSelect(id);
      const object = options.objects.find((object) => object.id === id);
      if (object) {
        const handle =
          event.target instanceof Element
            ? event.target.closest("[data-markup-resize]")?.getAttribute("data-markup-resize")
            : null;
        const corner = markupResizeCorners.some((corner) => corner === handle)
          ? nearestMarkupResizeCorner(object, position)
          : undefined;
        set(
          corner && object.kind !== "note"
            ? {
                kind: "resize",
                corner,
                start: position,
                original: object,
                candidate: object,
                pointerId: event.pointerId,
              }
            : {
                kind: "move",
                start: position,
                original: object,
                candidate: object,
                pointerId: event.pointerId,
              },
        );
      }
    }
    if (current.current) {
      event.currentTarget.setPointerCapture(event.pointerId);
      capture.current = { element: event.currentTarget, pointerId: event.pointerId };
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || tool === "hand") {
      return;
    }
    if (event.key === "Escape" && current.current) {
      event.preventDefault();
      cancel();
      return;
    }
    if (current.current && current.current.pointerId !== null) {
      return;
    }
    if (event.key === " " && tool === "ink") {
      event.preventDefault();
      if (event.repeat) {
        return;
      }
      if (current.current) {
        finish();
      } else {
        set({ kind: "ink", points: [cursor], pointerId: null });
      }
      return;
    }
    const directions: Record<string, MarkupPoint> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    if (!direction) {
      return;
    }
    event.preventDefault();
    if (tool === "ink") {
      const step = event.shiftKey ? 10 : 3;
      const next = {
        x: Math.max(1, Math.min(geometry.width - 1, cursor.x + direction.x * step)),
        y: Math.max(1, Math.min(geometry.height - 1, cursor.y + direction.y * step)),
      };
      setCursor(next);
      if (current.current?.kind === "ink" && current.current.pointerId === null) {
        move(next);
      }
      return;
    }
    const object =
      current.current?.kind === "move"
        ? current.current.candidate
        : options.objects.find((object) => object.id === options.selectedId);
    if (!object) {
      return;
    }
    const step = event.shiftKey ? 10 : 1;
    const candidate = {
      ...object,
      x: Math.max(0, Math.min(geometry.width - object.width, object.x + direction.x * step)),
      y: Math.max(0, Math.min(geometry.height - object.height, object.y + direction.y * step)),
    };
    const original = current.current?.kind === "move" ? current.current.original : object;
    set({
      kind: "move",
      start: { x: object.x, y: object.y },
      original,
      candidate,
      pointerId: null,
    });
  };
  const overlay =
    gesture?.kind === "move" || gesture?.kind === "resize"
      ? options.objects.map((object) =>
          object.id === gesture.candidate.id ? gesture.candidate : object,
        )
      : options.objects;
  return {
    gesture,
    cursor,
    overlay,
    handlers: {
      onPointerDown,
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        if (current.current?.pointerId === event.pointerId) {
          move(point(event));
        }
      },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
        if (current.current?.pointerId === event.pointerId) {
          if (current.current.kind === "ink" || current.current.kind === "highlight") {
            move(point(event));
          }
          finish();
        }
      },
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) => {
        if (current.current?.pointerId === event.pointerId) {
          interrupt();
        }
      },
      onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => {
        if (current.current?.pointerId === event.pointerId) {
          interrupt();
        }
      },
      onBlur: interrupt,
      onKeyDown,
      onKeyUp: (event: KeyboardEvent<HTMLDivElement>) => {
        if (
          event.key.startsWith("Arrow") &&
          current.current?.kind === "move" &&
          current.current.pointerId === null
        ) {
          finish();
        }
      },
    },
  };
};
