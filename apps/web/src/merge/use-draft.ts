import { useMemo, useRef, useState } from "react";
import { createFileRegistry } from "./file-registry";
import type { MergeInput, MoveDirection } from "./types";
import { useValidation } from "./use-validation";

const visibleFileCount = 8;

export const useDraft = (announce: (message: string) => void) => {
  const files = useMemo(() => createFileRegistry(), []);
  const [inputs, setInputs] = useState<MergeInput[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [windowIndex, setWindowIndex] = useState(0);
  const addButton = useRef<HTMLButtonElement>(null);
  const validationId = useValidation(inputs, files, setInputs, announce);
  const ready = inputs.length > 0 && inputs.every((input) => input.status === "ready");
  const pageCount = inputs.reduce(
    (sum, input) => sum + (input.status === "ready" ? input.info.pageCount : 0),
    0,
  );
  const maxWindow = Math.max(0, Math.ceil(inputs.length / visibleFileCount) - 1);
  const currentWindow = Math.min(windowIndex, maxWindow);
  const firstVisibleIndex = currentWindow * visibleFileCount;
  const visible = inputs.slice(firstVisibleIndex, firstVisibleIndex + visibleFileCount);

  const addFiles = (added: FileList | readonly File[]) => {
    const rows = Array.from(added, (file): MergeInput => {
      const id = crypto.randomUUID();
      files.retain(id, file);
      return { id, name: file.name, size: file.size, status: "pending" };
    });
    if (!rows.length) {
      return;
    }
    setInputs((current) => [...current, ...rows]);
    setAcknowledged(false);
    announce(`${rows.length} file${rows.length === 1 ? "" : "s"} added. Checking PDFs locally.`);
  };

  const removeFile = (id: string) => {
    const index = inputs.findIndex((input) => input.id === id);
    const remaining = inputs.filter((input) => input.id !== id);
    const next = remaining[Math.min(index, remaining.length - 1)];
    files.release(id);
    setInputs(remaining);
    setAcknowledged(false);
    announce("File removed.");
    setWindowIndex(
      Math.floor(Math.max(0, Math.min(index, remaining.length - 1)) / visibleFileCount),
    );
    requestAnimationFrame(() =>
      next ? document.getElementById(`remove-${next.id}`)?.focus() : addButton.current?.focus(),
    );
  };

  const moveFile = (id: string, target: number, control: MoveDirection = "up") => {
    if (target < 0 || target >= inputs.length) {
      return;
    }
    const reordered = [...inputs];
    const index = reordered.findIndex((input) => input.id === id);
    if (index < 0) {
      return;
    }
    const [input] = reordered.splice(index, 1);
    if (!input) {
      return;
    }
    reordered.splice(target, 0, input);
    setInputs(reordered);
    setWindowIndex(Math.floor(target / visibleFileCount));
    announce(`${input.name} moved to position ${target + 1} of ${inputs.length}.`);
    requestAnimationFrame(() => document.getElementById(`${control}-${id}`)?.focus());
  };

  const retryValidation = (id: string) => {
    setInputs((current) =>
      current.map((input) => (input.id === id ? { ...input, status: "pending" } : input)),
    );
  };

  const resetDraft = () => {
    files.releaseAll();
    setInputs([]);
    setAcknowledged(false);
    setWindowIndex(0);
  };

  return {
    inputs,
    files,
    acknowledged,
    setAcknowledged,
    ready,
    pageCount,
    visible,
    firstVisibleIndex,
    currentWindow,
    maxWindow,
    setWindowIndex,
    validationId,
    addButton,
    addFiles,
    removeFile,
    moveFile,
    retryValidation,
    resetDraft,
  };
};
