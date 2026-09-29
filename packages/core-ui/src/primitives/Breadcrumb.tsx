import type { ComponentProps } from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { Slot } from "radix-ui";
import { cn } from "../lib/utils";

export const Breadcrumb = (props: ComponentProps<"nav">) => (
  <nav aria-label="Breadcrumb" data-slot="breadcrumb" {...props} />
);

export const BreadcrumbList = ({ className, ...props }: ComponentProps<"ol">) => (
  <ol
    data-slot="breadcrumb-list"
    className={cn("flex min-w-0 items-center gap-2 text-sm text-muted-foreground", className)}
    {...props}
  />
);

export const BreadcrumbItem = ({ className, ...props }: ComponentProps<"li">) => (
  <li
    data-slot="breadcrumb-item"
    className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
    {...props}
  />
);

export const BreadcrumbLink = ({ className, children, ...props }: ComponentProps<"a">) => (
  <a
    data-slot="breadcrumb-link"
    className={cn(
      "rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
      className,
    )}
    {...props}
  >
    {children}
  </a>
);

export const BreadcrumbPage = ({
  asChild = false,
  className,
  ...props
}: ComponentProps<"span"> & { asChild?: boolean }) => {
  const Comp = asChild ? Slot.Root : "span";
  return (
    <Comp
      data-slot="breadcrumb-page"
      aria-current="page"
      className={cn("font-medium text-foreground", className)}
      {...props}
    />
  );
};

export const BreadcrumbSeparator = ({ className, ...props }: ComponentProps<"li">) => (
  <li
    data-slot="breadcrumb-separator"
    role="presentation"
    aria-hidden="true"
    className={cn("shrink-0 [&>svg]:size-3.5", className)}
    {...props}
  >
    <ChevronRight />
  </li>
);

export const BreadcrumbEllipsis = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    data-slot="breadcrumb-ellipsis"
    aria-hidden="true"
    className={cn("flex items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="size-4" />
  </span>
);
