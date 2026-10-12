import { useEffect, useRef, useState } from "react";
import { toast } from "@repo/core-ui";
import type { DocumentJob, DocumentTask } from "./types";
import { useDownloads } from "./useDownloads";

export const useDocumentJob = (announce: (message: string) => void) => {
  const [job, setJob] = useState<DocumentJob>({ phase: "editing" });
  const [onDemand, setOnDemand] = useState(false);
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

  const start = async (task: DocumentTask, options: { downloadOnComplete?: boolean } = {}) => {
    if (
      controller.current ||
      locked ||
      (job.phase === "complete" && (!onDemand || !options.downloadOnComplete))
    ) {
      return false;
    }
    const active = new AbortController();
    controller.current = active;
    setOnDemand(Boolean(options.downloadOnComplete));
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
        return false;
      }
      if (active.signal.aborted || outcome.kind === "cancelled") {
        setJob({ phase: "cancelled" });
      } else if (outcome.kind === "failure") {
        setJob({ phase: "error", message: outcome.message });
      } else {
        if (options.downloadOnComplete && outcome.value.length !== 1) {
          throw new Error("An on-demand operation must return exactly one PDF.");
        }
        downloads.retain(outcome.value);
        setJob({ phase: "complete" });
        if (options.downloadOnComplete) {
          downloads.download(0);
        } else {
          toast.success(
            outcome.value.length === 1 ? "Your PDF is ready." : "Your PDFs are ready.",
            {
              id: "document-job",
              description: "Choose Download to save your output.",
            },
          );
        }
        return true;
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
    return false;
  };
  return {
    job,
    locked,
    downloads,
    onDemand,
    start,
    editable: !locked && (job.phase !== "complete" || onDemand),
    cancel: () => {
      if (controller.current) {
        setJob({ phase: "cancelling" });
        controller.current.abort();
      }
    },
    editDraft: () => {
      if (!locked) {
        toast.dismiss("document-job");
        downloads.clear();
        setOnDemand(false);
        setJob({ phase: "editing" });
      }
    },
  };
};
