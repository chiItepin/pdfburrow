import { useState } from "react";
import { Button } from "@repo/core-ui";
import { MarkupDialog } from "./MarkupDialog";

export const GoToPage = ({
  page,
  count,
  onPage,
  onCancel,
}: {
  page: number;
  count: number;
  onPage: (page: number) => void;
  onCancel: () => void;
}) => {
  const [value, setValue] = useState(String(page));
  const [error, setError] = useState("");
  const apply = () => {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > count) {
      setError(`Enter a page from 1 to ${count}.`);
      return;
    }
    setError("");
    onPage(number);
  };
  return (
    <MarkupDialog title="Go to page" onCancel={onCancel}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <label className="flex items-center gap-3 text-sm">
          Page number
          <input
            aria-label="Page number"
            type="number"
            min={1}
            max={count}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="min-h-11 w-24 rounded-md border bg-background px-3"
          />
          <span className="text-muted-foreground">of {count}</span>
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Go</Button>
        </div>
      </form>
    </MarkupDialog>
  );
};
