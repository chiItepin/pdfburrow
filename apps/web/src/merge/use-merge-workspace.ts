import { useState } from "react";
import { describeJobStatus } from "./job-status";
import type { DiscardAction, MoveDirection } from "./types";
import { useDraft } from "./use-draft";
import { useMergeJob } from "./use-merge-job";
import { usePreviews } from "./use-previews";
import { useWorkspaceLifecycle } from "./use-workspace-lifecycle";

export const useMergeWorkspace = () => {
  const [notice, announce] = useState("");
  const [confirmation, setConfirmation] = useState<DiscardAction | null>(null);
  const draft = useDraft(announce);
  const execution = useMergeJob(announce);
  const focus = useWorkspaceLifecycle(draft.inputs.length, execution.job.phase);
  const previews = usePreviews(
    draft.visible.filter((input) => input.status === "ready").map((input) => input.id),
    draft.files.get,
    execution.locked,
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
    void execution.startMerge({
      acknowledged: draft.acknowledged,
      inputs: draft.inputs.map((input) => {
        const blob = draft.files.get(input.id);
        if (!blob) {
          throw new Error(`The input ${input.name} is no longer available.`);
        }
        return { id: input.id, name: input.name, blob };
      }),
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
    if (execution.needsDownload()) {
      setConfirmation("edit");
    } else {
      discardWork("edit");
    }
  };
  return {
    draft,
    execution,
    focus,
    previews,
    capable,
    confirmation,
    status: describeJobStatus(execution.job, notice),
    addFiles,
    removeFile,
    moveFile,
    mergeFiles,
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
