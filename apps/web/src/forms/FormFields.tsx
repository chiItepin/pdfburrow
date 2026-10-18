import { Checkbox, Label, RadioGroup, RadioGroupItem } from "@repo/core-ui";
import type { CSSProperties } from "react";
import type { FormField, FormValue, FormWidget } from "@repo/pdf-engine";
import { FormControl } from "./FormControl";

export const FormFields = ({
  fields,
  values,
  page,
  scale,
  disabled,
  onChange,
}: {
  fields: readonly FormField[];
  values: readonly FormValue[];
  page: number;
  scale?: number;
  disabled: boolean;
  onChange: (name: string, value: string | boolean) => void;
}) => {
  const style = (widget: FormWidget): CSSProperties | undefined =>
    scale === undefined
      ? undefined
      : {
          position: "absolute",
          left: widget.x * scale,
          top: widget.y * scale,
          width: widget.width * scale,
          height: widget.height * scale,
          transform: `translate(-50%, -50%) rotate(${widget.rotation}deg)`,
          fontSize: Math.max(10, 12 * scale),
        };
  return fields
    .filter((field) => field.widgets.some((widget) => widget.page === page))
    .map((field) => {
      const value = values.find((entry) => entry.name === field.name)?.value ?? field.value;
      const label = `${field.label}${field.required ? " (required)" : ""}${field.readOnly ? " (read-only)" : ""}`;
      const widgets = field.widgets.filter((widget) => widget.page === page);
      if (field.kind === "radio" || field.kind === "checkbox-group") {
        const options =
          scale === undefined
            ? [...new Set(field.options)].map((option) => ({ option, widget: undefined }))
            : widgets.map((widget) => ({ option: widget.option ?? "", widget }));
        const controls = options.map(({ option, widget }, index) => (
          <Label
            key={`${option}-${index}`}
            style={widget ? style(widget) : undefined}
            className={widget ? "flex" : "flex min-h-11 items-center gap-3"}
          >
            {field.kind === "radio" ? (
              <RadioGroupItem
                value={option}
                aria-label={`${field.label}: ${option}`}
                className={widget ? "size-full border-primary bg-primary/10 after:inset-0" : ""}
              />
            ) : (
              <Checkbox
                aria-label={`${field.label}: ${option}`}
                disabled={disabled || field.readOnly}
                checked={value === option}
                className={
                  widget ? "size-full rounded-none border-primary bg-primary/10" : "size-5"
                }
                onCheckedChange={(checked) => onChange(field.name, checked === true ? option : "")}
              />
            )}
            <span className={widget ? "sr-only" : ""}>{option}</span>
          </Label>
        ));
        return (
          <fieldset key={field.name} className={scale === undefined ? "space-y-3" : "contents"}>
            <legend className={scale === undefined ? "text-sm font-medium" : "sr-only"}>
              {label}
            </legend>
            {field.kind === "radio" ? (
              <RadioGroup
                aria-label={label}
                value={typeof value === "string" ? value : ""}
                disabled={disabled || field.readOnly}
                aria-required={field.required}
                className={scale === undefined ? "" : "contents"}
                onValueChange={(next) => onChange(field.name, next)}
              >
                {controls}
              </RadioGroup>
            ) : (
              <div className={scale === undefined ? "space-y-2" : "contents"}>{controls}</div>
            )}
          </fieldset>
        );
      }
      if (scale === undefined) {
        return (
          <div key={field.name} className="space-y-2">
            <p className="text-sm font-medium">{label}</p>
            <FormControl
              field={field}
              value={value}
              disabled={disabled}
              onChange={(next) => onChange(field.name, next)}
            />
            {field.kind === "text" && field.maxLength !== undefined && (
              <p className="text-sm text-muted-foreground">Maximum {field.maxLength} characters.</p>
            )}
          </div>
        );
      }
      return widgets.map((widget, index) => (
        <div
          key={`${field.name}-${index}`}
          style={style(widget)}
          className="[&_[data-slot=native-select-wrapper]]:h-full [&_[data-slot=native-select-wrapper]]:w-full"
          title={label}
        >
          <FormControl
            field={field}
            value={value}
            disabled={disabled}
            inline
            onChange={(next) => onChange(field.name, next)}
          />
        </div>
      ));
    });
};
