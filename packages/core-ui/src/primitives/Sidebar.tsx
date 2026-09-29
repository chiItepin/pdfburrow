import { createContext, useContext, useRef, useState } from "react";
import type { ComponentProps, RefObject } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Slot } from "radix-ui";
import { cn } from "../lib/utils";
import { useIsMobile } from "../lib/useIsMobile";
import { Button } from "./Button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./Sheet";

interface SidebarContextValue {
  readonly isMobile: boolean;
  readonly openMobile: boolean;
  readonly setOpenMobile: (open: boolean) => void;
  readonly trigger: RefObject<HTMLButtonElement | null>;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
};

export const SidebarProvider = ({ className, children, ...props }: ComponentProps<"div">) => {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <SidebarContext.Provider value={{ isMobile, openMobile, setOpenMobile, trigger }}>
      <div
        data-slot="sidebar-wrapper"
        className={cn("flex min-h-svh min-w-0", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  className,
  children,
  onCloseAutoFocus,
  ...props
}: ComponentProps<"aside"> & {
  onCloseAutoFocus?: ComponentProps<typeof SheetContent>["onCloseAutoFocus"];
}) => {
  const { isMobile, openMobile, setOpenMobile, trigger } = useSidebar();
  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          data-slot="sidebar"
          className="bg-sidebar text-sidebar-foreground"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
            onCloseAutoFocus?.(event);
          }}
        >
          <SheetTitle className="sr-only">PDF tools</SheetTitle>
          <SheetDescription className="sr-only">
            Choose a document tool or change the color theme.
          </SheetDescription>
          <div className={cn("flex min-h-0 flex-1 flex-col", className)}>{children}</div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <aside
      data-slot="sidebar"
      className={cn("hidden w-60 shrink-0 text-sidebar-foreground md:block", className)}
      {...props}
    >
      <div className="fixed inset-y-4 left-4 z-20 flex w-60 flex-col rounded-l-xl border-r bg-sidebar">
        {children}
      </div>
    </aside>
  );
};

export const SidebarTrigger = ({ className, onClick, ...props }: ComponentProps<typeof Button>) => {
  const { openMobile, setOpenMobile, trigger } = useSidebar();
  const Icon = openMobile ? PanelLeftClose : PanelLeftOpen;
  return (
    <Button
      ref={trigger}
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn("md:hidden", className)}
      aria-label={openMobile ? "Close sidebar" : "Open sidebar"}
      title={openMobile ? "Close sidebar" : "Open sidebar"}
      aria-expanded={openMobile}
      onClick={(event) => {
        onClick?.(event);
        setOpenMobile(!openMobile);
      }}
      {...props}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
};

export const SidebarInset = ({ className, ...props }: ComponentProps<"main">) => (
  <main
    data-slot="sidebar-inset"
    className={cn("relative flex min-w-0 flex-1 flex-col bg-background", className)}
    {...props}
  />
);

export const SidebarHeader = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="sidebar-header"
    className={cn("flex shrink-0 flex-col gap-2 p-4", className)}
    {...props}
  />
);

export const SidebarContent = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="sidebar-content"
    className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3", className)}
    {...props}
  />
);

export const SidebarFooter = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="sidebar-footer"
    className={cn("mt-auto flex shrink-0 flex-col gap-2 border-t p-4", className)}
    {...props}
  />
);

export const SidebarMenu = ({ className, ...props }: ComponentProps<"ul">) => (
  <ul
    data-slot="sidebar-menu"
    className={cn("flex w-full min-w-0 flex-col gap-1", className)}
    {...props}
  />
);

export const SidebarMenuItem = ({ className, ...props }: ComponentProps<"li">) => (
  <li data-slot="sidebar-menu-item" className={cn("relative", className)} {...props} />
);

export const SidebarMenuButton = ({
  asChild = false,
  isActive = false,
  className,
  ...props
}: ComponentProps<"button"> & { asChild?: boolean; isActive?: boolean }) => {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="sidebar-menu-button"
      data-active={isActive}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-foreground [&>svg]:size-4 [&>svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
};
