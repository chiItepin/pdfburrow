import { Button } from "@repo/core-ui";
import type { ToolRoute } from "./routes";

export const ToolIntroduction = ({
  route,
  onMerge,
  onSplit,
}: {
  route: Exclude<ToolRoute, "merge" | "split">;
  onMerge: () => void;
  onSplit: () => void;
}) => (
  <section className="py-8" aria-label="Tool availability">
    <h2 className="text-xl font-semibold">
      {route === "home"
        ? "Choose a PDF tool"
        : route === "not-found"
          ? "Choose an available tool"
          : "Not available in this development build"}
    </h2>
    <p className="mt-3 max-w-prose">
      {route === "home"
        ? "Combine local PDFs, or split and extract pages from one PDF. Free to use, with no signup."
        : route === "not-found"
          ? "This address does not identify a PDFBurrow tool. No documents or settings can be restored from a link."
          : "Image conversion has not been implemented. No files can be added here yet. Merge PDFs and Split / Extract are available."}
    </p>
    <Button className="mt-5" onClick={onMerge}>
      Open Merge PDFs
    </Button>
    <Button className="mt-5 sm:ml-3" variant="outline" onClick={onSplit}>
      Open Split / Extract
    </Button>
    <p className="mt-5 text-sm text-muted-foreground">
      Choose a tool before adding files. Switching tools clears your current work only after you
      confirm.
    </p>
  </section>
);
