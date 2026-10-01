import { Button } from "@repo/core-ui";
import type { useDocumentWorkspace } from "../workspace/useDocumentWorkspace";

export const MarkupOutput = ({
  workspace,
  busy,
  onGenerate,
}: {
  workspace: ReturnType<typeof useDocumentWorkspace>;
  busy: boolean;
  onGenerate: () => void;
}) => {
  const { execution, draft } = workspace;
  const { resultHeading, jobError } = workspace.focus;
  return (
    <>
      <label className="mt-6 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={draft.acknowledged}
          disabled={!execution.editable || busy}
          onChange={(event) => draft.setAcknowledged(event.target.checked)}
          className="mt-1 size-4 shrink-0 accent-primary"
        />
        <span>
          I understand: markup is baked into page content. Reopening won't restore editable objects.
          This is not a lossless copy or a digital signature; bookmarks, metadata, accessibility and
          PDF/A guarantees may change.
        </span>
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        {execution.job.phase === "complete" ? (
          <>
            <Button onClick={() => execution.downloads.download(0)} disabled={busy}>
              Download PDF
            </Button>
            <Button variant="outline" disabled={busy} onClick={workspace.requestEdit}>
              Edit markup
            </Button>
          </>
        ) : (
          <Button
            disabled={!draft.acknowledged || busy || !execution.editable}
            onClick={onGenerate}
          >
            {execution.job.phase === "error" ? "Retry generation" : "Generate PDF"}
          </Button>
        )}
        {execution.locked && (
          <Button
            variant="outline"
            disabled={execution.job.phase === "cancelling"}
            onClick={execution.cancel}
          >
            Cancel generation
          </Button>
        )}
      </div>
      {execution.job.phase === "complete" && (
        <h3 ref={resultHeading} tabIndex={-1} className="mt-5 text-lg font-semibold">
          Your marked PDF is ready
        </h3>
      )}
      <p role="status" className="mt-3 text-sm">
        {execution.job.phase === "processing"
          ? "Writing markup in the local worker..."
          : execution.job.phase === "cancelling"
            ? "Cancelling generation..."
            : execution.job.phase === "cancelled"
              ? "Generation cancelled. Your markup is unchanged."
              : execution.job.phase === "complete"
                ? "Your flattened PDF is ready. Choose Download PDF to save it."
                : workspace.notice}
      </p>
      {execution.job.phase === "error" && (
        <p ref={jobError} tabIndex={-1} role="alert" className="mt-3 text-destructive">
          {execution.job.message}
        </p>
      )}
      {execution.downloads.error && (
        <p role="alert" className="mt-3 text-destructive">
          {execution.downloads.error}
        </p>
      )}
    </>
  );
};
