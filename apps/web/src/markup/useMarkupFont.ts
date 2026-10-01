import { useEffect, useState } from "react";
import { siteBasePath } from "../workspace/site";

type FontState =
  | { state: "loading" }
  | { state: "ready"; bytes: Uint8Array }
  | { state: "error"; message: string };
export const useMarkupFont = () => {
  const [font, setFont] = useState<FontState>({ state: "loading" });
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let loaded: FontFace | undefined;
    const load = async () => {
      try {
        const response = await fetch(`${siteBasePath}assets/markupFont.ttf`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("The local note font could not load. Retry the font.");
        }
        const buffer = await response.arrayBuffer();
        loaded = new FontFace("PDFBurrow Notes", buffer);
        await loaded.load();
        if (controller.signal.aborted) {
          return;
        }
        document.fonts.add(loaded);
        setFont({ state: "ready", bytes: new Uint8Array(buffer) });
      } catch (error) {
        if (!controller.signal.aborted) {
          setFont({
            state: "error",
            message: error instanceof Error ? error.message : "The local note font could not load.",
          });
        }
      }
    };
    void load();
    return () => {
      controller.abort();
      if (loaded) {
        document.fonts.delete(loaded);
      }
    };
  }, [attempt]);
  return {
    font,
    retry: () => {
      setFont({ state: "loading" });
      retry((value) => value + 1);
    },
  };
};
