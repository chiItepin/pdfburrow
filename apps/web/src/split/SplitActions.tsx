import { Button } from "@repo/core-ui";
import { PreservationNotice } from "../workspace/PreservationNotice";
import type { useDocumentWorkspace } from "../workspace/useDocumentWorkspace";
import type { useSplitSettings } from "./useSplitSettings";
import { OutputPrediction } from "./OutputPrediction";

export const SplitActions = ({
  workspace,
  settings,
  removing,
  generate,
  status,
}: {
  workspace: ReturnType<typeof useDocumentWorkspace>;
  settings: ReturnType<typeof useSplitSettings>;
  removing: boolean;
  generate: () => void;
  status: string;
}) => {
  const { draft, execution, capable, focus } = workspace;
  const { jobError } = focus;
  const { job, locked, editable } = execution;
  return (
    <section className="tool-actions" aria-label={removing ? "Removal output" : "Split output"}>
      {removing && draft.ready && (
        <p className="mb-3 text-sm" role="status" aria-live="polite">
          {settings.plan
            ? `${settings.pages.length} page${settings.pages.length === 1 ? "" : "s"} will be removed. ${settings.plan.totalPages} will be kept in source order.`
            : settings.error}
        </p>
      )}
      {settings.plan && <OutputPrediction plan={settings.plan} />}
      {draft.inputs[0] && (
        <PreservationNotice
          action="generate"
          disabled={!editable}
          acknowledged={draft.acknowledged}
          onAcknowledge={draft.setAcknowledged}
        />
      )}
      {job.phase !== "complete" && (
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            size="lg"
            disabled={!draft.ready || !settings.plan || !draft.acknowledged || locked || !capable}
            onClick={generate}
          >
            {job.phase === "error"
              ? "Retry generation"
              : removing
                ? "Remove pages"
                : "Generate PDFs"}
          </Button>
          {locked && (
            <Button
              size="lg"
              variant="outline"
              disabled={job.phase === "cancelling"}
              onClick={execution.cancel}
            >
              Cancel generation
            </Button>
          )}
        </div>
      )}
      <p role="status" aria-live="polite" className="mt-4 min-h-6 text-sm">
        {status}
      </p>
      {job.phase === "error" && (
        <p ref={jobError} tabIndex={-1} role="alert" className="mt-3 text-destructive">
          {job.message}
        </p>
      )}
    </section>
  );
};
