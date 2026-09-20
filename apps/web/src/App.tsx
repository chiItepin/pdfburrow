import { useEffect, useRef, useState } from "react";
import { PageFrame } from "@repo/core-ui/components/page-frame";
import { Button } from "@repo/core-ui/primitives/button";

type CheckState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "ready" }
  | { phase: "failed"; message: string };

export function App() {
  const [check, setCheck] = useState<CheckState>({ phase: "idle" });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function runCheck() {
    if (controller.current) return;
    const active = new AbortController();
    controller.current = active;
    setCheck({ phase: "checking" });
    try {
      const { checkWorker } = await import("@repo/pdf-engine/diagnostics");
      await checkWorker(active.signal);
      if (!active.signal.aborted) setCheck({ phase: "ready" });
    } catch (error) {
      if (!active.signal.aborted) {
        setCheck({
          phase: "failed",
          message: error instanceof Error ? error.message : "The worker check failed. Please retry.",
        });
      }
    } finally {
      if (controller.current === active) controller.current = null;
    }
  }

  return (
    <PageFrame>
      <header className="border-b pb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">PDFBurrow</h1>
        <p className="mt-3 max-w-prose text-lg text-muted-foreground">
          A foundation for on-device PDF tools.
        </p>
      </header>
      <section aria-labelledby="workspace-heading" className="py-8">
        <h2 id="workspace-heading" className="text-xl font-semibold">Workspace foundation</h2>
        <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
          This development screen connects the shared interface and a local worker.
          Merge, split, and image conversion are not available yet.
        </p>
        <div className="mt-6">
          <Button onClick={() => void runCheck()} disabled={check.phase === "checking"}>
            {check.phase === "checking" ? "Checking worker..." : "Check local worker"}
          </Button>
        </div>
        <p role="status" aria-live="polite" className="mt-4 min-h-12 text-sm leading-relaxed">
          {check.phase === "idle" && "The check does not open or process any files."}
          {check.phase === "checking" && "Loading a worker from this site..."}
          {check.phase === "ready" && "Local worker responded. No documents were processed."}
          {check.phase === "failed" && check.message}
        </p>
      </section>
      <footer className="border-t pt-6 text-sm text-muted-foreground">
        Development foundation, not a released PDF editor.
      </footer>
    </PageFrame>
  );
}
