import { useEffect, useRef, useState } from "react";
import type { Thumbnail } from "./types";

export const usePreviews = (
  ids: readonly string[],
  getFile: (id: string) => File | undefined,
  paused: boolean,
  render: (file: File, signal: AbortSignal, id: string) => Promise<Blob>,
  sourceId?: string,
) => {
  const cache = useRef(new Map<string, Thumbnail>());
  const requestRetry = useRef<((id: string) => void) | null>(null);
  const [thumbnails, setThumbnails] = useState(new Map<string, Thumbnail>());
  const key = JSON.stringify(ids);
  useEffect(() => {
    const visible: string[] = JSON.parse(key);
    const controller = new AbortController();
    for (const [id, value] of cache.current) {
      if (!visible.includes(id)) {
        if (value.state === "ready") {
          URL.revokeObjectURL(value.url);
        }
        cache.current.delete(id);
      }
    }
    setThumbnails(
      new Map(
        visible.map((id) => [id, cache.current.get(id) ?? { state: paused ? "paused" : "queued" }]),
      ),
    );
    let running = false;
    const renderPending = async () => {
      if (running || paused || controller.signal.aborted) {
        return;
      }
      running = true;
      try {
        while (!controller.signal.aborted) {
          const id = visible.find((id) => !cache.current.has(id));
          if (id === undefined) {
            break;
          }
          const file = getFile(sourceId ?? id);
          if (!file) {
            const unavailable: Thumbnail = {
              state: "error",
              message: "The original file is no longer available. Remove it and add it again.",
            };
            cache.current.set(id, unavailable);
            setThumbnails((current) => new Map(current).set(id, unavailable));
            continue;
          }
          setThumbnails((current) => new Map(current).set(id, { state: "rendering" }));
          let thumbnail: Thumbnail;
          try {
            const blob = await render(file, controller.signal, id);
            if (controller.signal.aborted) {
              return;
            }
            thumbnail = { state: "ready", url: URL.createObjectURL(blob) };
          } catch {
            if (controller.signal.aborted) {
              return;
            }
            thumbnail = {
              state: "error",
              message:
                "Retry the preview or continue processing. PDF validation is independent of previews.",
            };
          }
          cache.current.set(id, thumbnail);
          setThumbnails((current) => new Map(current).set(id, thumbnail));
        }
      } finally {
        running = false;
      }
    };
    requestRetry.current = (id) => {
      if (paused || !visible.includes(id) || cache.current.get(id)?.state !== "error") {
        return;
      }
      cache.current.delete(id);
      setThumbnails((current) => new Map(current).set(id, { state: "queued" }));
      void renderPending();
    };
    void renderPending();
    return () => {
      requestRetry.current = null;
      controller.abort();
    };
  }, [key, getFile, paused, render, sourceId]);
  useEffect(() => {
    const current = cache.current;
    return () => {
      for (const value of current.values()) {
        if (value.state === "ready") {
          URL.revokeObjectURL(value.url);
        }
      }
      current.clear();
    };
  }, []);
  const retry = (id: string) => {
    requestRetry.current?.(id);
  };
  return { thumbnails, retry };
};
