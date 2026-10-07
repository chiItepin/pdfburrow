import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MarkupGeometry } from "@repo/pdf-engine";
import type { MarkupZoom } from "./MarkupPage";
import { useCanvasPan } from "./useCanvasPan";
import type { CanvasPanMode } from "./useCanvasPan";

type ZoomAnchor = {
  x: number;
  y: number;
  clientX: number;
  clientY: number;
};

export const useMarkupViewport = ({
  geometry,
  zoom,
  enabled,
  busy,
  onZoom,
  panMode,
  onBusy,
  onDeselect,
}: {
  geometry: MarkupGeometry;
  zoom: MarkupZoom;
  enabled: boolean;
  busy: boolean;
  onZoom: (zoom: number) => void;
  panMode: CanvasPanMode;
  onBusy: (busy: boolean) => void;
  onDeselect: () => void;
}) => {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const anchor = useRef<ZoomAnchor | null>(null);
  const [size, setSize] = useState({ width: 600, height: 600 });
  const { panning, isPanning } = useCanvasPan({
    container,
    canvas,
    enabled,
    busy,
    mode: panMode,
    onBusy,
    onDeselect,
  });
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

  useLayoutEffect(() => {
    const point = anchor.current;
    const viewport = container.current;
    const page = canvas.current;
    if (!point || !viewport || !page) {
      return;
    }
    const bounds = page.getBoundingClientRect();
    viewport.scrollLeft += bounds.left + point.x * scale - point.clientX;
    viewport.scrollTop += bounds.top + point.y * scale - point.clientY;
    anchor.current = null;
  }, [scale]);

  useEffect(() => {
    const viewport = container.current;
    if (!viewport || !enabled) {
      return;
    }
    let percentage = scale * 100;
    const wheel = (event: WheelEvent) => {
      const page = canvas.current;
      if (isPanning()) {
        event.preventDefault();
        return;
      }
      if (!page || event.deltaY === 0 || event.shiftKey) {
        return;
      }
      event.preventDefault();
      if (busy) {
        return;
      }
      const pixels =
        event.deltaY *
        (event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? viewport.clientHeight
            : 1);
      percentage = Math.max(25, Math.min(400, percentage * Math.exp(-pixels * 0.002)));
      const next = Math.round(percentage);
      const current = scale * 100;
      if (next === current || (pixels > 0 && next > current) || (pixels < 0 && next < current)) {
        return;
      }
      const bounds = page.getBoundingClientRect();
      anchor.current = {
        x: ((event.clientX - bounds.left) * geometry.width) / bounds.width,
        y: ((event.clientY - bounds.top) * geometry.height) / bounds.height,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      onZoom(next);
    };
    // React's delegated wheel listener is passive and cannot stop native scrolling.
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, [enabled, busy, scale, geometry.width, geometry.height, onZoom, isPanning]);

  return { container, canvas, scale, panning };
};
