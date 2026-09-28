import { useState } from "react";
import { Button } from "@repo/core-ui";
import type { SplitPlan } from "@repo/pdf-engine";

export const OutputPrediction = ({ plan }: { plan: SplitPlan }) => {
  const [windowIndex, setWindowIndex] = useState(0);
  const current = Math.min(windowIndex, Math.ceil(plan.outputCount / 8) - 1);
  const first = current * 8;
  return (
    <section className="mt-5" aria-label="Output prediction">
      <p className="font-medium">
        Output: {plan.outputCount} PDF{plan.outputCount === 1 ? "" : "s"}, {plan.totalPages} page
        {plan.totalPages === 1 ? "" : "s"} total.
      </p>
      <ol start={first + 1} className="mt-2 space-y-2 text-sm">
        {Array.from({ length: Math.min(8, plan.outputCount - first) }, (_, offset) => {
          const output = plan.outputAt(first + offset);
          return (
            <li key={output.filename} className="break-all">
              {output.filename} · {output.pageCount} page{output.pageCount === 1 ? "" : "s"}
            </li>
          );
        })}
      </ol>
      {plan.outputCount > 8 && (
        <nav aria-label="Prediction pages" className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={current === 0}
            onClick={() => setWindowIndex(current - 1)}
          >
            Previous predictions
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={first + 8 >= plan.outputCount}
            onClick={() => setWindowIndex(current + 1)}
          >
            Next predictions
          </Button>
          <span className="text-sm">
            {first + 1}-{Math.min(first + 8, plan.outputCount)} of {plan.outputCount}
          </span>
        </nav>
      )}
      {plan.repeatsPages && (
        <p className="mt-3 text-sm font-medium">
          Overlapping ranges repeat pages in the output. Pages are not deduplicated.
        </p>
      )}
    </section>
  );
};
