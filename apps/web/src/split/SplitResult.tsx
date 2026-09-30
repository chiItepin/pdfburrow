import type { Ref } from "react";
import { Button } from "@repo/core-ui";
import type { SplitPlan } from "@repo/pdf-engine";
import { OutputDownloads } from "../workspace/OutputDownloads";
import type { useDownloads } from "../workspace/useDownloads";

export const SplitResult = ({
  plan,
  headingRef,
  downloads,
  onEdit,
  removing = false,
}: {
  plan: SplitPlan;
  headingRef: Ref<HTMLHeadingElement>;
  downloads: ReturnType<typeof useDownloads>;
  onEdit: () => void;
  removing?: boolean;
}) => (
  <section aria-labelledby="result-heading" className="mb-8 rounded-lg border bg-secondary p-6">
    <h2 id="result-heading" ref={headingRef} tabIndex={-1} className="text-xl font-semibold">
      {removing ? "Your PDF is ready" : "Your PDFs are ready"}
    </h2>
    <p className="mt-1 text-sm">
      {removing
        ? `${plan.totalPages} page${plan.totalPages === 1 ? "" : "s"} kept in source order. Download your new PDF; your original is unchanged.`
        : `${plan.outputCount} PDF${plan.outputCount === 1 ? "" : "s"} generated. Download individual PDFs${plan.outputCount > 1 ? " or prepare a ZIP of all outputs" : ""}.`}
    </p>
    <OutputDownloads downloads={downloads} bundleName={plan.bundleName} />
    <Button className="mt-4" variant="outline" disabled={downloads.busy} onClick={onEdit}>
      Edit selection
    </Button>
  </section>
);
