import type { ToolRoute } from "./routes";

const guides = {
  seal: {
    title: "How to seal or verify a PDF",
    steps: [
      "Choose a final PDF, then create a key with a long passphrase or unlock an encrypted key backup.",
      "Save the encrypted key backup, create a proof, and download it. Share the unchanged PDF and proof together.",
      "To verify, choose the PDF and proof, optionally supply a separately trusted key fingerprint, and select Verify proof.",
    ],
    detail:
      "ECDSA P-256 signs the SHA-256 document digest, byte count, approval statement, random nonce and public key in a versioned record. Proofs are detached, not PDF-reader certificate signatures. Keys and passwords are never automatically persisted. A valid proof alone does not verify identity, legal validity or signing time; independently confirm the signer fingerprint. PDF contents are not parsed or assessed for safety.",
  },
  markup: {
    title: "How to sign and annotate a PDF",
    steps: [
      "Add one supported PDF and wait for local validation.",
      "Draw a visual signature, add ink, highlights or text notes, and edit their placement.",
      "Review the limitations, generate a flattened PDF, then choose Download PDF.",
    ],
    detail:
      "Your edits live only in this tab. Signatures are visual marks, not digital signatures or identity guarantees. Existing page annotations (including links), encrypted files, forms and digital signatures are not supported. Reopening a downloaded copy does not restore editable markup.",
  },
  merge: {
    title: "How to merge PDF files",
    steps: [
      "Add your PDF files and wait for local validation.",
      "Arrange whole files in the order you want, using Move up/down or dragging.",
      "Review the preservation notice, merge your PDFs, and choose Download PDF.",
    ],
    detail:
      "Each file contributes all its pages. The output keeps page sizes and rotations without rasterizing pages. Supported form fields stay editable; same-named fields from separate inputs are renamed to stay independent. Review the downloaded PDF. Encrypted PDFs, XFA forms, and detected digitally signed files are not supported; annotations, bookmarks, and other document features may not be preserved.",
  },
  split: {
    title: "How to split a PDF or extract pages",
    steps: [
      "Add one PDF and wait for local validation.",
      "Select and arrange pages, enter ranges, choose fixed groups, split every page, or choose Page sets.",
      "Review the preservation notice. Generate outputs in the existing operations, or use Your downloads in Page sets to download one PDF at a time.",
    ],
    detail:
      "In Page sets, every page starts as a separate PDF. Select pages and choose Group into one PDF to download them together, or Separate pages to restore individual PDFs. Your downloads labels each PDF by its original page numbers, in export order. Each Download PDF creates only that document; other operations offer individual downloads or a ZIP after generation. Selected pages can be reordered, and custom ranges combined or saved separately. Supported form fields on exported pages stay editable, with their current values. Review the downloaded PDF. Encrypted PDFs, XFA forms, and detected digital signatures are not supported.",
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
  remove: {
    title: "How to remove pages from a PDF",
    steps: [
      "Add one PDF and wait for local validation.",
      "Select the pages to remove. Keep at least one page; the remaining pages stay in source order.",
      "Review the output prediction and preservation notice, select Remove pages, then download your new PDF.",
    ],
    detail:
      "Your original stays unchanged. Removal rewrites the remaining pages without rasterizing them. Supported form fields on remaining pages stay editable, with their current values. Review the downloaded PDF. Annotations, bookmarks, and other document features may not be preserved. Encrypted PDFs, XFA forms, and detected digital signatures are not supported.",
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
