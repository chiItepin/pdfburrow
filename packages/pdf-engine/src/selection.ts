import { PdfError } from "./pdfError.ts";
import { pdfStem } from "./pdfFilename.ts";
import { enforceLimit } from "./resourceLimits.ts";
import type { PageRange, SplitPlan, SplitSelection } from "./splitTypes";
import type { PdfLimits } from "./types";

const invalid = (message: string): never => {
  throw new PdfError("invalid", message);
};

const pageNumber = (value: unknown, pageCount: number): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > pageCount) {
    return invalid(`Choose a whole page number from 1 through ${pageCount}.`);
  }
  return value;
};

const readRange = (value: unknown, pageCount: number): PageRange => {
  if (!value || typeof value !== "object" || !("start" in value) || !("end" in value)) {
    return invalid("Complete the start and end of every range.");
  }
  const start = pageNumber(value.start, pageCount);
  const end = pageNumber(value.end, pageCount);
  if (end < start) {
    return invalid("A range's end page cannot precede its start page.");
  }
  return { start, end };
};

const hasOverlap = (ranges: readonly PageRange[]): boolean => {
  const ordered = [...ranges].sort((left, right) => left.start - right.start);
  let end = 0;
  for (const range of ordered) {
    if (range.start <= end) {
      return true;
    }
    end = range.end;
  }
  return false;
};

export const planSplit = (
  name: string,
  pageCount: number,
  selection: SplitSelection,
  limits: PdfLimits = {},
): SplitPlan => {
  pageNumber(pageCount, Number.MAX_SAFE_INTEGER);
  if (!selection || typeof selection !== "object" || !("mode" in selection)) {
    return invalid("Choose a split or extraction mode.");
  }
  let ranges: readonly PageRange[] = [];
  let combined = false;
  let size = 0;
  switch (selection.mode) {
    case "selected":
    case "remove": {
      if (!Array.isArray(selection.pages) || selection.pages.length === 0) {
        return invalid(
          selection.mode === "remove"
            ? "Select at least one page to remove."
            : "Select at least one page.",
        );
      }
      const pages = Array.from(selection.pages, (page) => pageNumber(page, pageCount));
      if (new Set(pages).size !== pages.length) {
        return invalid(
          selection.mode === "remove"
            ? "Pages to remove must be unique."
            : "Selected pages must be unique. Use custom ranges to repeat pages.",
        );
      }
      const removed = new Set(pages);
      const retained =
        selection.mode === "remove"
          ? Array.from({ length: pageCount }, (_, index) => index + 1).filter(
              (page) => !removed.has(page),
            )
          : pages;
      if (retained.length === 0) {
        return invalid("Keep at least one page. Clear a page's selection to keep it.");
      }
      ranges = retained.map((page) => ({ start: page, end: page }));
      combined = true;
      break;
    }
    case "ranges":
      if (!Array.isArray(selection.ranges) || selection.ranges.length === 0) {
        return invalid("Add at least one range.");
      }
      if (typeof selection.combined !== "boolean") {
        return invalid("Choose combined or separate range outputs.");
      }
      ranges = Array.from(selection.ranges, (range) => readRange(range, pageCount));
      combined = selection.combined;
      break;
    case "fixed":
      size = pageNumber(selection.size, pageCount);
      break;
    case "every":
      size = 1;
      break;
    default:
      return invalid("Choose a supported split or extraction mode.");
  }
  const totalPages = size
    ? pageCount
    : ranges.reduce((total, range) => total + range.end - range.start + 1, 0);
  if (!Number.isSafeInteger(totalPages)) {
    return invalid("The selection contains too many pages. Remove some ranges.");
  }
  const outputCount = size ? Math.ceil(pageCount / size) : combined ? 1 : ranges.length;
  enforceLimit(totalPages, limits.totalPages, "Selected pages", "Select fewer pages or ranges.");
  enforceLimit(outputCount, limits.outputCount, "Output count", "Choose fewer outputs.");
  const stem = pdfStem(name);
  return {
    outputCount,
    totalPages,
    repeatsPages: hasOverlap(ranges),
    bundleName: `${stem}-${selection.mode === "remove" ? "removed" : "split"}.zip`,
    outputAt: (index) => {
      if (!Number.isSafeInteger(index) || index < 0 || index >= outputCount) {
        return invalid("The requested output is outside this selection.");
      }
      const range = ranges[index];
      const outputRanges = size
        ? [{ start: index * size + 1, end: Math.min((index + 1) * size, pageCount) }]
        : combined
          ? ranges
          : range
            ? [range]
            : invalid("The requested range is missing.");
      return {
        filename:
          selection.mode === "remove"
            ? `${stem}-removed.pdf`
            : combined
              ? `${stem}-extracted.pdf`
              : `${stem}-split-${String(index + 1).padStart(3, "0")}.pdf`,
        pageCount: outputRanges.reduce((total, item) => total + item.end - item.start + 1, 0),
        ranges: outputRanges,
      };
    },
  };
};
