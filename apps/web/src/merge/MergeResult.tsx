import type { Ref } from "react";
import { Button } from "@repo/core-ui";
import { OutputDownloads } from "../workspace/OutputDownloads";
import type { useDownloads } from "../workspace/useDownloads";

interface MergeResultProps {
  pageCount: number;
  headingRef: Ref<HTMLHeadingElement>;
  downloads: ReturnType<typeof useDownloads>;
  onEdit: () => void;
}

export const MergeResult = ({ pageCount, headingRef, downloads, onEdit }: MergeResultProps) => (
  <section aria-labelledby="result-heading" className="mb-8 rounded-lg border bg-secondary p-6">
    <h2 id="result-heading" ref={headingRef} tabIndex={-1} className="text-xl font-semibold">
      Your merged PDF is ready
    </h2>
    <p className="mt-1 text-sm">
      {pageCount} page{pageCount === 1 ? "" : "s"}
    </p>
    <OutputDownloads downloads={downloads} />
    <div className="mt-4 flex flex-wrap gap-3">
      <Button variant="outline" onClick={onEdit}>
        Edit inputs
      </Button>
    </div>
  </section>
);
