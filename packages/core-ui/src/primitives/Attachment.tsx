import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { Button } from "./Button";

const attachmentVariants = cva(
  "group/attachment relative flex max-w-full min-w-0 flex-wrap rounded-lg border bg-card text-card-foreground motion-safe:transition-colors data-[state=error]:border-destructive/50",
  {
    variants: {
      orientation: {
        horizontal: "items-center gap-3 p-3",
        vertical: "flex-col items-stretch gap-3 p-3",
      },
    },
    defaultVariants: { orientation: "horizontal" },
  },
);

export const Attachment = ({
  className,
  state = "done",
  orientation = "horizontal",
  ...props
}: ComponentProps<"div"> &
  VariantProps<typeof attachmentVariants> & {
    state?: "idle" | "uploading" | "processing" | "error" | "done";
  }) => (
  <div
    data-slot="attachment"
    data-state={state}
    data-orientation={orientation}
    className={cn(attachmentVariants({ orientation }), className)}
    {...props}
  />
);

export const AttachmentMedia = ({
  className,
  variant = "icon",
  ...props
}: ComponentProps<"div"> & { variant?: "icon" | "image" }) => (
  <div
    data-slot="attachment-media"
    data-variant={variant}
    className={cn(
      "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted",
      variant === "image" && "[&_img]:size-full [&_img]:object-contain",
      className,
    )}
    {...props}
  />
);

export const AttachmentContent = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="attachment-content"
    className={cn("min-w-0 max-w-full flex-1", className)}
    {...props}
  />
);

export const AttachmentTitle = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    data-slot="attachment-title"
    className={cn("block min-w-0 break-all font-semibold", className)}
    {...props}
  />
);

export const AttachmentDescription = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    data-slot="attachment-description"
    className={cn("mt-1 block text-sm text-muted-foreground", className)}
    {...props}
  />
);

export const AttachmentActions = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="attachment-actions"
    className={cn("relative flex flex-wrap gap-2", className)}
    {...props}
  />
);

export const AttachmentAction = ({
  variant = "ghost",
  ...props
}: ComponentProps<typeof Button>) => (
  <Button data-slot="attachment-action" variant={variant} {...props} />
);
