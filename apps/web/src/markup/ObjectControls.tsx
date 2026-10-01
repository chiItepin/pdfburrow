import { useId } from "react";
import { NativeSelect, NativeSelectOption } from "@repo/core-ui";
import type { MarkupObject } from "@repo/pdf-engine";

export const ObjectControls = ({
  page,
  objects,
  selected,
  disabled,
  onSelect,
}: {
  page: number;
  objects: readonly MarkupObject[];
  selected: MarkupObject | undefined;
  disabled: boolean;
  onSelect: (id: string | null) => void;
}) => {
  const id = useId();
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="text-sm">
        Markup on this page
      </label>
      <NativeSelect
        id={id}
        aria-label="Markup on this page"
        value={selected?.id ?? ""}
        disabled={disabled}
        onChange={(event) => onSelect(event.target.value || null)}
        className="min-h-11 border-border bg-background dark:bg-background dark:hover:bg-background"
      >
        <NativeSelectOption value="">None selected</NativeSelectOption>
        {objects
          .filter((object) => object.page === page)
          .map((object, index) => (
            <NativeSelectOption key={object.id} value={object.id}>
              {index + 1}.{" "}
              {object.kind === "note" ? `Note: ${object.text.slice(0, 30)}` : object.kind}
            </NativeSelectOption>
          ))}
      </NativeSelect>
    </div>
  );
};
