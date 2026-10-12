import { useState } from "react";
import { useFocusAfterCommit } from "@repo/core-ui";
import type { useDocumentWorkspace } from "../workspace/useDocumentWorkspace";
import { pdfLimits } from "../workspace/resourcePolicy";
import { pageSetFilename } from "./pageSets";
import type { PageSet } from "./pageSets";

export const usePageSetJob = (workspace: ReturnType<typeof useDocumentWorkspace>) => {
  const { draft, execution, capable } = workspace;
  const [activeSet, setActiveSet] = useState<number | null>(null);
  const [pendingEdit, setPendingEdit] = useState<(() => void) | null>(null);
  const focusAfterCommit = useFocusAfterCommit();
  const input = draft.inputs[0];
  const edit = (action: () => void) => {
    execution.editDraft();
    action();
  };
  const requestEdit = (action: () => void) => {
    if (!execution.editable) {
      return;
    }
    if (execution.downloads.needsDownload()) {
      setPendingEdit(() => action);
    } else {
      edit(action);
    }
  };
  const download = async (set: PageSet) => {
    if (!input || !execution.editable || !draft.ready || !draft.acknowledged || !capable) {
      return;
    }
    const filename = pageSetFilename(input.name, set.pages);
    if (execution.downloads.outputs[0]?.filename === filename) {
      execution.downloads.download(0);
      return;
    }
    if (execution.downloads.needsDownload()) {
      setPendingEdit(() => () => void download(set));
      return;
    }
    const completed = await execution.start(
      async (options) => {
        setActiveSet(set.id);
        const blob = draft.files.get(input.id);
        if (!blob) {
          throw new Error("The source PDF is no longer available.");
        }
        const { splitPdf } = await import("@repo/pdf-engine/split");
        const result = await splitPdf(
          {
            input: { id: input.id, name: input.name, blob },
            selection: { mode: "selected", pages: set.pages },
            acknowledged: draft.acknowledged,
            limits: pdfLimits,
          },
          options,
        );
        return result.kind === "success"
          ? {
              ...result,
              value: result.value.map((output) => ({ ...output, suggestedFilename: filename })),
            }
          : result;
      },
      { downloadOnComplete: true },
    );
    if (completed) {
      focusAfterCommit(() => document.getElementById(`download-set-${set.id}`));
    }
  };
  return {
    activeSet,
    download,
    requestEdit,
    confirmation: pendingEdit !== null,
    keep: () => setPendingEdit(null),
    discard: () => {
      if (pendingEdit) {
        edit(pendingEdit);
        setPendingEdit(null);
      }
    },
  };
};
