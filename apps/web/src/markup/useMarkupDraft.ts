import { useState } from "react";
import type { MarkupObject } from "@repo/pdf-engine";

interface History {
  readonly past: readonly (readonly MarkupObject[])[];
  readonly objects: readonly MarkupObject[];
  readonly future: readonly (readonly MarkupObject[])[];
}
export const useMarkupDraft = (onEdit: () => void) => {
  const [history, setHistory] = useState<History>({ past: [], objects: [], future: [] });
  const [selectedId, select] = useState<string | null>(null);
  const commit = (objects: readonly MarkupObject[]) => {
    onEdit();
    setHistory((current) => ({ past: [...current.past, current.objects], objects, future: [] }));
  };
  const add = (object: MarkupObject) => {
    commit([...history.objects, object]);
    select(object.id);
  };
  const update = (object: MarkupObject) =>
    commit(history.objects.map((current) => (current.id === object.id ? object : current)));
  const remove = () => {
    if (!history.objects.some((object) => object.id === selectedId)) {
      return;
    }
    commit(history.objects.filter((object) => object.id !== selectedId));
    select(null);
  };
  const undo = () => {
    const objects = history.past.at(-1);
    if (!objects) {
      return;
    }
    onEdit();
    setHistory({
      past: history.past.slice(0, -1),
      objects,
      future: [history.objects, ...history.future],
    });
    select(null);
  };
  const redo = () => {
    const objects = history.future[0];
    if (!objects) {
      return;
    }
    onEdit();
    setHistory({
      past: [...history.past, history.objects],
      objects,
      future: history.future.slice(1),
    });
    select(null);
  };
  return {
    objects: history.objects,
    selectedId,
    select,
    add,
    update,
    remove,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
};
