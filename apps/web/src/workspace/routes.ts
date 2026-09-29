export type ToolRoute = "home" | "merge" | "split" | "images" | "not-found";

export const routeHash = (route: ToolRoute) => (route === "home" ? "#/" : `#/${route}`);

export const readRoute = (hash: string): ToolRoute => {
  if (hash === "" || hash === "#" || hash === "#/") {
    return "home";
  }
  switch (hash) {
    case "#/merge":
      return "merge";
    case "#/split":
      return "split";
    case "#/images":
      return "images";
    default:
      return "not-found";
  }
};

export const routeTitles: Record<ToolRoute, string> = {
  home: "Home",
  merge: "Merge PDFs",
  split: "Split / Extract",
  images: "Images to PDF",
  "not-found": "Tool not found",
};
