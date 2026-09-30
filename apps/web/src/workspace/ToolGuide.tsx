import type { ToolRoute } from "./routes";

const guides = {
  merge: {
    title: "How to merge PDF files",
    steps: [
      "Add your PDF files and wait for local validation.",
      "Arrange whole files in the order you want, using Move up/down or dragging.",
      "Review the preservation notice, merge your PDFs, and choose Download PDF.",
    ],
    detail:
      "Each file contributes all its pages. The output keeps page sizes and rotations without rasterizing pages. Encrypted PDFs, forms, and detected digitally signed files are not supported; annotations, bookmarks, and other document features may not be preserved.",
  },
  split: {
    title: "How to split a PDF or extract pages",
    steps: [
      "Add one PDF and wait for local validation.",
      "Select and arrange pages, enter custom ranges, choose fixed page-count groups, or split every page.",
      "Review the predicted outputs and preservation notice, generate your PDFs, then download them individually or prepare a ZIP.",
    ],
    detail:
      "Selected pages can be arranged in a new order. Custom ranges can be combined into one PDF or saved separately. Splitting rewrites page content, not every document feature; encrypted PDFs, forms, and detected digital signatures are not supported.",
  },
  images: {
    title: "How to convert JPEG and PNG images to PDF",
    steps: [
      "Add static JPEG or PNG images and wait for local validation.",
      "Arrange the images, choose combined or separate PDFs, and adjust page size, orientation, margins, and fit.",
      "Generate your PDFs and explicitly download a PDF or prepare a ZIP for multiple outputs.",
    ],
    detail:
      "Conversion uses the original local images, not the optional thumbnails. Animated PNGs and unsupported image formats are rejected rather than silently converted. Large images can exhaust browser memory; workload limits are not yet calibrated.",
  },
};

export const ToolGuide = ({ route }: { route: ToolRoute }) => {
  if (route === "home" || route === "not-found") {
    return null;
  }
  const guide = guides[route];
  return (
    <section aria-labelledby="tool-guide-heading" className="border-t py-8">
      <h2 id="tool-guide-heading" className="text-xl font-semibold">
        {guide.title}
      </h2>
      <ol className="mt-3 max-w-prose list-decimal space-y-2 pl-6">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-4 max-w-prose text-sm text-muted-foreground">{guide.detail}</p>
    </section>
  );
};
