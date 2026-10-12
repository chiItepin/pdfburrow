import { useEffect, useRef } from "react";
import type { DocumentJob } from "./types";
import { useBeforeUnload } from "./useBeforeUnload";

export const useWorkspaceLifecycle = (
  inputCount: number,
  phase: DocumentJob["phase"],
  onDemand = false,
) => {
  const draftHeading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const jobError = useRef<HTMLParagraphElement>(null);
  useBeforeUnload(inputCount > 0);
  useEffect(() => {
    if (phase === "complete" && !onDemand) {
      resultHeading.current?.focus();
    }
    if (phase === "cancelled") {
      draftHeading.current?.focus();
    }
    if (phase === "error") {
      jobError.current?.focus();
    }
  }, [phase, onDemand]);
  return { draftHeading, resultHeading, jobError };
};
