import { Button } from "@repo/core-ui";
import type { ToolRoute } from "./routes";

export const ToolIntroduction = ({
  route,
  onMerge,
  onSplit,
  onImages,
}: {
  route: Exclude<ToolRoute, "merge" | "split" | "images">;
  onMerge: () => void;
  onSplit: () => void;
  onImages: () => void;
}) => (
  <section className="py-8" aria-label="Tool availability">
    <h2 className="text-xl font-semibold">
      {route === "home" ? "Choose a PDF tool" : "Choose an available tool"}
    </h2>
    <p className="mt-3 max-w-prose">
      {route === "home"
        ? "Combine local PDFs, split and extract pages, or turn JPEG and PNG images into PDFs. Free to use, with no signup."
        : "This address does not identify a PDFBurrow tool. No documents or settings can be restored from a link."}
    </p>
    <Button className="mt-5" onClick={onMerge}>
      Open Merge PDFs
    </Button>
    <Button className="mt-5 sm:ml-3" variant="outline" onClick={onSplit}>
      Open Split / Extract
    </Button>
    <Button className="mt-5 sm:ml-3" variant="outline" onClick={onImages}>
      Open Images to PDF
    </Button>
    <p className="mt-5 text-sm text-muted-foreground">
      Choose a tool before adding files. Switching tools clears your current work only after you
      confirm.
    </p>
  </section>
);
