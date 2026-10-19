import { Checkbox, Input, NativeSelect, NativeSelectOption, Textarea } from "@repo/core-ui";
import type { FormField } from "@repo/pdf-engine";

export const FormControl = ({
  field,
  value,
  disabled,
  inline = false,
  onChange,
}: {
  field: Exclude<FormField, { kind: "radio" | "checkbox-group" }>;
  value: string | boolean;
  disabled: boolean;
  inline?: boolean;
  onChange: (value: string | boolean) => void;
}) => {
  const label = `${field.label}${field.required ? " (required)" : ""}${field.readOnly ? " (read-only)" : ""}`;
  const common = {
    "aria-label": label,
    "aria-required": field.required,
    disabled: disabled || field.readOnly,
  };
  const className = inline
    ? "h-full min-h-0 w-full rounded-none border-primary bg-primary/10 px-1 py-0 text-inherit text-[length:inherit] shadow-none md:text-[length:inherit] dark:bg-primary/10 max-sm:min-h-0 pointer-coarse:min-h-0"
    : "";
  if (field.kind === "checkbox") {
    return (
      <Checkbox
        {...common}
        checked={value === true}
        className={inline ? "size-full rounded-none border-primary bg-primary/10" : "size-5"}
        onCheckedChange={(checked) => onChange(checked === true)}
      />
    );
  }
  if (field.kind === "dropdown") {
    return (
      <NativeSelect
        {...common}
        value={typeof value === "string" ? value : ""}
        className={className}
        onChange={(event) => onChange(event.target.value)}
      >
        <NativeSelectOption value="">Choose an option</NativeSelectOption>
        {field.options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  }
  const props = {
    ...common,
    className,
    value: typeof value === "string" ? value : "",
    maxLength: field.maxLength,
    readOnly: field.readOnly,
    spellCheck: false,
    autoComplete: "off",
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
  };
  return field.multiline ? (
    <Textarea {...props} className={`${className} resize-none`} />
  ) : (
    <Input {...props} />
  );
};
