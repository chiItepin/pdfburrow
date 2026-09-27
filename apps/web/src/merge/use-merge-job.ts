import { useEffect, useMemo, useRef, useState } from "react";
import type { MergeRequest } from "@repo/pdf-engine";
import { createOutputStore } from "./output-store";
import type { MergeJob } from "./types";

export const useMergeJob = (announce: (message: string) => void) => {
  const [job, setJob] = useState<MergeJob>({ phase: "editing" });
  const [downloadError, setDownloadError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const outputs = useMemo(() => createOutputStore(), []);
  const locked = job.phase === "processing" || job.phase === "cancelling";
  const editable = !locked && job.phase !== "complete";

  useEffect(
    () => () => {
      controller.current?.abort();
      outputs.clear();
    },
    [outputs],
  );

  const startMerge = async (request: MergeRequest) => {
    if (controller.current) {
      return;
    }
    const active = new AbortController();
    controller.current = active;
    setJob({ phase: "processing" });
    announce("");
    try {
      const { mergePdfs } = await import("@repo/pdf-engine/merge");
      if (active.signal.aborted) {
        setJob({ phase: "cancelled" });
        return;
      }
      const outcome = await mergePdfs(request, {
        signal: active.signal,
        onProgress: (progress) => {
          if (!active.signal.aborted) {
            setJob({ phase: "processing", progress });
          }
        },
      });
      if (outcome.kind === "cancelled" || active.signal.aborted) {
        setJob({ phase: "cancelled" });
      } else if (outcome.kind === "failure") {
        setJob({ phase: "error", message: outcome.message });
      } else {
        outputs.retain(outcome.value);
        setJob({
          phase: "complete",
          filename: outcome.value.suggestedFilename,
          bytes: outcome.value.blob.size,
        });
      }
    } catch {
      setJob(
        active.signal.aborted
          ? { phase: "cancelled" }
          : {
              phase: "error",
              message:
                "The merge engine could not load or finish. Your inputs are retained. Retry, or try fewer files.",
            },
      );
    } finally {
      if (controller.current === active) {
        controller.current = null;
      }
    }
  };

  const cancelMerge = () => {
    setJob({ phase: "cancelling" });
    controller.current?.abort();
  };

  const editDraft = () => {
    outputs.clear();
    setDownloadError("");
    setJob({ phase: "editing" });
  };

  const downloadPdf = () => {
    try {
      outputs.requestDownload();
      setDownloadError("");
      announce(
        "Download requested. Check your browser's downloads; this does not confirm the file was saved.",
      );
    } catch {
      setDownloadError(
        "The download could not be requested. The merged PDF is still available; try Download PDF again.",
      );
    }
  };

  return {
    job,
    locked,
    editable,
    downloadError,
    startMerge,
    cancelMerge,
    editDraft,
    downloadPdf,
    needsDownload: outputs.needsDownload,
  };
};
