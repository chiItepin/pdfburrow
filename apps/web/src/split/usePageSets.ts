import { useState } from "react";
import { createPageSets, groupPages, orderPageSets, ungroupPages } from "./pageSets";
import type { PageSets } from "./pageSets";

export const usePageSets = (pageCount: number, order: readonly number[]) => {
  const [edited, setEdited] = useState<PageSets | null>(null);
  const [selected, select] = useState<readonly number[]>([]);
  const state = edited ?? createPageSets(pageCount);
  const sets = pageCount ? orderPageSets(state, order) : [];
  return {
    sets,
    selected,
    select,
    group: () => {
      const next = groupPages(state, selected, order);
      setEdited(next);
      select([]);
      return next.nextId - 1;
    },
    ungroup: (id: number) => {
      setEdited(ungroupPages(state, id));
      select([]);
    },
  };
};
