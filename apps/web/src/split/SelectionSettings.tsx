import { RangeEditor } from "./RangeEditor";
import type { useSplitSettings } from "./useSplitSettings";

export const SelectionSettings = ({
  settings,
  pageCount,
  disabled,
  onEdit,
  announce,
}: {
  settings: ReturnType<typeof useSplitSettings>;
  pageCount: number;
  disabled: boolean;
  onEdit: () => void;
  announce: (message: string) => void;
}) => (
  <>
    <fieldset disabled={disabled} className="mt-4" aria-label="Page grouping">
      {settings.mode === "ranges" && (
        <>
          <RangeEditor
            ranges={settings.ranges}
            pageCount={pageCount}
            announce={announce}
            onChange={(ranges) => {
              onEdit();
              settings.setRanges(ranges);
            }}
          />
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.combined}
              className="mt-1 size-4 accent-primary"
              onChange={(event) => {
                onEdit();
                settings.setCombined(event.target.checked);
              }}
            />
            Combine ranges into one PDF
          </label>
          <p className="mt-2 text-sm text-muted-foreground">
            Turn off to create one PDF per range.
          </p>
        </>
      )}
      {settings.mode === "fixed" && (
        <label className="mt-4 block text-sm">
          Pages per PDF
          <input
            type="number"
            min={1}
            max={pageCount}
            step={1}
            value={settings.size}
            aria-describedby="selection-error group-help"
            aria-invalid={Boolean(settings.error)}
            className="mt-1 min-h-10 w-full rounded-md border bg-card px-3 focus-visible:outline-2 focus-visible:outline-ring"
            onChange={(event) => {
              onEdit();
              settings.setSize(event.target.value);
            }}
          />
          <span id="group-help" className="mt-2 block text-muted-foreground">
            Choose 1 through {pageCount}. Keep a shorter final group.
          </span>
        </label>
      )}
      {settings.mode === "every" && (
        <p className="mt-3 text-sm">Create one PDF per source page, in source order.</p>
      )}
    </fieldset>
    <p id="selection-error" className="mt-3 text-sm">
      {settings.error}
    </p>
  </>
);
