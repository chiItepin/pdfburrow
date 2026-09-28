import { useState } from "react";
import { createRoot } from "react-dom/client";
import { OutputDownloads } from "../../src/workspace/OutputDownloads";
import { useDocumentJob } from "../../src/workspace/useDocumentJob";

declare global {
  interface Window {
    fixtureOutputs: { bytes: number[]; filename: string }[];
  }
}

const Fixture = () => {
  const [notice, announce] = useState("");
  const execution = useDocumentJob(announce);
  return (
    <main>
      <button
        disabled={!execution.editable}
        onClick={() =>
          void execution.start(async () => ({
            kind: "success",
            value: window.fixtureOutputs.map((output) => ({
              blob: new Blob([new Uint8Array(output.bytes)], { type: "application/pdf" }),
              suggestedFilename: output.filename,
            })),
          }))
        }
      >
        Generate fixture outputs
      </button>
      <button disabled={execution.locked} onClick={execution.editDraft}>
        Clear fixture outputs
      </button>
      <p data-testid="job-phase">{execution.job.phase}</p>
      <p data-testid="notice">{notice}</p>
      <p data-testid="needs-download">{String(execution.downloads.needsDownload())}</p>
      <OutputDownloads downloads={execution.downloads} bundleName="report-split.zip" />
    </main>
  );
};

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing fixture root.");
}
createRoot(root).render(<Fixture />);
