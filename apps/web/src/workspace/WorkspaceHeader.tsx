import { useRef } from "react";
import type { Ref } from "react";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SidebarTrigger,
} from "@repo/core-ui";
import { routePath, routeTitles } from "./routes";
import type { ToolRoute } from "./routes";
import { siteBasePath } from "./site";
import { ToolSettingsTrigger } from "./ToolSettingsSidebar";

export const WorkspaceHeader = ({
  route,
  locked,
  heading,
  onNavigate,
}: {
  route: ToolRoute;
  locked: boolean;
  heading: Ref<HTMLHeadingElement>;
  onNavigate: (route: ToolRoute) => void;
}) => {
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const pendingHome = useRef(false);
  return (
    <header className="sticky top-0 z-10 flex min-h-16 shrink-0 items-center gap-2 border-b bg-background px-4 sm:px-6 lg:px-10">
      <SidebarTrigger />
      <span aria-hidden="true" className="mr-1 h-5 border-r md:hidden" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList>
          <BreadcrumbItem className="hidden sm:inline-flex">
            <BreadcrumbLink
              href={routePath("home", siteBasePath)}
              aria-disabled={locked}
              className="aria-disabled:opacity-50"
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                  return;
                }
                event.preventDefault();
                onNavigate("home");
              }}
            >
              PDFBurrow
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  ref={menuTrigger}
                  variant="ghost"
                  size="icon"
                  aria-label="Show breadcrumb navigation"
                >
                  <BreadcrumbEllipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                onCloseAutoFocus={(event) => {
                  if (pendingHome.current) {
                    event.preventDefault();
                    menuTrigger.current?.focus();
                    pendingHome.current = false;
                    onNavigate("home");
                  }
                }}
              >
                <DropdownMenuItem
                  disabled={locked}
                  onSelect={() => {
                    pendingHome.current = true;
                  }}
                >
                  PDFBurrow home
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage asChild>
              <h1
                id="page-heading"
                ref={heading}
                tabIndex={-1}
                className="rounded-sm text-base leading-snug focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                {routeTitles[route]}
              </h1>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {route !== "home" && route !== "not-found" && <ToolSettingsTrigger />}
    </header>
  );
};
