import { Button, ConfirmDiscard, FileDropzone } from "@repo/core-ui";
import { InputCard } from "../workspace/InputCard";
import { PreservationNotice } from "../workspace/PreservationNotice";
import type { useDocumentWorkspace } from "../workspace/useDocumentWorkspace";
import { PagePicker } from "./PagePicker";
import { SelectionSettings } from "./SelectionSettings";
import { useSplitSettings } from "./useSplitSettings";
import { useSplitJob } from "./useSplitJob";
import { SplitResult } from "./SplitResult";
import { ModePicker } from "./ModePicker";
import { OutputPrediction } from "./OutputPrediction";
import { ToolSettingsSidebar } from "../workspace/ToolSettingsSidebar";

export const SplitWorkspace = ({
  workspace,
  tool = "split",
}: {
  workspace: ReturnType<typeof useDocumentWorkspace>;
  tool?: "split" | "remove";
}) => {
  const { draft, execution, focus, capable, confirmation } = workspace;
  const { draftHeading, resultHeading, jobError } = focus;
  const { job, locked, editable } = execution;
  const input = draft.inputs[0];
  const removing = tool === "remove";
  const settings = useSplitSettings(input?.name ?? "", draft.ready ? draft.pageCount : 0, tool);
  const { generate, status } = useSplitJob(workspace, settings.selection, Boolean(settings.plan));
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
            Your source PDF
          </h2>
          <Button variant="ghost" disabled={locked || !input} onClick={workspace.requestReset}>
            Start over
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {removing
            ? "Remove unwanted pages from one PDF. Your original stays unchanged."
            : "Choose pages or ranges from one PDF. Your original stays unchanged."}
        </p>
        <div className="mt-6">
          <div className="min-w-0">
            <FileDropzone
              regionLabel="Add a source PDF"
              inputLabel="Choose one PDF"
              label="Add PDF"
              accept=".pdf,application/pdf"
              multiple={false}
              disabled={!editable || !capable || Boolean(input)}
              buttonRef={draft.addButton}
              onAddFiles={(files) => {
                if (files.length !== 1 || input) {
                  workspace.announce(
                    "Choose exactly one PDF. Remove the current source before adding another.",
                  );
                  return;
                }
                workspace.addFiles(files);
              }}
            >
              <p className="mt-3 text-sm text-muted-foreground">
                {input
                  ? "Remove the source or start over to choose another PDF."
                  : "Or drop one PDF here. No uploads. Encrypted PDFs, interactive forms, and digital signatures are not supported."}
              </p>
            </FileDropzone>
            {input && (
              <ol aria-label="Source PDF">
                <InputCard
                  input={input}
                  index={0}
                  total={1}
                  editable={editable}
                  reorderable={false}
                  checking={draft.validationId === input.id}
                  onMove={workspace.moveFile}
                  onRemove={workspace.removeFile}
                  onRetry={draft.retryValidation}
                />
              </ol>
            )}
            {input && draft.ready && settings.mode === "selected" && (
              <PagePicker
                sourceId={input.id}
                getFile={draft.files.get}
                pageCount={draft.pageCount}
                order={settings.order}
                selected={settings.pages}
                removing={removing}
                editable={editable}
                paused={locked}
                onSelect={(pages) => {
                  execution.editDraft();
                  settings.setPages(pages);
                }}
                onReorder={(order) => {
                  execution.editDraft();
                  settings.setPageOrder(order);
                }}
                announce={workspace.announce}
              />
            )}
          </div>
          <section
            className="tool-actions"
            aria-label={removing ? "Removal output" : "Split output"}
          >
            {removing && draft.ready && (
              <p className="mb-3 text-sm" role="status" aria-live="polite">
                {settings.plan
                  ? `${settings.pages.length} page${settings.pages.length === 1 ? "" : "s"} will be removed. ${settings.plan.totalPages} will be kept in source order.`
                  : settings.error}
              </p>
            )}
            {settings.plan && <OutputPrediction plan={settings.plan} />}
            {input && (
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
                  disabled={
                    !draft.ready || !settings.plan || !draft.acknowledged || locked || !capable
                  }
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
          <ToolSettingsSidebar
            title={removing ? "Remove pages settings" : "Split / Extract settings"}
          >
            {draft.ready ? (
              removing ? (
                <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                  Select pages in the source preview to remove them. Keep at least one page.
                  Remaining pages are saved together as one PDF in their original order.
                </p>
              ) : (
                <>
                  <ModePicker
                    mode={settings.mode}
                    disabled={!editable}
                    onChange={(mode) => {
                      execution.editDraft();
                      settings.setMode(mode);
                    }}
                  />
                  <SelectionSettings
                    settings={settings}
                    pageCount={draft.pageCount}
                    disabled={!editable}
                    onEdit={execution.editDraft}
                    announce={workspace.announce}
                  />
                </>
              )
            ) : (
              <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                {input
                  ? "Resolve input errors and wait for validation before choosing pages."
                  : "Add one PDF to choose pages and see exactly what will be generated."}
              </p>
            )}
          </ToolSettingsSidebar>
        </div>
      </section>
      {job.phase === "complete" && settings.plan && (
        <SplitResult
          plan={settings.plan}
          removing={removing}
          headingRef={resultHeading}
          downloads={execution.downloads}
          onEdit={workspace.requestEdit}
        />
      )}
      <ConfirmDiscard
        open={confirmation !== null}
        description={
          confirmation === "edit"
            ? "Some outputs have not had a download requested. Editing clears all generated outputs."
            : "This clears the source, selection, and outputs from this tab. Original files and downloaded copies are unchanged."
        }
        onKeep={workspace.keepWorking}
        onDiscard={workspace.confirmDiscard}
      />
    </>
  );
};
