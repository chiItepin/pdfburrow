import { lazy, Suspense } from "react";
import { Button, ConfirmDiscard, FileDropzone } from "@repo/core-ui";
import type { PdfOutput } from "@repo/pdf-engine";
import { InputCard } from "../workspace/InputCard";
import type { useDocumentWorkspace } from "../workspace/useDocumentWorkspace";

const FormEditor = lazy(() =>
  import("./FormEditor").then((module) => ({ default: module.FormEditor })),
);

export const FormWorkspace = ({
  workspace,
  onSign,
}: {
  workspace: ReturnType<typeof useDocumentWorkspace>;
  onSign: (output: PdfOutput) => boolean;
}) => {
  const { draft, execution } = workspace;
  const { draftHeading } = workspace.focus;
  const input = draft.inputs[0];
  const file = input ? draft.files.get(input.id) : undefined;
  return (
    <>
      <section className="py-8" aria-labelledby="draft-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="draft-heading" ref={draftHeading} tabIndex={-1} className="text-xl font-semibold">
            Fill your PDF form
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
          Complete existing form fields without uploading your paperwork. Download an editable copy,
          or flatten a copy before adding a visual signature. Work lives only in this tab.
        </p>
        {!workspace.capable && (
          <p role="alert" className="mt-4 text-destructive">
            This browser cannot run local PDF workers. Use a current browser with module workers and
            local file support.
          </p>
        )}
        <div className="mt-6">
          <FileDropzone
            regionLabel="Add a PDF form"
            inputLabel="Choose one PDF form"
            label="Choose PDF form"
            accept=".pdf,application/pdf"
            multiple={false}
            buttonRef={draft.addButton}
            disabled={!workspace.capable || Boolean(input) || !execution.editable}
            onAddFiles={(files) => {
              if (files.length !== 1 || input) {
                workspace.announce(
                  "Choose exactly one PDF form. Start over before adding another.",
                );
                return;
              }
              workspace.addFiles(files, "form");
            }}
          >
            <p className="mt-3 text-sm text-muted-foreground">
              Standard AcroForm fields only. Scans, XFA, scripted or calculated forms, encryption
              and digital signatures are not supported.
            </p>
          </FileDropzone>
          {input && (
            <ol aria-label="Source PDF form">
              <InputCard
                input={input}
                index={0}
                total={1}
                editable={execution.editable && !workspace.interactionLocked}
                checking={draft.validationId === input.id}
                reorderable={false}
                onMove={workspace.moveFile}
                onRemove={workspace.requestReset}
                onRetry={draft.retryValidation}
              />
            </ol>
          )}
          {input?.status === "ready" && "formPages" in input.info && file && (
            <Suspense
              fallback={
                <p role="status" className="mt-4">
                  Loading the local form editor...
                </p>
              }
            >
              <FormEditor
                key={input.id}
                file={file}
                info={input.info}
                workspace={workspace}
                onSign={onSign}
              />
            </Suspense>
          )}
          {input?.status !== "ready" && (
            <p role="status" className="mt-3 text-sm">
              {workspace.notice}
            </p>
          )}
        </div>
      </section>
      <ConfirmDiscard
        open={workspace.confirmation !== null}
        description={
          workspace.confirmation === "edit"
            ? "Editing clears the generated download. Your form values are retained."
            : "This clears the PDF, entered values and generated downloads from this tab. Original files and downloaded copies are unchanged."
        }
        keepLabel="Keep working"
        discardLabel={workspace.confirmation === "edit" ? "Edit form" : "Start over"}
        onKeep={workspace.keepWorking}
        onDiscard={workspace.confirmDiscard}
      />
    </>
  );
};
