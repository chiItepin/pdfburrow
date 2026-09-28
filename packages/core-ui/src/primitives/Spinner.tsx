import type { ComponentProps } from "react";
import { Loader2Icon } from "lucide-react";
import { cn } from "../lib/utils";

export const Spinner = ({ className, ...props }: ComponentProps<"svg">) => (
  <Loader2Icon
    data-slot="spinner"
    role="status"
    aria-label="Loading"
    className={cn("size-4 motion-safe:animate-spin", className)}
    {...props}
  />
);
