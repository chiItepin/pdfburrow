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
import type { ImageRotation } from "@repo/pdf-engine";
import type { InputRow, MoveDirection, Thumbnail } from "./types";

interface InputCardProps {
  input: InputRow;
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
  rotation?: ImageRotation;
  onRotate?: (id: string, direction: "left" | "right") => void;
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
  rotation = 0,
  onRotate,
}: InputCardProps) => {
  const focusAfterCommit = useFocusAfterCommit();
  const retry = (action: (id: string) => void) => {
    action(input.id);
    focusAfterCommit(() => document.getElementById(`input-${input.id}`));
  };
  const previewLabel =
    input.status !== "ready" || !thumbnail
      ? input.kind === "image"
        ? "Image"
        : "PDF"
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
        <AttachmentMedia variant="image" className="size-24 flex-col gap-2 border p-1">
          {thumbnail?.state === "ready" ? (
            <img
              src={thumbnail.url}
              alt={
                input.kind === "image" ? `Preview of ${input.name}` : `First page of ${input.name}`
              }
              className="h-full w-full object-contain"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
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
          {input.status === "ready" && "width" in input.info && (
            <p className="mt-1 text-sm text-muted-foreground">
              {rotation === 90 || rotation === 270
                ? `${input.info.height} x ${input.info.width}`
                : `${input.info.width} x ${input.info.height}`}{" "}
              pixels
              {" · "}
              {rotation}° additional rotation
            </p>
          )}
          {input.status === "pending" && (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {checking && <Spinner aria-hidden="true" />}
              {checking
                ? `Checking ${input.kind === "image" ? "image" : "PDF"}...`
                : "Waiting for validation..."}
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
          {onRotate && input.status === "ready" && (
            <>
              <AttachmentAction
                variant="outline"
                disabled={!editable}
                aria-label={`Rotate ${input.name} left`}
                onClick={() => onRotate(input.id, "left")}
              >
                Rotate left
              </AttachmentAction>
              <AttachmentAction
                variant="outline"
                disabled={!editable}
                aria-label={`Rotate ${input.name} right`}
                onClick={() => onRotate(input.id, "right")}
              >
                Rotate right
              </AttachmentAction>
            </>
          )}
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
