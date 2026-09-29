import { createContext, useContext, useId, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  useMediaQuery,
} from "@repo/core-ui";

interface SettingsContextValue {
  readonly compact: boolean;
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly trigger: RefObject<HTMLButtonElement | null>;
  readonly panelId: string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const ToolSettingsProvider = ({ children }: { children: ReactNode }) => {
  const compact = useMediaQuery("(max-width: 1279px)");
  const [dockedOpen, setDockedOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  return (
    <SettingsContext.Provider
      value={{
        compact,
        open: compact ? drawerOpen : dockedOpen,
        setOpen: compact ? setDrawerOpen : setDockedOpen,
        trigger,
        panelId,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

const useToolSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("Tool settings must be used within a ToolSettingsProvider.");
  }
  return context;
};

export const ToolSettingsTrigger = () => {
  const { open, setOpen, trigger, panelId } = useToolSettings();
  const Icon = open ? PanelRightClose : PanelRightOpen;
  return (
    <Button
      ref={trigger}
      variant="ghost"
      size="icon"
      aria-label={open ? "Close settings" : "Open settings"}
      title={open ? "Close settings" : "Open settings"}
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      className="ml-auto"
      onClick={() => setOpen(!open)}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
};

export const ToolSettingsSidebar = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => {
  const { compact, open, setOpen, trigger, panelId } = useToolSettings();
  const titleId = useId();
  const content = (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">{children}</div>
  );
  if (compact) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          id={panelId}
          side="right"
          closeLabel="Close settings"
          className="w-80 bg-sidebar"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <SheetTitle className="shrink-0 border-b px-6 py-5 pr-14 font-semibold">
            {title}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Adjust settings for this tool. Close this panel to return to your documents.
          </SheetDescription>
          {content}
        </SheetContent>
      </Sheet>
    );
  }
  if (!open) {
    return null;
  }
  return (
    <aside
      id={panelId}
      data-settings-docked
      aria-labelledby={titleId}
      className="fixed top-20 right-[calc(1rem+1px)] bottom-4 z-10 flex w-80 flex-col rounded-br-xl border-l bg-sidebar"
    >
      <h2 id={titleId} className="shrink-0 border-b px-6 py-5 font-semibold">
        {title}
      </h2>
      {content}
    </aside>
  );
};
