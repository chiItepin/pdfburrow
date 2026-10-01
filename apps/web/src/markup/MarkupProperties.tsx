import { useState } from "react";
import { Button, ModalDialog } from "@repo/core-ui";
import { layoutNote, markupBoundsError, resizeMarkup } from "@repo/pdf-engine/markup-layout";
import type { MarkupGeometry, MarkupObject } from "@repo/pdf-engine";

export const MarkupProperties = ({
  object,
  geometry,
  fontBytes,
  onSave,
  onCancel,
}: {
  object: MarkupObject;
  geometry: MarkupGeometry;
  fontBytes?: Uint8Array;
  onSave: (object: MarkupObject) => void;
  onCancel: () => void;
}) => {
  const [fields, setFields] = useState({
    x: String(object.x),
    y: String(object.y),
    width: String(object.width),
    height: String(object.height),
    scale: "100",
  });
  let candidate = { ...object, x: Number(fields.x), y: Number(fields.y) };
  let error = "";
  try {
    candidate = resizeMarkup(
      candidate,
      object.kind === "ink" || object.kind === "signature"
        ? (object.width * Number(fields.scale)) / 100
        : Number(fields.width),
      Number(fields.height),
    );
    if (candidate.kind === "note") {
      if (!fontBytes) {
        throw new Error("Wait for the note font before resizing.");
      }
      candidate = {
        ...candidate,
        height: layoutNote(candidate.text, candidate.width, fontBytes).height,
      };
    }
    error = markupBoundsError(candidate, geometry);
  } catch (failure) {
    error = failure instanceof Error ? failure.message : "The markup dimensions are invalid.";
  }
  const keys =
    object.kind === "highlight"
      ? (["x", "y", "width", "height"] as const)
      : object.kind === "note"
        ? (["x", "y", "width"] as const)
        : (["x", "y", "scale"] as const);
  return (
    <ModalDialog title="Move / size markup" onCancel={onCancel}>
      <p className="mb-4 text-sm text-muted-foreground">
        Position from the visible page's top-left, in PDF points. Drawn marks scale proportionally,
        including stroke width.
      </p>
      <div className="grid grid-cols-2 gap-4">
        {keys.map((key) => (
          <label key={key} className="text-sm font-medium">
            {key === "scale" ? "Scale (%)" : `${key.toUpperCase()} (points)`}
            <input
              type="number"
              value={fields[key]}
              onChange={(event) => setFields({ ...fields, [key]: event.target.value })}
              className="mt-2 block min-h-11 w-full rounded-md border bg-background px-3"
            />
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="my-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={Boolean(error)} onClick={() => onSave(candidate)}>
          Apply
        </Button>
      </div>
    </ModalDialog>
  );
};
