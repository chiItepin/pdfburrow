import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
} from "@repo/core-ui";
import type { MarkupTool } from "./usePageGestures";
import type { MarkupZoom } from "./MarkupPage";
import { MarkupToolsMenu, markupTools } from "./MarkupToolsMenu";
import { MarkupViewMenu } from "./MarkupViewMenu";
import { useMenubarAction } from "./useMenubarAction";

export const MarkupToolbar = ({
  tool,
  disabled,
  busy,
  canUndo,
  canRedo,
  hasSelection,
  canGenerate,
  canDownload,
  canNote,
  onTool,
  onSignature,
  onUndo,
  onRedo,
  onDelete,
  onGenerate,
  onDownload,
  onReset,
  page,
  count,
  zoom,
  onPage,
  onZoom,
  onGoToPage,
  onZoomLevel,
  onHighlight,
  onNote,
  onProperties,
  onEditNote,
  canEditNote,
}: {
  tool: MarkupTool;
  disabled: boolean;
  busy: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  canGenerate: boolean;
  canDownload: boolean;
  canNote: boolean;
  onTool: (tool: MarkupTool) => void;
  onSignature: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onGenerate: () => void;
  onDownload: () => void;
  onReset: () => void;
  page: number;
  count: number;
  zoom: MarkupZoom;
  onPage: (page: number) => void;
  onZoom: (zoom: MarkupZoom) => void;
  onGoToPage: () => void;
  onZoomLevel: () => void;
  onHighlight: () => void;
  onNote: () => void;
  onProperties: () => void;
  onEditNote: () => void;
  canEditNote: boolean;
}) => {
  const {
    trigger: fileTrigger,
    defer: deferFileAction,
    onCloseAutoFocus: closeFileMenu,
  } = useMenubarAction();
  const {
    trigger: editTrigger,
    defer: deferEditAction,
    onCloseAutoFocus: closeEditMenu,
  } = useMenubarAction();
  return (
    <div data-markup-controls className="flex flex-wrap items-center justify-between gap-2">
      <Menubar aria-label="Markup commands">
        <MenubarMenu>
          <MenubarTrigger ref={fileTrigger}>File</MenubarTrigger>
          <MenubarContent onCloseAutoFocus={closeFileMenu}>
            <MenubarItem disabled={!canGenerate || busy} onSelect={onGenerate}>
              Generate PDF
            </MenubarItem>
            <MenubarItem disabled={!canDownload || busy} onSelect={onDownload}>
              Download PDF
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem disabled={busy} onSelect={deferFileAction(onReset)}>
              Start over
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger ref={editTrigger}>Edit</MenubarTrigger>
          <MenubarContent onCloseAutoFocus={closeEditMenu}>
            <MenubarItem disabled={disabled || busy || !canUndo} onSelect={onUndo}>
              Undo<MenubarShortcut>Ctrl / Cmd Z</MenubarShortcut>
            </MenubarItem>
            <MenubarItem disabled={disabled || busy || !canRedo} onSelect={onRedo}>
              Redo<MenubarShortcut>Shift Ctrl / Cmd Z</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem
              disabled={disabled || busy || !hasSelection}
              onSelect={deferEditAction(onProperties)}
            >
              Move / size...
            </MenubarItem>
            <MenubarItem
              disabled={disabled || busy || !canEditNote}
              onSelect={deferEditAction(onEditNote)}
            >
              Edit note...
            </MenubarItem>
            <MenubarItem disabled={disabled || busy || !hasSelection} onSelect={onDelete}>
              Delete selected
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MarkupToolsMenu
          tool={tool}
          disabled={disabled || busy}
          canNote={canNote}
          onTool={onTool}
          onSignature={onSignature}
          onHighlight={onHighlight}
          onNote={onNote}
        />
        <MarkupViewMenu
          page={page}
          count={count}
          zoom={zoom}
          disabled={busy}
          onPage={onPage}
          onZoom={onZoom}
          onGoToPage={onGoToPage}
          onZoomLevel={onZoomLevel}
        />
      </Menubar>
      <p aria-label="Editor view" className="text-xs text-muted-foreground">
        {markupTools.find((choice) => choice.value === tool)?.label} · Page {page} of {count} ·{" "}
        {typeof zoom === "number" ? `${zoom}%` : zoom === "page" ? "Fit page" : "Fit width"}
      </p>
    </div>
  );
};
