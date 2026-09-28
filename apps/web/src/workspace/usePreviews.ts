import { useEffect, useRef, useState } from "react";
import type { Thumbnail } from "./types";

export const usePreviews = (
  ids: readonly string[],
  getFile: (id: string) => File | undefined,
  paused: boolean,
  render: (file: File, signal: AbortSignal) => Promise<Blob>,
) => {
  const cache = useRef(new Map<string, Thumbnail>());
  const [thumbnails, setThumbnails] = useState(new Map<string, Thumbnail>());
  const [attempt, setAttempt] = useState(0);
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
    if (!paused) {
      void (async () => {
        for (const id of visible) {
          if (controller.signal.aborted) {
            return;
          }
          if (cache.current.has(id)) {
            continue;
          }
          const file = getFile(id);
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
            const blob = await render(file, controller.signal);
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
                "Retry the preview or continue merging. PDF validation is independent of previews.",
            };
          }
          cache.current.set(id, thumbnail);
          setThumbnails((current) => new Map(current).set(id, thumbnail));
        }
      })();
    }
    return () => controller.abort();
  }, [key, getFile, paused, render, attempt]);
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
    if (paused || !ids.includes(id) || cache.current.get(id)?.state !== "error") {
      return;
    }
    cache.current.delete(id);
    setAttempt((current) => current + 1);
  };
  return { thumbnails, retry };
};
