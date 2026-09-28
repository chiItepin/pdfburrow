import { useEffect, useRef, useState } from "react";
import type { DocumentJob, DocumentTask } from "./types";
import { useDownloads } from "./useDownloads";

export const useDocumentJob = (announce: (message: string) => void) => {
  const [job, setJob] = useState<DocumentJob>({ phase: "editing" });
  const controller = useRef<AbortController | null>(null);
  const downloads = useDownloads(announce);
  const locked = job.phase === "processing" || job.phase === "cancelling" || downloads.busy;
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [],
  );

  const start = async (task: DocumentTask) => {
    if (controller.current || locked || job.phase === "complete") {
      return;
    }
    const active = new AbortController();
    controller.current = active;
    setJob({ phase: "processing" });
    announce("");
    try {
      const outcome = await task({
        signal: active.signal,
        onProgress: (progress) => {
          if (controller.current === active && !active.signal.aborted) {
            setJob({ phase: "processing", progress });
          }
        },
      });
      if (controller.current !== active) {
        return;
      }
      if (active.signal.aborted || outcome.kind === "cancelled") {
        setJob({ phase: "cancelled" });
      } else if (outcome.kind === "failure") {
        setJob({ phase: "error", message: outcome.message });
      } else {
        downloads.retain(outcome.value);
        setJob({ phase: "complete" });
      }
    } catch {
      if (controller.current === active) {
        setJob(
          active.signal.aborted
            ? { phase: "cancelled" }
            : {
                phase: "error",
                message:
                  "The local operation could not load or finish. Your inputs are retained. Retry with less work.",
              },
        );
      }
    } finally {
      if (controller.current === active) {
        controller.current = null;
      }
    }
  };
  return {
    job,
    locked,
    downloads,
    start,
    editable: !locked && job.phase !== "complete",
    cancel: () => {
      if (controller.current) {
        setJob({ phase: "cancelling" });
        controller.current.abort();
      }
    },
    editDraft: () => {
      if (!locked) {
        downloads.clear();
        setJob({ phase: "editing" });
      }
    },
  };
};
