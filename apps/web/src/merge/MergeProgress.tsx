import { Progress, Spinner } from "@repo/core-ui";
import type { DocumentJob } from "../workspace/types";

export const MergeProgress = ({
  job,
  pageCount,
  status,
}: {
  job: DocumentJob;
  pageCount: number;
  status: string;
}) => {
  const copying =
    job.phase === "processing" && job.progress?.phase === "copying" ? job.progress : undefined;
  const busy = job.phase === "processing" || job.phase === "cancelling";
  return (
    <div className="mt-4">
      {copying && (
        <Progress
          className="mb-3"
          aria-label="Pages copied"
          value={copying.completed}
          max={pageCount}
          aria-valuetext={`${copying.completed} of ${pageCount} pages copied`}
        />
      )}
      <p
        role="status"
        aria-label="Merge status"
        className="flex min-h-6 items-center gap-2 text-sm"
      >
        {busy && !copying && <Spinner aria-hidden="true" />}
        {status}
      </p>
    </div>
  );
};
