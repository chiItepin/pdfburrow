export const WorkspaceFooter = () => (
  <footer className="py-6 text-xs leading-relaxed text-muted-foreground">
    <p className="mb-3 text-sm text-foreground">
      PDFBurrow processes your documents in this browser, without uploading them.
    </p>
    <p>
      Files stay in this tab's memory. Refreshing or closing the tab loses your work; original files
      and downloaded copies are unchanged. Browser leave warnings are best effort.
    </p>
    <p className="mt-2">
      Experimental build: provisional workload limits are enforced, but are not device-tested safety
      guarantees. Complex files may still exhaust browser memory. Offline use is not promised.
    </p>
    <div className="mt-3 flex flex-wrap gap-x-5 text-sm underline underline-offset-4 [&>a]:py-2 hover:[&>a]:text-foreground">
      <a href="https://github.com/chiItepin/pdfburrow" target="_blank" rel="noreferrer">
        Source code
      </a>
      <a href="privacy.html" target="_blank" rel="noreferrer">
        Privacy
      </a>
      <a href="notices.html" target="_blank" rel="noreferrer">
        Licenses/notices
      </a>
      <a href="limits.html" target="_blank" rel="noreferrer">
        Workload limits
      </a>
    </div>
    <p className="mt-2">These links open in a new tab without discarding your work.</p>
  </footer>
);
