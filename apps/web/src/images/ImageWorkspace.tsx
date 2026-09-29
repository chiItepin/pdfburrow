import { Button, ConfirmDiscard, FileDropzone, Progress, Spinner } from "@repo/core-ui";
import { InputList } from "../workspace/InputList";
import { OutputDownloads } from "../workspace/OutputDownloads";
import { renderImagePreview } from "../workspace/previewRenderers";
import type { useDocumentWorkspace } from "../workspace/useDocumentWorkspace";
import { usePreviews } from "../workspace/usePreviews";
import { ImageSettings } from "./ImageSettings";
import { useImageJob } from "./useImageJob";
import { ToolSettingsSidebar } from "../workspace/ToolSettingsSidebar";

export const ImageWorkspace = ({
  workspace,
}: {
  workspace: ReturnType<typeof useDocumentWorkspace>;
}) => {
  const { draft, execution, focus, confirmation } = workspace;
  const { draftHeading, resultHeading, jobError } = focus;
  const { job, locked, editable } = execution;
  const images = useImageJob(workspace);
  const previews = usePreviews(
    draft.visible.filter((input) => input.status === "ready").map((input) => input.id),
    draft.files.get,
    locked,
    renderImagePreview,
  );
  return (
    <>
      {!images.capable && (
        <p role="alert" className="my-4 text-destructive">
          This browser cannot convert images locally. Use a current browser with module workers,
          image bitmap decoding, and offscreen canvas support. No files will be uploaded.
        </p>
      )}
      <section aria-labelledby="draft-heading" className="py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="draft-heading" ref={draftHeading} tabIndex={-1} className="text-xl font-semibold">
            Your images
          </h2>
          <Button
            variant="ghost"
            disabled={locked || !draft.inputs.length}
            onClick={workspace.requestReset}
          >
            Start over
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          One image per page, in displayed order. Orientation metadata is applied before your
          rotations. Thumbnails show image direction and white backgrounds, not paper margins.
        </p>
        <div className="mt-6">
          <div className="min-w-0">
            <FileDropzone
              regionLabel="Add image files"
              inputLabel="Choose JPEG or PNG images"
              label="Add images"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              disabled={!editable || !images.capable}
              buttonRef={draft.addButton}
              onAddFiles={(files) => workspace.addFiles(files, "image")}
            >
              <p className="mt-3 text-sm text-muted-foreground">
                Or drop static JPEG or PNG images here. Your originals stay on your device and are
                not changed.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Animated PNG, HEIC, WebP, and TIFF are not supported.
              </p>
            </FileDropzone>
            <InputList
              draft={draft}
              editable={editable}
              previews={previews.thumbnails}
              previewsPaused={locked}
              retryPreview={previews.retry}
              moveFile={workspace.moveFile}
              removeFile={images.removeFile}
              rotations={images.rotations}
              rotateFile={images.rotateFile}
            />
          </div>
          <section className="tool-actions" aria-label="Image output">
            <p className="mt-4 text-sm">
              {draft.ready && images.names
                ? images.names.filenames.length === 1
                  ? `Output: ${images.names.filenames[0]}, ${draft.inputs.length} page${draft.inputs.length === 1 ? "" : "s"}.`
                  : `Output: ${images.names.filenames.length} one-page PDFs, in the order above.`
                : draft.inputs.length
                  ? "Resolve input errors and wait for validation before converting."
                  : "Add images to get started."}
            </p>
            {job.phase !== "complete" && (
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  disabled={!draft.ready || locked || !images.capable}
                  onClick={images.generate}
                >
                  {job.phase === "error" ? "Retry conversion" : "Convert to PDF"}
                </Button>
                {locked && (
                  <Button
                    size="lg"
                    variant="outline"
                    disabled={job.phase === "cancelling"}
                    onClick={execution.cancel}
                  >
                    Cancel conversion
                  </Button>
                )}
              </div>
            )}
            {images.progress?.phase === "converting" && (
              <Progress
                className="mt-4"
                aria-label="Images converted"
                value={images.progress.completed}
                max={images.progress.total}
              />
            )}
            <p
              role="status"
              aria-label="Image conversion status"
              className="mt-4 flex min-h-6 items-center gap-2 text-sm"
            >
              {locked && <Spinner aria-hidden="true" />}
              {images.status}
            </p>
            {job.phase === "error" && (
              <p ref={jobError} tabIndex={-1} role="alert" className="mt-3 text-destructive">
                {job.message}
              </p>
            )}
          </section>
          <ToolSettingsSidebar title="Image PDF settings">
            <ImageSettings
              settings={images.settings}
              disabled={!editable}
              onChange={images.changeSettings}
            />
          </ToolSettingsSidebar>
        </div>
      </section>
      {job.phase === "complete" && images.names && (
        <section
          aria-labelledby="result-heading"
          className="mb-8 rounded-lg border bg-secondary p-6"
        >
          <h2
            id="result-heading"
            ref={resultHeading}
            tabIndex={-1}
            className="text-xl font-semibold"
          >
            Your image PDFs are ready
          </h2>
          <p className="mt-1 text-sm">
            {images.names.filenames.length} PDF{images.names.filenames.length === 1 ? "" : "s"}{" "}
            generated. Choose a download to save your work.
          </p>
          <OutputDownloads downloads={execution.downloads} bundleName={images.names.bundleName} />
          <Button
            className="mt-4"
            variant="outline"
            disabled={execution.downloads.busy}
            onClick={workspace.requestEdit}
          >
            Edit images and settings
          </Button>
        </section>
      )}
      <ConfirmDiscard
        open={confirmation !== null}
        description={
          confirmation === "edit"
            ? "Some outputs have not had a download requested. Editing clears all generated outputs."
            : "This clears the images, settings, and outputs from this tab. Original files and downloaded copies are unchanged."
        }
        onKeep={workspace.keepWorking}
        onDiscard={workspace.confirmDiscard}
      />
    </>
  );
};
