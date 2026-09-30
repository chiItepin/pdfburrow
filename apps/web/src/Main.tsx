import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { App } from "@/App";
import { ThemeProvider } from "./workspace/ThemeProvider";
import { pageRegistry } from "./workspace/pageRegistry";

const root = document.getElementById("root");
if (!root) {
  throw new Error("The application root is missing.");
}

const page = pageRegistry.find((page) => page.route === root.dataset.pageRoute);
if (!page || page.source !== "react") {
  throw new Error("The prerendered application route is missing or invalid.");
}

hydrateRoot(
  root,
  <StrictMode>
    <ThemeProvider>
      <App initialRoute={page.route} />
    </ThemeProvider>
  </StrictMode>,
);
