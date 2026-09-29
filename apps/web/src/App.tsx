import { ConfirmDiscard, SidebarInset, SidebarProvider, Toaster, useTheme } from "@repo/core-ui";
import { MergeWorkspace } from "./merge";
import { useDocumentWorkspace } from "./workspace/useDocumentWorkspace";
import { ImageWorkspace } from "./images";
import { SplitWorkspace } from "./split";
import { ToolNavigation } from "./workspace/ToolNavigation";
import { ToolIntroduction } from "./workspace/ToolIntroduction";
import { WorkspaceFooter } from "./workspace/WorkspaceFooter";
import { useToolNavigation } from "./workspace/useToolNavigation";
import { WorkspaceHeader } from "./workspace/WorkspaceHeader";
import { ToolSettingsProvider } from "./workspace/ToolSettingsSidebar";

export const App = () => {
  const workspace = useDocumentWorkspace();
  const { theme } = useTheme();
  const { route, heading, confirmation, notice, request, keep, discard } = useToolNavigation({
    hasWork: workspace.draft.inputs.length > 0,
    locked: workspace.execution.locked,
    discard: workspace.discardForNavigation,
  });
  return (
    <SidebarProvider className="h-dvh min-h-0 overflow-hidden bg-background md:m-4 md:h-[calc(100dvh-2rem)] md:rounded-xl md:border md:border-y-0">
      <a
        href="#page-heading"
        className="sr-only z-50 rounded-md bg-background p-3 focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        onClick={(event) => {
          event.preventDefault();
          heading.current?.focus();
        }}
      >
        Skip to content
      </a>
      <ToolNavigation route={route} locked={workspace.execution.locked} onNavigate={request} />
      <ToolSettingsProvider key={route}>
        <SidebarInset aria-labelledby="page-heading" className="min-h-0">
          <WorkspaceHeader
            route={route}
            locked={workspace.execution.locked}
            heading={heading}
            onNavigate={request}
          />
          <div
            className="min-h-0 flex-1 overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring has-[[data-settings-docked]]:mr-80"
            data-workspace-scroll
            role="region"
            aria-label="Document workspace"
          >
            <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 sm:px-6 lg:px-10">
              <div data-workspace-content className="flex-1">
                {notice && (
                  <p role="alert" className="mt-4">
                    {notice}
                  </p>
                )}
                {route === "merge" ? (
                  <MergeWorkspace workspace={workspace} />
                ) : route === "split" ? (
                  <SplitWorkspace
                    key={workspace.draft.inputs[0]?.id ?? "empty"}
                    workspace={workspace}
                  />
                ) : route === "images" ? (
                  <ImageWorkspace key={workspace.draft.revision} workspace={workspace} />
                ) : (
                  <ToolIntroduction route={route} onNavigate={request} />
                )}
              </div>
              <WorkspaceFooter />
            </div>
          </div>
        </SidebarInset>
      </ToolSettingsProvider>
      <ConfirmDiscard
        open={confirmation}
        description="Changing tools or returning Home clears the current inputs, settings, and outputs from this tab. Original files and downloaded copies are unchanged."
        onKeep={keep}
        onDiscard={discard}
      />
      <Toaster theme={theme} />
    </SidebarProvider>
  );
};
