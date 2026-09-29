import { useRef } from "react";
import { FileText, House, Moon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Switch,
  useSidebar,
  useTheme,
} from "@repo/core-ui";
import { routeHash } from "./routes";
import type { ToolRoute } from "./routes";
import { tools } from "./tools";

export const ToolNavigation = ({
  route,
  locked,
  onNavigate,
}: {
  route: ToolRoute;
  locked: boolean;
  onNavigate: (route: ToolRoute) => void;
}) => {
  const { isMobile, setOpenMobile } = useSidebar();
  const { theme, setTheme, error } = useTheme();
  const pending = useRef<ToolRoute | null>(null);
  const entries = [{ route: "home", label: "Home", icon: House } as const, ...tools];
  return (
    <Sidebar
      aria-label="Workspace sidebar"
      onCloseAutoFocus={() => {
        if (pending.current !== null) {
          const next = pending.current;
          pending.current = null;
          onNavigate(next);
        }
      }}
    >
      <SidebarHeader className="h-16 justify-center border-b px-6">
        <div className="flex items-center gap-2.5 font-semibold tracking-tight">
          <FileText className="size-5 text-primary" strokeWidth={1.75} aria-hidden="true" />
          PDFBurrow
        </div>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="PDF tools">
          <SidebarMenu>
            {entries.map(({ route: value, label, icon: Icon }) => (
              <SidebarMenuItem key={value}>
                <SidebarMenuButton asChild isActive={route === value}>
                  <a
                    href={routeHash(value)}
                    aria-current={route === value ? "page" : undefined}
                    aria-disabled={locked}
                    onClick={(event) => {
                      event.preventDefault();
                      if (isMobile) {
                        // Restore drawer focus before opening a discard confirmation.
                        pending.current = value;
                        setOpenMobile(false);
                      } else {
                        onNavigate(value);
                      }
                    }}
                  >
                    <Icon strokeWidth={1.75} aria-hidden="true" />
                    <span>{label}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex min-h-11 items-center gap-3 px-2">
          <Moon className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          <label htmlFor="dark-mode" className="flex-1 cursor-pointer py-3 text-sm">
            Dark mode
          </label>
          <Switch
            id="dark-mode"
            checked={theme === "dark"}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          />
        </div>
        {error && (
          <p role="alert" className="px-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};
