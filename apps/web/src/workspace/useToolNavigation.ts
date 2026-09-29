import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createNavigation } from "./navigation";
import type { NavigationGuard } from "./navigation";
import { readRoute } from "./routes";
import type { ToolRoute } from "./routes";
import { siteBasePath } from "./site";
import { updatePageMetadata } from "./updatePageMetadata";

export const useToolNavigation = (guard: NavigationGuard, initialRoute?: ToolRoute) => {
  const latest = useRef(guard);
  const controller = useRef<ReturnType<typeof createNavigation> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [route, setRoute] = useState(() => initialRoute ?? readRoute(location, siteBasePath));
  const [confirmation, setConfirmation] = useState(false);
  const [notice, setNotice] = useState("");
  useLayoutEffect(() => {
    latest.current = guard;
  });
  useEffect(() => {
    controller.current = createNavigation({
      guard: () => latest.current,
      change: (next) => {
        setRoute(next);
        setNotice("");
        requestAnimationFrame(() => heading.current?.focus());
      },
      confirm: setConfirmation,
      blocked: () =>
        setNotice(
          "Navigation is locked while work is running. Cancel and wait for it to stop first.",
        ),
    });
    return () => {
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);
  useEffect(() => {
    updatePageMetadata(route);
  }, [route]);
  return {
    route,
    heading,
    confirmation,
    notice,
    request: (next: ToolRoute) => {
      controller.current?.request(next);
    },
    keep: () => {
      controller.current?.keep();
    },
    discard: () => {
      controller.current?.discard();
    },
  };
};
