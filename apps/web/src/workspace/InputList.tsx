import { Button } from "@repo/core-ui";
import type { DragEvent } from "react";
import { InputCard } from "./InputCard";
import type { usePdfDraft } from "./usePdfDraft";
import type { MoveDirection, Thumbnail } from "./types";

export const InputList = ({
  draft,
  editable,
  previews,
  moveFile,
  removeFile,
}: {
  draft: ReturnType<typeof usePdfDraft>;
  editable: boolean;
  previews: ReadonlyMap<string, Thumbnail>;
  moveFile: (id: string, target: number, direction?: MoveDirection) => void;
  removeFile: (id: string) => void;
}) => {
  const canDrop = (event: DragEvent<HTMLButtonElement>) =>
    editable && event.dataTransfer.types.includes("application/x-pdfburrow");
  const allowDrop = (event: DragEvent<HTMLButtonElement>) => {
    if (canDrop(event)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
  };
  const dropAt = (event: DragEvent<HTMLButtonElement>, target: number) => {
    if (!canDrop(event)) {
      return;
    }
    event.preventDefault();
    const id = event.dataTransfer.getData("application/x-pdfburrow");
    if (draft.inputs.some((input) => input.id === id)) {
      moveFile(id, target);
    }
  };

  return (
    <>
      <ol className="space-y-3" start={draft.firstVisibleIndex + 1} aria-label="PDF input order">
        {draft.visible.map((input, offset) => (
          <InputCard
            key={input.id}
            input={input}
            index={draft.firstVisibleIndex + offset}
            total={draft.inputs.length}
            editable={editable}
            checking={input.id === draft.validationId}
            thumbnail={previews.get(input.id)}
            onMove={moveFile}
            onRemove={removeFile}
            onRetry={draft.retryValidation}
          />
        ))}
      </ol>
      {draft.maxWindow > 0 && (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            Drop a PDF on Previous files or Next files to move it to that view's nearest position.
            Repeat to move farther, or use Move up/down.
          </p>
          <nav aria-label="Input list pages" className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={draft.currentWindow === 0}
              onClick={() => draft.setWindowIndex(draft.currentWindow - 1)}
              onDragOver={allowDrop}
              onDrop={(event) => dropAt(event, draft.firstVisibleIndex - 1)}
            >
              Previous files
            </Button>
            <span className="text-sm">
              Files {draft.firstVisibleIndex + 1}-{draft.firstVisibleIndex + draft.visible.length}{" "}
              of {draft.inputs.length}
            </span>
            <Button
              variant="outline"
              disabled={draft.currentWindow === draft.maxWindow}
              onClick={() => draft.setWindowIndex(draft.currentWindow + 1)}
              onDragOver={allowDrop}
              onDrop={(event) => dropAt(event, draft.firstVisibleIndex + draft.visible.length)}
            >
              Next files
            </Button>
          </nav>
        </>
      )}
    </>
  );
};
