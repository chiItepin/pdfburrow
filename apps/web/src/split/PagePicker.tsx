import { useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { Button, useFocusAfterCommit } from "@repo/core-ui";
import { usePreviews } from "../workspace/usePreviews";
import { renderPdfPagePreview } from "../workspace/previewRenderers";
import { SortablePage } from "./SortablePage";
import { PageWindowButton } from "./PageWindowButton";

export const PagePicker = ({
  sourceId,
  getFile,
  pageCount,
  order,
  selected,
  editable,
  paused,
  onSelect,
  onReorder,
  announce,
}: {
  sourceId: string;
  getFile: (id: string) => File | undefined;
  pageCount: number;
  order: readonly number[];
  selected: readonly number[];
  editable: boolean;
  paused: boolean;
  onSelect: (pages: readonly number[]) => void;
  onReorder: (pages: readonly number[]) => void;
  announce: (message: string) => void;
}) => {
  const [windowIndex, setWindowIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const focusAfterCommit = useFocusAfterCommit();
  const first = windowIndex * 8;
  const visible = order.slice(first, first + 8);
  const changedOrder = order.some((page, index) => page !== index + 1);
  const previews = usePreviews(
    visible.map(String),
    getFile,
    paused || dragging,
    renderPdfPagePreview,
    sourceId,
  );
  const movePage = (page: number, target: number, control = "drag") => {
    const index = order.indexOf(page);
    if (!editable || index < 0 || target < 0 || target >= pageCount || index === target) {
      return;
    }
    const reordered = [...order];
    reordered.splice(index, 1);
    reordered.splice(target, 0, page);
    onReorder(reordered);
    setWindowIndex(Math.floor(target / 8));
    announce(
      `Page ${page} moved to position ${target + 1} of ${pageCount}. Selected pages export in this order.`,
    );
    focusAfterCommit(() => document.getElementById(`${control}-page-${page}`));
  };
  return (
    <section className="mt-6" aria-label="Source pages">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Choose pages</h3>
        <span className="text-sm">
          {selected.length} of {pageCount} selected
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Selected pages export in the order shown, not the order you select them. Previews are
        optional.
      </p>
      <p id="page-order-help" className="mt-2 text-sm text-muted-foreground">
        Drag a handle to reorder (press and hold on touch screens), or use Earlier and Later. With a
        handle focused, press Space, use arrow keys, then Space to drop or Escape to cancel.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" disabled={!editable || dragging} onClick={() => onSelect(order)}>
          Select all
        </Button>
        <Button variant="ghost" disabled={!editable || dragging} onClick={() => onSelect([])}>
          Clear
        </Button>
        <Button
          variant="ghost"
          disabled={!editable || dragging || !changedOrder}
          onClick={() => {
            onReorder(Array.from({ length: pageCount }, (_, index) => index + 1));
            setWindowIndex(0);
            announce("Source page order restored. Your selection is unchanged.");
          }}
        >
          Reset page order
        </Button>
      </div>
      <DragDropProvider
        onBeforeDragStart={(event) => {
          if (!editable) {
            event.preventDefault();
          }
        }}
        onDragStart={() => setDragging(true)}
        onDragEnd={(event) => {
          setDragging(false);
          if (event.canceled) {
            announce("Reordering cancelled. Page order unchanged.");
            return;
          }
          const { source, target } = event.operation;
          if (!isSortable(source) || typeof source.id !== "number" || !target) {
            return;
          }
          movePage(
            source.id,
            target.id === "previous-pages"
              ? first - 1
              : target.id === "next-pages"
                ? first + visible.length
                : first + source.index,
          );
        }}
      >
        <ol aria-label="Page order" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {visible.map((number, offset) => (
            <SortablePage
              key={number}
              number={number}
              index={offset}
              position={first + offset + 1}
              total={pageCount}
              selected={selected.includes(number)}
              editable={editable}
              dragging={dragging}
              preview={previews.get(String(number))}
              onMove={movePage}
              onToggle={() =>
                onSelect(
                  selected.includes(number)
                    ? selected.filter((page) => page !== number)
                    : [...selected, number],
                )
              }
            />
          ))}
        </ol>
        {pageCount > 8 && (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              Drop on Previous pages or Next pages to move to that view's nearest position. Earlier
              and Later also work across views.
            </p>
            <nav
              aria-label="Source page windows"
              className="mt-4 flex flex-wrap items-center gap-3"
            >
              <PageWindowButton
                direction="previous"
                unavailable={windowIndex === 0}
                paused={paused}
                editable={editable}
                dragging={dragging}
                onNavigate={() => setWindowIndex(windowIndex - 1)}
              />
              <span className="text-sm">
                {first + 1}-{Math.min(first + 8, pageCount)} of {pageCount}
              </span>
              <PageWindowButton
                direction="next"
                unavailable={first + 8 >= pageCount}
                paused={paused}
                editable={editable}
                dragging={dragging}
                onNavigate={() => setWindowIndex(windowIndex + 1)}
              />
            </nav>
          </>
        )}
      </DragDropProvider>
    </section>
  );
};
