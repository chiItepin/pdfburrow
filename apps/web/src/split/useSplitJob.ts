import type { SplitSelection } from "@repo/pdf-engine";
import type { usePdfWorkspace } from "../workspace/usePdfWorkspace";

export const useSplitJob = (
  workspace: ReturnType<typeof usePdfWorkspace>,
  selection: SplitSelection,
  valid: boolean,
) => {
  const { draft, execution, capable } = workspace;
  const { job, editable } = execution;
  const input = draft.inputs[0];
  const generate = () => {
    if (!input || !editable || !draft.ready || !draft.acknowledged || !valid || !capable) {
      return;
    }
    void execution.start(async (options) => {
      const blob = draft.files.get(input.id);
      if (!blob) {
        throw new Error("The source PDF is no longer available.");
      }
      const { splitPdf } = await import("@repo/pdf-engine/split");
      return splitPdf(
        {
          input: { id: input.id, name: input.name, blob },
          selection,
          acknowledged: draft.acknowledged,
        },
        options,
      );
    });
  };
  const status =
    job.phase === "cancelling"
      ? "Cancelling. Waiting for the worker to stop..."
      : job.phase === "cancelled"
        ? "Generation cancelled. Your source and selection are unchanged."
        : job.phase === "processing"
          ? job.progress?.phase === "copying"
            ? `Copied ${job.progress.completed} of ${job.progress.total} selected pages...`
            : job.progress?.phase === "saving"
              ? "Saving PDFs locally..."
              : "Checking the source in the local split worker..."
          : workspace.notice;
  return { generate, status };
};
