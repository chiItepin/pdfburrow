import type { ImageSettings as Settings } from "@repo/pdf-engine";

export const ImageSettings = ({
  settings,
  disabled,
  onChange,
}: {
  settings: Settings;
  disabled: boolean;
  onChange: (settings: Settings) => void;
}) => (
  <div className="space-y-5">
    <fieldset disabled={disabled} className="mt-4">
      <legend className="font-medium">Output grouping</legend>
      {(
        [
          ["combined", "One combined PDF"],
          ["separate", "One PDF per image"],
        ] as const
      ).map(([value, label]) => (
        <label key={value} className="flex min-h-10 items-center gap-3 text-sm">
          <input
            type="radio"
            name="image-grouping"
            className="size-4 accent-primary"
            checked={settings.grouping === value}
            onChange={() => onChange({ ...settings, grouping: value })}
          />
          {label}
        </label>
      ))}
    </fieldset>
    <fieldset disabled={disabled}>
      <legend className="font-medium">Paper size</legend>
      {(
        [
          ["a4", "A4 (210 x 297 mm)"],
          ["letter", "Letter (8.5 x 11 inches)"],
          ["image", "Image size (96 pixels per inch)"],
        ] as const
      ).map(([value, label]) => (
        <label key={value} className="flex min-h-10 items-center gap-3 text-sm">
          <input
            type="radio"
            name="image-paper"
            className="size-4 accent-primary"
            checked={settings.paper === value}
            onChange={() => onChange({ ...settings, paper: value })}
          />
          {label}
        </label>
      ))}
    </fieldset>
    {settings.paper === "image" ? (
      <p className="text-sm text-muted-foreground">
        Each page follows its rotated image at 96 pixels per inch. No margins; embedded DPI is
        ignored. Large images can make physically large pages.
      </p>
    ) : (
      <>
        <fieldset disabled={disabled}>
          <legend className="font-medium">Page orientation</legend>
          {(
            [
              ["auto", "Auto per image"],
              ["portrait", "Portrait"],
              ["landscape", "Landscape"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-10 items-center gap-3 text-sm">
              <input
                type="radio"
                name="image-orientation"
                className="size-4 accent-primary"
                checked={settings.orientation === value}
                onChange={() => onChange({ ...settings, orientation: value })}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset disabled={disabled}>
          <legend className="font-medium">Margins on all sides</legend>
          {(
            [
              [0, "None (0 mm)"],
              [10, "Small (10 mm)"],
              [20, "Large (20 mm)"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-10 items-center gap-3 text-sm">
              <input
                type="radio"
                name="image-margin"
                className="size-4 accent-primary"
                checked={settings.margin === value}
                onChange={() => onChange({ ...settings, margin: value })}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </>
    )}
    <p className="text-sm text-muted-foreground">
      Images are centered and fit fully, without cropping or stretching. Pixel dimensions are
      preserved; enlargement does not add detail. Transparency is placed on white.
    </p>
  </div>
);
