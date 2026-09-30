import { useState } from "react";
import { Button } from "@repo/core-ui";
import { layoutNote, markupBoundsError } from "@repo/pdf-engine/markup-layout";
import type { MarkupGeometry, MarkupObject, MarkupPoint } from "@repo/pdf-engine";
import { MarkupDialog } from "./MarkupDialog";

export const NoteEditor = ({
  object,
  position,
  page,
  geometry,
  fontBytes,
  onSave,
  onCancel,
}: {
  object?: MarkupObject & { kind: "note" };
  position: MarkupPoint;
  page: number;
  geometry: MarkupGeometry;
  fontBytes: Uint8Array;
  onSave: (object: MarkupObject) => void;
  onCancel: () => void;
}) => {
  const [text, setText] = useState(object?.text ?? "");
  const [width, setWidth] = useState(
    String(object?.width ?? Math.min(220, geometry.width - position.x)),
  );
  let candidate: MarkupObject | undefined;
  let error = "";
  const id = object?.id ?? "new-note";
  try {
    const layout = layoutNote(text, Number(width), fontBytes);
    candidate = {
      id,
      kind: "note",
      page,
      x: position.x,
      y: position.y,
      width: Number(width),
      height: layout.height,
      text: layout.text,
    };
    error = markupBoundsError(candidate, geometry);
  } catch (failure) {
    error = failure instanceof Error ? failure.message : "The note could not be measured.";
  }
  return (
    <MarkupDialog title={object ? "Edit text note" : "Add text note"} onCancel={onCancel}>
      <p className="mb-4 text-sm text-muted-foreground">
        12-point black Liberation Sans. Western European text and common punctuation; notes wrap to
        their width.
      </p>
      <label className="block text-sm font-medium">
        Note text
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          className="mt-2 block w-full rounded-md border bg-background p-3 focus-visible:outline-ring"
        />
      </label>
      <label className="mt-4 block text-sm font-medium">
        Width (PDF points)
        <input
          type="number"
          min={1}
          max={geometry.width - position.x}
          value={width}
          onChange={(event) => setWidth(event.target.value)}
          className="mt-2 block min-h-11 w-32 rounded-md border bg-background px-3"
        />
      </label>
      {error && (
        <p role="alert" className="my-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel note
        </Button>
        <Button
          disabled={!candidate || Boolean(error)}
          onClick={() => {
            if (candidate && !error) {
              onSave({ ...candidate, id: object?.id ?? crypto.randomUUID() });
            }
          }}
        >
          Save note
        </Button>
      </div>
    </MarkupDialog>
  );
};
