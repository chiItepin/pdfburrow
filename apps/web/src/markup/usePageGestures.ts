import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { MarkupGeometry, MarkupObject, MarkupPoint } from "@repo/pdf-engine";
import { markupBoundsError, strokeObject } from "@repo/pdf-engine/markup-layout";

export type MarkupTool = "select" | "ink" | "highlight" | "note";
type Gesture =
  | { kind: "ink"; points: readonly MarkupPoint[]; keyboard: boolean }
  | { kind: "highlight"; start: MarkupPoint; end: MarkupPoint }
  | {
      kind: "move";
      start: MarkupPoint;
      original: MarkupObject;
      candidate: MarkupObject;
      keyboard: boolean;
    };
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
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const current = useRef<Gesture | null>(null);
  const [cursor, setCursor] = useState<MarkupPoint>({
    x: geometry.width / 2,
    y: geometry.height / 2,
  });
  const set = (next: Gesture | null) => {
    current.current = next;
    setGesture(next);
    options.onBusy(Boolean(next));
  };
  const cancel = () => set(null);
  const point = (event: PointerEvent) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        1,
        Math.min(
          geometry.width - 1,
          ((event.clientX - bounds.left) * geometry.width) / bounds.width,
        ),
      ),
      y: Math.max(
        1,
        Math.min(
          geometry.height - 1,
          ((event.clientY - bounds.top) * geometry.height) / bounds.height,
        ),
      ),
    };
  };
  const finish = () => {
    const value = current.current;
    set(null);
    if (!value) {
      return;
    }
    if (value.kind === "move") {
      if (value.candidate.x !== value.original.x || value.candidate.y !== value.original.y) {
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
  const move = (position: MarkupPoint) => {
    const value = current.current;
    if (!value) {
      return;
    }
    if (value.kind === "ink") {
      set({ ...value, points: [...value.points, position] });
    }
    if (value.kind === "highlight") {
      set({ ...value, end: position });
    }
    if (value.kind === "move") {
      set({
        ...value,
        candidate: {
          ...value.original,
          x: Math.max(
            0,
            Math.min(
              geometry.width - value.original.width,
              value.original.x + position.x - value.start.x,
            ),
          ),
          y: Math.max(
            0,
            Math.min(
              geometry.height - value.original.height,
              value.original.y + position.y - value.start.y,
            ),
          ),
        },
      });
    }
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0 || current.current) {
      return;
    }
    event.preventDefault();
    event.currentTarget.focus();
    const position = point(event);
    setCursor(position);
    if (tool === "note") {
      options.onNote(position);
      return;
    }
    if (tool === "ink") {
      set({ kind: "ink", points: [position], keyboard: false });
    } else if (tool === "highlight") {
      set({ kind: "highlight", start: position, end: position });
    } else {
      const target =
        event.target instanceof Element ? event.target.closest("[data-markup-id]") : null;
      const id = target?.getAttribute("data-markup-id") ?? null;
      options.onSelect(id);
      const object = options.objects.find((object) => object.id === id);
      if (object) {
        set({
          kind: "move",
          start: position,
          original: object,
          candidate: object,
          keyboard: false,
        });
      }
    }
    if (current.current) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    if (event.key === "Escape" && current.current) {
      event.preventDefault();
      cancel();
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
        set({ kind: "ink", points: [cursor], keyboard: true });
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
      if (current.current?.kind === "ink" && current.current.keyboard) {
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
    set({ kind: "move", start: { x: object.x, y: object.y }, original, candidate, keyboard: true });
  };
  const overlay =
    gesture?.kind === "move"
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
        if (current.current && !("keyboard" in current.current && current.current.keyboard)) {
          move(point(event));
        }
      },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
        if (current.current && !("keyboard" in current.current && current.current.keyboard)) {
          move(point(event));
          finish();
        }
      },
      onPointerCancel: cancel,
      onLostPointerCapture: cancel,
      onBlur: cancel,
      onKeyDown,
      onKeyUp: (event: KeyboardEvent<HTMLDivElement>) => {
        if (
          event.key.startsWith("Arrow") &&
          current.current?.kind === "move" &&
          current.current.keyboard
        ) {
          finish();
        }
      },
    },
  };
};
