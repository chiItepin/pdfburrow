import { pdfStem } from "@repo/pdf-engine/filename";

export interface PageSet {
  readonly id: number;
  readonly pages: readonly number[];
}

export interface PageSets {
  readonly sets: readonly PageSet[];
  readonly nextId: number;
}

export const createPageSets = (pageCount: number): PageSets => {
  if (!Number.isSafeInteger(pageCount) || pageCount < 0) {
    throw new Error("The source page count must be a nonnegative whole number.");
  }
  return {
    sets: Array.from({ length: pageCount }, (_, index) => ({
      id: index + 1,
      pages: [index + 1],
    })),
    nextId: pageCount + 1,
  };
};

export const orderPageSets = (state: PageSets, order: readonly number[]): readonly PageSet[] => {
  const positions = new Map(order.map((page, index) => [page, index]));
  const position = (page: number) => {
    const index = positions.get(page);
    if (index === undefined) {
      throw new Error("A set contains a page outside the source page order.");
    }
    return index;
  };
  const pages = state.sets.flatMap((set) => set.pages);
  if (
    new Set(order).size !== order.length ||
    new Set(pages).size !== pages.length ||
    pages.length !== order.length ||
    pages.some((page) => !positions.has(page)) ||
    state.sets.some((set) => !set.pages.length)
  ) {
    throw new Error("Each source page must belong to exactly one nonempty set.");
  }
  const ordered = state.sets.map((set) => ({
    ...set,
    pages: [...set.pages].sort((left, right) => position(left) - position(right)),
  }));
  return ordered.sort((left, right) => position(left.pages[0]!) - position(right.pages[0]!));
};

export const groupPages = (
  state: PageSets,
  selected: readonly number[],
  order: readonly number[],
): PageSets => {
  const sets = orderPageSets(state, order);
  const pages = new Set(selected);
  if (
    selected.length < 2 ||
    pages.size !== selected.length ||
    selected.some((page) => !order.includes(page))
  ) {
    throw new Error("Select at least two different source pages to group.");
  }
  return {
    sets: [
      ...sets
        .map((set) => ({ ...set, pages: set.pages.filter((page) => !pages.has(page)) }))
        .filter((set) => set.pages.length > 0),
      { id: state.nextId, pages: order.filter((page) => pages.has(page)) },
    ],
    nextId: state.nextId + 1,
  };
};

export const ungroupPages = (state: PageSets, id: number): PageSets => {
  const set = state.sets.find((value) => value.id === id);
  if (!set || set.pages.length < 2) {
    throw new Error("Choose a grouped set to restore its individual pages.");
  }
  return {
    sets: [
      ...state.sets.filter((value) => value.id !== id),
      ...set.pages.map((page, index) => ({ id: state.nextId + index, pages: [page] })),
    ],
    nextId: state.nextId + set.pages.length,
  };
};

const validatePages = (pages: readonly number[]) => {
  if (
    !pages.length ||
    new Set(pages).size !== pages.length ||
    pages.some((page) => !Number.isSafeInteger(page) || page < 1)
  ) {
    throw new Error("A PDF must contain distinct positive whole-number pages.");
  }
};

export const pageSetLabel = (pages: readonly number[]): string => {
  validatePages(pages);
  const parts: string[] = [];
  for (let index = 0; index < pages.length; index++) {
    const first = pages[index];
    if (first === undefined) {
      throw new Error("A PDF page label is missing its page number.");
    }
    let last = index;
    let end = first;
    const step = (pages[index + 1] ?? first) - first;
    if (Math.abs(step) === 1) {
      let next = pages[last + 1];
      while (next !== undefined && next - end === step) {
        last++;
        end = next;
        next = pages[last + 1];
      }
    }
    if (last - index >= 2) {
      parts.push(`${first}-${end}`);
      index = last;
    } else {
      parts.push(String(first));
    }
  }
  return `${pages.length === 1 ? "Page" : "Pages"} ${parts.join(" + ")}`;
};

export const pageSetFilename = (name: string, pages: readonly number[]): string => {
  validatePages(pages);
  const suffix =
    pages.length > 8
      ? `${pages.length}-pages-from-${pages[0]}`
      : `${pages.length === 1 ? "page" : "pages"}-${pages.join("-")}`;
  return `${pdfStem(name)}-${suffix}.pdf`;
};
