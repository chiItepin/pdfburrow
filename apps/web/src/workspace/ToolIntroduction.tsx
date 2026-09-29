import { Button } from "@repo/core-ui";
import { ArrowUpRight } from "lucide-react";
import type { ToolRoute } from "./routes";
import { tools } from "./tools";

export const ToolIntroduction = ({
  route,
  onNavigate,
}: {
  route: Exclude<ToolRoute, "merge" | "split" | "images">;
  onNavigate: (route: ToolRoute) => void;
}) => (
  <section className="max-w-3xl py-10 sm:py-12" aria-label="Tool availability">
    <h2 className="text-2xl font-semibold tracking-tight">
      {route === "home" ? "Choose a PDF tool" : "Choose an available tool"}
    </h2>
    <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
      {route === "home"
        ? "Combine local PDFs, split and extract pages, or turn JPEG and PNG images into PDFs. Free to use, with no signup."
        : "This address does not identify a PDFBurrow tool. No documents or settings can be restored from a link."}
    </p>
    <div className="mt-8 divide-y border-y">
      {tools.map(({ route: value, label, description, icon: Icon }) => (
        <Button
          key={value}
          variant="ghost"
          className="h-auto w-full justify-start gap-4 rounded-none px-2 py-6 text-left whitespace-normal sm:gap-5"
          aria-label={`Open ${label}`}
          onClick={() => onNavigate(value)}
        >
          <Icon className="size-5! text-primary" strokeWidth={1.5} aria-hidden="true" />
          <span className="flex-1">
            <span className="block text-base font-medium">{label}</span>
            <span className="mt-1 block text-sm leading-relaxed font-normal text-muted-foreground">
              {description}
            </span>
          </span>
          <ArrowUpRight className="text-muted-foreground" aria-hidden="true" />
        </Button>
      ))}
    </div>
    <p className="mt-6 max-w-prose text-sm leading-relaxed text-muted-foreground">
      Choose a tool before adding files. Switching tools clears your current work only after you
      confirm.
    </p>
  </section>
);
