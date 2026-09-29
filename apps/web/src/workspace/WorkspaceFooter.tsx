import { siteBasePath } from "./site";

export const WorkspaceFooter = () => (
  <footer className="border-t pt-6 text-sm leading-relaxed text-muted-foreground">
    <p>
      Files stay in this tab's memory. Refreshing or closing the tab loses your work; original files
      and downloaded copies are unchanged. Browser leave warnings are best effort.
    </p>
    <p className="mt-2">
      Development build: browser coverage and safe workload limits are not yet calibrated. Large or
      complex files may exhaust browser memory. Offline use is not promised.
    </p>
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3 text-primary underline">
      <a href="https://github.com/chiItepin/pdfburrow" target="_blank" rel="noreferrer">
        Source code
      </a>
      <a href={`${siteBasePath}privacy.html`} target="_blank" rel="noreferrer">
        Privacy
      </a>
      <a href={`${siteBasePath}notices.html`} target="_blank" rel="noreferrer">
        Licenses/notices
      </a>
    </div>
    <p className="mt-2">These links open in a new tab without discarding your work.</p>
  </footer>
);
