import type { ComponentProps } from "react";
import { CircleIcon } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "../lib/utils";

export const RadioGroup = ({
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Root>) => (
  <RadioGroupPrimitive.Root
    data-slot="radio-group"
    className={cn("grid gap-3", className)}
    {...props}
  />
);

export const RadioGroupItem = ({
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Item>) => (
  <RadioGroupPrimitive.Item
    data-slot="radio-group-item"
    className={cn(
      "relative aspect-square size-4 shrink-0 rounded-full border border-input text-primary shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40 after:absolute after:-inset-3",
      className,
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator
      data-slot="radio-group-indicator"
      className="relative flex items-center justify-center"
    >
      <CircleIcon
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-primary"
      />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
);
