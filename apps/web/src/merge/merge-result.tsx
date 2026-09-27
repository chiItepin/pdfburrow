import type { Ref } from "react";
import { Button } from "@repo/core-ui";
import type { MergeJob } from "./types";

interface MergeResultProps {
  job: Extract<MergeJob, { phase: "complete" }>;
  pageCount: number;
  headingRef: Ref<HTMLHeadingElement>;
  downloadError: string;
  onDownload: () => void;
  onEdit: () => void;
}

export const MergeResult = ({
  job,
  pageCount,
  headingRef,
  downloadError,
  onDownload,
  onEdit,
}: MergeResultProps) => (
  <section aria-labelledby="result-heading" className="mb-8 rounded-lg border bg-secondary p-6">
    <h2 id="result-heading" ref={headingRef} tabIndex={-1} className="text-xl font-semibold">
      Your merged PDF is ready
    </h2>
    <p className="mt-2 break-all">{job.filename}</p>
    <p className="mt-1 text-sm">
      {pageCount} pages · {(job.bytes / 1024).toFixed(1)} KB
    </p>
    <div className="mt-4 flex flex-wrap gap-3">
      <Button onClick={onDownload}>Download PDF</Button>
      <Button variant="outline" onClick={onEdit}>
        Edit inputs
      </Button>
    </div>
    {downloadError && (
      <p role="alert" className="mt-3 text-destructive">
        {downloadError}
      </p>
    )}
  </section>
);
