import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { RefObject } from "react";

export type CanvasPanMode = "select" | "hand" | "background";
type Pan = {
  pointerId: number;
  x: number;
  y: number;
  left: number;
  top: number;
  moved: boolean;
  deselectOnClick: boolean;
};

export const useCanvasPan = ({
  container,
  canvas,
  enabled,
  busy,
  mode,
  onBusy,
  onDeselect,
}: {
  container: RefObject<HTMLDivElement | null>;
  canvas: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  busy: boolean;
  mode: CanvasPanMode;
  onBusy: (busy: boolean) => void;
  onDeselect: () => void;
}) => {
  const current = useRef<Pan | null>(null);
  const [panning, setPanning] = useState(false);
  const finish = useEffectEvent((deselect = false) => {
    const pan = current.current;
    if (!pan) {
      return;
    }
    current.current = null;
    setPanning(false);
    onBusy(false);
    const viewport = container.current;
    if (viewport?.hasPointerCapture(pan.pointerId)) {
      viewport.releasePointerCapture(pan.pointerId);
    }
    if (deselect && pan.deselectOnClick && !pan.moved) {
      onDeselect();
    }
  });
  const pointerDown = useEffectEvent((event: PointerEvent) => {
    const viewport = container.current;
    const page = canvas.current;
    if (
      !viewport ||
      !page ||
      !enabled ||
      busy ||
      current.current ||
      (event.button !== 0 && event.button !== 1)
    ) {
      return;
    }
    const bounds = viewport.getBoundingClientRect();
    const x = event.clientX - bounds.left - viewport.clientLeft;
    const y = event.clientY - bounds.top - viewport.clientTop;
    if (x < 0 || y < 0 || x >= viewport.clientWidth || y >= viewport.clientHeight) {
      return;
    }
    const target = event.target;
    const insidePage = target instanceof Node && page.contains(target);
    const onMarkup =
      target instanceof Element &&
      Boolean(target.closest("[data-markup-id],[data-markup-selection]"));
    if (
      event.button !== 1 &&
      ((mode === "background" && insidePage) || (mode === "select" && onMarkup))
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    page.focus({ preventScroll: true });
    current.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
      moved: false,
      deselectOnClick: mode === "select" && event.button === 0,
    };
    viewport.setPointerCapture(event.pointerId);
    setPanning(true);
    onBusy(true);
  });
  const pointerMove = useEffectEvent((event: PointerEvent) => {
    const pan = current.current;
    const viewport = container.current;
    if (!pan || !viewport || pan.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const dx = event.clientX - pan.x;
    const dy = event.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) > 3) {
      current.current = { ...pan, moved: true };
    }
    viewport.scrollTo(pan.left - dx, pan.top - dy);
  });
  const pointerUp = useEffectEvent((event: PointerEvent) => {
    if (current.current?.pointerId === event.pointerId) {
      event.preventDefault();
      event.stopPropagation();
      finish(true);
    }
  });
  const pointerCancel = useEffectEvent((event: PointerEvent) => {
    if (current.current?.pointerId === event.pointerId) {
      finish();
    }
  });
  const keyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape" && current.current) {
      event.preventDefault();
      event.stopPropagation();
      finish();
      return;
    }
    if (current.current && event.key === "Tab") {
      finish();
      return;
    }
    if (
      current.current &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      (event.key === " " ||
        event.key.startsWith("Arrow") ||
        ["Home", "End", "PageUp", "PageDown"].includes(event.key))
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (
      !enabled ||
      busy ||
      mode !== "hand" ||
      current.current ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    const directions: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      event.stopPropagation();
      const step = event.shiftKey ? 160 : 40;
      container.current?.scrollBy(direction.x * step, direction.y * step);
    }
  });
  const focusOut = useEffectEvent((event: FocusEvent) => {
    if (
      !(event.relatedTarget instanceof Node) ||
      !container.current?.contains(event.relatedTarget)
    ) {
      finish();
    }
  });
  const windowBlur = useEffectEvent(() => finish());
  useEffect(() => {
    if (!enabled) {
      finish();
    }
  }, [enabled]);
  useEffect(() => {
    const viewport = container.current;
    if (!viewport) {
      return;
    }
    viewport.addEventListener("pointerdown", pointerDown, true);
    viewport.addEventListener("pointermove", pointerMove, true);
    viewport.addEventListener("pointerup", pointerUp, true);
    viewport.addEventListener("pointercancel", pointerCancel, true);
    viewport.addEventListener("lostpointercapture", pointerCancel, true);
    viewport.addEventListener("keydown", keyDown, true);
    viewport.addEventListener("focusout", focusOut, true);
    window.addEventListener("blur", windowBlur);
    return () => {
      viewport.removeEventListener("pointerdown", pointerDown, true);
      viewport.removeEventListener("pointermove", pointerMove, true);
      viewport.removeEventListener("pointerup", pointerUp, true);
      viewport.removeEventListener("pointercancel", pointerCancel, true);
      viewport.removeEventListener("lostpointercapture", pointerCancel, true);
      viewport.removeEventListener("keydown", keyDown, true);
      viewport.removeEventListener("focusout", focusOut, true);
      window.removeEventListener("blur", windowBlur);
      finish();
    };
  }, [container]);

  return { panning, isPanning: () => current.current !== null };
};
