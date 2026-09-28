import { useSortable } from "@dnd-kit/react/sortable";
import { Button, cn } from "@repo/core-ui";
import type { Thumbnail } from "../workspace/types";

export const SortablePage = ({
  number,
  index,
  position,
  total,
  selected,
  editable,
  dragging,
  preview,
  onToggle,
  onMove,
}: {
  number: number;
  index: number;
  position: number;
  total: number;
  selected: boolean;
  editable: boolean;
  dragging: boolean;
  preview?: Thumbnail;
  onToggle: () => void;
  onMove: (page: number, target: number, control: string) => void;
}) => {
  const { ref, handleRef, isDragSource } = useSortable({
    id: number,
    index,
    disabled: !editable,
    type: "pdf-page",
    accept: "pdf-page",
  });
  return (
    <li
      ref={ref}
      aria-label={`Page ${number}, position ${position} of ${total}`}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-lg border bg-white p-3",
        selected && "border-primary bg-secondary",
        isDragSource && "shadow-md",
      )}
    >
      <label className="flex cursor-pointer flex-col gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            aria-label={`Page ${number}`}
            disabled={!editable || dragging}
            checked={selected}
            onChange={onToggle}
          />
          Page {number}
        </span>
        <span className="flex h-32 items-center justify-center">
          {preview?.url ? (
            <img
              src={preview.url}
              alt={`Preview of page ${number}`}
              draggable={false}
              className="max-h-full max-w-full"
            />
          ) : (
            <span className="text-center text-xs text-muted-foreground">
              {preview?.error
                ? "Preview unavailable. You can still select this page."
                : "Loading preview..."}
            </span>
          )}
        </span>
      </label>
      <Button
        ref={handleRef}
        id={`drag-page-${number}`}
        variant="ghost"
        size="sm"
        className="min-h-11 touch-none cursor-grab select-none px-2 active:cursor-grabbing"
        disabled={!editable}
        aria-label={`Drag page ${number}`}
        aria-describedby="page-order-help"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
        Drag
      </Button>
      <div className="flex flex-wrap gap-1">
        {([-1, 1] as const).map((direction) => {
          const control = direction === -1 ? "earlier" : "later";
          return (
            <Button
              key={control}
              id={`${control}-page-${number}`}
              variant="outline"
              size="sm"
              className="min-h-11 flex-1 px-2 text-xs"
              disabled={!editable || dragging}
              aria-disabled={direction === -1 ? position === 1 : position === total}
              aria-label={`Move page ${number} ${control}`}
              onClick={() => onMove(number, position - 1 + direction, control)}
            >
              {direction === -1 ? "Earlier" : "Later"}
            </Button>
          );
        })}
      </div>
    </li>
  );
};
