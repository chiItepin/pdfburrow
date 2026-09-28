import { Button } from "@repo/core-ui";
import type { ToolRoute } from "./routes";

export const ToolIntroduction = ({
  route,
  onMerge,
}: {
  route: Exclude<ToolRoute, "merge">;
  onMerge: () => void;
}) => (
  <section className="py-8" aria-label="Tool availability">
    <h2 className="text-xl font-semibold">
      {route === "home"
        ? "Start with Merge PDFs"
        : route === "not-found"
          ? "Choose an available tool"
          : "Not available in this development build"}
    </h2>
    <p className="mt-3 max-w-prose">
      {route === "home"
        ? "Combine local PDFs in the order you choose, then download the result. Free to use, with no signup."
        : route === "not-found"
          ? "This address does not identify a PDFBurrow tool. No documents or settings can be restored from a link."
          : "This tool has not been implemented. No files can be added here yet. Merge PDFs is available; split, extraction, and image conversion are still planned."}
    </p>
    <Button className="mt-5" onClick={onMerge}>
      Open Merge PDFs
    </Button>
    <p className="mt-5 text-sm text-muted-foreground">
      Choose a tool before adding files. Switching tools clears your current work only after you
      confirm.
    </p>
  </section>
);
