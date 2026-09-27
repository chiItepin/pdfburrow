import { Button } from "@repo/core-ui";
import { InputCard } from "./InputCard";
import type { useMergeWorkspace } from "./use-merge-workspace";

type Workspace = ReturnType<typeof useMergeWorkspace>;

export const InputList = ({
  draft,
  execution,
  previews,
  moveFile,
  removeFile,
}: Pick<Workspace, "draft" | "execution" | "previews" | "moveFile" | "removeFile">) => (
  <>
    <ol className="space-y-3" start={draft.firstVisibleIndex + 1} aria-label="PDF merge order">
      {draft.visible.map((input, offset) => (
        <InputCard
          key={input.id}
          input={input}
          index={draft.firstVisibleIndex + offset}
          total={draft.inputs.length}
          editable={execution.editable}
          checking={input.id === draft.validationId}
          thumbnail={previews.get(input.id)}
          onMove={moveFile}
          onRemove={removeFile}
          onRetry={draft.retryValidation}
        />
      ))}
    </ol>
    {draft.maxWindow > 0 && (
      <nav aria-label="Input list pages" className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={draft.currentWindow === 0}
          onClick={() => draft.setWindowIndex(draft.currentWindow - 1)}
        >
          Previous files
        </Button>
        <span className="text-sm">
          Files {draft.firstVisibleIndex + 1}-{draft.firstVisibleIndex + draft.visible.length} of{" "}
          {draft.inputs.length}
        </span>
        <Button
          variant="outline"
          disabled={draft.currentWindow === draft.maxWindow}
          onClick={() => draft.setWindowIndex(draft.currentWindow + 1)}
        >
          Next files
        </Button>
      </nav>
    )}
  </>
);
