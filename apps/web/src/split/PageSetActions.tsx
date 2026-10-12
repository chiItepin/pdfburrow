import { useState } from "react";
import { Button, Spinner, toast, useFocusAfterCommit } from "@repo/core-ui";
import { PreservationNotice } from "../workspace/PreservationNotice";
import type { useDocumentWorkspace } from "../workspace/useDocumentWorkspace";
import type { usePageSetJob } from "./usePageSetJob";
import type { usePageSets } from "./usePageSets";
import { pageSetFilename, pageSetLabel } from "./pageSets";

export const PageSetActions = ({
  workspace,
  pageSets,
  setJob,
}: {
  workspace: ReturnType<typeof useDocumentWorkspace>;
  pageSets: ReturnType<typeof usePageSets>;
  setJob: ReturnType<typeof usePageSetJob>;
}) => {
  const [windowIndex, setWindowIndex] = useState(0);
  const focusAfterCommit = useFocusAfterCommit();
  const { draft, execution, capable, focus } = workspace;
  const { jobError } = focus;
  const { job, locked, editable, downloads } = execution;
  const lastWindow = Math.max(0, Math.ceil(pageSets.sets.length / 8) - 1);
  const current = Math.min(windowIndex, lastWindow);
  const first = current * 8;
  const active = pageSets.sets.find((set) => set.id === setJob.activeSet);
  const activeLabel = active ? pageSetLabel(active.pages).toLowerCase() : "your PDF";
  const status =
    job.phase === "cancelling"
      ? "Cancelling. Waiting for the worker to stop..."
      : job.phase === "cancelled"
        ? "Generation cancelled. Your page groups are unchanged."
        : job.phase === "processing"
          ? job.progress?.phase === "copying"
            ? `Preparing ${activeLabel}: copied ${job.progress.completed} of ${job.progress.total} pages...`
            : `Preparing ${activeLabel} locally...`
          : workspace.notice;
  return (
    <section className="tool-actions" aria-label="Your downloads">
      <h3 id="page-sets-heading" tabIndex={-1} className="text-lg font-semibold">
        Your downloads
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {pageSets.sets.length} PDF{pageSets.sets.length === 1 ? "" : "s"}. Each download creates
        only that PDF. Group selected pages above to download them together.
      </p>
      <PreservationNotice
        action="generate"
        disabled={!editable}
        acknowledged={draft.acknowledged}
        onAcknowledge={draft.setAcknowledged}
      />
      <ol aria-label="PDFs to download" className="mt-5 divide-y">
        {pageSets.sets.slice(first, first + 8).map((set) => {
          const label = pageSetLabel(set.pages);
          const filename = pageSetFilename(draft.inputs[0]?.name ?? "", set.pages);
          const ready = downloads.outputs[0]?.filename === filename;
          const processing = locked && setJob.activeSet === set.id;
          return (
            <li
              key={set.id}
              aria-label={label}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div className="min-w-0 flex-1 basis-48">
                <p className="break-words font-medium">{label}</p>
                <p className="mt-1 text-sm">
                  {set.pages.length === 1 ? "Single-page PDF" : "Combined PDF"}
                  {set.pages.length > 1 && ` (${set.pages.length} pages)`}
                </p>
                <p className="mt-1 break-all text-xs text-muted-foreground">{filename}</p>
                {ready && (
                  <p className="mt-1 text-sm">
                    PDF ready. Download again if your browser did not save it.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {set.pages.length > 1 && (
                  <Button
                    variant="outline"
                    disabled={!editable}
                    aria-label={`Separate pages: ${label}`}
                    onClick={() =>
                      setJob.requestEdit(() => {
                        pageSets.ungroup(set.id);
                        workspace.announce(`${label} will now download as individual PDFs.`);
                        toast.success("Pages separated.", {
                          id: "page-set-edit",
                          description: `${set.pages.length} pages are now available as individual PDFs in Your downloads.`,
                        });
                        focusAfterCommit(() => document.getElementById("page-sets-heading"));
                      })
                    }
                  >
                    Separate pages
                  </Button>
                )}
                <Button
                  id={`download-set-${set.id}`}
                  disabled={!draft.ready || !draft.acknowledged || !editable || !capable}
                  aria-label={`Download PDF: ${label}`}
                  onClick={() => void setJob.download(set)}
                >
                  {processing && <Spinner aria-hidden="true" />}
                  {processing ? "Generating..." : "Download PDF"}
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      {lastWindow > 0 && (
        <nav aria-label="Download list pages" className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            disabled={current === 0 || locked}
            onClick={() => setWindowIndex(current - 1)}
          >
            Previous PDFs
          </Button>
          <span className="text-sm">
            {first + 1}-{Math.min(first + 8, pageSets.sets.length)} of {pageSets.sets.length}
          </span>
          <Button
            variant="outline"
            disabled={current === lastWindow || locked}
            onClick={() => setWindowIndex(current + 1)}
          >
            Next PDFs
          </Button>
        </nav>
      )}
      {locked && (
        <Button
          className="mt-4"
          variant="outline"
          disabled={job.phase === "cancelling"}
          onClick={execution.cancel}
        >
          Cancel generation
        </Button>
      )}
      <p role="status" aria-live="polite" className="mt-4 min-h-6 text-sm">
        {status}
      </p>
      {job.phase === "error" && (
        <p ref={jobError} tabIndex={-1} role="alert" className="mt-3 text-destructive">
          {job.message}
        </p>
      )}
      {downloads.error && (
        <p role="alert" className="mt-3 text-destructive">
          {downloads.error}
        </p>
      )}
    </section>
  );
};
