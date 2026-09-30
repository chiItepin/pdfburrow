import type { ComponentProps } from "react";
import { Menubar as Primitive } from "radix-ui";
import { Circle } from "lucide-react";
import { cn } from "../lib/utils";

export const MenubarMenu = Primitive.Menu;
export const MenubarRadioGroup = Primitive.RadioGroup;
export const Menubar = ({ className, ...props }: ComponentProps<typeof Primitive.Root>) => (
  <Primitive.Root
    data-slot="menubar"
    className={cn(
      "flex h-9 items-center gap-1 rounded-md border bg-background p-1 shadow-xs max-sm:h-11",
      className,
    )}
    {...props}
  />
);
export const MenubarTrigger = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.Trigger>) => (
  <Primitive.Trigger
    data-slot="menubar-trigger"
    className={cn(
      "flex items-center rounded-sm px-2 py-1 text-sm font-medium outline-none select-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground max-sm:min-h-9",
      className,
    )}
    {...props}
  />
);
export const MenubarContent = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.Content>) => (
  <Primitive.Portal>
    <Primitive.Content
      data-slot="menubar-content"
      align="start"
      alignOffset={-4}
      sideOffset={8}
      className={cn(
        "z-50 max-h-(--radix-menubar-content-available-height) min-w-48 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        className,
      )}
      {...props}
    />
  </Primitive.Portal>
);
export const MenubarItem = ({ className, ...props }: ComponentProps<typeof Primitive.Item>) => (
  <Primitive.Item
    data-slot="menubar-item"
    className={cn(
      "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 max-sm:min-h-11 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
      className,
    )}
    {...props}
  />
);
export const MenubarSeparator = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.Separator>) => (
  <Primitive.Separator
    data-slot="menubar-separator"
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
);
export const MenubarShortcut = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    data-slot="menubar-shortcut"
    aria-hidden="true"
    className={cn("ml-auto pl-6 text-xs text-muted-foreground", className)}
    {...props}
  />
);
export const MenubarRadioItem = ({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.RadioItem>) => (
  <Primitive.RadioItem
    data-slot="menubar-radio-item"
    className={cn(
      "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 max-sm:min-h-11 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
      className,
    )}
    {...props}
  >
    <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
      <Primitive.ItemIndicator>
        <Circle className="size-2! fill-current" />
      </Primitive.ItemIndicator>
    </span>
    {children}
  </Primitive.RadioItem>
);
