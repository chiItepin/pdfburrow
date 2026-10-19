import { useState } from "react";
import { Button, Checkbox, Label, ModalDialog } from "@repo/core-ui";
import type { PdfOutput } from "@repo/pdf-engine";
import type { useDocumentWorkspace } from "../workspace/useDocumentWorkspace";

export const FormOutput = ({
  workspace,
  flattened,
  onGenerate,
  onSign,
}: {
  workspace: ReturnType<typeof useDocumentWorkspace>;
  flattened: boolean;
  onGenerate: (flatten: boolean) => void;
  onSign: (output: PdfOutput) => boolean;
}) => {
  const [confirm, setConfirm] = useState(false);
  const [handoffError, setHandoffError] = useState("");
  const { draft, execution } = workspace;
  const { resultHeading, jobError } = workspace.focus;
  const complete = execution.job.phase === "complete";
  const confirmFlatten = (open: boolean) => {
    setConfirm(open);
    workspace.setInteractionLocked(open);
  };
  return (
    <>
      <Label className="mt-6 flex items-start gap-3 leading-relaxed">
        <Checkbox
          checked={draft.acknowledged}
          disabled={!execution.editable}
          onCheckedChange={(checked) => draft.setAcknowledged(checked === true)}
          className="mt-1"
        />
        <span>
          I understand that field fonts and appearance may change. I will review the downloaded PDF.
          Document-level features, metadata, accessibility and PDF/A guarantees are not preserved.
        </span>
      </Label>
      <div className="mt-4 flex flex-wrap gap-3">
        {complete ? (
          <>
            <Button onClick={() => execution.downloads.download(0)} disabled={execution.locked}>
              {flattened ? "Download flattened PDF" : "Download filled PDF"}
            </Button>
            {flattened && (
              <Button
                onClick={() => {
                  const output = execution.downloads.values()[0];
                  if (!output || !onSign(output)) {
                    setHandoffError(
                      "The signature editor could not open. Your filled form is retained. Retry after any pending navigation finishes.",
                    );
                  }
                }}
              >
                Continue to visual signing
              </Button>
            )}
            <Button variant="outline" onClick={workspace.requestEdit} disabled={execution.locked}>
              Edit form
            </Button>
          </>
        ) : (
          <>
            <Button
              disabled={!draft.acknowledged || !execution.editable}
              onClick={() => onGenerate(false)}
            >
              Generate filled PDF
            </Button>
            <Button
              variant="outline"
              disabled={!draft.acknowledged || !execution.editable}
              onClick={() => confirmFlatten(true)}
            >
              Prepare for visual signature
            </Button>
          </>
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
      {complete && (
        <h3 ref={resultHeading} tabIndex={-1} className="mt-5 text-lg font-semibold">
          {flattened ? "Your copy is ready for signing" : "Your filled PDF is ready"}
        </h3>
      )}
      <p role="status" className="mt-3 text-sm">
        {execution.job.phase === "processing"
          ? "Writing form values in the local worker..."
          : execution.job.phase === "cancelling"
            ? "Cancelling generation..."
            : execution.job.phase === "cancelled"
              ? "Generation cancelled. Your form values are retained."
              : complete
                ? flattened
                  ? "Fields in this copy are fixed page content. Download it or continue to the signature editor."
                  : "Fields remain editable. Choose Download filled PDF to save your copy."
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
      {handoffError && (
        <p role="alert" className="mt-3 text-destructive">
          {handoffError}
        </p>
      )}
      {confirm && (
        <ModalDialog
          title="Flatten a copy for visual signing?"
          onCancel={() => confirmFlatten(false)}
        >
          <p className="text-sm leading-relaxed">
            This turns form fields into fixed page content. Your original is unchanged, but
            continuing to the signature editor replaces this tab's form draft. Save an editable
            filled PDF first if you need one. Flattening is not tamper protection, and a visual
            signature is not a digital signature.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => confirmFlatten(false)}>
              Keep filling
            </Button>
            <Button
              onClick={() => {
                confirmFlatten(false);
                onGenerate(true);
              }}
            >
              Flatten copy
            </Button>
          </div>
        </ModalDialog>
      )}
    </>
  );
};
