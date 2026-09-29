import type { ComponentProps } from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "../lib/utils";

export const Switch = ({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) => (
  <SwitchPrimitive.Root
    data-slot="switch"
    className={cn(
      "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border-2 border-transparent outline-none after:absolute after:-inset-y-3 after:-inset-x-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      data-slot="switch-thumb"
      className="pointer-events-none block size-4 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none data-[state=checked]:translate-x-4.5 data-[state=unchecked]:translate-x-0.5"
    />
  </SwitchPrimitive.Root>
);
