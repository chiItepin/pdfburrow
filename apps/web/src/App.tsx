import { ConfirmDiscard, PageFrame } from "@repo/core-ui";
import { MergeWorkspace } from "./merge";
import { useDocumentWorkspace } from "./workspace/useDocumentWorkspace";
import { ImageWorkspace } from "./images";
import { SplitWorkspace } from "./split";
import { ToolNavigation } from "./workspace/ToolNavigation";
import { ToolIntroduction } from "./workspace/ToolIntroduction";
import { WorkspaceFooter } from "./workspace/WorkspaceFooter";
import { useToolNavigation } from "./workspace/useToolNavigation";
import { routeTitles } from "./workspace/routes";

export const App = () => {
  const workspace = useDocumentWorkspace();
  const { route, heading, confirmation, notice, request, keep, discard } = useToolNavigation({
    hasWork: workspace.draft.inputs.length > 0,
    locked: workspace.execution.locked,
    discard: workspace.discardForNavigation,
  });
  return (
    <PageFrame className="max-w-6xl">
      <ToolNavigation route={route} locked={workspace.execution.locked} onNavigate={request} />
      <header className="border-b pb-8">
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          {routeTitles[route]}
        </h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          PDFBurrow processes your documents in this browser, without uploading them.
        </p>
      </header>
      {notice && (
        <p role="alert" className="mt-4">
          {notice}
        </p>
      )}
      {route === "merge" ? (
        <MergeWorkspace workspace={workspace} />
      ) : route === "split" ? (
        <SplitWorkspace key={workspace.draft.inputs[0]?.id ?? "empty"} workspace={workspace} />
      ) : route === "images" ? (
        <ImageWorkspace key={workspace.draft.revision} workspace={workspace} />
      ) : (
        <ToolIntroduction
          route={route}
          onMerge={() => request("merge")}
          onSplit={() => request("split")}
          onImages={() => request("images")}
        />
      )}
      <WorkspaceFooter />
      <ConfirmDiscard
        open={confirmation}
        description="Changing tools or returning Home clears the current inputs, settings, and outputs from this tab. Original files and downloaded copies are unchanged."
        onKeep={keep}
        onDiscard={discard}
      />
    </PageFrame>
  );
};
