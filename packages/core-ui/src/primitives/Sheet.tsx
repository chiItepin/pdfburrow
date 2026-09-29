import type { ComponentProps } from "react";
import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { cn } from "../lib/utils";
import { Button } from "./Button";

export const Sheet = SheetPrimitive.Root;
export const SheetTitle = SheetPrimitive.Title;
export const SheetDescription = SheetPrimitive.Description;

export const SheetContent = ({
  className,
  children,
  side = "left",
  closeLabel = "Close sidebar",
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "left" | "right";
  closeLabel?: string;
}) => (
  <SheetPrimitive.Portal>
    <SheetPrimitive.Overlay data-slot="sheet-overlay" className="fixed inset-0 z-40 bg-black/40" />
    <SheetPrimitive.Content
      data-slot="sheet-content"
      className={cn(
        "fixed inset-y-0 z-50 flex h-dvh w-72 max-w-[calc(100%-2rem)] flex-col bg-background shadow-lg",
        side === "left" ? "left-0 border-r" : "right-0 border-l",
        className,
      )}
      {...props}
    >
      {children}
      <SheetPrimitive.Close asChild>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-2"
          aria-label={closeLabel}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPrimitive.Portal>
);
