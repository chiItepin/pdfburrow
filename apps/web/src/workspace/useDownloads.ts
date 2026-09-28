import { useEffect, useRef, useState } from "react";
import { toast } from "@repo/core-ui";
import type { BundleLimits, BundleProgress, PdfOutput } from "@repo/pdf-engine";
import { bundleFilename, createOutputStore } from "./outputStore";
import type { OutputSummary } from "./types";

type Packaging =
  | { phase: "idle" | "cancelling" }
  | { phase: "packaging"; progress?: BundleProgress }
  | { phase: "ready"; filename: string; bytes: number };

export const useDownloads = (announce: (message: string) => void) => {
  const [store] = useState(createOutputStore);
  const controller = useRef<AbortController | null>(null);
  const [outputs, setOutputs] = useState<readonly OutputSummary[]>([]);
  const [packaging, setPackaging] = useState<Packaging>({ phase: "idle" });
  const [error, setError] = useState("");
  const busy = packaging.phase === "packaging" || packaging.phase === "cancelling";
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
      store.clear();
    },
    [store],
  );

  const clear = () => {
    toast.dismiss("document-download");
    controller.current?.abort();
    controller.current = null;
    store.clear();
    setOutputs([]);
    setPackaging({ phase: "idle" });
    setError("");
  };
  const retain = (values: readonly PdfOutput[]) => {
    setOutputs(store.retain(values));
    setPackaging({ phase: "idle" });
    setError("");
  };
  const download = (index?: number) => {
    try {
      if (index === undefined) {
        store.requestBundle();
      } else {
        store.requestPdf(index);
      }
      setError("");
      announce("");
      toast.info("Download requested.", {
        id: "document-download",
        description: "Check your browser's downloads; this does not confirm the file was saved.",
      });
    } catch {
      setError(
        "The download could not be requested. Your outputs are still available; try the download again.",
      );
    }
  };
  const prepareBundle = async (filename: string, limits?: BundleLimits) => {
    if (controller.current) {
      return;
    }
    const active = new AbortController();
    controller.current = active;
    setPackaging({ phase: "packaging" });
    setError("");
    try {
      const { bundlePdfs } = await import("@repo/pdf-engine/bundle");
      if (controller.current !== active) {
        return;
      }
      const result = await bundlePdfs(
        { outputs: store.values(), filename: bundleFilename(filename), limits },
        {
          signal: active.signal,
          onProgress: (progress) => {
            if (controller.current === active && !active.signal.aborted) {
              setPackaging({ phase: "packaging", progress });
            }
          },
        },
      );
      if (controller.current !== active) {
        return;
      }
      if (active.signal.aborted || result.kind === "cancelled") {
        setPackaging({ phase: "idle" });
        announce("ZIP preparation cancelled. Your PDFs are still available.");
      } else if (result.kind === "failure") {
        setPackaging({ phase: "idle" });
        setError(result.message);
      } else {
        store.retainBundle(result.value);
        setPackaging({
          phase: "ready",
          filename: result.value.suggestedFilename,
          bytes: result.value.blob.size,
        });
        announce("ZIP ready. Select Download ZIP to save it.");
      }
    } catch {
      if (controller.current === active) {
        setPackaging({ phase: "idle" });
        if (active.signal.aborted) {
          announce("ZIP preparation cancelled. Your PDFs are still available.");
        } else {
          setError("ZIP preparation could not finish. Retry or download your PDFs individually.");
        }
      }
    } finally {
      if (controller.current === active) {
        controller.current = null;
      }
    }
  };
  return {
    outputs,
    packaging,
    busy,
    error,
    clear,
    retain,
    download,
    prepareBundle,
    needsDownload: store.needsDownload,
    usage: store.usage,
    cancel: () => {
      if (controller.current) {
        setPackaging({ phase: "cancelling" });
        controller.current.abort();
      }
    },
  };
};
