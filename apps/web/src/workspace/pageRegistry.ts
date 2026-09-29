interface PageDetails {
  readonly route: string;
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly indexable: boolean;
  readonly schema: {
    readonly type: "WebSite" | "SoftwareApplication";
    readonly name: string;
  } | null;
}

export type PageDefinition = PageDetails &
  (
    | { readonly source: "react"; readonly legacyHash: string | null }
    | { readonly source: "html"; readonly template: string }
  );

export const pageRegistry = [
  {
    route: "home",
    path: "",
    source: "react",
    legacyHash: "#/",
    title: "PDFBurrow - Free PDF tools, no uploads",
    description:
      "Merge PDFs, split and extract pages, or convert JPEG and PNG images to PDF in your browser. Free local PDF tools with no uploads and no signup.",
    indexable: true,
    schema: { type: "WebSite", name: "PDFBurrow" },
  },
  {
    route: "merge",
    path: "merge/",
    source: "react",
    legacyHash: "#/merge",
    title: "Merge PDFs locally, free and without uploads - PDFBurrow",
    description:
      "Combine PDF files into one PDF in your browser. Arrange files in your preferred order, keep page sizes and rotations, and download without uploading documents.",
    indexable: true,
    schema: { type: "SoftwareApplication", name: "PDFBurrow - Merge PDFs" },
  },
  {
    route: "split",
    path: "split/",
    source: "react",
    legacyHash: "#/split",
    title: "Split PDF and extract pages without uploads - PDFBurrow",
    description:
      "Split a PDF, extract selected pages, or create PDFs from custom ranges in your browser. Download individual PDFs or a ZIP without uploading your document.",
    indexable: true,
    schema: { type: "SoftwareApplication", name: "PDFBurrow - Split / Extract" },
  },
  {
    route: "images",
    path: "images/",
    source: "react",
    legacyHash: "#/images",
    title: "Convert JPG and PNG images to PDF locally - PDFBurrow",
    description:
      "Turn JPEG and PNG images into PDFs in your browser. Arrange images and choose page layout, then download your PDFs. Free, with no uploads or signup.",
    indexable: true,
    schema: { type: "SoftwareApplication", name: "PDFBurrow - Images to PDF" },
  },
  {
    route: "privacy",
    path: "privacy.html",
    source: "html",
    template: "privacy.html",
    title: "Privacy - PDFBurrow",
    description:
      "Learn how PDFBurrow processes documents locally, keeps work in tab memory, and separates document privacy from ordinary website hosting requests.",
    indexable: true,
    schema: null,
  },
  {
    route: "notices",
    path: "notices.html",
    source: "html",
    template: "notices.html",
    title: "Licenses and notices - PDFBurrow",
    description:
      "Read PDFBurrow's development licensing status, third-party software notices, and locally distributed PDF.js decoder license information.",
    indexable: true,
    schema: null,
  },
  {
    route: "not-found",
    path: "404.html",
    source: "react",
    legacyHash: null,
    title: "Tool not found - PDFBurrow",
    description: "This address does not identify a PDFBurrow tool. Choose an available PDF tool.",
    indexable: false,
    schema: null,
  },
] as const satisfies readonly PageDefinition[];

export type Page = (typeof pageRegistry)[number];
export type PageRoute = Page["route"];
export type ReactPage = Extract<Page, { source: "react" }>;

export const getPage = (route: PageRoute): Page => {
  const page = pageRegistry.find((page) => page.route === route);
  if (!page) {
    throw new Error(`Unknown page route: ${route}`);
  }
  return page;
};

export const pagePath = (page: PageDefinition, basePath: string) => `${basePath}${page.path}`;

export const pageFilename = (page: PageDefinition) =>
  page.path === "" || page.path.endsWith("/") ? `${page.path}index.html` : page.path;
