import { Button } from "@repo/core-ui";
import type { PdfInputRow, MoveDirection, Thumbnail } from "./types";

interface InputCardProps {
  input: PdfInputRow;
  index: number;
  total: number;
  editable: boolean;
  checking: boolean;
  thumbnail?: Thumbnail;
  onMove: (id: string, target: number, direction?: MoveDirection) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

export const InputCard = ({
  input,
  index,
  total,
  editable,
  checking,
  thumbnail,
  onMove,
  onRemove,
  onRetry,
}: InputCardProps) => (
  <li
    className="rounded-lg border bg-white p-4"
    draggable={editable}
    onDragStart={(event) => event.dataTransfer.setData("application/x-pdfburrow", input.id)}
    onDragOver={(event) => {
      if (editable) {
        event.preventDefault();
      }
    }}
    onDrop={(event) => {
      event.preventDefault();
      const id = event.dataTransfer.getData("application/x-pdfburrow");
      if (id) {
        onMove(id, index);
      }
    }}
  >
    <div className="flex gap-4">
      <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded border bg-muted p-1">
        {thumbnail?.url ? (
          <img
            src={thumbnail.url}
            alt={`First page of ${input.name}`}
            className="max-h-full max-w-full"
          />
        ) : (
          <span className="text-center text-xs text-muted-foreground">
            {thumbnail?.error ? "Preview unavailable" : "PDF"}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="break-all font-semibold">
          {index + 1}. {input.name}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {(input.size / 1024).toFixed(1)} KB
          {input.status === "ready" &&
            ` · ${input.info.pageCount} page${input.info.pageCount === 1 ? "" : "s"}`}
          {input.status === "pending" &&
            (checking ? " · Checking PDF..." : " · Waiting for validation...")}
        </p>
        {input.status === "error" && (
          <p className="mt-2 text-sm text-destructive">{input.message}</p>
        )}
        {input.status === "ready" &&
          input.info.warnings.map((warning) => (
            <p key={warning} className="mt-2 text-sm">
              {warning}
            </p>
          ))}
        {thumbnail?.error && (
          <p className="mt-2 text-sm text-muted-foreground">{thumbnail.error}</p>
        )}
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        id={`up-${input.id}`}
        variant="outline"
        disabled={!editable}
        aria-disabled={index === 0}
        aria-label={`Move ${input.name} up`}
        onClick={() => onMove(input.id, index - 1, "up")}
      >
        Move up
      </Button>
      <Button
        id={`down-${input.id}`}
        variant="outline"
        disabled={!editable}
        aria-disabled={index === total - 1}
        aria-label={`Move ${input.name} down`}
        onClick={() => onMove(input.id, index + 1, "down")}
      >
        Move down
      </Button>
      <Button
        id={`remove-${input.id}`}
        variant="ghost"
        disabled={!editable}
        aria-label={`Remove ${input.name}`}
        onClick={() => onRemove(input.id)}
      >
        Remove
      </Button>
      {input.status === "error" && (
        <Button
          variant="outline"
          aria-label={`Retry validation of ${input.name}`}
          onClick={() => onRetry(input.id)}
        >
          Retry validation
        </Button>
      )}
    </div>
  </li>
);
