import { getPage, pageFilename, pagePath, pageRegistry } from "./pageRegistry.ts";
import type { ReactPage } from "./pageRegistry.ts";

export type ToolRoute = ReactPage["route"];

export const routePath = (route: ToolRoute, basePath: string) => pagePath(getPage(route), basePath);

const toolPages = pageRegistry.filter((page) => page.source === "react");

export const readRoute = (
  { pathname, hash }: { readonly pathname: string; readonly hash: string },
  basePath: string,
): ToolRoute => {
  // Old bookmarks and manually edited hashes still pass through the discard guard.
  if (hash && hash !== "#") {
    return toolPages.find((page) => page.legacyHash === hash)?.route ?? "not-found";
  }
  for (const page of toolPages) {
    const path = pagePath(page, basePath);
    if (
      pathname === path ||
      pathname === `${basePath}${pageFilename(page)}` ||
      (page.path.endsWith("/") && pathname === path.slice(0, -1))
    ) {
      return page.route;
    }
  }
  return "not-found";
};

export const routeTitles: Record<ToolRoute, string> = {
  home: "Home",
  markup: "Sign & annotate PDF",
  merge: "Merge PDFs",
  split: "Split / Extract",
  remove: "Remove pages",
  images: "Images to PDF",
  "not-found": "Tool not found",
};
