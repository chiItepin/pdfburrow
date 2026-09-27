import { useEffect, useMemo, useRef, useState } from "react";
import { PageFrame } from "@repo/core-ui/components/page-frame";
import { ConfirmDiscard } from "@repo/core-ui/components/confirm-discard";
import { Button } from "@repo/core-ui/primitives/button";
import type { PdfInfo, PdfOutput, PdfProgress } from "@repo/pdf-engine/types";
import { usePreviews } from "./use-previews";

type Input = { id: string; name: string; size: number } & (
  | { status: "pending" }
  | { status: "ready"; info: PdfInfo }
  | { status: "error"; message: string }
);
type Job =
  | { phase: "editing" | "cancelled" | "cancelling" }
  | { phase: "complete"; filename: string; bytes: number }
  | { phase: "processing"; progress?: PdfProgress }
  | { phase: "error"; message: string };

const windowSize = 8;

function createRegistry() {
  const files = new Map<string, File>();
  return {
    get: (id: string) => files.get(id),
    retain: (id: string, file: File) => { files.set(id, file); },
    release: (id: string) => { files.delete(id); },
    releaseAll: () => { files.clear(); },
  };
}

export function App() {
  const files = useMemo(() => createRegistry(), []);
  const [inputs, setInputs] = useState<Input[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [job, setJob] = useState<Job>({ phase: "editing" });
  const [notice, setNotice] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [confirmation, setConfirmation] = useState<"reset" | "edit" | null>(null);
  const [windowIndex, setWindowIndex] = useState(0);
  const filePicker = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const draftHeading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const jobError = useRef<HTMLParagraphElement>(null);
  const jobController = useRef<AbortController | null>(null);
  const result = useRef<(PdfOutput & { url?: string; requested: boolean }) | null>(null);
  const locked = job.phase === "processing" || job.phase === "cancelling";
  const editable = !locked && job.phase !== "complete";
  const validationId = inputs.find((input) => input.status === "pending")?.id;
  const ready = inputs.length > 0 && inputs.every((input) => input.status === "ready");
  const pageCount = inputs.reduce((sum, input) => sum + (input.status === "ready" ? input.info.pageCount : 0), 0);
  const maxWindow = Math.max(0, Math.ceil(inputs.length / windowSize) - 1);
  const currentWindow = Math.min(windowIndex, maxWindow);
  const visible = inputs.slice(currentWindow * windowSize, (currentWindow + 1) * windowSize);
  const previews = usePreviews(visible.filter((input) => input.status === "ready").map((input) => input.id), files.get, locked);
  const capable = typeof Worker !== "undefined" && typeof Blob.prototype.arrayBuffer === "function"
    && typeof crypto.randomUUID === "function";

  useEffect(() => {
    if (!validationId) return;
    const file = files.get(validationId);
    if (!file) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const { validatePdf } = await import("@repo/pdf-engine/merge");
        if (controller.signal.aborted) return;
        const outcome = await validatePdf({ id: validationId, name: file.name, blob: file }, { signal: controller.signal });
        if (controller.signal.aborted || outcome.kind === "cancelled") return;
        setInputs((current) => current.map((input) => input.id !== validationId ? input
          : outcome.kind === "success" ? { ...input, status: "ready", info: outcome.value }
            : { ...input, status: "error", message: outcome.message }));
        setNotice(outcome.kind === "success" ? `${file.name}: PDF validation finished.` : `${file.name} needs attention. Retry validation or remove this file.`);
      } catch {
        if (!controller.signal.aborted) setInputs((current) => current.map((input) => input.id === validationId
          ? { ...input, status: "error", message: "The local PDF engine could not load. Retry validation or reload after saving your work elsewhere." } : input));
      }
    })();
    return () => controller.abort();
  }, [validationId, files]);

  useEffect(() => {
    if (!inputs.length) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [inputs.length]);

  useEffect(() => {
    if (job.phase === "complete") resultHeading.current?.focus();
    if (job.phase === "cancelled") draftHeading.current?.focus();
    if (job.phase === "error") jobError.current?.focus();
  }, [job.phase]);

  useEffect(() => () => {
    jobController.current?.abort();
    if (result.current?.url) URL.revokeObjectURL(result.current.url);
  }, []);

  function clearResult() {
    if (result.current?.url) URL.revokeObjectURL(result.current.url);
    result.current = null;
    setDownloadError("");
  }

  function addFiles(added: FileList | readonly File[]) {
    if (!editable || !capable) return;
    const rows = Array.from(added, (file): Input => {
      const id = crypto.randomUUID();
      files.retain(id, file);
      return { id, name: file.name, size: file.size, status: "pending" };
    });
    if (!rows.length) return;
    setInputs((current) => [...current, ...rows]);
    setAcknowledged(false);
    setJob({ phase: "editing" });
    setNotice(`${rows.length} file${rows.length === 1 ? "" : "s"} added. Checking PDFs locally.`);
  }

  function remove(id: string) {
    const index = inputs.findIndex((input) => input.id === id);
    const remaining = inputs.filter((input) => input.id !== id);
    const next = remaining[Math.min(index, remaining.length - 1)];
    files.release(id);
    setInputs(remaining);
    setAcknowledged(false);
    setJob({ phase: "editing" });
    setNotice("File removed.");
    setWindowIndex(Math.floor(Math.max(0, Math.min(index, remaining.length - 1)) / windowSize));
    requestAnimationFrame(() => next ? document.getElementById(`remove-${next.id}`)?.focus() : addButton.current?.focus());
  }

  function move(id: string, target: number, control: "up" | "down" = "up") {
    if (!editable || target < 0 || target >= inputs.length) return;
    const reordered = [...inputs];
    const index = reordered.findIndex((input) => input.id === id);
    if (index < 0) return;
    const [input] = reordered.splice(index, 1);
    reordered.splice(target, 0, input!);
    setInputs(reordered);
    setJob({ phase: "editing" });
    setWindowIndex(Math.floor(target / windowSize));
    setNotice(`${input!.name} moved to position ${target + 1} of ${inputs.length}.`);
    requestAnimationFrame(() => document.getElementById(`${control}-${id}`)?.focus());
  }

  async function merge() {
    if (jobController.current || !ready || !acknowledged || !editable) return;
    const controller = new AbortController();
    jobController.current = controller;
    setJob({ phase: "processing" });
    setNotice("");
    try {
      const { mergePdfs } = await import("@repo/pdf-engine/merge");
      if (controller.signal.aborted) { setJob({ phase: "cancelled" }); return; }
      const outcome = await mergePdfs({
        acknowledged,
        inputs: inputs.map((input) => ({ id: input.id, name: input.name, blob: files.get(input.id)! })),
      }, {
        signal: controller.signal,
        onProgress: (progress) => { if (!controller.signal.aborted) setJob({ phase: "processing", progress }); },
      });
      if (outcome.kind === "cancelled" || controller.signal.aborted) setJob({ phase: "cancelled" });
      else if (outcome.kind === "failure") setJob({ phase: "error", message: outcome.message });
      else {
        result.current = { ...outcome.value, requested: false };
        setJob({ phase: "complete", filename: outcome.value.suggestedFilename, bytes: outcome.value.blob.size });
      }
    } catch {
      setJob(controller.signal.aborted ? { phase: "cancelled" }
        : { phase: "error", message: "The merge engine could not load or finish. Your inputs are retained. Retry, or try fewer files." });
    } finally {
      if (jobController.current === controller) jobController.current = null;
    }
  }

  function cancel() {
    setJob({ phase: "cancelling" });
    jobController.current?.abort();
  }

  function discard(action: "reset" | "edit") {
    clearResult();
    if (action === "reset") {
      files.releaseAll();
      setInputs([]);
      setAcknowledged(false);
      setWindowIndex(0);
    }
    setJob({ phase: "editing" });
    setNotice(action === "reset" ? "Workspace cleared. Original files are unchanged." : "Editing inputs. Previous output cleared.");
    setConfirmation(null);
    requestAnimationFrame(() => action === "reset" ? addButton.current?.focus() : draftHeading.current?.focus());
  }

  function download() {
    const output = result.current;
    if (!output) return;
    const anchor = document.createElement("a");
    try {
      output.url ??= URL.createObjectURL(output.blob);
      anchor.href = output.url;
      anchor.download = output.suggestedFilename;
      document.body.append(anchor);
      anchor.click();
      output.requested = true;
      setDownloadError("");
      setNotice("Download requested. Check your browser's downloads; this does not confirm the file was saved.");
    } catch {
      setDownloadError("The download could not be requested. The merged PDF is still available; try Download PDF again.");
    } finally {
      anchor.remove();
    }
  }

  const status = job.phase === "processing"
    ? job.progress?.phase === "copying" ? `Copied ${job.progress.completed} pages...`
      : job.progress?.phase === "saving" ? "Saving the merged PDF..."
        : job.progress ? `Checking input ${job.progress.completed + 1} of ${job.progress.total}...` : "Starting the local merge worker..."
    : job.phase === "cancelling" ? "Cancelling. Waiting for the worker to stop..."
      : job.phase === "cancelled" ? "Merge cancelled. Your inputs and order are unchanged."
        : notice;

  return (
    <PageFrame>
      <header className="border-b pb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">PDFBurrow</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Merge PDFs</h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          Combine PDFs in the order you choose. Processing happens in this browser, without uploading your documents.
        </p>
      </header>

      {!capable && <p role="alert" className="my-4 text-destructive">This browser cannot run the local PDF worker. Use a current browser with module workers and local file support.</p>}
      <section aria-labelledby="draft-heading" className="py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="draft-heading" ref={draftHeading} tabIndex={-1} className="text-xl font-semibold">Your PDFs</h2>
          <Button variant="ghost" disabled={locked || !inputs.length} onClick={() => setConfirmation("reset")}>Start over</Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Whole files are merged in displayed order. Page sizes and rotations are kept.</p>
        <div className="my-5 rounded-lg border-2 border-dashed bg-white p-6"
          onDragOver={(event) => { event.preventDefault(); }}
          onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}>
          <input ref={filePicker} type="file" accept=".pdf,application/pdf" multiple className="hidden"
            aria-label="Choose PDF files" disabled={!editable || !capable}
            onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
          <Button ref={addButton} disabled={!editable || !capable} onClick={() => filePicker.current?.click()}>Add PDFs</Button>
          <p className="mt-3 text-sm text-muted-foreground">Or drop PDF files here. Encrypted PDFs, interactive forms, and digital signatures are not supported.</p>
        </div>

        <ol className="space-y-3" start={currentWindow * windowSize + 1} aria-label="PDF merge order">
          {visible.map((input, offset) => {
            const index = currentWindow * windowSize + offset;
            const thumbnail = previews.get(input.id);
            return (
              <li key={input.id} className="rounded-lg border bg-white p-4" draggable={editable}
                onDragStart={(event) => event.dataTransfer.setData("application/x-pdfburrow", input.id)}
                onDragOver={(event) => { if (editable) event.preventDefault(); }}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData("application/x-pdfburrow");
                  if (id) move(id, index);
                }}>
                <div className="flex gap-4">
                  <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded border bg-muted p-1">
                    {thumbnail?.url ? <img src={thumbnail.url} alt={`First page of ${input.name}`} className="max-h-full max-w-full" />
                      : <span className="text-center text-xs text-muted-foreground">{thumbnail?.error ? "Preview unavailable" : "PDF"}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-all font-semibold">{index + 1}. {input.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {(input.size / 1024).toFixed(1)} KB
                      {input.status === "ready" && ` · ${input.info.pageCount} page${input.info.pageCount === 1 ? "" : "s"}`}
                      {input.status === "pending" && (input.id === validationId ? " · Checking PDF..." : " · Waiting for validation...")}
                    </p>
                    {input.status === "error" && <p className="mt-2 text-sm text-destructive">{input.message}</p>}
                    {input.status === "ready" && input.info.warnings.map((warning) => <p key={warning} className="mt-2 text-sm">{warning}</p>)}
                    {thumbnail?.error && <p className="mt-2 text-sm text-muted-foreground">{thumbnail.error}</p>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button id={`up-${input.id}`} variant="outline" disabled={!editable} aria-disabled={index === 0}
                    aria-label={`Move ${input.name} up`} onClick={() => move(input.id, index - 1, "up")}>Move up</Button>
                  <Button id={`down-${input.id}`} variant="outline" disabled={!editable} aria-disabled={index === inputs.length - 1}
                    aria-label={`Move ${input.name} down`} onClick={() => move(input.id, index + 1, "down")}>Move down</Button>
                  <Button id={`remove-${input.id}`} variant="ghost" disabled={!editable} aria-label={`Remove ${input.name}`}
                    onClick={() => remove(input.id)}>Remove</Button>
                  {input.status === "error" && <Button variant="outline" aria-label={`Retry validation of ${input.name}`}
                    onClick={() => setInputs((current) => current.map((row) => row.id === input.id ? { ...row, status: "pending" } : row))}>Retry validation</Button>}
                </div>
              </li>
            );
          })}
        </ol>
        {maxWindow > 0 && <nav aria-label="Input list pages" className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={currentWindow === 0} onClick={() => setWindowIndex(currentWindow - 1)}>Previous files</Button>
          <span className="text-sm">Files {currentWindow * windowSize + 1}-{Math.min(inputs.length, (currentWindow + 1) * windowSize)} of {inputs.length}</span>
          <Button variant="outline" disabled={currentWindow === maxWindow} onClick={() => setWindowIndex(currentWindow + 1)}>Next files</Button>
        </nav>}
        {inputs.length > 0 && <fieldset disabled={!editable} className="mt-6 rounded-lg border p-4">
          <legend className="px-1 font-semibold">Before you merge</legend>
          <p className="mb-3 text-sm">This is a page-focused rewrite, not a lossless copy. Annotations and visible marks may change or disappear.
            Bookmarks, attachments, metadata, accessibility tags, and PDF/A guarantees are not preserved. Feature detection is not exhaustive.</p>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={acknowledged} className="mt-1 size-4 shrink-0 accent-primary"
              onChange={(event) => setAcknowledged(event.target.checked)} />
            <span className="text-sm">I understand these limitations for the current PDF inputs.</span>
          </label>
        </fieldset>}
        <p className="mt-4 text-sm">
          {ready ? `Output: one PDF, ${pageCount} page${pageCount === 1 ? "" : "s"}, in the order above.`
            : inputs.length ? "Resolve input errors and wait for validation before merging." : "Add PDFs to get started."}
        </p>
        {job.phase !== "complete" && <div className="mt-4 flex flex-wrap gap-3">
          <Button size="lg" disabled={!ready || !acknowledged || locked || !capable} onClick={() => void merge()}>
            {job.phase === "error" ? "Retry merge" : "Merge PDFs"}
          </Button>
          {locked && <Button size="lg" variant="outline" disabled={job.phase === "cancelling"} onClick={cancel}>Cancel merge</Button>}
        </div>}
        <p role="status" aria-live="polite" className="mt-4 min-h-6 text-sm">{status}</p>
        {job.phase === "error" && <p ref={jobError} tabIndex={-1} role="alert" className="mt-3 text-destructive">{job.message}</p>}
      </section>

      {job.phase === "complete" && <section aria-labelledby="result-heading" className="mb-8 rounded-lg border bg-secondary p-6">
        <h2 id="result-heading" ref={resultHeading} tabIndex={-1} className="text-xl font-semibold">Your merged PDF is ready</h2>
        <p className="mt-2 break-all">{job.filename}</p>
        <p className="mt-1 text-sm">{pageCount} pages · {(job.bytes / 1024).toFixed(1)} KB</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={download}>Download PDF</Button>
          <Button variant="outline" onClick={() => result.current?.requested ? discard("edit") : setConfirmation("edit")}>Edit inputs</Button>
        </div>
        {downloadError && <p role="alert" className="mt-3 text-destructive">{downloadError}</p>}
      </section>}

      <footer className="border-t pt-6 text-sm leading-relaxed text-muted-foreground">
        <p>Files stay in this tab's memory. Refreshing or closing the tab loses your work; original files are unchanged.</p>
        <p className="mt-2">Development build: browser coverage and safe workload limits are not yet calibrated. Large or complex PDFs may exhaust browser memory.
          Split and image conversion are not included.</p>
        <a className="mt-3 inline-block text-primary underline" href="https://github.com/chiItepin/pdfburrow" target="_blank" rel="noreferrer">Source code</a>
      </footer>
      <ConfirmDiscard open={confirmation !== null}
        description={confirmation === "edit" ? "The merged PDF has not had a download requested. Editing clears that output."
          : "This clears the current inputs and output from this tab. Original files and downloaded copies are unchanged."}
        onKeep={() => setConfirmation(null)} onDiscard={() => { if (confirmation) discard(confirmation); }} />
    </PageFrame>
  );
}
