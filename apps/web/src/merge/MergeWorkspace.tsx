import { Button, ConfirmDiscard } from "@repo/core-ui";
import { FilePicker } from "./FilePicker";
import { InputList } from "../workspace/InputList";
import { MergeResult } from "./MergeResult";
import { PreservationNotice } from "./PreservationNotice";
import type { useMergeWorkspace } from "./useMergeWorkspace";

export const MergeWorkspace = ({
  workspace,
}: {
  workspace: ReturnType<typeof useMergeWorkspace>;
}) => {
  const { draft, execution, focus, capable, confirmation } = workspace;
  const { draftHeading, resultHeading, jobError } = focus;
  const { job, locked, editable } = execution;
  return (
    <>
      {!capable && (
        <p role="alert" className="my-4 text-destructive">
          This browser cannot run the local PDF worker. Use a current browser with module workers
          and local file support.
        </p>
      )}
      <section aria-labelledby="draft-heading" className="py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="draft-heading" ref={draftHeading} tabIndex={-1} className="text-xl font-semibold">
            Your PDFs
          </h2>
          <Button
            variant="ghost"
            disabled={locked || !draft.inputs.length}
            onClick={workspace.requestReset}
          >
            Start over
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Whole files are merged in displayed order. Page sizes and rotations are kept.
        </p>
        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <FilePicker
              disabled={!editable || !capable}
              buttonRef={draft.addButton}
              onAddFiles={workspace.addFiles}
            />
            <InputList
              draft={draft}
              editable={editable}
              previews={workspace.previews}
              moveFile={workspace.moveFile}
              removeFile={workspace.removeFile}
            />
          </div>
          <section className="min-w-0 lg:pt-5" aria-labelledby="settings-heading">
            <h3 id="settings-heading" className="text-lg font-semibold">
              Merge settings
            </h3>
            {draft.inputs.length > 0 && (
              <PreservationNotice
                disabled={!editable}
                acknowledged={draft.acknowledged}
                onAcknowledge={draft.setAcknowledged}
              />
            )}
            <p className="mt-4 text-sm">
              {draft.ready
                ? `Output: one PDF, ${draft.pageCount} page${draft.pageCount === 1 ? "" : "s"}, in the order above.`
                : draft.inputs.length
                  ? "Resolve input errors and wait for validation before merging."
                  : "Add PDFs to get started."}
            </p>
            {job.phase !== "complete" && (
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  disabled={!draft.ready || !draft.acknowledged || locked || !capable}
                  onClick={workspace.mergeFiles}
                >
                  {job.phase === "error" ? "Retry merge" : "Merge PDFs"}
                </Button>
                {locked && (
                  <Button
                    size="lg"
                    variant="outline"
                    disabled={job.phase === "cancelling"}
                    onClick={execution.cancel}
                  >
                    Cancel merge
                  </Button>
                )}
              </div>
            )}
            <p role="status" aria-live="polite" className="mt-4 min-h-6 text-sm">
              {workspace.status}
            </p>
            {job.phase === "error" && (
              <p ref={jobError} tabIndex={-1} role="alert" className="mt-3 text-destructive">
                {job.message}
              </p>
            )}
          </section>
        </div>
      </section>
      {job.phase === "complete" && (
        <MergeResult
          pageCount={draft.pageCount}
          headingRef={resultHeading}
          downloads={execution.downloads}
          onEdit={workspace.requestEdit}
        />
      )}
      <ConfirmDiscard
        open={confirmation !== null}
        description={
          confirmation === "edit"
            ? "The merged PDF has not had a download requested. Editing clears that output."
            : "This clears the current inputs and output from this tab. Original files and downloaded copies are unchanged."
        }
        onKeep={workspace.keepWorking}
        onDiscard={workspace.confirmDiscard}
      />
    </>
  );
};
