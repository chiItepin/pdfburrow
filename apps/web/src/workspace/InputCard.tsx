import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  Spinner,
  useFocusAfterCommit,
} from "@repo/core-ui";
import type { PdfInputRow, MoveDirection, Thumbnail } from "./types";

interface InputCardProps {
  input: PdfInputRow;
  index: number;
  total: number;
  editable: boolean;
  checking: boolean;
  reorderable?: boolean;
  previewsPaused?: boolean;
  thumbnail?: Thumbnail;
  onMove: (id: string, target: number, direction?: MoveDirection) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onRetryPreview?: (id: string) => void;
}

export const InputCard = ({
  input,
  index,
  total,
  editable,
  checking,
  reorderable = true,
  previewsPaused = false,
  thumbnail,
  onMove,
  onRemove,
  onRetry,
  onRetryPreview,
}: InputCardProps) => {
  const focusAfterCommit = useFocusAfterCommit();
  const retry = (action: (id: string) => void) => {
    action(input.id);
    focusAfterCommit(() => document.getElementById(`input-${input.id}`));
  };
  const previewLabel =
    input.status !== "ready" || !thumbnail
      ? "PDF"
      : thumbnail?.state === "error"
        ? "Preview unavailable"
        : thumbnail?.state === "rendering"
          ? "Generating preview..."
          : previewsPaused
            ? "Preview paused"
            : "Preview queued";
  return (
    <li
      draggable={editable && reorderable}
      onDragStart={(event) => event.dataTransfer.setData("application/x-pdfburrow", input.id)}
      onDragOver={(event) => {
        if (editable && reorderable) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        const id = event.dataTransfer.getData("application/x-pdfburrow");
        if (id && editable && reorderable) {
          onMove(id, index);
        }
      }}
    >
      <Attachment
        className="w-full items-start gap-4 p-4"
        state={
          input.status === "pending" ? "processing" : input.status === "error" ? "error" : "done"
        }
      >
        <AttachmentMedia variant="image" className="h-24 w-20 flex-col gap-2 border p-1">
          {thumbnail?.state === "ready" ? (
            <img src={thumbnail.url} alt={`First page of ${input.name}`} />
          ) : (
            <>
              {thumbnail?.state === "rendering" && <Spinner aria-hidden="true" />}
              <span className="text-center text-xs text-muted-foreground">{previewLabel}</span>
            </>
          )}
        </AttachmentMedia>
        <AttachmentContent>
          <h3 id={`input-${input.id}`} tabIndex={-1}>
            <AttachmentTitle>
              {index + 1}. {input.name}
            </AttachmentTitle>
          </h3>
          <AttachmentDescription>
            {(input.size / 1024).toFixed(1)} KB
            {input.status === "ready" &&
              ` · ${input.info.pageCount} page${input.info.pageCount === 1 ? "" : "s"}`}
          </AttachmentDescription>
          {input.status === "pending" && (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {checking && <Spinner aria-hidden="true" />}
              {checking ? "Checking PDF..." : "Waiting for validation..."}
            </p>
          )}
          {input.status === "error" && (
            <p className="mt-2 text-sm text-destructive">{input.message}</p>
          )}
          {input.status === "ready" &&
            input.info.warnings.map((warning) => (
              <p key={warning} className="mt-2 text-sm">
                {warning}
              </p>
            ))}
          {thumbnail?.state === "error" && (
            <p className="mt-2 text-sm text-muted-foreground">{thumbnail.message}</p>
          )}
        </AttachmentContent>
        <AttachmentActions className="w-full">
          {reorderable && (
            <>
              <AttachmentAction
                id={`up-${input.id}`}
                variant="outline"
                disabled={!editable}
                aria-disabled={index === 0}
                aria-label={`Move ${input.name} up`}
                onClick={() => onMove(input.id, index - 1, "up")}
              >
                Move up
              </AttachmentAction>
              <AttachmentAction
                id={`down-${input.id}`}
                variant="outline"
                disabled={!editable}
                aria-disabled={index === total - 1}
                aria-label={`Move ${input.name} down`}
                onClick={() => onMove(input.id, index + 1, "down")}
              >
                Move down
              </AttachmentAction>
            </>
          )}
          <AttachmentAction
            id={`remove-${input.id}`}
            disabled={!editable}
            aria-label={`Remove ${input.name}`}
            onClick={() => onRemove(input.id)}
          >
            Remove
          </AttachmentAction>
          {input.status === "error" && (
            <AttachmentAction
              variant="outline"
              disabled={!editable}
              aria-label={`Retry validation of ${input.name}`}
              onClick={() => retry(onRetry)}
            >
              Retry validation
            </AttachmentAction>
          )}
          {thumbnail?.state === "error" && onRetryPreview && (
            <AttachmentAction
              variant="outline"
              disabled={previewsPaused}
              aria-label={`Retry preview of ${input.name}`}
              onClick={() => retry(onRetryPreview)}
            >
              Retry preview
            </AttachmentAction>
          )}
        </AttachmentActions>
      </Attachment>
    </li>
  );
};
