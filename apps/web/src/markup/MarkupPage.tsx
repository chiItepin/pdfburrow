import { useEffect, useRef, useState } from "react";
import { Button } from "@repo/core-ui";
import type { MarkupGeometry, MarkupObject, MarkupPoint } from "@repo/pdf-engine";
import { useMarkupPage } from "./useMarkupPage";
import { usePageGestures } from "./usePageGestures";
import type { MarkupTool } from "./usePageGestures";
import { MarkupObjects } from "./MarkupObjects";

export type MarkupZoom = "page" | "width" | number;
export const MarkupPage = ({
  file,
  page,
  geometry,
  zoom,
  tool,
  objects,
  selectedId,
  fontBytes,
  disabled,
  paused,
  onSelect,
  onAdd,
  onUpdate,
  onNote,
  onBusy,
  onAdded,
  onError,
}: {
  file: File;
  page: number;
  geometry: MarkupGeometry;
  zoom: MarkupZoom;
  tool: MarkupTool;
  objects: readonly MarkupObject[];
  selectedId: string | null;
  fontBytes?: Uint8Array;
  disabled: boolean;
  paused: boolean;
  onSelect: (id: string | null) => void;
  onAdd: (object: MarkupObject) => void;
  onUpdate: (object: MarkupObject) => void;
  onNote: (position: MarkupPoint) => void;
  onBusy: (busy: boolean) => void;
  onAdded: () => void;
  onError: (message: string) => void;
}) => {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 600 });
  useEffect(() => {
    const element = container.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() =>
      setSize({
        width: Math.max(1, element.clientWidth - 32),
        height: Math.max(1, element.clientHeight - 32),
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const scale =
    typeof zoom === "number"
      ? zoom / 100
      : zoom === "width"
        ? size.width / geometry.width
        : Math.min(size.width / geometry.width, size.height / geometry.height);
  const { preview, retry } = useMarkupPage(file, page, geometry, paused);
  const draw = usePageGestures({
    page,
    geometry,
    tool,
    objects,
    selectedId,
    disabled: disabled || preview.state !== "ready",
    onSelect,
    onAdd,
    onUpdate,
    onNote,
    onBusy,
    onAdded,
    onError,
  });
  return (
    <>
      <div
        ref={container}
        className="mt-4 h-[min(65dvh,700px)] min-h-80 overflow-auto rounded-md border bg-muted p-4"
      >
        {preview.state === "error" ? (
          <div className="p-4">
            <p role="alert" className="mb-4 text-destructive">
              {preview.message}
            </p>
            <Button variant="outline" disabled={paused} onClick={retry}>
              Retry page preview
            </Button>
          </div>
        ) : preview.state === "loading" ? (
          <p role="status" className="p-4">
            Rendering this page locally…
          </p>
        ) : (
          <div
            role="button"
            aria-roledescription="markup canvas"
            aria-label={`PDF markup canvas, page ${page}`}
            tabIndex={0}
            aria-describedby="markup-canvas-help"
            className="relative mx-auto touch-none bg-white shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ width: geometry.width * scale, height: geometry.height * scale }}
            {...draw.handlers}
          >
            <img
              src={preview.url}
              alt={`Original PDF page ${page}`}
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
            <svg
              viewBox={`0 0 ${geometry.width} ${geometry.height}`}
              className="absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <MarkupObjects objects={draw.overlay} selectedId={selectedId} fontBytes={fontBytes} />
              {draw.gesture?.kind === "ink" && (
                <polyline
                  points={draw.gesture.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="black"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {draw.gesture?.kind === "highlight" && (
                <rect
                  x={Math.min(draw.gesture.start.x, draw.gesture.end.x)}
                  y={Math.min(draw.gesture.start.y, draw.gesture.end.y)}
                  width={Math.abs(draw.gesture.end.x - draw.gesture.start.x)}
                  height={Math.abs(draw.gesture.end.y - draw.gesture.start.y)}
                  fill="yellow"
                  fillOpacity={0.3}
                />
              )}
              {tool === "ink" && (
                <circle cx={draw.cursor.x} cy={draw.cursor.y} r={3} fill="none" stroke="#205b49" />
              )}
            </svg>
          </div>
        )}
      </div>
      <p id="markup-canvas-help" className="mt-3 text-sm text-muted-foreground">
        {tool === "ink"
          ? "Drag to draw. Keyboard: focus the page, arrows move the cursor, Space starts/ends a stroke."
          : tool === "highlight"
            ? "Drag a rectangle or add a centered highlight."
            : tool === "note"
              ? "Click the page or place a centered note."
              : "Select a mark to move it. Arrow keys nudge 1 point; Shift + arrows nudge 10. Use Move / size for exact placement."}{" "}
        Escape cancels an unfinished edit.
      </p>
    </>
  );
};
