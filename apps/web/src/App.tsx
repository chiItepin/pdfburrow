import { ConfirmDiscard, SidebarInset, SidebarProvider, Toaster } from "@repo/core-ui";
import { MergeWorkspace } from "./merge";
import { MarkupWorkspace } from "./markup/MarkupWorkspace";
import { useDocumentWorkspace } from "./workspace/useDocumentWorkspace";
import { ImageWorkspace } from "./images";
import { SplitWorkspace } from "./split";
import { ToolNavigation } from "./workspace/ToolNavigation";
import { ToolIntroduction } from "./workspace/ToolIntroduction";
import { WorkspaceFooter } from "./workspace/WorkspaceFooter";
import { useToolNavigation } from "./workspace/useToolNavigation";
import type { ToolRoute } from "./workspace/routes";
import { ToolGuide } from "./workspace/ToolGuide";
import { WorkspaceHeader } from "./workspace/WorkspaceHeader";
import { ToolSettingsProvider } from "./workspace/ToolSettingsSidebar";
import { useTheme } from "./workspace/ThemeProvider";
import { usePersonalSeal } from "./seal/usePersonalSeal";
import { SealWorkspace } from "./seal/SealWorkspace";
import { FormWorkspace } from "./forms/FormWorkspace";

export const App = ({ initialRoute }: { initialRoute?: ToolRoute }) => {
  const workspace = useDocumentWorkspace();
  const seal = usePersonalSeal();
  const locked = workspace.execution.locked || workspace.interactionLocked || seal.busy;
  const { theme } = useTheme();
  const { route, heading, confirmation, notice, request, keep, discard, transfer } =
    useToolNavigation(
      {
        hasWork: workspace.draft.inputs.length > 0 || seal.hasWork,
        locked,
        discard: () => {
          workspace.discardForNavigation();
          seal.discard();
        },
      },
      initialRoute,
    );
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
      <ToolNavigation route={route} locked={locked} onNavigate={request} />
      <ToolSettingsProvider key={route}>
        <SidebarInset aria-labelledby="page-heading" className="min-h-0">
          <WorkspaceHeader route={route} locked={locked} heading={heading} onNavigate={request} />
          <div
            className="min-h-0 flex-1 overflow-y-auto outline-none [overflow-anchor:none] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring has-[[data-settings-docked]]:mr-80"
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
                {route === "forms" ? (
                  <FormWorkspace
                    workspace={workspace}
                    onSign={(output) =>
                      transfer("markup", () => {
                        workspace.discardForNavigation();
                        workspace.draft.addFiles(
                          [
                            new File([output.blob], output.suggestedFilename, {
                              type: "application/pdf",
                            }),
                          ],
                          "markup",
                        );
                      })
                    }
                  />
                ) : route === "seal" ? (
                  <SealWorkspace seal={seal} />
                ) : route === "markup" ? (
                  <MarkupWorkspace workspace={workspace} />
                ) : route === "merge" ? (
                  <MergeWorkspace workspace={workspace} />
                ) : route === "split" || route === "remove" ? (
                  <SplitWorkspace
                    key={`${route}-${workspace.draft.inputs[0]?.id ?? "empty"}`}
                    tool={route}
                    workspace={workspace}
                  />
                ) : route === "images" ? (
                  <ImageWorkspace key={workspace.draft.revision} workspace={workspace} />
                ) : (
                  <ToolIntroduction route={route} onNavigate={request} />
                )}
              </div>
              <ToolGuide route={route} />
              <WorkspaceFooter />
            </div>
          </div>
        </SidebarInset>
      </ToolSettingsProvider>
      <ConfirmDiscard
        open={confirmation}
        description="Changing tools or returning Home clears inputs, settings, outputs and unlocked signing keys from this tab. Save any encrypted key backup and proof first. Original files and downloaded copies are unchanged."
        onKeep={keep}
        onDiscard={discard}
      />
      <Toaster theme={theme} />
    </SidebarProvider>
  );
};
