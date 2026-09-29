import { useRef } from "react";
import { Button, useFocusAfterCommit } from "@repo/core-ui";
import type { RangeRow } from "./useSplitSettings";

export const RangeEditor = ({
  ranges,
  pageCount,
  onChange,
  announce,
}: {
  ranges: readonly RangeRow[];
  pageCount: number;
  onChange: (ranges: readonly RangeRow[]) => void;
  announce: (message: string) => void;
}) => {
  const addButton = useRef<HTMLButtonElement>(null);
  const focusAfterCommit = useFocusAfterCommit();
  const change = (id: string, field: "start" | "end", value: string) =>
    onChange(ranges.map((range) => (range.id === id ? { ...range, [field]: value } : range)));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    const row = ranges[index];
    if (!row || target < 0 || target >= ranges.length) {
      return;
    }
    const reordered = [...ranges];
    reordered.splice(index, 1);
    reordered.splice(target, 0, row);
    onChange(reordered);
    announce(`Range moved to position ${target + 1} of ${ranges.length}.`);
    focusAfterCommit(() => document.getElementById(`range-${direction}-${row.id}`));
  };
  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground">
        Ranges include both endpoints. Rows set output order.
      </p>
      <ol className="mt-3 space-y-4">
        {ranges.map((range, index) => (
          <li key={range.id} className="border-b pb-4">
            <p className="mb-2 font-medium">Range {index + 1}</p>
            <div className="grid grid-cols-2 gap-3">
              {(["start", "end"] as const).map((field) => (
                <label key={field} className="text-sm">
                  {field === "start" ? "Start page" : "End page"}
                  <input
                    type="number"
                    step={1}
                    id={`range-${field}-${range.id}`}
                    min={field === "end" ? Number(range.start) || 1 : 1}
                    max={field === "start" ? Number(range.end) || pageCount : pageCount}
                    aria-label={`Range ${index + 1} ${field} page`}
                    aria-describedby="selection-error"
                    aria-invalid={
                      range[field] === "" ||
                      !Number.isInteger(Number(range[field])) ||
                      Number(range[field]) < 1 ||
                      Number(range[field]) > pageCount ||
                      Number(range.end) < Number(range.start)
                    }
                    className="mt-1 min-h-10 w-full rounded-md border bg-card px-3 focus-visible:outline-2 focus-visible:outline-ring"
                    value={range[field]}
                    onChange={(event) => change(range.id, field, event.target.value)}
                  />
                </label>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {([-1, 1] as const).map((direction) => (
                <Button
                  key={direction}
                  variant="outline"
                  size="sm"
                  id={`range-${direction}-${range.id}`}
                  aria-label={`Move range ${index + 1} ${direction === -1 ? "up" : "down"}`}
                  aria-disabled={direction === -1 ? index === 0 : index === ranges.length - 1}
                  onClick={() => move(index, direction)}
                >
                  Move {direction === -1 ? "up" : "down"}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove range ${index + 1}`}
                onClick={() => {
                  const remaining = ranges.filter((row) => row.id !== range.id);
                  onChange(remaining);
                  announce(`Range ${index + 1} removed.`);
                  const next = remaining[Math.min(index, remaining.length - 1)];
                  focusAfterCommit(() =>
                    next ? document.getElementById(`range-start-${next.id}`) : addButton.current,
                  );
                }}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <Button
        ref={addButton}
        variant="outline"
        className="mt-3"
        onClick={() => {
          const id = crypto.randomUUID();
          onChange([...ranges, { id, start: "1", end: String(pageCount) }]);
          focusAfterCommit(() => document.getElementById(`range-start-${id}`));
        }}
      >
        Add range
      </Button>
    </div>
  );
};
