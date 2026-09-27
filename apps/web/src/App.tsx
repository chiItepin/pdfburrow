import { PageFrame } from "@repo/core-ui";
import { MergeWorkspace } from "./merge";

export const App = () => (
  <PageFrame>
    <header className="border-b pb-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">PDFBurrow</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Merge PDFs</h1>
      <p className="mt-3 max-w-prose text-muted-foreground">
        Combine PDFs in the order you choose. Processing happens in this browser, without uploading
        your documents.
      </p>
    </header>
    <MergeWorkspace />
    <footer className="border-t pt-6 text-sm leading-relaxed text-muted-foreground">
      <p>
        Files stay in this tab's memory. Refreshing or closing the tab loses your work; original
        files are unchanged.
      </p>
      <p className="mt-2">
        Development build: browser coverage and safe workload limits are not yet calibrated. Large
        or complex PDFs may exhaust browser memory. Split and image conversion are not included.
      </p>
      <a
        className="mt-3 inline-block text-primary underline"
        href="https://github.com/chiItepin/pdfburrow"
        target="_blank"
        rel="noreferrer"
      >
        Source code
      </a>
    </footer>
  </PageFrame>
);
