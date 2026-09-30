import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Button, ModalDialog } from "@repo/core-ui";
import type { MarkupPoint } from "@repo/pdf-engine";

export const SignatureCapture = ({
  onCancel,
  onUse,
}: {
  onCancel: () => void;
  onUse: (strokes: readonly (readonly MarkupPoint[])[]) => void;
}) => {
  const [mode, setMode] = useState<"no-hold" | "drag">("no-hold");
  const [strokes, setStrokes] = useState<readonly (readonly MarkupPoint[])[]>([]);
  const [redo, setRedo] = useState<readonly (readonly MarkupPoint[])[]>([]);
  const [active, setActive] = useState<readonly MarkupPoint[] | null>(null);
  const [cursor, setCursor] = useState<MarkupPoint>({ x: 240, y: 100 });
  const keyboardStroke = useRef(false);
  const pad = useRef<HTMLDivElement>(null);
  const cancelStroke = () => {
    setActive(null);
    keyboardStroke.current = false;
  };
  const finish = () => {
    if (active) {
      setStrokes([...strokes, active]);
      setRedo([]);
    }
    cancelStroke();
  };
  const undo = () => {
    if (active || !strokes.length) {
      return;
    }
    const last = strokes.at(-1);
    if (last) {
      setRedo([last, ...redo]);
      setStrokes(strokes.slice(0, -1));
    }
  };
  const redoStroke = () => {
    const first = redo[0];
    if (active || !first) {
      return;
    }
    setStrokes([...strokes, first]);
    setRedo(redo.slice(1));
  };
  const point = (event: PointerEvent) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(2, Math.min(478, ((event.clientX - bounds.left) * 480) / bounds.width)),
      y: Math.max(2, Math.min(198, ((event.clientY - bounds.top) * 200) / bounds.height)),
    };
  };
  const keyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && (key === "z" || key === "y")) {
      event.preventDefault();
      event.stopPropagation();
      if (key === "y" || event.shiftKey) {
        redoStroke();
      } else {
        undo();
      }
      return;
    }
    if (event.key === "Escape" && active) {
      event.preventDefault();
      event.stopPropagation();
      cancelStroke();
    }
    if (event.key === " ") {
      event.preventDefault();
      if (event.repeat) {
        return;
      }
      if (active) {
        finish();
      } else {
        keyboardStroke.current = true;
        setActive([cursor]);
      }
    }
    const directions: Record<string, MarkupPoint> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 3;
      const next = {
        x: Math.max(2, Math.min(478, cursor.x + direction.x * step)),
        y: Math.max(2, Math.min(198, cursor.y + direction.y * step)),
      };
      setCursor(next);
      if (active && keyboardStroke.current) {
        setActive([...active, next]);
      }
    }
  };
  return (
    <ModalDialog
      title="Draw your signature"
      onCancel={onCancel}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && ["z", "y"].includes(event.key.toLowerCase())) {
          keyDown(event);
        }
      }}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        A visual mark, not a digital signature or proof of identity. Nothing is saved outside this
        tab.
      </p>
      <fieldset className="mb-3 flex flex-wrap gap-4 text-sm" disabled={Boolean(active)}>
        <legend className="sr-only">Signature drawing mode</legend>
        {(["no-hold", "drag"] as const).map((value) => (
          <label key={value} className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="signature-mode"
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            {value === "no-hold" ? "Click to start / click to end" : "Hold and drag"}
          </label>
        ))}
      </fieldset>
      <div
        ref={pad}
        role="button"
        aria-roledescription="drawing pad"
        aria-pressed={Boolean(active)}
        aria-label="Signature drawing pad"
        aria-describedby="signature-help"
        tabIndex={0}
        className="touch-none overflow-hidden rounded-md border bg-white text-black outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onKeyDown={keyDown}
        onBlur={cancelStroke}
        onPointerLeave={cancelStroke}
        onPointerCancel={cancelStroke}
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return;
          }
          event.preventDefault();
          pad.current?.focus();
          if (keyboardStroke.current) {
            return;
          }
          const next = point(event);
          setCursor(next);
          if (active && mode === "no-hold") {
            finish();
          } else {
            setActive([next]);
          }
        }}
        onPointerMove={(event) => {
          if (!active || keyboardStroke.current) {
            return;
          }
          const next = point(event);
          setCursor(next);
          setActive([...active, next]);
        }}
        onPointerUp={() => {
          if (mode === "drag" && active && !keyboardStroke.current) {
            finish();
          }
        }}
      >
        <svg viewBox="0 0 480 200" className="block w-full" aria-hidden="true">
          {[...strokes, ...(active ? [active] : [])].map((points, index) => (
            <polyline
              key={index}
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              stroke="black"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          <circle cx={cursor.x} cy={cursor.y} r={4} fill="none" stroke="#205b49" />
        </svg>
      </div>
      <p id="signature-help" className="my-3 text-sm text-muted-foreground">
        {mode === "no-hold"
          ? "Click once, move without holding a button, then click again to finish each stroke."
          : "Hold and drag to draw each stroke."}{" "}
        Keyboard: focus the pad, use arrows to move, and Space to start/end. Leaving the pad, losing
        focus or Escape cancels only the unfinished stroke.
      </p>
      <p role="status" className="mb-3 text-sm">
        {active
          ? "Stroke in progress"
          : `${strokes.length} completed stroke${strokes.length === 1 ? "" : "s"}`}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={Boolean(active) || !strokes.length} onClick={undo}>
          Undo stroke
        </Button>
        <Button variant="outline" disabled={Boolean(active) || !redo.length} onClick={redoStroke}>
          Redo stroke
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel signature
        </Button>
        <Button disabled={Boolean(active) || !strokes.length} onClick={() => onUse(strokes)}>
          Use signature
        </Button>
      </div>
    </ModalDialog>
  );
};
