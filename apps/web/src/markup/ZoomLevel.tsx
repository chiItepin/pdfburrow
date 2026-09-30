import { useState } from "react";
import { Button } from "@repo/core-ui";
import type { MarkupZoom } from "./MarkupPage";
import { MarkupDialog } from "./MarkupDialog";

export const ZoomLevel = ({
  zoom,
  onZoom,
  onCancel,
}: {
  zoom: MarkupZoom;
  onZoom: (zoom: number) => void;
  onCancel: () => void;
}) => {
  const [value, setValue] = useState(String(typeof zoom === "number" ? zoom : 100));
  const [error, setError] = useState("");
  const apply = () => {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 25 || number > 400 || number % 25 !== 0) {
      setError("Enter a zoom from 25% to 400%, in steps of 25%.");
      return;
    }
    onZoom(number);
  };
  return (
    <MarkupDialog title="Zoom level" onCancel={onCancel}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <label className="flex items-center gap-3 text-sm">
          Zoom percentage
          <input
            aria-label="Zoom percentage"
            type="number"
            min={25}
            max={400}
            step={25}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="min-h-11 w-24 rounded-md border bg-background px-3"
          />
          <span className="text-muted-foreground">%</span>
        </label>
        <p className="mt-2 text-sm text-muted-foreground">25-400%, in steps of 25%.</p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Apply zoom</Button>
        </div>
      </form>
    </MarkupDialog>
  );
};
