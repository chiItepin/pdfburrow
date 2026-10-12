import { useEffect, useRef } from "react";
import type { DocumentJob } from "./types";

export const useWorkspaceLifecycle = (
  inputCount: number,
  phase: DocumentJob["phase"],
  onDemand = false,
) => {
  const draftHeading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const jobError = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!inputCount) {
      return;
    }
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [inputCount]);
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
