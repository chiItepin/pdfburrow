import { routePath } from "./routes";
import type { ToolRoute } from "./routes";

export type PageRoute = ToolRoute | "privacy" | "notices";

const pages: Record<PageRoute, { readonly title: string; readonly description: string }> = {
  home: {
    title: "PDFBurrow - Free PDF tools, no uploads",
    description:
      "Merge PDFs, split and extract pages, or convert JPEG and PNG images to PDF in your browser. Free local PDF tools with no uploads and no signup.",
  },
  merge: {
    title: "Merge PDFs locally, free and without uploads - PDFBurrow",
    description:
      "Combine PDF files into one PDF in your browser. Arrange files in your preferred order, keep page sizes and rotations, and download without uploading documents.",
  },
  split: {
    title: "Split PDF and extract pages without uploads - PDFBurrow",
    description:
      "Split a PDF, extract selected pages, or create PDFs from custom ranges in your browser. Download individual PDFs or a ZIP without uploading your document.",
  },
  images: {
    title: "Convert JPG and PNG images to PDF locally - PDFBurrow",
    description:
      "Turn JPEG and PNG images into PDFs in your browser. Arrange images and choose page layout, then download your PDFs. Free, with no uploads or signup.",
  },
  privacy: {
    title: "Privacy - PDFBurrow",
    description:
      "Learn how PDFBurrow processes documents locally, keeps work in tab memory, and separates document privacy from ordinary website hosting requests.",
  },
  notices: {
    title: "Licenses and notices - PDFBurrow",
    description:
      "Read PDFBurrow's development licensing status, third-party software notices, and locally distributed PDF.js decoder license information.",
  },
  "not-found": {
    title: "Tool not found - PDFBurrow",
    description: "This address does not identify a PDFBurrow tool. Choose an available PDF tool.",
  },
};

export const pageMetadata = (route: PageRoute, basePath: string, origin: string) => {
  const path =
    route === "privacy" || route === "notices"
      ? `${basePath}${route}.html`
      : routePath(route, basePath);
  return {
    ...pages[route],
    url: `${origin}${path}`,
    robots: route === "not-found" ? "noindex, follow" : "index, follow",
  };
};

export const structuredData = (route: PageRoute, basePath: string, origin: string) => {
  const metadata = pageMetadata(route, basePath, origin);
  if (route === "home") {
    return {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "PDFBurrow",
      url: metadata.url,
      description: metadata.description,
      inLanguage: "en",
    };
  }
  if (route === "merge" || route === "split" || route === "images") {
    return {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: `PDFBurrow - ${route === "merge" ? "Merge PDFs" : route === "split" ? "Split / Extract" : "Images to PDF"}`,
      url: metadata.url,
      description: metadata.description,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web browser",
      browserRequirements: "Requires JavaScript, module workers, and local file support.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    };
  }
  return null;
};
