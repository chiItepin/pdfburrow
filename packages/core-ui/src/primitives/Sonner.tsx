import type { CSSProperties } from "react";
import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { Toaster as Sonner } from "sonner";
import type { ToasterProps } from "sonner";
import { Spinner } from "./Spinner";

const style: CSSProperties &
  Record<"--normal-bg" | "--normal-text" | "--normal-border" | "--border-radius", string> = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
  "--border-radius": "var(--radius)",
};

export const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    className="toaster"
    visibleToasts={1}
    icons={{
      success: <CircleCheckIcon className="size-4" aria-hidden="true" />,
      info: <InfoIcon className="size-4" aria-hidden="true" />,
      warning: <TriangleAlertIcon className="size-4" aria-hidden="true" />,
      error: <OctagonXIcon className="size-4" aria-hidden="true" />,
      loading: <Spinner aria-hidden="true" />,
    }}
    style={style}
    {...props}
  />
);
