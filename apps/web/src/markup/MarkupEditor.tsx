import { useState } from "react";
import type { KeyboardEvent } from "react";
import { Button } from "@repo/core-ui";
import type { MarkupInfo, MarkupObject, MarkupPoint } from "@repo/pdf-engine";
import { resizeMarkup, strokeObject } from "@repo/pdf-engine/markup-layout";
import type { useDocumentWorkspace } from "../workspace/useDocumentWorkspace";
import { useMarkupDraft } from "./useMarkupDraft";
import { useMarkupFont } from "./useMarkupFont";
import { MarkupPage } from "./MarkupPage";
import type { MarkupZoom } from "./MarkupPage";
import type { MarkupTool } from "./usePageGestures";
import { GoToPage } from "./GoToPage";
import { ZoomLevel } from "./ZoomLevel";
import { MarkupToolbar } from "./MarkupToolbar";
import { SignatureCapture } from "./SignatureCapture";
import { NoteEditor } from "./NoteEditor";
import { MarkupProperties } from "./MarkupProperties";
import { MarkupOutput } from "./MarkupOutput";
import { pdfLimits } from "../workspace/resourcePolicy";
import { ObjectControls } from "./ObjectControls";

type Dialog =
  | { kind: "signature" }
  | { kind: "page" }
  | { kind: "zoom" }
  | { kind: "note"; position: MarkupPoint; object?: MarkupObject & { kind: "note" } }
  | { kind: "properties"; object: MarkupObject };
export const MarkupEditor = ({
  file,
  info,
  workspace,
}: {
  file: File;
  info: MarkupInfo;
  workspace: ReturnType<typeof useDocumentWorkspace>;
}) => {
  const { execution, draft } = workspace;
  const history = useMarkupDraft(execution.editDraft);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<MarkupZoom>("page");
  const [tool, setTool] = useState<MarkupTool>("select");
  const [gesture, setGesture] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const busy = gesture || Boolean(dialog) || execution.locked;
  const geometry = info.pages[page - 1];
  const { font, retry } = useMarkupFont();
  const fontBytes = font.state === "ready" ? font.bytes : undefined;
  const selected = history.objects.find(
    (object) => object.id === history.selectedId && object.page === page,
  );
  if (!geometry) {
    return <p role="alert">This page is unavailable. Start over with a valid PDF.</p>;
  }
  const onBusy = (value: boolean) => {
    setGesture(value);
    workspace.setInteractionLocked(value);
  };
  const open = (value: Dialog) => {
    setDialog(value);
    workspace.setInteractionLocked(true);
  };
  const close = () => {
    setDialog(null);
    workspace.setInteractionLocked(false);
  };
  const onAdd = (object: MarkupObject) => {
    history.add(object);
    setTool("select");
  };
  const changePage = (value: number) => {
    setPage(value);
    history.select(null);
  };
  const generate = () => {
    if (busy || !execution.editable || !draft.acknowledged) {
      return;
    }
    void execution.start(async (options) => {
      const { generateMarkupPdf } = await import("@repo/pdf-engine/markup");
      const outcome = await generateMarkupPdf(
        {
          input: { id: draft.inputs[0]?.id ?? "", name: file.name, blob: file },
          objects: history.objects,
          acknowledged: draft.acknowledged,
          limits: pdfLimits,
        },
        options,
      );
      return outcome.kind === "success" ? { kind: "success", value: [outcome.value] } : outcome;
    });
  };
  const keyDown = (event: KeyboardEvent) => {
    const target = event.target;
    if (
      busy ||
      !execution.editable ||
      (target instanceof Element && target.closest("input,textarea,select,[contenteditable=true]"))
    ) {
      return;
    }
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && (key === "z" || key === "y")) {
      event.preventDefault();
      if (event.shiftKey || key === "y") {
        history.redo();
      } else {
        history.undo();
      }
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      history.remove();
    }
  };
  return (
    <section aria-label="PDF markup editor" className="mt-6" onKeyDownCapture={keyDown}>
      <MarkupToolbar
        tool={tool}
        disabled={!execution.editable}
        busy={busy}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        hasSelection={Boolean(selected)}
        canGenerate={draft.acknowledged && execution.editable}
        canDownload={execution.job.phase === "complete"}
        canNote={Boolean(fontBytes)}
        onTool={setTool}
        onSignature={() => open({ kind: "signature" })}
        onUndo={history.undo}
        onRedo={history.redo}
        onDelete={history.remove}
        onGenerate={generate}
        onDownload={() => execution.downloads.download(0)}
        onReset={workspace.requestReset}
        page={page}
        count={info.pageCount}
        zoom={zoom}
        onPage={changePage}
        onZoom={setZoom}
        onGoToPage={() => open({ kind: "page" })}
        onZoomLevel={() => open({ kind: "zoom" })}
        onHighlight={() =>
          onAdd({
            id: crypto.randomUUID(),
            page,
            kind: "highlight",
            x: geometry.width * 0.25,
            y: geometry.height * 0.45,
            width: geometry.width * 0.5,
            height: Math.min(24, geometry.height * 0.1),
          })
        }
        onNote={() =>
          open({ kind: "note", position: { x: geometry.width * 0.25, y: geometry.height * 0.45 } })
        }
        onProperties={() => {
          if (selected) {
            open({ kind: "properties", object: selected });
          }
        }}
        canEditNote={selected?.kind === "note" && Boolean(fontBytes)}
        onEditNote={() => {
          if (selected?.kind === "note") {
            open({ kind: "note", position: selected, object: selected });
          }
        }}
      />
      <MarkupPage
        key={`canvas-${page}`}
        file={file}
        page={page}
        geometry={geometry}
        zoom={zoom}
        tool={tool}
        objects={history.objects.filter((object) => object.page === page)}
        selectedId={history.selectedId}
        fontBytes={fontBytes}
        disabled={!execution.editable || Boolean(dialog)}
        paused={execution.locked}
        onSelect={history.select}
        onAdd={onAdd}
        onUpdate={history.update}
        onNote={(position) => {
          if (fontBytes) {
            open({ kind: "note", position });
          }
        }}
        onBusy={onBusy}
        onAdded={() => setTool("select")}
        onError={workspace.announce}
      />
      <ObjectControls
        page={page}
        objects={history.objects}
        selected={selected}
        disabled={!execution.editable || busy}
        onSelect={history.select}
      />
      {font.state === "error" && (
        <div className="mt-4">
          <p role="alert" className="text-sm text-destructive">
            {font.message}
          </p>
          <Button variant="outline" onClick={retry}>
            Retry note font
          </Button>
        </div>
      )}
      <MarkupOutput workspace={workspace} busy={busy} onGenerate={generate} />
      {dialog?.kind === "page" && (
        <GoToPage
          page={page}
          count={info.pageCount}
          onCancel={close}
          onPage={(value) => {
            changePage(value);
            close();
          }}
        />
      )}
      {dialog?.kind === "zoom" && (
        <ZoomLevel
          zoom={zoom}
          onCancel={close}
          onZoom={(value) => {
            setZoom(value);
            close();
          }}
        />
      )}
      {dialog?.kind === "signature" && (
        <SignatureCapture
          onCancel={close}
          onUse={(strokes) => {
            let object = strokeObject("signature", strokes, crypto.randomUUID(), page);
            const scale = Math.min(
              1,
              (geometry.width * 0.6) / object.width,
              (geometry.height * 0.3) / object.height,
            );
            object = resizeMarkup(object, object.width * scale, object.height * scale);
            onAdd({
              ...object,
              x: (geometry.width - object.width) / 2,
              y: (geometry.height - object.height) / 2,
            });
            close();
          }}
        />
      )}
      {dialog?.kind === "note" && fontBytes && (
        <NoteEditor
          object={dialog.object}
          position={dialog.position}
          page={page}
          geometry={geometry}
          fontBytes={fontBytes}
          onCancel={close}
          onSave={(object) => {
            if (dialog.object) {
              history.update(object);
            } else {
              onAdd(object);
            }
            close();
          }}
        />
      )}
      {dialog?.kind === "properties" && (
        <MarkupProperties
          object={dialog.object}
          geometry={geometry}
          fontBytes={fontBytes}
          onCancel={close}
          onSave={(object) => {
            history.update(object);
            close();
          }}
        />
      )}
    </section>
  );
};
