import { useState } from "react";
import { useFocusAfterCommit } from "@repo/core-ui";
import type { DiscardAction, InputRow, MoveDirection } from "./types";
import { useInputDraft } from "./useInputDraft";
import { useDocumentJob } from "./useDocumentJob";
import { useWorkspaceLifecycle } from "./useWorkspaceLifecycle";
import { useHydrated } from "./useHydrated";

export const useDocumentWorkspace = () => {
  const hydrated = useHydrated();
  const [notice, announce] = useState("");
  const [confirmation, setConfirmation] = useState<DiscardAction | null>(null);
  const draft = useInputDraft(announce);
  const execution = useDocumentJob(announce);
  const focus = useWorkspaceLifecycle(draft.inputs.length, execution.job.phase);
  const focusAfterCommit = useFocusAfterCommit();
  const capable =
    !hydrated ||
    (typeof Worker !== "undefined" &&
      typeof Blob.prototype.arrayBuffer === "function" &&
      typeof crypto.randomUUID === "function");

  const addFiles = (files: FileList | readonly File[], kind: InputRow["kind"] = "pdf") => {
    if (!execution.editable || !capable) {
      return;
    }
    execution.editDraft();
    draft.addFiles(files, kind);
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
    focusAfterCommit(() =>
      action === "reset" ? draft.addButton.current : focus.draftHeading.current,
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
    capable,
    confirmation,
    notice: draft.resourceError || notice,
    announce,
    addFiles,
    removeFile,
    moveFile,
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
