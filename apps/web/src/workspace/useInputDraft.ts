import { useEffect, useRef, useState } from "react";
import { useFocusAfterCommit } from "@repo/core-ui";
import { createFileRegistry } from "./fileRegistry";
import type { InputRow, MoveDirection } from "./types";
import { useValidation } from "./useValidation";

const visibleFileCount = 8;

export const useInputDraft = (announce: (message: string) => void) => {
  const [files] = useState(createFileRegistry);
  const [inputs, setInputs] = useState<InputRow[]>([]);
  const [revision, setRevision] = useState(0);
  const [acknowledged, setAcknowledged] = useState(false);
  const [windowIndex, setWindowIndex] = useState(0);
  const addButton = useRef<HTMLButtonElement>(null);
  const focusAfterCommit = useFocusAfterCommit();
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

  useEffect(() => () => files.releaseAll(), [files]);

  const addFiles = (added: FileList | readonly File[], kind: InputRow["kind"] = "pdf") => {
    const rows = Array.from(added, (file): InputRow => {
      const id = crypto.randomUUID();
      files.retain(id, file);
      return { id, name: file.name, size: file.size, kind, status: "pending" };
    });
    if (!rows.length) {
      return;
    }
    setInputs((current) => [...current, ...rows]);
    setAcknowledged(false);
    announce(
      `${rows.length} file${rows.length === 1 ? "" : "s"} added. Checking ${kind === "image" ? "images" : "PDFs"} locally.`,
    );
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
    focusAfterCommit(() =>
      next ? document.getElementById(`remove-${next.id}`) : addButton.current,
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
    focusAfterCommit(() => document.getElementById(`${control}-${id}`));
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
    setRevision((current) => current + 1);
  };

  return {
    inputs,
    revision,
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
