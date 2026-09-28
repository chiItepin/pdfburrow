import { useState } from "react";
import { planSplit } from "@repo/pdf-engine/selection";
import type { SplitPlan, SplitSelection } from "@repo/pdf-engine";

export interface RangeRow {
  readonly id: string;
  readonly start: string;
  readonly end: string;
}

export const useSplitSettings = (name: string, pageCount: number) => {
  const [mode, setMode] = useState<SplitSelection["mode"]>("selected");
  const [pages, setPages] = useState<readonly number[]>([]);
  const [pageOrder, setPageOrder] = useState<readonly number[] | null>(null);
  const order = pageOrder ?? Array.from({ length: pageCount }, (_, index) => index + 1);
  const selected = new Set(pages);
  const [ranges, setRanges] = useState<readonly RangeRow[]>([]);
  const [combined, setCombined] = useState(true);
  const [size, setSize] = useState("1");
  const selection: SplitSelection =
    mode === "selected"
      ? { mode, pages: order.filter((page) => selected.has(page)) }
      : mode === "ranges"
        ? {
            mode,
            ranges: ranges.map(({ start, end }) => ({ start: Number(start), end: Number(end) })),
            combined,
          }
        : mode === "fixed"
          ? { mode, size: Number(size) }
          : { mode };
  let plan: SplitPlan | undefined;
  let error = "";
  if (pageCount > 0) {
    try {
      plan = planSplit(name, pageCount, selection);
    } catch (failure) {
      error = failure instanceof Error ? failure.message : "Review the page selection.";
    }
  }
  return {
    mode,
    setMode,
    pages,
    setPages,
    order,
    setPageOrder,
    ranges,
    setRanges,
    combined,
    setCombined,
    size,
    setSize,
    selection,
    plan,
    error,
  };
};
