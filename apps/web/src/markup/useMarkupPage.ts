import { useEffect, useState } from "react";
import type { MarkupGeometry } from "@repo/pdf-engine";
import { pdfLimits } from "../workspace/resourcePolicy";

type PagePreview =
  { state: "loading" } | { state: "error"; message: string } | { state: "ready"; url: string };
export const useMarkupPage = (
  file: File,
  page: number,
  geometry: MarkupGeometry,
  paused: boolean,
) => {
  const [preview, setPreview] = useState<PagePreview>({ state: "loading" });
  const [attempt, retry] = useState(0);
  useEffect(() => {
    if (paused) {
      return;
    }
    const controller = new AbortController();
    let url: string | undefined;
    const render = async () => {
      try {
        const { previewPdfPage } = await import("@repo/pdf-engine/preview");
        const result = await previewPdfPage(
          file,
          controller.signal,
          page,
          { inputBytes: pdfLimits.perInputBytes },
          1600,
        );
        if (controller.signal.aborted) {
          return;
        }
        if (
          Math.abs(result.geometry.width - geometry.width) > 0.001 ||
          Math.abs(result.geometry.height - geometry.height) > 0.001 ||
          result.geometry.transform.some(
            (value, index) => Math.abs(value - geometry.transform[index]!) > 0.001,
          )
        ) {
          throw new Error(
            "The preview and PDF writer disagree on page geometry. Export a new source copy externally.",
          );
        }
        url = URL.createObjectURL(result.blob);
        setPreview({ state: "ready", url });
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreview({
            state: "error",
            message:
              error instanceof Error
                ? error.message
                : "The page preview could not load. Retry the preview.",
          });
        }
      }
    };
    void render();
    return () => {
      controller.abort();
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [file, page, geometry, paused, attempt]);
  return {
    preview,
    retry: () => {
      setPreview({ state: "loading" });
      retry((value) => value + 1);
    },
  };
};
