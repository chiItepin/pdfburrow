import { Button } from "@repo/core-ui";
import { routeHash } from "./routes";
import type { ToolRoute } from "./routes";

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
        ["images", "Images to PDF (not available)"],
      ] as const
    ).map(([value, label]) => (
      <Button key={value} variant={route === value ? "secondary" : "ghost"} asChild>
        <a
          href={routeHash(value)}
          aria-current={route === value ? "page" : undefined}
          aria-disabled={locked}
          className="aria-disabled:opacity-50"
          onClick={(event) => {
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
