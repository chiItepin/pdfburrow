import { useEffect, useRef, useState } from "react";

interface Thumbnail {
  url?: string;
  error?: string;
}

export function usePreviews(ids: readonly string[], getFile: (id: string) => File | undefined, paused: boolean) {
  const cache = useRef(new Map<string, Thumbnail>());
  const [thumbnails, setThumbnails] = useState(new Map<string, Thumbnail>());
  const key = JSON.stringify(ids);

  useEffect(() => {
    const visible: string[] = JSON.parse(key);
    const controller = new AbortController();
    for (const [id, value] of cache.current) {
      if (!visible.includes(id)) {
        if (value.url) URL.revokeObjectURL(value.url);
        cache.current.delete(id);
      }
    }
    setThumbnails(new Map(cache.current));
    if (!paused) void (async () => {
      for (const id of visible) {
        if (controller.signal.aborted) return;
        if (cache.current.has(id)) continue;
        const file = getFile(id);
        if (!file) continue;
        let thumbnail: Thumbnail;
        try {
          const { previewPdf } = await import("@repo/pdf-engine/preview");
          if (controller.signal.aborted) return;
          const blob = await previewPdf(file, controller.signal);
          if (controller.signal.aborted) return;
          thumbnail = { url: URL.createObjectURL(blob) };
        } catch {
          if (controller.signal.aborted) return;
          thumbnail = { error: "Preview unavailable. Validation and merging are independent of previews." };
        }
        cache.current.set(id, thumbnail);
        setThumbnails(new Map(cache.current));
      }
    })();
    return () => controller.abort();
  }, [key, getFile, paused]);

  useEffect(() => {
    const current = cache.current;
    return () => {
      for (const value of current.values()) if (value.url) URL.revokeObjectURL(value.url);
      current.clear();
    };
  }, []);
  return thumbnails;
}
