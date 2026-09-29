import { renderToString } from "react-dom/server";
import { App } from "./App";
import { pageMetadata, structuredData } from "./workspace/pageMetadata";
import type { PageRoute } from "./workspace/pageMetadata";
import { siteBasePath, siteOrigin } from "./workspace/site";

export const renderPage = (route: PageRoute) => ({
  content:
    route === "privacy" || route === "notices" ? "" : renderToString(<App initialRoute={route} />),
  metadata: pageMetadata(route, siteBasePath, siteOrigin),
  schema: structuredData(route, siteBasePath, siteOrigin),
});
