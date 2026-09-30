import { pagePath } from "./pageRegistry.ts";
import type { PageDefinition } from "./pageRegistry.ts";

export const pageMetadata = (page: PageDefinition, basePath: string, origin: string) => ({
  title: page.title,
  description: page.description,
  url: `${origin}${pagePath(page, basePath)}`,
  robots: page.indexable ? "index, follow" : "noindex, follow",
});

export const structuredData = (page: PageDefinition, basePath: string, origin: string) => {
  if (!page.schema) {
    return null;
  }
  const metadata = pageMetadata(page, basePath, origin);
  const common = {
    "@context": "https://schema.org",
    "@type": page.schema.type,
    name: page.schema.name,
    url: metadata.url,
    description: metadata.description,
  };
  if (page.schema.type === "WebSite") {
    return {
      ...common,
      inLanguage: "en",
    };
  }
  return {
    ...common,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web browser",
    browserRequirements: "Requires JavaScript, module workers, and local file support.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
};
