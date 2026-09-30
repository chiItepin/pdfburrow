import { Button, ConfirmDiscard, FileDropzone } from "@repo/core-ui";
import { lazy, Suspense } from "react";
import { InputCard } from "../workspace/InputCard";
import type { useDocumentWorkspace } from "../workspace/useDocumentWorkspace";
const MarkupEditor = lazy(() =>
  import("./MarkupEditor").then((module) => ({ default: module.MarkupEditor })),
);

export const MarkupWorkspace = ({
  workspace,
}: {
  workspace: ReturnType<typeof useDocumentWorkspace>;
}) => {
  const { draft, execution, confirmation } = workspace;
  const { draftHeading } = workspace.focus;
  const input = draft.inputs[0];
  const file = input ? draft.files.get(input.id) : undefined;
  return (
    <>
      <section className="py-8" aria-labelledby="draft-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="draft-heading" ref={draftHeading} tabIndex={-1} className="text-xl font-semibold">
            Sign and annotate your PDF
          </h2>
          <Button
            variant="ghost"
            disabled={!input || execution.locked || workspace.interactionLocked}
            onClick={workspace.requestReset}
          >
            Start over
          </Button>
        </div>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Add a drawn signature, ink, highlights, and text notes. Your file stays on this device;
          edits live only in this tab. Original files are never overwritten.
        </p>
        {!workspace.capable && (
          <p role="alert" className="mt-4 text-destructive">
            This browser cannot run local PDF workers. Use a current browser with module workers and
            local file support.
          </p>
        )}
        <div className="mt-6">
          <FileDropzone
            regionLabel="Add a PDF to sign"
            inputLabel="Choose one PDF to sign"
            label="Choose PDF"
            accept=".pdf,application/pdf"
            multiple={false}
            disabled={!execution.editable || !workspace.capable || Boolean(input)}
            buttonRef={draft.addButton}
            onAddFiles={(files) => {
              if (files.length !== 1 || input) {
                workspace.announce("Choose exactly one PDF. Start over before adding another.");
                return;
              }
              workspace.addFiles(files, "markup");
            }}
          >
            <p className="mt-3 text-sm text-muted-foreground">
              No uploads. Existing page annotations or links, encrypted PDFs, forms, and digital
              signatures are not supported. Use a flattened, noninteractive source copy.
            </p>
          </FileDropzone>
          {input && (
            <ol aria-label="Source PDF">
              <InputCard
                input={input}
                index={0}
                total={1}
                editable={execution.editable && !workspace.interactionLocked}
                reorderable={false}
                checking={draft.validationId === input.id}
                onMove={workspace.moveFile}
                onRemove={workspace.requestReset}
                onRetry={draft.retryValidation}
              />
            </ol>
          )}
          {input?.status === "ready" && "pages" in input.info && file && (
            <Suspense
              fallback={
                <p role="status" className="mt-4">
                  Loading the local markup editor...
                </p>
              }
            >
              <MarkupEditor key={input.id} file={file} info={input.info} workspace={workspace} />
            </Suspense>
          )}
        </div>
      </section>
      <ConfirmDiscard
        open={confirmation !== null}
        description={
          confirmation === "edit"
            ? "Editing clears generated outputs. Some outputs have not had a download requested. Your PDF and markup are retained."
            : "This removes the PDF, all markup, undo history, and generated downloads from this tab. Original files and downloaded copies are unchanged."
        }
        keepLabel="Keep editing"
        discardLabel={confirmation === "edit" ? "Edit markup" : "Start over"}
        onKeep={workspace.keepWorking}
        onDiscard={workspace.confirmDiscard}
      />
    </>
  );
};
