import type { ComponentProps } from "react";
import { Progress as ProgressPrimitive } from "radix-ui";
import { cn } from "../lib/utils";

export const Progress = ({
  className,
  value,
  max = 100,
  ...props
}: ComponentProps<typeof ProgressPrimitive.Root>) => (
  <ProgressPrimitive.Root
    data-slot="progress"
    value={value}
    max={max}
    className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className="h-full w-full bg-primary motion-safe:transition-transform"
      style={{ transform: `translateX(-${100 - ((value ?? 0) / max) * 100}%)` }}
    />
  </ProgressPrimitive.Root>
);
