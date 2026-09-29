import { renderToString } from "react-dom/server";
import { App } from "./App";
import { ThemeProvider } from "./workspace/ThemeProvider";
import type { ReactPage } from "./workspace/pageRegistry";

export { pageRegistry, pageFilename } from "./workspace/pageRegistry";
export { pageMetadata, structuredData } from "./workspace/pageMetadata";

export const renderPage = (page: ReactPage) =>
  renderToString(
    <ThemeProvider>
      <App initialRoute={page.route} />
    </ThemeProvider>,
  );
