import { Button, ConfirmDiscard, FileDropzone, toast, useFocusAfterCommit } from "@repo/core-ui";
import { InputCard } from "../workspace/InputCard";
import type { useDocumentWorkspace } from "../workspace/useDocumentWorkspace";
import { PagePicker } from "./PagePicker";
import { formPreviewSources } from "../workspace/previewRenderers";
import { SelectionSettings } from "./SelectionSettings";
import { useSplitSettings } from "./useSplitSettings";
import { useSplitJob } from "./useSplitJob";
import { SplitResult } from "./SplitResult";
import { ModePicker } from "./ModePicker";
import { ToolSettingsSidebar } from "../workspace/ToolSettingsSidebar";
import { usePageSets } from "./usePageSets";
import { usePageSetJob } from "./usePageSetJob";
import { PageSetActions } from "./PageSetActions";
import { SplitActions } from "./SplitActions";
import { pageSetLabel } from "./pageSets";

export const SplitWorkspace = ({
  workspace,
  tool = "split",
}: {
  workspace: ReturnType<typeof useDocumentWorkspace>;
  tool?: "split" | "remove";
}) => {
  const { draft, execution, focus, capable, confirmation } = workspace;
  const { draftHeading, resultHeading } = focus;
  const { job, locked, editable } = execution;
  const input = draft.inputs[0];
  const removing = tool === "remove";
  const settings = useSplitSettings(input?.name ?? "", draft.ready ? draft.pageCount : 0, tool);
  const grouping = !removing && settings.mode === "sets";
  const pageSets = usePageSets(draft.ready ? draft.pageCount : 0, settings.order);
  const setJob = usePageSetJob(workspace);
  const focusAfterCommit = useFocusAfterCommit();
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
                  : "Or drop one PDF here. No uploads. Supported form fields stay editable in the output. Encrypted PDFs, XFA forms, and digital signatures are not supported."}
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
                  onRemove={(id) =>
                    grouping
                      ? setJob.requestEdit(() => workspace.removeFile(id))
                      : workspace.removeFile(id)
                  }
                  onRetry={draft.retryValidation}
                />
              </ol>
            )}
            {input && draft.ready && (settings.mode === "selected" || grouping) && (
              <PagePicker
                sourceId={input.id}
                formSources={formPreviewSources(draft.inputs)}
                getFile={draft.files.get}
                pageCount={draft.pageCount}
                order={settings.order}
                selected={grouping ? pageSets.selected : settings.pages}
                removing={removing}
                editable={editable}
                paused={locked}
                onSelect={(pages) => {
                  if (grouping) {
                    pageSets.select(pages);
                  } else {
                    execution.editDraft();
                    settings.setPages(pages);
                  }
                }}
                onReorder={(order, onApplied) => {
                  const apply = () => {
                    settings.setPageOrder(order);
                    onApplied();
                  };
                  if (grouping) {
                    setJob.requestEdit(apply);
                  } else {
                    execution.editDraft();
                    apply();
                  }
                }}
                onGroup={
                  grouping
                    ? () =>
                        setJob.requestEdit(() => {
                          const pages = settings.order.filter((page) =>
                            pageSets.selected.includes(page),
                          );
                          pageSets.group();
                          workspace.announce(`${pageSetLabel(pages)} will download together.`);
                          toast.success("Pages grouped.", {
                            id: "page-set-edit",
                            description: `${pages.length} pages will download together. Choose Download PDF in Your downloads when ready.`,
                          });
                          focusAfterCommit(() => document.getElementById("page-sets-heading"));
                        })
                    : undefined
                }
                announce={workspace.announce}
              />
            )}
          </div>
          {grouping && draft.ready ? (
            <PageSetActions workspace={workspace} pageSets={pageSets} setJob={setJob} />
          ) : (
            <SplitActions
              workspace={workspace}
              settings={settings}
              removing={removing}
              generate={generate}
              status={status}
            />
          )}
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
                      setJob.requestEdit(() => settings.setMode(mode));
                    }}
                  />
                  {grouping ? (
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                      Every page starts as a separate PDF. Select pages and group them to download
                      together. Download only the PDFs you need.
                    </p>
                  ) : (
                    <SelectionSettings
                      settings={settings}
                      pageCount={draft.pageCount}
                      disabled={!editable}
                      onEdit={execution.editDraft}
                      announce={workspace.announce}
                    />
                  )}
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
      {!grouping && job.phase === "complete" && settings.plan && (
        <SplitResult
          plan={settings.plan}
          removing={removing}
          headingRef={resultHeading}
          downloads={execution.downloads}
          onEdit={workspace.requestEdit}
        />
      )}
      <ConfirmDiscard
        open={setJob.confirmation}
        description="The latest PDF's download has not been requested. Continuing clears that generated PDF; your source and page groups stay available."
        onKeep={setJob.keep}
        onDiscard={setJob.discard}
      />
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
