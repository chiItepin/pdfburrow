import type { PDFDocument } from "pdf-lib";
import { PDFArray, PDFName, PDFNumber, PDFPageLeaf, PDFPageTree, PDFRef } from "pdf-lib";
import { PdfError } from "./pdfError.ts";

type PageNode = PDFPageTree | PDFPageLeaf;
type Visit =
  | { readonly kind: "enter"; readonly node: PageNode; readonly parent?: PDFPageTree }
  | { readonly kind: "count"; readonly expected: number; readonly start: number };

const invalidTree = (detail: string): never => {
  throw new PdfError(
    "invalid",
    `The PDF page tree is invalid (${detail}). Export a new copy using another PDF tool.`,
  );
};

export const inspectPageTree = (document: PDFDocument): number => {
  const root = document.catalog.lookup(PDFName.of("Pages"));
  if (!(root instanceof PDFPageTree)) {
    return invalidTree("missing page tree");
  }
  const pending: Visit[] = [{ kind: "enter", node: root }];
  const visited = new Set<PageNode>();
  let pageCount = 0;
  // Validate before pdf-lib's recursive traversal, which can skip invalid children.
  while (pending.length) {
    const visit = pending.pop();
    if (!visit) {
      break;
    }
    if (visit.kind === "count") {
      if (pageCount - visit.start !== visit.expected) {
        invalidTree("page count does not match its children");
      }
      continue;
    }
    const { node, parent } = visit;
    if (visited.has(node)) {
      invalidTree("repeated or cyclic page reference");
    }
    visited.add(node);
    if (node.lookup(PDFName.of("Parent")) !== parent) {
      invalidTree("inconsistent parent reference");
    }
    if (node instanceof PDFPageLeaf) {
      pageCount++;
      continue;
    }
    const kids = node.lookup(PDFName.of("Kids"));
    const count = node.lookup(PDFName.of("Count"));
    if (!(kids instanceof PDFArray) || !(count instanceof PDFNumber)) {
      return invalidTree("missing children or page count");
    }
    const expected = count.asNumber();
    if (!Number.isSafeInteger(expected) || expected < 0) {
      invalidTree("invalid page count");
    }
    pending.push({ kind: "count", expected, start: pageCount });
    for (let index = kids.size() - 1; index >= 0; index--) {
      const ref = kids.get(index);
      const child = document.context.lookup(ref);
      if (
        !(ref instanceof PDFRef) ||
        !(child instanceof PDFPageTree || child instanceof PDFPageLeaf)
      ) {
        return invalidTree("missing or invalid page child");
      }
      pending.push({ kind: "enter", node: child, parent: node });
    }
  }
  return pageCount;
};
