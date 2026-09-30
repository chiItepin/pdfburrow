import type { SplitSelection } from "@repo/pdf-engine";

export const ModePicker = ({
  mode,
  disabled,
  onChange,
}: {
  mode: Exclude<SplitSelection["mode"], "remove">;
  disabled: boolean;
  onChange: (mode: Exclude<SplitSelection["mode"], "remove">) => void;
}) => (
  <fieldset disabled={disabled} className="mt-6">
    <legend className="font-medium">Choose an operation</legend>
    <div className="mt-2 grid gap-1">
      {(
        [
          ["selected", "Selected pages"],
          ["ranges", "Custom ranges"],
          ["fixed", "Fixed page-count groups"],
          ["every", "Every page"],
        ] as const
      ).map(([value, label]) => (
        <label key={value} className="flex min-h-10 items-center gap-3 text-sm">
          <input
            type="radio"
            name="split-mode"
            value={value}
            className="size-4 accent-primary"
            checked={mode === value}
            onChange={() => onChange(value)}
          />
          {label}
        </label>
      ))}
    </div>
  </fieldset>
);
