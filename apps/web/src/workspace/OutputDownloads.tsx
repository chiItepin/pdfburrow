import { useEffect, useRef, useState } from "react";
import { Button, Progress, Spinner } from "@repo/core-ui";
import type { useDownloads } from "./useDownloads";

export const OutputDownloads = ({
  downloads,
  bundleName,
}: {
  downloads: ReturnType<typeof useDownloads>;
  bundleName?: string;
}) => {
  const [windowIndex, setWindowIndex] = useState(0);
  const zipButton = useRef<HTMLButtonElement>(null);
  const { outputs, packaging } = downloads;
  const lastWindow = Math.max(0, Math.ceil(outputs.length / 8) - 1);
  const first = Math.min(windowIndex, lastWindow) * 8;
  useEffect(() => {
    if (packaging.phase === "ready" || packaging.phase === "idle") {
      zipButton.current?.focus();
    }
  }, [packaging.phase]);
  return (
    <>
      <div className="mt-4 space-y-4">
        {outputs.slice(first, first + 8).map((output, offset) => (
          <div key={output.filename}>
            <p className="break-all">{output.filename}</p>
            <p className="mt-1 text-sm">{(output.bytes / 1024).toFixed(1)} KB</p>
            <Button
              className="mt-2"
              disabled={downloads.busy}
              aria-label={outputs.length === 1 ? "Download PDF" : `Download ${output.filename}`}
              onClick={() => downloads.download(first + offset)}
            >
              Download PDF
            </Button>
          </div>
        ))}
      </div>
      {lastWindow > 0 && (
        <nav aria-label="Output list pages" className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            disabled={first === 0 || downloads.busy}
            onClick={() => setWindowIndex(Math.max(0, windowIndex - 1))}
          >
            Previous outputs
          </Button>
          <span>
            {first + 1}-{Math.min(first + 8, outputs.length)} of {outputs.length}
          </span>
          <Button
            variant="outline"
            disabled={first / 8 === lastWindow || downloads.busy}
            onClick={() => setWindowIndex(windowIndex + 1)}
          >
            Next outputs
          </Button>
        </nav>
      )}
      {outputs.length > 1 && bundleName && (
        <div className="mt-5">
          <Button
            ref={zipButton}
            disabled={downloads.busy}
            onClick={() =>
              packaging.phase === "ready"
                ? downloads.download()
                : void downloads.prepareBundle(bundleName)
            }
          >
            {downloads.busy && <Spinner aria-hidden="true" />}
            {packaging.phase === "ready" ? "Download ZIP" : "Prepare ZIP for all PDFs"}
          </Button>
          {packaging.phase === "ready" && (
            <p className="mt-2 break-all text-sm">
              {packaging.filename} · {(packaging.bytes / 1024).toFixed(1)} KB
            </p>
          )}
          {downloads.busy && (
            <>
              {packaging.phase === "packaging" && packaging.progress && (
                <Progress
                  className="mt-3"
                  aria-label="PDFs packaged"
                  value={packaging.progress.completed}
                  max={packaging.progress.total}
                  aria-valuetext={`${packaging.progress.completed} of ${packaging.progress.total} PDFs packaged`}
                />
              )}
              <p role="status" className="mt-2">
                {packaging.phase === "cancelling"
                  ? "Cancelling. Waiting for the ZIP worker to stop..."
                  : packaging.phase === "packaging" && packaging.progress
                    ? `Packaged ${packaging.progress.completed} of ${packaging.progress.total} PDFs...`
                    : "Preparing ZIP locally..."}
              </p>
              <Button
                variant="outline"
                className="mt-2"
                disabled={packaging.phase === "cancelling"}
                onClick={downloads.cancel}
              >
                Cancel ZIP preparation
              </Button>
            </>
          )}
          <p className="mt-2 text-sm">
            Preparing a ZIP does not start a download. Your PDFs remain available if preparation
            fails or is cancelled.
          </p>
        </div>
      )}
      {downloads.error && (
        <p role="alert" className="mt-3 text-destructive">
          {downloads.error}
        </p>
      )}
    </>
  );
};
