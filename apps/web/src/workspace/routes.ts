export type ToolRoute = "home" | "merge" | "split" | "images" | "not-found";

export const routePath = (route: ToolRoute, basePath: string) =>
  `${basePath}${route === "home" ? "" : route === "not-found" ? "404.html" : `${route}/`}`;

export const readRoute = (
  { pathname, hash }: { readonly pathname: string; readonly hash: string },
  basePath: string,
): ToolRoute => {
  // Old bookmarks and manually edited hashes still pass through the discard guard.
  if (hash && hash !== "#") {
    switch (hash) {
      case "#/":
        return "home";
      case "#/merge":
        return "merge";
      case "#/split":
        return "split";
      case "#/images":
        return "images";
      default:
        return "not-found";
    }
  }
  if (pathname === basePath || pathname === `${basePath}index.html`) {
    return "home";
  }
  for (const route of ["merge", "split", "images"] as const) {
    const path = routePath(route, basePath);
    if (pathname === path || pathname === path.slice(0, -1) || pathname === `${path}index.html`) {
      return route;
    }
  }
  return "not-found";
};

export const routeTitles: Record<ToolRoute, string> = {
  home: "PDF tools that run on your device. No uploads.",
  merge: "Merge PDFs",
  split: "Split / Extract",
  images: "Images to PDF",
  "not-found": "Tool not found",
};
