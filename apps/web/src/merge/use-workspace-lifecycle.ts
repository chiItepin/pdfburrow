import { useEffect, useRef } from "react";
import type { MergeJob } from "./types";

export const useWorkspaceLifecycle = (inputCount: number, phase: MergeJob["phase"]) => {
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
    if (phase === "complete") {
      resultHeading.current?.focus();
    }
    if (phase === "cancelled") {
      draftHeading.current?.focus();
    }
    if (phase === "error") {
      jobError.current?.focus();
    }
  }, [phase]);
  return { draftHeading, resultHeading, jobError };
};
