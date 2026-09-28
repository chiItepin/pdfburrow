import { useState } from "react";
import { describeJobStatus } from "./jobStatus";
import type { DiscardAction } from "./types";
import type { MoveDirection } from "../workspace/types";
import { usePdfDraft } from "../workspace/usePdfDraft";
import { useDocumentJob } from "../workspace/useDocumentJob";
import { usePreviews } from "../workspace/usePreviews";
import { useWorkspaceLifecycle } from "../workspace/useWorkspaceLifecycle";
import { renderPdfPreview } from "../workspace/previewRenderers";

export const useMergeWorkspace = () => {
  const [notice, announce] = useState("");
  const [confirmation, setConfirmation] = useState<DiscardAction | null>(null);
  const draft = usePdfDraft(announce);
  const execution = useDocumentJob(announce);
  const focus = useWorkspaceLifecycle(draft.inputs.length, execution.job.phase);
  const previews = usePreviews(
    draft.visible.filter((input) => input.status === "ready").map((input) => input.id),
    draft.files.get,
    execution.locked,
    renderPdfPreview,
  );
  const capable =
    typeof Worker !== "undefined" &&
    typeof Blob.prototype.arrayBuffer === "function" &&
    typeof crypto.randomUUID === "function";

  const addFiles = (files: FileList | readonly File[]) => {
    if (!execution.editable || !capable) {
      return;
    }
    execution.editDraft();
    draft.addFiles(files);
  };
  const removeFile = (id: string) => {
    if (!execution.editable) {
      return;
    }
    execution.editDraft();
    draft.removeFile(id);
  };
  const moveFile = (id: string, target: number, direction?: MoveDirection) => {
    if (!execution.editable) {
      return;
    }
    execution.editDraft();
    draft.moveFile(id, target, direction);
  };
  const mergeFiles = () => {
    if (!execution.editable || !draft.ready || !draft.acknowledged || !capable) {
      return;
    }
    void execution.start(async (options) => {
      const { mergePdfs } = await import("@repo/pdf-engine/merge");
      const inputs = draft.inputs.map((input) => {
        const blob = draft.files.get(input.id);
        if (!blob) {
          throw new Error(`The input ${input.name} is no longer available.`);
        }
        return { id: input.id, name: input.name, blob };
      });
      const result = await mergePdfs({ acknowledged: draft.acknowledged, inputs }, options);
      return result.kind === "success" ? { kind: "success", value: [result.value] } : result;
    });
  };
  const discardWork = (action: DiscardAction) => {
    execution.editDraft();
    if (action === "reset") {
      draft.resetDraft();
    }
    announce(
      action === "reset"
        ? "Workspace cleared. Original files are unchanged."
        : "Editing inputs. Previous output cleared.",
    );
    setConfirmation(null);
    requestAnimationFrame(() =>
      action === "reset" ? draft.addButton.current?.focus() : focus.draftHeading.current?.focus(),
    );
  };
  const requestEdit = () => {
    if (execution.downloads.needsDownload()) {
      setConfirmation("edit");
    } else {
      discardWork("edit");
    }
  };
  return {
    draft,
    execution,
    focus,
    previews: previews.thumbnails,
    retryPreview: previews.retry,
    capable,
    confirmation,
    status: describeJobStatus(execution.job, notice),
    addFiles,
    removeFile,
    moveFile,
    mergeFiles,
    discardForNavigation: () => {
      execution.editDraft();
      draft.resetDraft();
      setConfirmation(null);
      announce("");
    },
    requestEdit,
    requestReset: () => setConfirmation("reset"),
    keepWorking: () => setConfirmation(null),
    confirmDiscard: () => {
      if (confirmation) {
        discardWork(confirmation);
      }
    },
  };
};
