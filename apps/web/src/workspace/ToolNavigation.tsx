import { Button } from "@repo/core-ui";
import { routePath } from "./routes";
import type { ToolRoute } from "./routes";
import { siteBasePath } from "./site";

export const ToolNavigation = ({
  route,
  locked,
  onNavigate,
}: {
  route: ToolRoute;
  locked: boolean;
  onNavigate: (route: ToolRoute) => void;
}) => (
  <nav aria-label="PDF tools" className="mb-8 flex flex-wrap items-center gap-2">
    {(
      [
        ["home", "Home"],
        ["merge", "Merge PDFs"],
        ["split", "Split / Extract"],
        ["images", "Images to PDF"],
      ] as const
    ).map(([value, label]) => (
      <Button key={value} variant={route === value ? "secondary" : "ghost"} asChild>
        <a
          href={routePath(value, siteBasePath)}
          aria-current={route === value ? "page" : undefined}
          aria-disabled={locked}
          className="aria-disabled:opacity-50"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
              return;
            }
            event.preventDefault();
            onNavigate(value);
          }}
        >
          {label}
        </a>
      </Button>
    ))}
  </nav>
);
