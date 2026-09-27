import type { ComponentProps } from "react";
import { cn } from "../lib/utils";
export const PageFrame = ({ className, ...props }: ComponentProps<"main">) => {
  return (
    <main className={cn("mx-auto w-full max-w-3xl px-6 py-12 sm:py-20", className)} {...props} />
  );
};
